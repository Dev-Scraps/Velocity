pub mod settings;
pub mod ytdlp;
pub mod aria2;
pub mod streaming;

use crate::find_ytdlp;
use crate::find_ffmpeg;
use crate::models::{DownloadHistoryItem, DownloadTask, Playlist, StreamInfo, Video, VideoInfo};
use crate::services::{
    AppState, CookieManager, Database, DownloadManager, DownloadTaskInfo, PlaylistDiscovery,
    YtDlpClient, YtDlpInfoClient,
};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

fn parse_cookies_string(
    cookies_str: &str,
) -> Result<std::collections::HashMap<String, String>, String> {
    log::trace!(
        "Parsing cookies from string ({} bytes)",
        cookies_str.len()
    );

    let essential_cookie_names = [
        "SAPISID",
        "HSID",
        "SSID",
        "APISID",
        "SID",
        "__Secure-1PAPISID",
        "__Secure-3PAPISID",
        "__Secure-1PSID",
        "__Secure-3PSID",
        "LOGIN_INFO",
        "PREF",
        "VISITOR_INFO1_LIVE",
        "YSC",
        "CONSENT",
        "__Secure-1PSIDTS",
        "__Secure-3PSIDTS",
        "__Secure-1PSIDCC",
        "__Secure-3PSIDCC",
        "SIDCC",
        "__Secure-ROLLOUT_TOKEN",
        "AEC",
        "NID",
    ];

    let mut cookies_map: std::collections::HashMap<String, String> =
        if cookies_str.contains("Netscape") || cookies_str.contains('\t') {
        CookieManager::parse_netscape_format(cookies_str).map_err(|e| e.to_string())?
    } else if cookies_str.trim_start().starts_with('{') || cookies_str.trim_start().starts_with('[')
    {
        CookieManager::parse_json_format(cookies_str).map_err(|e| e.to_string())?
    } else {
        std::collections::HashMap::new()
    };

    if cookies_map.is_empty() {
        for line in cookies_str.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some((key, value)) = trimmed.split_once('=') {
                let key = key.trim();
                let value = value.trim();
                if !key.is_empty() && !value.is_empty() {
                    cookies_map.insert(key.to_string(), value.to_string());
                }
            }
        }
    }

    cookies_map
        .retain(|key, value| !value.is_empty() && essential_cookie_names.contains(&key.as_str()));

    let core_auth = ["SAPISID", "HSID", "SSID", "APISID", "SID"];
    let missing_core: Vec<&str> = core_auth
        .iter()
        .cloned()
        .filter(|name| !cookies_map.contains_key(*name))
        .collect();

    log::trace!("Parsed {} cookies from string", cookies_map.len());

    if !missing_core.is_empty() {
        return Err(format!(
            "Missing required YouTube auth cookies: {}. Please export cookies from youtube.com while logged in.",
            missing_core.join(", ")
        ));
    }

    Ok(cookies_map)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct VideoResponse {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub uploader: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(alias = "duration")]
    pub duration: Option<i64>,
    #[serde(alias = "thumbnail", default)]
    pub thumbnail_url: String,
    #[serde(default)]
    pub description: String,
    #[serde(alias = "upload_date", default)]
    pub upload_date: String,
    #[serde(alias = "view_count", default)]
    pub view_count: i64,
}

impl From<VideoInfo> for Video {
    fn from(v: VideoInfo) -> Self {
        Video {
            id: v.id,
            title: v.title,
            channel_name: v.channel,
            channel_id: None,
            view_count: Some(v.view_count as i64),
            upload_date: None,
            duration: Some(format_duration(v.duration)),
            thumbnail_url: Some(v.thumbnail_url),
            is_short: false,
            is_liked: false,
            is_downloaded: false,
            playlist_id: None,
            position: None,
            completion_percentage: None,
            file_path: None,
            file_size: None,
        }
    }
}

impl From<VideoResponse> for Video {
    fn from(v: VideoResponse) -> Self {
        Video {
            id: v.id,
            title: v.title,
            channel_name: v.uploader.or(v.channel),
            channel_id: None,
            view_count: Some(v.view_count),
            upload_date: v.upload_date.into(),
            duration: v.duration.map(|d| format_duration(d as u64)),
            thumbnail_url: Some(v.thumbnail_url),
            is_short: false,
            is_liked: false,
            is_downloaded: false,
            playlist_id: None,
            position: None,
            completion_percentage: None,
            file_path: None,
            file_size: None,
        }
    }
}

fn format_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{}:{:02}", minutes, secs)
    }
}

fn select_thumbnail_url(entry: &Value, fallback_video_id: Option<&str>) -> Option<String> {
    if let Some(url) = entry.get("thumbnail").and_then(|t| t.as_str()) {
        if !url.is_empty() {
            return Some(url.to_string());
        }
    }

    if let Some(thumbnails) = entry.get("thumbnails").and_then(|t| t.as_array()) {
        let mut best_url: Option<String> = None;
        let mut best_height: u64 = 0;

        for t in thumbnails {
            let url = match t.get("url").and_then(|u| u.as_str()) {
                Some(u) if !u.is_empty() => u,
                _ => continue,
            };
            let height = t.get("height").and_then(|h| h.as_u64()).unwrap_or(0);

            if best_url.is_none() || height >= best_height {
                best_url = Some(url.to_string());
                best_height = height;
            }
        }

        if best_url.is_some() {
            return best_url;
        }
    }

    fallback_video_id
        .filter(|id| !id.is_empty())
        .map(|id| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id))
}

