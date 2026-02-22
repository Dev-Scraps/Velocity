use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;

use crate::services::{
    CookieManager, CookieValidationResult, DownloadTask, DownloadType, DownloadWorker,
    MetadataService, PlaylistContent, PlaylistDiscovery, YtDlpClient, YtDlpInfoClient,
    YtDlpManager,
};

#[tauri::command]
pub async fn ytdlp_get_video_metadata(
    url: String,
    _cookies: Option<String>,
    state: State<'_, Mutex<YtDlpInfoClient>>,
) -> Result<serde_json::Value, String> {
    if url.trim().is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    let client = state.lock().await;

    // Ignore cookies for metadata fetching
    let result = client.extract_info(&url, None).await.map_err(|e| {
        log::error!("Failed to extract metadata for {}: {}", url, e);
        format!("Failed to extract metadata: {}", e)
    })?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_playlist_metadata(
    playlist_id: String,
    cookies: Option<String>,
    state: State<'_, Mutex<PlaylistContent>>,
) -> Result<crate::services::PlaylistContentResponse, String> {
    let playlist_content = state.lock().await;

    let cookies_map = if let Some(cookies_str) = cookies {
        Some(parse_cookies_string(&cookies_str)?)
    } else {
        None
    };

    let result = playlist_content
        .get_items(&playlist_id, cookies_map, true)
        .await
        .map_err(|e| format!("Failed to extract playlist: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_playlist_detailed(
    playlist_id: String,
    cookies: String,
    state: State<'_, Mutex<PlaylistContent>>,
) -> Result<crate::services::PlaylistContentResponse, String> {
    let playlist_content = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    let result = playlist_content
        .get_items_detailed(&playlist_id, Some(cookies_map), true)
        .await
        .map_err(|e| format!("Failed to extract detailed playlist: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_search_videos(
    query: String,
    max_results: i32,
    cookies: Option<String>,
    state: State<'_, Mutex<YtDlpClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    let url = format!("ytsearch{}:{}", max_results, query);

    let cookies_map = if let Some(cookies_str) = cookies {
        Some(parse_cookies_string(&cookies_str)?)
    } else {
        None
    };

    let result = client
        .extract(&url, true, cookies_map)
        .await
        .map_err(|e| format!("Failed to search videos: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_video_formats(
    url: String,
    _cookies: Option<String>,
    state: State<'_, Mutex<YtDlpInfoClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    // Ignore cookies for format fetching as requested
    let result = client
        .extract_info(&url, None)
        .await
        .map_err(|e| format!("Failed to get formats: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_resolve_stream(
    url: String,
    quality: String,
    _cookies: Option<String>,
    state: State<'_, Mutex<YtDlpInfoClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    // Ignore cookies for stream resolution
    let result = client
        .extract_info(&url, None)
        .await
        .map_err(|e| format!("Failed to resolve stream: {}", e))?;

    let formats = result
        .get("formats")
        .and_then(|f| f.as_array())
        .ok_or("No formats found")?;

    let quality_num: u32 = quality.trim_end_matches('p').parse().unwrap_or(1080);

    let mut video_url = None;
    let mut audio_url = None;
    let mut subtitle_urls = Vec::new();

    for fmt in formats {
        if video_url.is_none()
            && fmt
                .get("vcodec")
                .and_then(|v: &serde_json::Value| v.as_str())
                != Some("none")
        {
            if let Some(height) = fmt
                .get("height")
                .and_then(|h: &serde_json::Value| h.as_u64())
            {
                if height as u32 <= quality_num {
                    video_url = fmt
                        .get("url")
                        .and_then(|u: &serde_json::Value| u.as_str())
                        .map(|s: &str| s.to_string());
                }
            }
        }

        if audio_url.is_none()
            && fmt
                .get("acodec")
                .and_then(|a: &serde_json::Value| a.as_str())
                != Some("none")
        {
            audio_url = fmt
                .get("url")
                .and_then(|u: &serde_json::Value| u.as_str())
                .map(|s: &str| s.to_string());
        }

        if video_url.is_some() && audio_url.is_some() {
            break;
        }
    }

    if let Some(subtitles) = result
        .get("subtitles")
        .and_then(|s: &serde_json::Value| s.as_object())
    {
        for (_lang, subs) in subtitles {
            if let Some(subs_array) = subs.as_array() {
                if let Some(first_sub) = subs_array.first() {
                    if let Some(url) = first_sub
                        .get("url")
                        .and_then(|u: &serde_json::Value| u.as_str())
                    {
                        subtitle_urls.push(url.to_string());
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "video_url": video_url,
        "audio_url": audio_url,
        "subtitle_urls": subtitle_urls,
        "expiry": 0
    }))
}

#[tauri::command]
pub async fn ytdlp_download_video(
    url: String,
    output_dir: String,
    cookies: Option<String>,
    min_height: Option<u32>,
    preferred_format: Option<String>,
    state: State<'_, Mutex<YtDlpManager>>,
) -> Result<crate::services::DownloadResult, String> {
    if url.trim().is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    if output_dir.trim().is_empty() {
        return Err("Output directory cannot be empty".to_string());
    }

    let manager = state.lock().await;

    let output_path = PathBuf::from(&output_dir);

    // Validate output directory
    if !output_path.exists() {
        log::info!("Creating output directory: {:?}", output_path);
        tokio::fs::create_dir_all(&output_path)
            .await
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let min_height = min_height.unwrap_or(720);
    let preferred_format = preferred_format.unwrap_or_else(|| "mp4".to_string());

    log::info!(
        "Starting download: url={}, quality={}p, format={}",
        url,
        min_height,
        preferred_format
    );

    let result = manager
        .download_high_res(&url, &output_path, cookies, min_height, &preferred_format)
        .await
        .map_err(|e| {
            log::error!("Download failed for {}: {}", url, e);
            format!(
                "Download failed: {}. Please check your internet connection and try again.",
                e
            )
        })?;

    log::info!("Download completed successfully: {:?}", result.file_path);

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_download_audio(
    url: String,
    output_dir: String,
    cookies: Option<String>,
    state: State<'_, Mutex<YtDlpManager>>,
) -> Result<crate::services::DownloadResult, String> {
    let manager = state.lock().await;

    let output_path = PathBuf::from(output_dir);

    let result = manager
        .download_audio(&url, &output_path, cookies)
        .await
        .map_err(|e| format!("Audio download failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_download_with_worker(
    url: String,
    output_dir: Option<String>,
    download_type: String,
    cookies: Option<String>,
    min_height: Option<u32>,
    preferred_format: Option<String>,
    state: State<'_, Mutex<DownloadWorker>>,
) -> Result<crate::services::DownloadStatus, String> {
    let worker = state.lock().await;

    let download_type = match download_type.as_str() {
        "audio" => DownloadType::Audio,
        "separate_streams" => DownloadType::SeparateStreams,
        _ => DownloadType::Video,
    };

    let task = DownloadTask {
        id: uuid::Uuid::new_v4().to_string(),
        url,
        download_type,
        output_dir,
        format_ids: None,
        cookies,
        min_height,
        preferred_format,
    };

    let result = worker
        .download(task)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_liked_videos(
    cookies: String,
    _max_results: Option<i32>,
    state: State<'_, Mutex<YtDlpClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    let url = "https://www.youtube.com/playlist?list=LL".to_string();

    let result = client
        .extract(&url, true, Some(cookies_map))
        .await
        .map_err(|e| format!("Failed to get liked videos: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_user_playlists(
    cookies: String,
    state: State<'_, Mutex<PlaylistDiscovery>>,
) -> Result<crate::services::PlaylistDiscoveryResponse, String> {
    let discovery = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    let result = discovery
        .discover(Some(cookies_map))
        .await
        .map_err(|e| format!("Failed to get user playlists: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_validate_cookies(cookies: String) -> Result<CookieValidationResult, String> {
    if cookies.trim().is_empty() {
        return Ok(CookieValidationResult {
            is_valid: false,
            message: "Cookies cannot be empty".to_string(),
            auth_cookies: vec![],
            identity_cookies: vec![],
        });
    }

    let cookies_map = match parse_cookies_string(&cookies) {
        Ok(map) => map,
        Err(e) => {
            return Ok(CookieValidationResult {
                is_valid: false,
                message: e,
                auth_cookies: vec![],
                identity_cookies: vec![],
            });
        }
    };

    let result = CookieManager::validate_cookies(&Some(cookies_map.clone()));

    log::info!(
        "Cookie validation result: is_valid={}, auth_cookies={}, identity_cookies={}",
        result.is_valid,
        result.auth_cookies.len(),
        result.identity_cookies.len()
    );

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_clear_cache(state: State<'_, Mutex<YtDlpClient>>) -> Result<(), String> {
    log::info!("Clearing yt-dlp cache");
    let client = state.lock().await;
    client.clear_cache().await;
    log::info!("Cache cleared successfully");
    Ok(())
}

#[tauri::command]
pub async fn ytdlp_set_ffmpeg_path(
    path: String,
    state: State<'_, Mutex<YtDlpClient>>,
) -> Result<(), String> {
    let mut client = state.lock().await;
    client.set_ffmpeg_path(PathBuf::from(path));
    Ok(())
}

#[tauri::command]
pub async fn ytdlp_get_video_info(
    url: String,
    cookies: Option<String>,
    state: State<'_, Mutex<MetadataService>>,
) -> Result<crate::services::VideoMetadata, String> {
    let metadata_service = state.lock().await;

    let cookies_map = if let Some(cookies_str) = cookies {
        Some(parse_cookies_string(&cookies_str)?)
    } else {
        None
    };

    let result = metadata_service
        .get_video_info(&url, cookies_map)
        .await
        .map_err(|e| format!("Failed to get video info: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn ytdlp_get_playlist_info(
    playlist_id: String,
    cookies: Option<String>,
    state: State<'_, Mutex<MetadataService>>,
) -> Result<crate::services::PlaylistMetadata, String> {
    let metadata_service = state.lock().await;

    let cookies_map = if let Some(cookies_str) = cookies {
        Some(parse_cookies_string(&cookies_str)?)
    } else {
        None
    };

    let result = metadata_service
        .get_playlist_info(&playlist_id, cookies_map)
        .await
        .map_err(|e| format!("Failed to get playlist info: {}", e))?;

    Ok(result)
}

fn parse_cookies_string(cookies_str: &str) -> Result<HashMap<String, String>, String> {
    let mut cookies_map = HashMap::new();
    let mut line_count = 0;
    let mut valid_cookies = 0;

    for line in cookies_str.lines() {
        line_count += 1;
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse Netscape format (tab-separated)
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 7 {
            let domain = parts[0];
            let name = parts[5];
            let value = parts[6];

            // Validate domain and cookie name
            if (domain.contains("youtube.com") || domain.contains("google.com"))
                && !name.is_empty()
                && !value.is_empty()
            {
                cookies_map.insert(name.to_string(), value.to_string());
                valid_cookies += 1;
            }
        } else if line.contains('=') {
            // Try parsing key=value format as fallback
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim();
                if !key.is_empty() && !value.is_empty() {
                    cookies_map.insert(key.to_string(), value.to_string());
                    valid_cookies += 1;
                }
            }
        }
    }

    log::info!(
        "Cookie parsing: {} lines processed, {} valid cookies extracted",
        line_count,
        valid_cookies
    );

    if cookies_map.is_empty() {
        return Err(
            "No valid cookies found. Please ensure the cookie file is in Netscape format."
                .to_string(),
        );
    }

    // Validate essential YouTube cookies are present
    let essential_cookies = ["SAPISID", "HSID", "SSID", "APISID", "SID"];
    let has_essential = essential_cookies
        .iter()
        .any(|cookie| cookies_map.contains_key(*cookie));

    if !has_essential {
        log::warn!("No essential YouTube authentication cookies found");
    }

    Ok(cookies_map)
}
