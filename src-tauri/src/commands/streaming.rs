use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::services::{CookieManager, YtDlpInfoClient, PlaylistContent};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamMode {
    Audio,
    Av,
}

fn is_hls_format(format: &Value) -> bool {
    let protocol = format
        .get("protocol")
        .and_then(|p| p.as_str())
        .unwrap_or("");
    if protocol.contains("m3u8") {
        return true;
    }

    let url = format.get("url").and_then(|u| u.as_str()).unwrap_or("");
    url.contains("m3u8") || url.contains("hls_playlist")
}

fn is_hls_url(url: &str) -> bool {
    url.contains("m3u8") || url.contains("hls_playlist")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResolveResponse {
    pub video_url: Option<String>,
    pub audio_url: Option<String>,
    pub muxed_url: Option<String>,
    pub subtitles: Vec<SubtitleTrack>,
    pub captions: Vec<SubtitleTrack>,
    pub audio_tracks: Vec<AudioTrack>,
    pub selected_format_id: Option<String>,
    pub selected_video_format_id: Option<String>,
    pub selected_audio_format_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleTrack {
    pub language: String,
    pub name: Option<String>,
    pub url: String,
    pub ext: Option<String>,
    pub automatic: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrack {
    pub format_id: String,
    pub language: Option<String>,
    pub name: Option<String>,
    pub abr: Option<f64>,
    pub url: String,
    pub ext: Option<String>,
    pub acodec: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamFormatsResponse {
    pub formats: Vec<Value>,
    pub subtitles: Vec<SubtitleTrack>,
    pub captions: Vec<SubtitleTrack>,
    pub audio_tracks: Vec<AudioTrack>,
}

#[tauri::command]
pub async fn stream_get_formats(
    url: String,
    cookies: Option<String>,
    state: State<'_, Mutex<YtDlpInfoClient>>,
) -> Result<StreamFormatsResponse, String> {
    let client = state.lock().await;
    let (cookies_path, temp_file_path) = build_cookie_file(cookies)?;

    let metadata = client
        .extract_info(&url, cookies_path)
        .await
        .map_err(|e| format!("Failed to get formats: {}", e))?;

    if let Some(path) = temp_file_path {
        let _ = std::fs::remove_file(path);
    }

    let formats = metadata
        .get("formats")
        .and_then(|f| f.as_array())
        .cloned()
        .unwrap_or_default();

    let (subtitles, captions) = extract_subtitles(&metadata);
    let audio_tracks = extract_audio_tracks(&formats);

    Ok(StreamFormatsResponse {
        formats,
        subtitles,
        captions,
        audio_tracks,
    })
}

#[tauri::command]
pub async fn stream_resolve(
    url: String,
    mode: StreamMode,
    cookies: Option<String>,
    state: State<'_, Mutex<YtDlpInfoClient>>,
) -> Result<StreamResolveResponse, String> {
    let client = state.lock().await;
    let (cookies_path, temp_file_path) = build_cookie_file(cookies)?;

    let metadata = client
        .extract_info(&url, cookies_path.clone())
        .await
        .map_err(|e| format!("Failed to resolve stream: {}", e))?;

    if let Some(path) = temp_file_path {
        let _ = std::fs::remove_file(path);
    }

    let formats = metadata
        .get("formats")
        .and_then(|f| f.as_array())
        .cloned()
        .unwrap_or_default();

    let (subtitles, captions) = extract_subtitles(&metadata);
    let audio_tracks = extract_audio_tracks(&formats);

    let mut selection = match mode {
        StreamMode::Audio => pick_best_audio(&formats),
        StreamMode::Av => pick_best_av(&formats),
    };

    if let Some(audio_url) = selection.audio_url.clone() {
        if is_hls_url(&audio_url) {
            if let Ok(Some(direct_url)) = client
                .get_direct_url(&url, cookies_path.clone(), "bestaudio[protocol!=m3u8]/bestaudio")
                .await
            {
                selection.audio_url = Some(direct_url);
            }
        }
    } else if let Ok(Some(direct_url)) = client
        .get_direct_url(&url, cookies_path.clone(), "bestaudio[protocol!=m3u8]/bestaudio")
        .await
    {
        selection.audio_url = Some(direct_url);
    }

    Ok(StreamResolveResponse {
        video_url: selection.video_url,
        audio_url: selection.audio_url,
        muxed_url: None,
        subtitles,
        captions,
        audio_tracks,
        selected_format_id: selection.format_id,
        selected_video_format_id: selection.video_format_id,
        selected_audio_format_id: selection.audio_format_id,
    })
}

#[tauri::command]
pub async fn stream_get_playlist_entries(
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

    playlist_content
        .get_items_detailed(&playlist_id, cookies_map, true)
        .await
        .map_err(|e| format!("Failed to extract playlist: {}", e))
}

#[derive(Default)]
struct StreamSelection {
    format_id: Option<String>,
    video_format_id: Option<String>,
    audio_format_id: Option<String>,
    video_url: Option<String>,
    audio_url: Option<String>,
}

fn pick_best_audio(formats: &[Value]) -> StreamSelection {
    let mut best: Option<(f64, String, String, String)> = None;

    for format in formats.iter().filter(|f| !is_hls_format(f)) {
        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        if vcodec != "none" || acodec == "none" {
            continue;
        }

        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let abr = format.get("abr").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let format_id = format
            .get("format_id")
            .and_then(|f| f.as_str())
            .unwrap_or_default()
            .to_string();
        let ext = format
            .get("ext")
            .and_then(|f| f.as_str())
            .unwrap_or_default();

        let score = abr;
        let current = (score, format_id, url.to_string(), ext.to_string());
        if best.as_ref().map(|b| b.0).unwrap_or(-1.0) < score {
            best = Some(current);
        }
    }

    if let Some((_, format_id, url, _ext)) = best {
        StreamSelection {
            format_id: Some(format_id.clone()),
            audio_format_id: Some(format_id),
            audio_url: Some(url),
            ..Default::default()
        }
    } else {
        let hls_fallback = pick_best_audio_allow_hls(formats);
        if hls_fallback.audio_url.is_some() {
            hls_fallback
        } else {
            pick_best_audio_fallback(formats)
        }
    }
}

fn pick_best_audio_allow_hls(formats: &[Value]) -> StreamSelection {
    let mut best: Option<(f64, String, String, String)> = None;

    for format in formats.iter() {
        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        if vcodec != "none" || acodec == "none" {
            continue;
        }

        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let abr = format.get("abr").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let format_id = format
            .get("format_id")
            .and_then(|f| f.as_str())
            .unwrap_or_default()
            .to_string();
        let ext = format
            .get("ext")
            .and_then(|f| f.as_str())
            .unwrap_or_default();

        let score = abr;
        let current = (score, format_id, url.to_string(), ext.to_string());
        if best.as_ref().map(|b| b.0).unwrap_or(-1.0) < score {
            best = Some(current);
        }
    }

    if let Some((_, format_id, url, _ext)) = best {
        StreamSelection {
            format_id: Some(format_id.clone()),
            audio_format_id: Some(format_id),
            audio_url: Some(url),
            ..Default::default()
        }
    } else {
        StreamSelection::default()
    }
}

fn pick_best_av(formats: &[Value]) -> StreamSelection {
    let mut best_progressive: Option<(u64, f64, String, String)> = None;
    let mut best_video: Option<(u64, f64, String, String)> = None;

    for format in formats.iter().filter(|f| !is_hls_format(f)) {
        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        let height = format.get("height").and_then(|h| h.as_u64()).unwrap_or(0);
        let tbr = format.get("tbr").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let format_id = format
            .get("format_id")
            .and_then(|f| f.as_str())
            .unwrap_or_default()
            .to_string();

        if vcodec != "none" && acodec != "none" {
            let score = (height, tbr, format_id.clone(), url.to_string());
            if best_progressive
                .as_ref()
                .map(|b| (b.0, b.1))
                .unwrap_or((0, 0.0))
                < (height, tbr)
            {
                best_progressive = Some(score);
            }
        } else if vcodec != "none" && acodec == "none" {
            let score = (height, tbr, format_id.clone(), url.to_string());
            if best_video
                .as_ref()
                .map(|b| (b.0, b.1))
                .unwrap_or((0, 0.0))
                < (height, tbr)
            {
                best_video = Some(score);
            }
        }
    }

    if let Some((_height, _tbr, format_id, url)) = best_progressive {
        return StreamSelection {
            format_id: Some(format_id.clone()),
            video_format_id: Some(format_id),
            video_url: Some(url.clone()),
            audio_url: Some(url),
            ..Default::default()
        };
    }

    let audio_selection = pick_best_audio(formats);
    if let (Some((_height, _tbr, video_format_id, video_url)), Some(audio_format_id), Some(audio_url)) =
        (best_video, audio_selection.audio_format_id.clone(), audio_selection.audio_url.clone())
    {
        return StreamSelection {
            format_id: Some(format!("{}+{}", video_format_id, audio_format_id)),
            video_format_id: Some(video_format_id),
            audio_format_id: Some(audio_format_id),
            video_url: Some(video_url),
            audio_url: Some(audio_url),
        };
    }

    pick_best_av_fallback(formats)
}

fn pick_best_audio_fallback(formats: &[Value]) -> StreamSelection {
    let mut best: Option<(f64, String, String, String)> = None;
    for format in formats {
        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        if vcodec != "none" || acodec == "none" {
            continue;
        }

        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let abr = format.get("abr").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let format_id = format
            .get("format_id")
            .and_then(|f| f.as_str())
            .unwrap_or_default()
            .to_string();
        let ext = format
            .get("ext")
            .and_then(|f| f.as_str())
            .unwrap_or_default();

        let score = abr;
        let current = (score, format_id, url.to_string(), ext.to_string());
        if best.as_ref().map(|b| b.0).unwrap_or(-1.0) < score {
            best = Some(current);
        }
    }

    if let Some((_, format_id, url, _ext)) = best {
        StreamSelection {
            format_id: Some(format_id.clone()),
            audio_format_id: Some(format_id),
            audio_url: Some(url),
            ..Default::default()
        }
    } else {
        StreamSelection::default()
    }
}

fn pick_best_av_fallback(formats: &[Value]) -> StreamSelection {
    let mut best_progressive: Option<(u64, f64, String, String)> = None;
    let mut best_video: Option<(u64, f64, String, String)> = None;

    for format in formats {
        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        let height = format.get("height").and_then(|h| h.as_u64()).unwrap_or(0);
        let tbr = format.get("tbr").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let format_id = format
            .get("format_id")
            .and_then(|f| f.as_str())
            .unwrap_or_default()
            .to_string();

        if vcodec != "none" && acodec != "none" {
            let score = (height, tbr, format_id.clone(), url.to_string());
            if best_progressive
                .as_ref()
                .map(|b| (b.0, b.1))
                .unwrap_or((0, 0.0))
                < (height, tbr)
            {
                best_progressive = Some(score);
            }
        } else if vcodec != "none" && acodec == "none" {
            let score = (height, tbr, format_id.clone(), url.to_string());
            if best_video
                .as_ref()
                .map(|b| (b.0, b.1))
                .unwrap_or((0, 0.0))
                < (height, tbr)
            {
                best_video = Some(score);
            }
        }
    }

    if let Some((_height, _tbr, format_id, url)) = best_progressive {
        return StreamSelection {
            format_id: Some(format_id.clone()),
            video_format_id: Some(format_id),
            video_url: Some(url.clone()),
            audio_url: Some(url),
            ..Default::default()
        };
    }

    let audio_selection = pick_best_audio_fallback(formats);
    if let (Some((_height, _tbr, video_format_id, video_url)), Some(audio_format_id), Some(audio_url)) =
        (best_video, audio_selection.audio_format_id.clone(), audio_selection.audio_url.clone())
    {
        return StreamSelection {
            format_id: Some(format!("{}+{}", video_format_id, audio_format_id)),
            video_format_id: Some(video_format_id),
            audio_format_id: Some(audio_format_id),
            video_url: Some(video_url),
            audio_url: Some(audio_url),
        };
    }

    StreamSelection::default()
}

fn extract_audio_tracks(formats: &[Value]) -> Vec<AudioTrack> {
    let mut tracks = Vec::new();
    for format in formats {
        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        if vcodec != "none" || acodec == "none" {
            continue;
        }

        let url = match format.get("url").and_then(|u| u.as_str()) {
            Some(u) if !u.is_empty() => u.to_string(),
            _ => continue,
        };

        tracks.push(AudioTrack {
            format_id: format
                .get("format_id")
                .and_then(|f| f.as_str())
                .unwrap_or_default()
                .to_string(),
            language: format
                .get("language")
                .and_then(|l| l.as_str())
                .map(|l| l.to_string()),
            name: format
                .get("format_note")
                .and_then(|n| n.as_str())
                .map(|n| n.to_string()),
            abr: format.get("abr").and_then(|v| v.as_f64()),
            url,
            ext: format
                .get("ext")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string()),
            acodec: format
                .get("acodec")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string()),
        });
    }

    tracks
}

fn extract_subtitles(metadata: &Value) -> (Vec<SubtitleTrack>, Vec<SubtitleTrack>) {
    let subtitles = parse_subtitle_map(metadata.get("subtitles"), false);
    let captions = parse_subtitle_map(metadata.get("automatic_captions"), true);
    (subtitles, captions)
}

fn parse_subtitle_map(value: Option<&Value>, automatic: bool) -> Vec<SubtitleTrack> {
    let mut tracks = Vec::new();
    let Some(map) = value.and_then(|v| v.as_object()) else {
        return tracks;
    };

    for (language, entries) in map {
        let Some(entries) = entries.as_array() else {
            continue;
        };
        for entry in entries {
            let Some(url) = entry.get("url").and_then(|u| u.as_str()) else {
                continue;
            };
            tracks.push(SubtitleTrack {
                language: language.clone(),
                name: entry
                    .get("name")
                    .and_then(|n| n.as_str())
                    .map(|n| n.to_string()),
                url: url.to_string(),
                ext: entry
                    .get("ext")
                    .and_then(|e| e.as_str())
                    .map(|e| e.to_string()),
                automatic,
            });
        }
    }

    tracks
}

fn build_cookie_file(cookies: Option<String>) -> Result<(Option<std::path::PathBuf>, Option<std::path::PathBuf>), String> {
    if let Some(cookies_content) = cookies {
        if cookies_content.is_empty() {
            return Ok((None, None));
        }

        let temp_dir = std::env::temp_dir();
        let file_name = format!("velocity_stream_cookies_{}.txt", Uuid::new_v4());
        let file_path = temp_dir.join(file_name);

        let cookie_map = if cookies_content.contains("Netscape") || cookies_content.contains('\t') {
            CookieManager::parse_netscape_format(&cookies_content).map_err(|e| e.to_string())?
        } else if cookies_content.trim_start().starts_with('{') || cookies_content.trim_start().starts_with('[') {
            CookieManager::parse_json_format(&cookies_content).map_err(|e| e.to_string())?
        } else {
            CookieManager::extract_to_dict(&cookies_content)
        };

        let netscape = CookieManager::dict_to_netscape(&cookie_map);
        if let Err(err) = std::fs::write(&file_path, netscape) {
            return Err(format!("Failed to write cookies file: {}", err));
        }

        Ok((Some(file_path.clone()), Some(file_path)))
    } else {
        Ok((None, None))
    }
}

fn parse_cookies_string(cookies_str: &str) -> Result<std::collections::HashMap<String, String>, String> {
    if cookies_str.trim().is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let cookies_map = if cookies_str.contains("Netscape") || cookies_str.contains('\t') {
        CookieManager::parse_netscape_format(cookies_str).map_err(|e| e.to_string())?
    } else if cookies_str.trim_start().starts_with('{') || cookies_str.trim_start().starts_with('[') {
        CookieManager::parse_json_format(cookies_str).map_err(|e| e.to_string())?
    } else {
        CookieManager::extract_to_dict(cookies_str)
    };

    Ok(cookies_map)
}