#[tauri::command]
pub async fn open_youtube_login_window(_app: tauri::AppHandle) -> Result<(), String> {
    // Create a built-in window for YouTube login - better UX and avoids pipe issues
    let _login_window = tauri::WebviewWindowBuilder::new(
        &_app,
        "youtube-login",
        tauri::WebviewUrl::External("https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com".parse().unwrap())
    )
    .title("YouTube Login")
    .inner_size(1000.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .decorations(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create login window: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn start_download_task(
    app: tauri::AppHandle,
    task_id: String,
    url: String,
    format_id: Option<String>,
    unique_filename: Option<bool>,
    state: State<'_, tokio::sync::Mutex<DownloadManager>>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let output_dir = {
        let app_state = app_state.lock().await;
        app_state.get_downloads_dir().unwrap_or_else(|e| {
            log::warn!("Could not find download directory: {}", e);
            std::env::current_dir().unwrap_or_else(|err| {
                log::error!("Failed to get current directory: {}", err);
                PathBuf::from(".")
            })
        })
    };

    {
        let app_state = app_state.lock().await;
        let db_path = app_state.get_database_file();
        if let Ok(db) = Database::new(&db_path) {
            let existing_task = db
                .get_download_tasks()
                .ok()
                .and_then(|tasks| tasks.into_iter().find(|t| t.id == task_id));

            let task = if let Some(mut task) = existing_task {
                task.url = task.url.or_else(|| Some(url.clone()));
                task.output_dir = task
                    .output_dir
                    .or_else(|| Some(output_dir.to_string_lossy().to_string()));
                task.unique_filename = task.unique_filename.or(unique_filename);
                task.format_id = task.format_id.or(format_id.clone());
                task.status = "queued".to_string();
                task.progress = 0.0;
                if task.speed.is_none() {
                    task.speed = Some("0 MB/s".to_string());
                }
                if task.eta.is_none() {
                    task.eta = Some("0:00".to_string());
                }
                task
            } else {
                DownloadTask {
                    id: task_id.clone(),
                    video_id: None,
                    url: Some(url.clone()),
                    output_dir: Some(output_dir.to_string_lossy().to_string()),
                    unique_filename,
                    title: "Downloading...".to_string(),
                    status: "queued".to_string(),
                    progress: 0.0,
                    speed: Some("0 MB/s".to_string()),
                    eta: Some("0:00".to_string()),
                    format_id: format_id.clone(),
                    resolution: None,
                    codec_info: None,
                    file_size: None,
                    fps: None,
                    thumbnail_url: None,
                    created_at: None,
                    updated_at: None,
                }
            };
            if let Err(e) = db.upsert_download_task(&task) {
                log::error!("Failed to persist download task {}: {}", task_id, e);
            }
        }
    }

    let ffmpeg_path = {
        let mut candidates: Vec<PathBuf> = Vec::new();

        // Bundled resources (platform-specific subdirectory)
        #[cfg(target_os = "windows")]
        candidates.push(PathBuf::from("resources/binaries/windows/ffmpeg.exe"));
        #[cfg(target_os = "macos")]
        candidates.push(PathBuf::from("resources/binaries/macos/ffmpeg"));
        #[cfg(target_os = "linux")]
        candidates.push(PathBuf::from("resources/binaries/linux/ffmpeg"));

        // PATH lookup
        #[cfg(target_os = "windows")]
        candidates.push(PathBuf::from("ffmpeg.exe"));
        #[cfg(not(target_os = "windows"))]
        candidates.push(PathBuf::from("ffmpeg"));

        // Platform-specific system locations
        #[cfg(target_os = "windows")]
        {
            candidates.push(PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"));
            candidates.push(PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"));
            if let Some(home) = dirs::home_dir() {
                candidates.push(home.join("scoop").join("shims").join("ffmpeg.exe"));
                candidates.push(home.join("ffmpeg").join("bin").join("ffmpeg.exe"));
            }
        }

        #[cfg(target_os = "macos")]
        {
            candidates.push(PathBuf::from("/opt/homebrew/bin/ffmpeg"));
            candidates.push(PathBuf::from("/usr/local/bin/ffmpeg"));
            candidates.push(PathBuf::from("/usr/bin/ffmpeg"));
        }

        #[cfg(target_os = "linux")]
        {
            candidates.push(PathBuf::from("/usr/bin/ffmpeg"));
            candidates.push(PathBuf::from("/usr/local/bin/ffmpeg"));
            candidates.push(PathBuf::from("/snap/bin/ffmpeg"));
        }

        candidates
            .into_iter()
            .find(|path| path.exists())
            .map(|path| path.parent().map(PathBuf::from).unwrap_or(path))
    };

    let info = DownloadTaskInfo {
        url,
        format_id,
        output_dir,
        ffmpeg_path,
        unique_filename: unique_filename.unwrap_or(false),
        retry_count: 0,
        max_retries: 3,
    };

    let manager = state.lock().await;
    if manager.is_active(&task_id).await {
        log::info!("[start_download_task] Task {} already active, skipping", task_id);
        return Ok(());
    }
    manager
        .start_download(app, task_id, info)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_download_task(
    app: tauri::AppHandle,
    task_id: String,
    state: State<'_, tokio::sync::Mutex<DownloadManager>>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager
        .pause_download(app, &task_id)
        .await
        .map_err(|e| e.to_string())?;

    let db_path = {
        let app_state = app_state.lock().await;
        app_state.get_database_file()
    };
    update_task_status(&db_path, &task_id, "paused");
    Ok(())
}

#[tauri::command]
pub async fn resume_download_task(
    app: tauri::AppHandle,
    task_id: String,
    state: State<'_, tokio::sync::Mutex<DownloadManager>>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let manager = state.lock().await;
    match manager.resume_download(app.clone(), &task_id).await {
        Ok(_) => {
            let db_path = {
                let app_state = app_state.lock().await;
                app_state.get_database_file()
            };
            update_task_status(&db_path, &task_id, "queued");
            Ok(())
        }
        Err(e) => {
            log::warn!("[resume_download_task] Resume failed for {}: {}", task_id, e);
            let app_state = app_state.lock().await;
            let db_path = app_state.get_database_file();
            let db = Database::new(&db_path).map_err(|err| err.to_string())?;
            let tasks = db.get_download_tasks().map_err(|err| err.to_string())?;
            let task = tasks
                .into_iter()
                .find(|t| t.id == task_id)
                .ok_or_else(|| "Task metadata not found".to_string())?;

            let url = task
                .url
                .ok_or_else(|| "Missing url for task".to_string())?;
            let output_dir = task
                .output_dir
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    app_state
                        .get_downloads_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                });
            drop(app_state);

            let ffmpeg_path = find_ffmpeg(&app);
            let info = DownloadTaskInfo {
                url,
                format_id: task.format_id,
                output_dir,
                ffmpeg_path,
                unique_filename: task.unique_filename.unwrap_or(false),
                retry_count: 0,
                max_retries: 3,
            };

            manager
                .start_download(app, task_id.clone(), info)
                .await
                .map_err(|err| err.to_string())?;

            update_task_status(&db_path, &task_id, "queued");
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn cancel_download_task(
    app: tauri::AppHandle,
    task_id: String,
    state: State<'_, tokio::sync::Mutex<DownloadManager>>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager
        .cancel_download(app, &task_id)
        .await
        .map_err(|e| e.to_string())?;

    let db_path = {
        let app_state = app_state.lock().await;
        app_state.get_database_file()
    };
    update_task_status(&db_path, &task_id, "cancelled");
    Ok(())
}

fn update_task_status(db_path: &PathBuf, task_id: &str, status: &str) {
    if let Ok(db) = Database::new(db_path) {
        if let Ok(mut tasks) = db.get_download_tasks() {
            if let Some(task) = tasks.iter_mut().find(|t| t.id == task_id) {
                task.status = status.to_string();
                let _ = db.upsert_download_task(task);
            }
        }
    }
}

#[tauri::command]
pub async fn retry_download_task(
    app: tauri::AppHandle,
    task_id: String,
    max_retries: Option<u32>,
    state: State<'_, tokio::sync::Mutex<DownloadManager>>,
) -> Result<(), String> {
    let manager = state.lock().await;
    let max_retries = max_retries.unwrap_or(3);
    manager
        .retry_download(app, task_id, max_retries)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_download_tasks(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<DownloadTask>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let tasks = db
        .get_download_tasks()
        .map_err(|e| format!("Failed to get download tasks: {}", e))?;

    Ok(tasks)
}

#[tauri::command]
pub async fn upsert_download_task(
    task: DownloadTask,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db.upsert_download_task(&task)
        .map_err(|e| format!("Failed to save download task: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_download_task(
    task_id: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    db.delete_download_task(&task_id)
        .map_err(|e| format!("Failed to delete download task: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn extract_cookies_from_window(
    _app: tauri::AppHandle,
    _state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<serde_json::Value, String> {
    std::thread::sleep(std::time::Duration::from_millis(500));

    // Close login window if it exists
    if let Some(window) = _app.get_webview_window("youtube-login") {
        let _ = window.close();
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    // Return empty result - users should use import_cookies_from_file instead
    Ok(serde_json::json!({
        "success": false,
        "message": "Please use the import cookies from file feature instead"
    }))
}

#[tauri::command]
pub async fn open_file_dialog(_app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = _app
        .dialog()
        .file()
        .add_filter("Cookie Files", &["txt", "json"])
        .set_title("Select Cookie File")
        .blocking_pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    // Convert FilePath to string path
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let path_str = path
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 path".to_string())?;

    // Read file content
    let content =
        std::fs::read_to_string(path_str).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(content)
}

#[tauri::command]
pub async fn import_cookies_from_file(
    _app: tauri::AppHandle,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::DialogExt;

    log::info!("import_cookies_from_file: Starting cookie import");

    let file_path = _app
        .dialog()
        .file()
        .add_filter("Cookie Files", &["txt"])
        .set_title("Import YouTube Cookies (Netscape Format)")
        .blocking_pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    // Convert FilePath to string path
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let path_str = path
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 path".to_string())?;

    log::info!("import_cookies_from_file: Reading from {}", path_str);

    // Read file content
    let content =
        std::fs::read_to_string(path_str).map_err(|e| format!("Failed to read file: {}", e))?;

    log::info!(
        "import_cookies_from_file: Read {} bytes from file",
        content.len()
    );

    // Validate it looks like a Netscape cookie file
    if !content.contains(".youtube.com") && !content.contains("youtube") {
        return Err("File doesn't contain YouTube cookies. Make sure it's a Netscape format cookie file with YouTube domain cookies.".to_string());
    }

    log::info!("import_cookies_from_file: Cookies validated");

    // Use AppState to get database path for consistency
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    log::info!(
        "import_cookies_from_file: Opening database at {}",
        db_path.display()
    );

    let db = Database::new(&db_path).map_err(|e| {
        log::error!("import_cookies_from_file: Failed to open database: {}", e);
        format!("Failed to open database: {}", e)
    })?;

    log::info!("import_cookies_from_file: Saving cookies to database");

    db.save_cookies(&content).map_err(|e| {
        log::error!("import_cookies_from_file: Failed to save cookies: {}", e);
        format!("Failed to save cookies to database: {}", e)
    })?;

    log::info!(
        "import_cookies_from_file: Successfully imported {} bytes",
        content.len()
    );

    Ok(serde_json::json!({
        "success": true,
        "message": "Cookies imported successfully",
        "count": content.lines().filter(|l| l.contains(".youtube.com")).count()
    }))
}

#[tauri::command]
pub async fn get_user_playlists(
    _app: tauri::AppHandle,
    cookies: String,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    // Use PlaylistDiscovery to get all user playlists (saved, private, watch later, liked)
    let discovery = PlaylistDiscovery::new(client.clone());
    let result = discovery
        .discover(Some(cookies_map))
        .await
        .map_err(|e| format!("Failed to get user playlists: {}", e))?;

    // Persist playlists to local database
    let app_state = app_state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    for p in &result.playlists {
        let description = if p.description.trim().is_empty() {
            None
        } else {
            Some(p.description.clone())
        };

        let playlist = Playlist {
            id: p.id.clone(),
            title: p.title.clone(),
            description,
            video_count: p.playlist_count as i64,
            thumbnail_url: p.thumbnail.clone(),
            uploader: Some(p.uploader.clone()),
            channel: Some(p.uploader.clone()),
            channel_id: None,
            view_count: None,
        };
        db.upsert_playlist(&playlist)
            .map_err(|e| format!("Failed to save playlist {}: {}", playlist.id, e))?;
    }

    Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn get_liked_videos_with_cookies(
    _app: tauri::AppHandle,
    cookies: String,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<Vec<Video>, String> {
    eprintln!(
        "[Rust] get_liked_videos_with_cookies called with {} cookies",
        cookies.len()
    );

    let client = state.lock().await;
    eprintln!("[Rust] Client locked");

    let cookies_map = parse_cookies_string(&cookies)?;

    // Use YtDlpClient to get liked videos
    let playlist_url = "https://www.youtube.com/playlist?list=LL"; // Liked Videos playlist
    let metadata = client
        .extract(playlist_url, true, Some(cookies_map))
        .await
        .map_err(|e| format!("Failed to get liked videos: {}", e))?;

    let entries = metadata
        .get("entries")
        .and_then(|e| e.as_array())
        .ok_or_else(|| "No entries found".to_string())?;

    let videos: Vec<Video> = entries
        .iter()
        .filter_map(|entry| {
            let title = entry.get("title")?.as_str()?;
            let video_id = entry.get("id")?.as_str()?;
            let thumbnail_url = select_thumbnail_url(entry, Some(video_id));
            Some(Video {
                id: video_id.to_string(),
                title: title.to_string(),
                channel_name: entry
                    .get("uploader")
                    .or_else(|| entry.get("channel"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                channel_id: None,
                view_count: entry
                    .get("view_count")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as i64),
                upload_date: entry
                    .get("upload_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                duration: entry
                    .get("duration")
                    .and_then(|v| v.as_u64())
                    .map(format_duration),
                thumbnail_url,
                is_short: false,
                is_liked: true,
                is_downloaded: false,
                playlist_id: Some("LL".to_string()),
                position: entry
                    .get("playlist_index")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as i64),
                completion_percentage: None,
                file_path: None,
                file_size: None,
            })
        })
        .collect();

    // Persist liked videos to local database
    let app_state = app_state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    for v in &videos {
        db.upsert_video(v)
            .map_err(|e| format!("Failed to save liked video {}: {}", v.id, e))?;
    }

    Ok(videos)
}

#[tauri::command]
pub async fn search_videos(
    _app: tauri::AppHandle,
    query: String,
    max_results: i32,
    cookies: Option<String>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<Vec<Video>, String> {
    let client = state.lock().await;

    let cookies_map = if let Some(c) = cookies {
        Some(parse_cookies_string(&c)?)
    } else {
        None
    };

    // Use YtDlpClient to search videos
    let search_url = format!("ytsearch{}:{}", max_results, query);
    let metadata = client
        .extract(&search_url, false, cookies_map)
        .await
        .map_err(|e| format!("Failed to search videos: {}", e))?;

    let entries = metadata
        .get("entries")
        .and_then(|e| e.as_array())
        .ok_or_else(|| "No entries found".to_string())?;

    let videos: Vec<Video> = entries
        .iter()
        .filter_map(|entry| {
            let title = entry
                .get("title")
                .or_else(|| entry.get("fulltitle"))
                .and_then(|value| value.as_str());
            let video_id = entry
                .get("id")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
                .or_else(|| {
                    entry
                        .get("url")
                        .and_then(|value| value.as_str())
                        .and_then(|url| {
                            if let Some(pos) = url.find("v=") {
                                let id = &url[pos + 2..];
                                return Some(id.split('&').next().unwrap_or(id).to_string());
                            }
                            if let Some(pos) = url.find("youtu.be/") {
                                let id = &url[pos + 9..];
                                return Some(id.split('?').next().unwrap_or(id).to_string());
                            }
                            None
                        })
                });

            let video_id = match video_id {
                Some(video_id) => video_id,
                None => return None,
            };
            let title = title.unwrap_or("Untitled video");

            let thumbnail_url = select_thumbnail_url(entry, Some(&video_id));

            Some(Video {
                id: video_id,
                title: title.to_string(),
                channel_name: entry
                    .get("uploader")
                    .or_else(|| entry.get("channel"))
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string()),
                channel_id: entry
                    .get("channel_id")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string()),
                view_count: entry
                    .get("view_count")
                    .and_then(|value| value.as_u64())
                    .map(|v| v as i64),
                upload_date: entry
                    .get("upload_date")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string()),
                duration: entry
                    .get("duration")
                    .and_then(|value| value.as_u64())
                    .map(format_duration),
                thumbnail_url,
                is_short: false,
                is_liked: false,
                is_downloaded: false,
                playlist_id: None,
                position: None,
                completion_percentage: None,
                file_path: None,
                file_size: None,
            })
        })
        .collect();

    Ok(videos)
}

#[tauri::command]
pub async fn get_video_metadata(
    _app: tauri::AppHandle,
    url: String,
    _cookies: Option<String>,
    state: State<'_, tokio::sync::Mutex<YtDlpInfoClient>>,
) -> Result<Video, String> {
    let client = state.lock().await;

    // Ignore cookies for metadata fetching
    let metadata = client
        .extract_info(&url, None)
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let id = metadata
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or(&url)
        .to_string();

    let title = metadata
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let channel_name = metadata
        .get("uploader")
        .or_else(|| metadata.get("channel"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let thumbnail_url = select_thumbnail_url(&metadata, Some(&id));

    Ok(Video {
        id,
        title,
        channel_name,
        channel_id: metadata
            .get("channel_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        view_count: metadata
            .get("view_count")
            .and_then(|v| v.as_u64())
            .map(|v| v as i64),
        upload_date: metadata
            .get("upload_date")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        duration: metadata
            .get("duration")
            .and_then(|v| v.as_u64())
            .map(format_duration),
        thumbnail_url,
        is_short: false,
        is_liked: false,
        is_downloaded: false,
        playlist_id: None,
        position: None,
        completion_percentage: None,
        file_path: None,
        file_size: None,
    })
}

#[tauri::command]
pub async fn get_playlist(
    _app: tauri::AppHandle,
    url: String,
    cookies: Option<String>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<Vec<Video>, String> {
    let client = state.lock().await;

    let cookies_map = if let Some(c) = cookies {
        Some(parse_cookies_string(&c)?)
    } else {
        None
    };

    let metadata = client
        .extract(&url, true, cookies_map)
        .await
        .map_err(|e| format!("Failed to get playlist: {}", e))?;

    let entries = metadata
        .get("entries")
        .and_then(|e| e.as_array())
        .ok_or_else(|| "No entries found in playlist".to_string())?;

    let playlist_id = url
        .split("list=")
        .nth(1)
        .and_then(|s| s.split('&').next())
        .map(|s| s.to_string());

    let videos: Vec<Video> = entries
        .iter()
        .enumerate()
        .filter_map(|(idx, entry)| {
            let title = entry
                .get("title")
                .or_else(|| entry.get("fulltitle"))
                .and_then(|value| value.as_str());
            let video_id = entry
                .get("id")
                .or_else(|| entry.get("video_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let video_id = match video_id {
                Some(id) if !id.is_empty() => id,
                _ => return None,
            };

            let title = title.unwrap_or("Untitled video");

            let thumbnail_url = select_thumbnail_url(entry, Some(&video_id));

            Some(Video {
                id: video_id.clone(),
                title: title.to_string(),
                channel_name: entry
                    .get("uploader")
                    .or_else(|| entry.get("channel"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                channel_id: entry
                    .get("channel_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                view_count: entry
                    .get("view_count")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as i64),
                upload_date: entry
                    .get("upload_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                duration: entry
                    .get("duration")
                    .and_then(|v| v.as_u64())
                    .map(format_duration),
                thumbnail_url,
                is_short: false,
                is_liked: false,
                is_downloaded: false,
                playlist_id: playlist_id.clone(),
                position: Some((idx + 1) as i64),
                completion_percentage: None,
                file_path: None,
                file_size: None,
            })
        })
        .collect();

    // Persist playlist metadata + videos to local database
    if let Some(pid) = playlist_id.as_ref() {
        let app_state = app_state.lock().await;
        let db_path = app_state.get_database_file();
        let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let playlist_thumbnail = select_thumbnail_url(&metadata, None);
        let playlist_title = metadata
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Playlist");
        let playlist_description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let playlist_uploader = metadata
            .get("uploader")
            .or_else(|| metadata.get("channel"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let pl = Playlist {
            id: pid.clone(),
            title: playlist_title.to_string(),
            description: playlist_description,
            video_count: videos.len() as i64,
            thumbnail_url: playlist_thumbnail,
            uploader: playlist_uploader.clone(),
            channel: playlist_uploader,
            channel_id: None,
            view_count: None,
        };
        db.upsert_playlist(&pl)
            .map_err(|e| format!("Failed to save playlist {}: {}", pl.id, e))?;

        for v in &videos {
            db.upsert_video(v)
                .map_err(|e| format!("Failed to save video {}: {}", v.id, e))?;
        }
    }

    Ok(videos)
}

#[tauri::command]
pub async fn get_video_formats(
    _app: tauri::AppHandle,
    url: String,
    _cookies: Option<String>,
    state: State<'_, tokio::sync::Mutex<YtDlpInfoClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    // Ignore cookies for format fetching
    let metadata = client
        .extract_info(&url, None)
        .await
        .map_err(|e| format!("Failed to get formats: {}", e))?;

    let formats = metadata
        .get("formats")
        .and_then(|f| f.as_array())
        .ok_or_else(|| "No formats found".to_string())?
        .clone();

    log::info!("Extracted {} formats for video: {}", formats.len(), url);

    Ok(serde_json::json!({ "formats": formats }))
}

#[tauri::command]
pub async fn resolve_stream(
    _app: tauri::AppHandle,
    url: String,
    cookies: Option<String>,
    state: State<'_, tokio::sync::Mutex<YtDlpInfoClient>>,
) -> Result<StreamInfo, String> {
    let client = state.lock().await;

    // Handle cookies if present
    let (cookies_path, temp_file_path) = if let Some(cookies_content) = cookies {
        if !cookies_content.is_empty() {
            let temp_dir = std::env::temp_dir();
            let file_name = format!("velocity_cookies_{}.txt", Uuid::new_v4());
            let file_path = temp_dir.join(file_name);
            
            if let Ok(mut file) = std::fs::File::create(&file_path) {
                use std::io::Write;
                if file.write_all(cookies_content.as_bytes()).is_ok() {
                    (Some(file_path.clone()), Some(file_path))
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let metadata = client
        .extract_info(&url, cookies_path)
        .await;

    // Clean up temp file
    if let Some(path) = temp_file_path {
        let _ = std::fs::remove_file(path);
    }

    let metadata = metadata.map_err(|e| format!("Failed to resolve stream: {}", e))?;

    // Extract stream info from metadata
    let formats = metadata
        .get("formats")
        .and_then(|f| f.as_array())
        .ok_or_else(|| "No formats found".to_string())?;

    let mut video_url = String::new();
    let mut audio_url = String::new();
    let mut best_height = 0;

    for format in formats {
        let url = format.get("url").and_then(|u| u.as_str()).unwrap_or("");
        if url.is_empty() {
            continue;
        }

        let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
        let acodec = format.get("acodec").and_then(|a| a.as_str()).unwrap_or("none");
        let height = format.get("height").and_then(|h| h.as_u64()).unwrap_or(0);

        // Check for audio-only stream (m4a/webm)
        if vcodec == "none" && acodec != "none" {
            // Simple logic: just take the last one found (usually best quality in ytdlp list) or prefer specific codecs?
            // ytdlp usually sorts best to worst or worst to best? default is worst to best.
            // So overwriting is fine to get the best.
            audio_url = url.to_string();
        }

        // Check for combined video+audio (progressive)
        if vcodec != "none" && acodec != "none" {
            if height > best_height {
                 video_url = url.to_string();
                 best_height = height;
            }
        }
    }

    // Fallback: if no progressive video found, look for just video
    if video_url.is_empty() {
         for format in formats {
            let url = format.get("url").and_then(|u| u.as_str()).unwrap_or("");
            if url.is_empty() { continue; }
            let vcodec = format.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
             if vcodec != "none" {
                video_url = url.to_string();
                // We just take the last one (best)
             }
         }
    }
    
    // If we still have no audio_url, but we have a progressive video_url, use that for audio too
    if audio_url.is_empty() && !video_url.is_empty() {
        // Only if it really has audio (we checked acodec != none above for proper progressive)
        // But let's just use it as fallback
        audio_url = video_url.clone();
    }

    let stream_info = StreamInfo {
        video_url,
        audio_url,
        subtitle_urls: Vec::new(),
        expiry: 0,
    };

    Ok(stream_info)
}

#[tauri::command]
pub async fn validate_cookies(
    _app: tauri::AppHandle,
    cookies: String,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<bool, String> {
    let client = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    // Try to fetch a simple video to validate cookies
    let test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    let result = client.extract(test_url, true, Some(cookies_map)).await;

    match result {
        Ok(_) => {
            let app_state = app_state.lock().await;
            let db_path = app_state.get_database_file();
            let db = Database::new(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;
            db.save_cookies(&cookies)
                .map_err(|e| format!("Failed to save cookies: {}", e))?;
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn download_video(
    app: tauri::AppHandle,
    url: String,
    _output_path: String,
    format_id: Option<String>,
    task_id: Option<String>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<String, String> {
    let client = state.lock().await;

    if let Some(id) = task_id.clone() {
        let _ = app.emit(
            "download_status",
            serde_json::json!({
                "taskId": id,
                "status": "downloading"
            }),
        );
    }

    let ffmpeg_path = {
        let candidates = vec![
            PathBuf::from("ffmpeg.exe"),
            PathBuf::from("ffmpeg"),
            PathBuf::from("resources/binaries/ffmpeg.exe"),
            PathBuf::from("resources/binaries/ffmpeg"),
            PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"),
            dirs::home_dir()
                .map(|h| h.join("ffmpeg").join("bin").join("ffmpeg"))
                .unwrap_or_else(|| PathBuf::from("ffmpeg")),
            dirs::home_dir()
                .map(|h| {
                    h.join("scoop")
                        .join("apps")
                        .join("ffmpeg")
                        .join("current")
                        .join("bin")
                        .join("ffmpeg.exe")
                })
                .unwrap_or_else(|| PathBuf::from("ffmpeg.exe")),
        ];

        candidates.into_iter().find(|path| path.exists())
    };

    // Get download directory
    let download_dir = std::path::PathBuf::from(
        dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap()),
    )
    .join("velocity");

    // Create directory if it doesn't exist
    if !download_dir.exists() {
        std::fs::create_dir_all(&download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }

    let url_owned = url.clone();
    let download_dir_clone = download_dir.clone();
    let format_id_clone = format_id.clone();

    // Find bundled yt-dlp path
    let ytdlp_path = find_ytdlp(&app);

    let result = tokio::task::spawn_blocking(move || {
        // Use blocking call to run yt-dlp download
        let cmd_name: &std::ffi::OsStr = if let Some(path) = &ytdlp_path {
            log::info!("Using bundled yt-dlp: {}", path.display());
            path.as_os_str()
        } else {
            log::info!("Using system yt-dlp");
            std::ffi::OsStr::new("yt-dlp")
        };

        let mut cmd = std::process::Command::new(cmd_name);

        // Hide console window on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        // Process group handling for Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0); // Create new process group
        }

        cmd.arg(&url_owned).arg("--no-warnings").arg("-o").arg(
            download_dir_clone
                .join("%(title)s.%(ext)s")
                .to_string_lossy()
                .to_string(),
        );

        if let Some(ffmpeg) = ffmpeg_path {
            cmd.arg("--ffmpeg-location")
                .arg(ffmpeg.to_string_lossy().to_string())
                .arg("--embed-metadata")
                .arg("--embed-chapters")
                .arg("--embed-info-json")
                .arg("--embed-thumbnail");
        } else {
            log::warn!("FFmpeg not found; skipping embed options");
        }

        // Add format selection if provided
        if let Some(fmt) = format_id_clone {
            cmd.arg("-f").arg(&fmt);
        } else {
            cmd.arg("-f").arg("bestvideo+bestaudio/best");
        }

        // Execute command
        let output = cmd
            .output()
            .map_err(|e| anyhow::anyhow!("Failed to execute yt-dlp: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("yt-dlp download failed: {}", stderr);
        }

        Ok::<(), anyhow::Error>(())
    })
    .await
    .map_err(|e| format!("Failed to spawn download task: {}", e))
    .and_then(|inner_result| inner_result.map_err(|e| format!("Download failed: {}", e)));

    if let Some(id) = task_id.clone() {
        let status = if result.is_ok() { "completed" } else { "error" };
        let _ = app.emit(
            "download_status",
            serde_json::json!({
                "taskId": id,
                "status": status
            }),
        );
    }

    result?;

    // Extract video info to get the actual filename
    let metadata = client
        .extract(&url, false, None)
        .await
        .map_err(|e| format!("Failed to extract video info: {}", e))?;

    let filename = metadata
        .get("_filename")
        .or_else(|| metadata.get("title"))
        .and_then(|v| v.as_str())
        .unwrap_or("video")
        .to_string();

    Ok(download_dir.join(filename).to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_download_history(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<DownloadHistoryItem>, String> {
    let app_state = state.lock().await;
    let history_file = app_state.get_history_file();

    if !history_file.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&history_file)
        .map_err(|e| format!("Failed to read history: {}", e))?;

    let history: Vec<DownloadHistoryItem> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse history: {}", e))?;

    Ok(history)
}

#[tauri::command]
pub async fn add_to_history(
    item: DownloadHistoryItem,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let history_file = app_state.get_history_file();

    // Read existing history
    let mut history: Vec<DownloadHistoryItem> = if history_file.exists() {
        let content = std::fs::read_to_string(&history_file)
            .map_err(|e| format!("Failed to read history: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    // Add new item
    history.push(item);

    // Save history
    let content = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    std::fs::write(&history_file, content)
        .map_err(|e| format!("Failed to write history: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, tokio::sync::Mutex<AppState>>) -> Result<(), String> {
    let app_state = state.lock().await;
    let history_file = app_state.get_history_file();

    if history_file.exists() {
        std::fs::remove_file(&history_file)
            .map_err(|e| format!("Failed to clear history: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn clear_all_data(
    state: State<'_, tokio::sync::Mutex<AppState>>,
    ytdlp_state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<(), String> {
    log::info!("Starting to clear all data...");

    // Clear download history
    {
        let app_state = state.lock().await;
        let history_file = app_state.get_history_file();
        if history_file.exists() {
            std::fs::remove_file(&history_file)
                .map_err(|e| format!("Failed to clear history: {}", e))?;
            log::info!("Download history cleared");
        }
    }

    // Clear cookies
    {
        let app_state = state.lock().await;
        let cookies_file = app_state.get_cookies_file();
        if cookies_file.exists() {
            std::fs::remove_file(&cookies_file)
                .map_err(|e| format!("Failed to clear cookies: {}", e))?;
            log::info!("Cookies cleared");
        }
    }

    // Clear database
    {
        let app_state = state.lock().await;
        let db_path = app_state.get_database_file();
        if db_path.exists() {
            std::fs::remove_file(&db_path)
                .map_err(|e| format!("Failed to clear database: {}", e))?;
            log::info!("Database cleared");
        }
    }

    // Clear yt-dlp cache
    {
        let client = ytdlp_state.lock().await;
        client.clear_cache().await;
        log::info!("yt-dlp cache cleared");
    }

    log::info!("All data cleared successfully");
    Ok(())
}

#[tauri::command]
pub async fn save_cookies(
    cookies: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    log::info!(
        "save_cookies: Saving {} bytes of cookies to database",
        cookies.len()
    );

    // Save and verify
    match db.save_cookies(&cookies) {
        Ok(_) => {
            log::info!("save_cookies: Successfully saved cookies to database");
            match db.load_cookies() {
                Ok(Some(saved)) => {
                    log::info!(
                        "save_cookies: Verified saved cookies length={}",
                        saved.len()
                    );
                }
                Ok(None) => {
                    log::warn!("save_cookies: Verification failed - no cookies found after save");
                }
                Err(e) => {
                    log::error!("save_cookies: Verification read failed: {}", e);
                }
            }
            Ok(())
        }
        Err(e) => {
            log::error!("save_cookies: Failed to save cookies: {}", e);
            Err(format!("Failed to save cookies: {}", e))
        }
    }
}

#[tauri::command]
pub async fn load_cookies(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    log::info!(
        "load_cookies: Loading cookies from database at {}",
        db_path.display()
    );

    // Diagnostic checks: table existence and row count
    match db.cookies_table_exists() {
        Ok(true) => log::info!("load_cookies: 'cookies' table exists"),
        Ok(false) => log::warn!("load_cookies: 'cookies' table does NOT exist"),
        Err(e) => log::error!(
            "load_cookies: Failed to check cookies table existence: {}",
            e
        ),
    }

    match db.cookies_count() {
        Ok(count) => log::info!("load_cookies: cookies table row count = {}", count),
        Err(e) => log::warn!("load_cookies: Could not query cookies count: {}", e),
    }

    match db.load_cookies() {
        Ok(Some(cookies)) => {
            log::info!(
                "load_cookies: Successfully loaded {} bytes of cookies",
                cookies.len()
            );
            Ok(cookies)
        }
        Ok(None) => {
            log::warn!("load_cookies: No cookies found in database");
            Err("No cookies found".to_string())
        }
        Err(e) => {
            log::error!("load_cookies: Failed to load cookies: {}", e);
            Err(format!("Failed to load cookies: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_all_playlists(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<Playlist>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let playlists = db
        .get_all_playlists()
        .map_err(|e| format!("Failed to get playlists: {}", e))?;

    Ok(playlists)
}

#[tauri::command]
pub async fn check_binaries(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let mut missing = Vec::new();
    let mut found = Vec::new();

    #[cfg(target_os = "windows")]
    let ytdlp_name = "yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let ytdlp_name = "yt-dlp";

    #[cfg(target_os = "windows")]
    let ffmpeg_name = "ffmpeg.exe";
    #[cfg(not(target_os = "windows"))]
    let ffmpeg_name = "ffmpeg";

    #[cfg(target_os = "windows")]
    let ffprobe_name = "ffprobe.exe";
    #[cfg(not(target_os = "windows"))]
    let ffprobe_name = "ffprobe";

    // Check yt-dlp
    if let Ok(resource_dir) = app.path().resource_dir() {
        let ytdlp_path = resource_dir
            .join("binaries")
            .join(if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "macos"
            } else {
                "linux"
            })
            .join(ytdlp_name);
        if ytdlp_path.exists() {
            found.push(("yt-dlp", ytdlp_path.to_string_lossy().to_string()));
        } else {
            missing.push("yt-dlp");
        }
    } else {
        missing.push("yt-dlp");
    }

    // Check ffmpeg
    if let Ok(resource_dir) = app.path().resource_dir() {
        let ffmpeg_path = resource_dir
            .join("binaries")
            .join(if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "macos"
            } else {
                "linux"
            })
            .join(ffmpeg_name);
        if ffmpeg_path.exists() {
            found.push(("ffmpeg", ffmpeg_path.to_string_lossy().to_string()));
        } else {
            missing.push("ffmpeg");
        }
    } else {
        missing.push("ffmpeg");
    }

    // Check ffprobe
    if let Ok(resource_dir) = app.path().resource_dir() {
        let ffprobe_path = resource_dir
            .join("binaries")
            .join(if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "macos"
            } else {
                "linux"
            })
            .join(ffprobe_name);
        if ffprobe_path.exists() {
            found.push(("ffprobe", ffprobe_path.to_string_lossy().to_string()));
        } else {
            missing.push("ffprobe");
        }
    } else {
        missing.push("ffprobe");
    }

    Ok(serde_json::json!({
        "success": true,
        "found": found,
        "missing": missing,
        "all_present": missing.is_empty()
    }))
}

#[tauri::command]
pub async fn get_videos_by_playlist(
    state: State<'_, tokio::sync::Mutex<AppState>>,
    playlist_id: String,
) -> Result<Vec<Video>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let videos = db
        .get_videos_by_playlist(&playlist_id)
        .map_err(|e| format!("Failed to get playlist videos: {}", e))?;

    Ok(videos)
}

#[tauri::command]
pub async fn get_liked_videos(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<Video>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let videos = db
        .get_liked_videos()
        .map_err(|e| format!("Failed to get liked videos: {}", e))?;

    Ok(videos)
}

#[tauri::command]
pub async fn get_downloaded_videos(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<Video>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // First sync the download folder with the database
    match app_state.get_downloads_dir() {
        Ok(download_dir) => {
            if let Err(e) = db.sync_download_folder(&download_dir) {
                log::warn!("Failed to sync download folder: {}", e);
            }
        }
        Err(e) => {
            log::warn!(
                "Failed to resolve downloads directory, skipping folder sync: {}",
                e
            );
        }
    }

    let videos = db
        .get_downloaded_videos()
        .map_err(|e| format!("Failed to get downloaded videos: {}", e))?;

    Ok(videos)
}

#[tauri::command]
pub async fn get_playlist_videos(
    _app: tauri::AppHandle,
    playlist_id: String,
    cookies: String,
    app_state: State<'_, tokio::sync::Mutex<AppState>>,
    state: State<'_, tokio::sync::Mutex<YtDlpClient>>,
) -> Result<serde_json::Value, String> {
    let client = state.lock().await;

    let cookies_map = parse_cookies_string(&cookies)?;

    // Use YtDlpClient to get playlist info
    let playlist_url = format!("https://www.youtube.com/playlist?list={}", playlist_id);
    let mut metadata = client
        .extract(&playlist_url, true, Some(cookies_map))
        .await
        .map_err(|e| format!("Failed to get playlist videos: {}", e))?;

    // Ensure each entry has a usable thumbnail URL (yt-dlp flat results often use thumbnails[])
    if let Some(entries) = metadata.get_mut("entries").and_then(|e| e.as_array_mut()) {
        for entry in entries.iter_mut() {
            if !entry.is_object() {
                continue;
            }

            let existing = entry
                .get("thumbnail")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            if !existing.is_empty() {
                continue;
            }

            let id = entry
                .get("id")
                .or_else(|| entry.get("video_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if let Some(url) = select_thumbnail_url(entry, Some(id)) {
                if let Some(obj) = entry.as_object_mut() {
                    obj.insert("thumbnail".to_string(), Value::String(url));
                }
            }
        }
    }

    // Persist playlist + videos in database (best effort)
    let entries = metadata
        .get("entries")
        .and_then(|e| e.as_array())
        .cloned()
        .unwrap_or_default();
    if !entries.is_empty() {
        let app_state = app_state.lock().await;
        let db_path = app_state.get_database_file();
        let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let playlist_thumbnail = select_thumbnail_url(&metadata, None);
        let playlist_title = metadata
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Playlist");
        let playlist_description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let playlist_uploader = metadata
            .get("uploader")
            .or_else(|| metadata.get("channel"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let pl = Playlist {
            id: playlist_id.clone(),
            title: playlist_title.to_string(),
            description: playlist_description,
            video_count: entries.len() as i64,
            thumbnail_url: playlist_thumbnail,
            uploader: playlist_uploader.clone(),
            channel: playlist_uploader,
            channel_id: None,
            view_count: None,
        };
        db.upsert_playlist(&pl)
            .map_err(|e| format!("Failed to save playlist {}: {}", pl.id, e))?;

        for (idx, entry) in entries.iter().enumerate() {
            let video_id = entry
                .get("id")
                .or_else(|| entry.get("video_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let video_id = match video_id {
                Some(id) if !id.is_empty() => id,
                _ => continue,
            };

            let title = entry
                .get("title")
                .or_else(|| entry.get("fulltitle"))
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled video")
                .to_string();

            let v = Video {
                id: video_id.clone(),
                title,
                channel_name: entry
                    .get("uploader")
                    .or_else(|| entry.get("channel"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                channel_id: entry
                    .get("channel_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                view_count: entry
                    .get("view_count")
                    .and_then(|v| v.as_u64())
                    .map(|v| v as i64),
                upload_date: entry
                    .get("upload_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                duration: entry
                    .get("duration")
                    .and_then(|v| v.as_u64())
                    .map(format_duration),
                thumbnail_url: select_thumbnail_url(entry, Some(&video_id)),
                is_short: false,
                is_liked: false,
                is_downloaded: false,
                playlist_id: Some(playlist_id.clone()),
                position: Some((idx + 1) as i64),
                completion_percentage: None,
                file_path: None,
                file_size: None,
            };

            db.upsert_video(&v)
                .map_err(|e| format!("Failed to save video {}: {}", v.id, e))?;
        }
    }

    Ok(metadata)
}

#[tauri::command]
pub async fn search_database_videos(
    state: State<'_, tokio::sync::Mutex<AppState>>,
    query: String,
) -> Result<Vec<Video>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    let videos = db
        .search_videos(&query)
        .map_err(|e| format!("Failed to search videos: {}", e))?;

    Ok(videos)
}

#[tauri::command]
pub async fn get_download_directory(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<String, String> {
    let _app_state = state.lock().await;

    // Default download directory
    let download_dir = std::path::PathBuf::from(
        dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap()),
    )
    .join("velocity");

    Ok(download_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_download_directory(
    path: String,
    _state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    // Validate the directory exists or can be created
    let dir = std::path::PathBuf::from(&path);

    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }

    // TODO: Save to config file
    Ok(())
}

#[tauri::command]
pub async fn open_download_directory(
    _state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let download_dir = std::path::PathBuf::from(
        dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap()),
    )
    .join("velocity");

    if !download_dir.exists() {
        std::fs::create_dir_all(&download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }

    // Open in file explorer
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&download_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&download_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&download_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn export_database(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    if !db_path.exists() {
        return Err("Database file not found".to_string());
    }

    // Create export filename with timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let export_filename = format!("velocity_database_{}.db", timestamp);

    // Copy database to export location
    let export_path = std::path::PathBuf::from(
        dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap()),
    )
    .join("velocity")
    .join(&export_filename);

    // Create directory if it doesn't exist
    if let Some(parent) = export_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create export directory: {}", e))?;
        }
    }

    std::fs::copy(&db_path, &export_path).map_err(|e| format!("Failed to copy database: {}", e))?;

    Ok(export_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_file_dialog_backup(_app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = _app
        .dialog()
        .file()
        .add_filter("Backup Files", &["json", "db"])
        .set_title("Select Backup File")
        .blocking_pick_file()
        .ok_or_else(|| "No file selected".to_string())?;

    // Convert FilePath to string path
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let path_str = path
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 path".to_string())?;

    Ok(path_str.to_string())
}

#[tauri::command]
pub async fn delete_downloaded_video(
    video_id: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Get the video to find its file path
    let videos = db
        .get_downloaded_videos()
        .map_err(|e| format!("Failed to get downloaded videos: {}", e))?;

    if let Some(video) = videos.iter().find(|v| v.id == video_id) {
        // Try to extract file path from video metadata or construct it
        let downloads_dir = app_state
            .get_downloads_dir()
            .map_err(|e| format!("Failed to get downloads directory: {}", e))?;

        // Try different possible file names based on video title and ID
        let possible_names = vec![
            format!("{}.mp4", video.id),
            format!("{}.mkv", video.id),
            format!("{}.webm", video.id),
            format!("{}.mp4", sanitize_filename(&video.title)),
            format!("{}.mkv", sanitize_filename(&video.title)),
            format!("{}.webm", sanitize_filename(&video.title)),
        ];

        let mut deleted_file = false;
        for name in possible_names {
            let file_path = downloads_dir.join(&name);
            if file_path.exists() {
                if let Err(e) = std::fs::remove_file(&file_path) {
                    eprintln!("Failed to delete file {}: {}", file_path.display(), e);
                    return Err(format!("Failed to delete file: {}", e));
                }
                deleted_file = true;
                break;
            }
        }

        if !deleted_file {
            eprintln!("No file found for video {}", video_id);
            // Don't return error - just remove from database
        }

        // Remove from database
        db.delete_downloaded_video(&video_id)
            .map_err(|e| format!("Failed to delete video from database: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn remove_downloaded_video_from_list(
    video_id: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    let db = Database::new(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Only remove from database, keep the file
    db.delete_downloaded_video(&video_id)
        .map_err(|e| format!("Failed to remove video from list: {}", e))?;

    Ok(())
}

// Helper function to sanitize filename
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>()
        .chars()
        .take(100) // Limit length
        .collect()
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(content)
}

#[tauri::command]
pub async fn import_database(
    file_path: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();

    // Validate source file exists
    let source_path = std::path::PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err("Source database file not found".to_string());
    }

    // Create backup of current database before import
    if db_path.exists() {
        let backup_path = db_path.with_extension("db.backup");
        std::fs::copy(&db_path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Create directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {}", e))?;
        }
    }

    // Copy the imported database
    std::fs::copy(&source_path, &db_path)
        .map_err(|e| format!("Failed to import database: {}", e))?;

    Ok(())
}

// ============================================================
// Website Cookies Commands - Multi-site cookie management
// ============================================================

#[tauri::command]
pub async fn get_website_cookies(
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Vec<crate::models::WebsiteCookie>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;

    db.get_all_website_cookies().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_website_cookie(
    id: Option<String>,
    name: String,
    website_url: String,
    content: String,
    is_default: Option<bool>,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<crate::models::WebsiteCookie, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;

    // Generate domain pattern from website_url
    let domain_pattern = CookieManager::get_domain_pattern(&website_url)
        .unwrap_or_else(|| format!(".{}", website_url));

    let cookie = crate::models::WebsiteCookie {
        id: id.unwrap_or_else(|| Uuid::new_v4().to_string()),
        name,
        website_url: website_url.clone(),
        domain_pattern,
        content,
        is_default: is_default.unwrap_or(false),
        created_at: None,
        updated_at: None,
    };

    db.upsert_website_cookie(&cookie).map_err(|e| e.to_string())?;

    // Re-fetch to get timestamps
    let cookies = db.get_all_website_cookies().map_err(|e| e.to_string())?;
    cookies
        .into_iter()
        .find(|c| c.id == cookie.id)
        .ok_or_else(|| "Failed to retrieve saved cookie".to_string())
}

#[tauri::command]
pub async fn delete_website_cookie(
    id: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;

    db.delete_website_cookie(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cookies_for_url(
    url: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<Option<crate::models::WebsiteCookie>, String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;

    // Extract domain from URL
    let domain = CookieManager::extract_domain(&url)
        .ok_or_else(|| "Could not extract domain from URL".to_string())?;

    db.get_cookies_for_domain(&domain).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_default_website_cookie(
    id: String,
    domain_pattern: String,
    state: State<'_, tokio::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let db_path = app_state.get_database_file();
    let db = Database::new(&db_path).map_err(|e| e.to_string())?;

    db.set_default_cookie_for_domain(&id, &domain_pattern)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_cookie_domains(
    content: String,
) -> Result<Vec<String>, String> {
    Ok(CookieManager::detect_domains_from_content(&content))
}

