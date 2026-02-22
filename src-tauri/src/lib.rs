pub mod commands;
pub mod models;
pub mod services;
pub mod startup_verification;
pub mod updater;

use services::ytdlp_config::CACHE_ENABLED;
use services::{AppState, Database, DownloadManager, DownloadTaskInfo, PlaylistContent, YtDlpClient, YtDlpInfoClient, YtDlpManager, Aria2Service};
use startup_verification::{log_startup_checks, StartupVerifier};
use std::path::PathBuf;
use tauri::{Listener, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    match std::fs::create_dir_all("logs") {
        Ok(_) => log::info!("Created logs directory"),
        Err(_) => log::warn!("Failed to create logging directory, using temp directory"),
    };

    tauri::Builder::default()
        .manage(tokio::sync::Mutex::new(
            AppState::new().expect("Failed to initialize app state"),
        ))
        .manage(tokio::sync::Mutex::new(YtDlpClient::default()))
        .manage(tokio::sync::Mutex::new(YtDlpInfoClient::default()))
        .manage(tokio::sync::Mutex::new(PlaylistContent::default()))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Run startup verification checks
            let checks = StartupVerifier::verify_all();
            log_startup_checks(&checks);
            let app_handle = app.handle();
            let ffmpeg_path = find_ffmpeg(&app_handle);
            let ytdlp_path = find_ytdlp(&app_handle);

            // Initialize services in a blocking task
            let ytdlp_client = app.state::<tokio::sync::Mutex<YtDlpClient>>();
            let ytdlp_info_client = app.state::<tokio::sync::Mutex<YtDlpInfoClient>>();

            // Initialize services with bundled paths
            match ytdlp_client.try_lock() {
                Ok(mut client) => {
                    *client = YtDlpClient::new_with_path(CACHE_ENABLED, ytdlp_path.clone());
                }
                Err(_) => {
                    log::warn!("Failed to acquire lock for YtDlpClient initialization");
                }
            }

            match ytdlp_info_client.try_lock() {
                Ok(mut info_client) => {
                    *info_client = YtDlpInfoClient::new_with_path(60, ytdlp_path.clone());
                }
                Err(_) => {
                    log::warn!("Failed to acquire lock for YtDlpInfoClient initialization");
                }
            }

            // Initialize YtDlpManager with FFmpeg path
            if let Some(ffmpeg) = ffmpeg_path {
                let manager = YtDlpManager::new_with_paths(ffmpeg.clone(), ytdlp_path)
                    .map_err(|e| format!("Failed to initialize YtDlpManager: {}", e))?;
                app.manage(tokio::sync::Mutex::new(Some(manager)));
                log::info!("YtDlpManager initialized successfully");
            } else {
                log::warn!("FFmpeg not found, YtDlpManager not initialized");
                app.manage(tokio::sync::Mutex::new(None::<YtDlpManager>));
            }

            // Initialize DownloadManager
            let ytdlp_path = find_ytdlp(&app_handle);
            let aria2_path = find_aria2(&app_handle);
            app.manage(tokio::sync::Mutex::new(DownloadManager::new(ytdlp_path)));
            app.manage(tokio::sync::Mutex::new(Aria2Service::new(aria2_path)));

            // Requeue active downloads from persisted tasks
            let app_handle_for_requeue = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                requeue_active_downloads(app_handle_for_requeue).await;
            });

            // Setup cleanup on app exit
            let app_handle_for_listener = app_handle.clone();
            let app_handle_for_task_base = app_handle.clone();
            app_handle_for_listener.listen("tauri://close-requested", move |_| {
                let app_handle_for_task = app_handle_for_task_base.clone();
                tauri::async_runtime::spawn(async move {
                    let manager =
                        app_handle_for_task.state::<tokio::sync::Mutex<DownloadManager>>();
                    let manager = manager.lock().await;
                    manager.shutdown().await;
                });
            });

            log::info!("velocity app initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_youtube_login_window,
            commands::extract_cookies_from_window,
            commands::open_file_dialog,
            commands::open_file_dialog_backup,
            commands::save_cookies,
            commands::load_cookies,
            commands::validate_cookies,
            commands::start_download_task,
            commands::pause_download_task,
            commands::resume_download_task,
            commands::cancel_download_task,
            commands::retry_download_task,
            commands::get_user_playlists,
            commands::get_liked_videos_with_cookies,
            commands::search_videos,
            commands::get_video_metadata,
            commands::get_video_formats,
            commands::get_playlist,
            commands::resolve_stream,
            commands::download_video,
            commands::get_download_tasks,
            commands::upsert_download_task,
            commands::delete_download_task,
            commands::get_download_history,
            commands::add_to_history,
            commands::clear_history,
            commands::clear_all_data,
            commands::get_all_playlists,
            commands::get_videos_by_playlist,
            commands::get_liked_videos,
            commands::get_downloaded_videos,
            commands::delete_downloaded_video,
            commands::remove_downloaded_video_from_list,
            commands::get_playlist_videos,
            commands::search_database_videos,
            commands::get_download_directory,
            commands::set_download_directory,
            commands::open_download_directory,
            commands::export_database,
            commands::import_database,
            commands::read_text_file,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::reset_settings,
            commands::ytdlp::ytdlp_get_video_metadata,
            commands::ytdlp::ytdlp_get_playlist_metadata,
            commands::ytdlp::ytdlp_get_playlist_detailed,
            commands::ytdlp::ytdlp_search_videos,
            commands::ytdlp::ytdlp_get_video_formats,
            commands::ytdlp::ytdlp_resolve_stream,
            commands::ytdlp::ytdlp_download_video,
            commands::ytdlp::ytdlp_download_audio,
            commands::ytdlp::ytdlp_download_with_worker,
            commands::ytdlp::ytdlp_get_liked_videos,
            commands::ytdlp::ytdlp_get_user_playlists,
            commands::ytdlp::ytdlp_clear_cache,
            commands::ytdlp::ytdlp_set_ffmpeg_path,
            commands::ytdlp::ytdlp_get_video_info,
            commands::ytdlp::ytdlp_get_playlist_info,
            commands::streaming::stream_get_formats,
            commands::streaming::stream_resolve,
            commands::streaming::stream_get_playlist_entries,
            commands::check_binaries,
            commands::aria2::aria2_start_download,
            commands::aria2::aria2_get_download_info,
            commands::aria2::aria2_fetch_metadata,
            // Website cookies - multi-site cookie management
            commands::get_website_cookies,
            commands::save_website_cookie,
            commands::delete_website_cookie,
            commands::get_cookies_for_url,
            commands::set_default_website_cookie,
            commands::detect_cookie_domains,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("Failed to run Tauri application: {}", e);
        });
}

async fn requeue_active_downloads(app: tauri::AppHandle) {
    let (db_path, downloads_dir) = {
        let app_state = app.state::<tokio::sync::Mutex<AppState>>();
        let app_state = app_state.lock().await;
        let downloads_dir = app_state
            .get_downloads_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        (app_state.get_database_file(), downloads_dir)
    };

    let db = match Database::new(&db_path) {
        Ok(db) => db,
        Err(e) => {
            log::warn!("Failed to open database for requeue: {}", e);
            return;
        }
    };

    let tasks = match db.get_download_tasks() {
        Ok(tasks) => tasks,
        Err(e) => {
            log::warn!("Failed to load download tasks for requeue: {}", e);
            return;
        }
    };

    let active_statuses = ["downloading", "queued", "retrying", "merging", "extracting"];
    let ffmpeg_path = find_ffmpeg(&app);
    let manager = app.state::<tokio::sync::Mutex<DownloadManager>>();

    for mut task in tasks {
        if !active_statuses.contains(&task.status.as_str()) {
            continue;
        }

        let url = match task.url.clone() {
            Some(url) => url,
            None => {
                log::warn!("Skipping task {} requeue: missing url", task.id);
                continue;
            }
        };

        let output_dir = task
            .output_dir
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(|| downloads_dir.clone());

        let info = DownloadTaskInfo {
            url,
            format_id: task.format_id.clone(),
            output_dir,
            ffmpeg_path: ffmpeg_path.clone(),
            unique_filename: task.unique_filename.unwrap_or(false),
            retry_count: 0,
            max_retries: 3,
        };

        let manager_guard = manager.lock().await;
        if manager_guard.is_active(&task.id).await {
            continue;
        }
        if let Err(e) = manager_guard.start_download(app.clone(), task.id.clone(), info).await {
            log::warn!("Failed to requeue task {}: {}", task.id, e);
            continue;
        }
        drop(manager_guard);

        task.status = "queued".to_string();
        let _ = db.upsert_download_task(&task);
    }
}
fn find_bundled_binary(
    app: &tauri::AppHandle,
    binary_name: &str,
    platform_dir: &str,
) -> Option<PathBuf> {
    // Try multiple possible resource locations
    let mut possible_resource_dirs: Vec<PathBuf> = Vec::new();

    log::debug!(
        "Looking for bundled binary: {} in platform: {}",
        binary_name,
        platform_dir
    );

    // First priority: app.path().resource_dir() - works in both dev and production
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("binaries").join(platform_dir);
        log::debug!("Checking resource_dir path: {}", path.display());
        possible_resource_dirs.push(path);
    }

    // NSIS installation: typically C:\Program Files\Velocity\resources\binaries
    #[cfg(target_os = "windows")]
    {
        possible_resource_dirs.push(
            PathBuf::from("C:\\Program Files\\Velocity\\resources\\binaries").join(platform_dir),
        );

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let parent_resources = parent.join("resources").join("binaries").join(platform_dir);
                log::debug!(
                    "Checking exe parent resources: {}",
                    parent_resources.display()
                );
                possible_resource_dirs.push(parent_resources);
            }
        }
    }

    // Development path (when running with cargo)
    possible_resource_dirs.push(PathBuf::from("src-tauri/resources/binaries").join(platform_dir));
    possible_resource_dirs.push(PathBuf::from("resources/binaries").join(platform_dir));

    // Relative to exe
    possible_resource_dirs.push(
        PathBuf::from(".")
            .join("resources")
            .join("binaries")
            .join(platform_dir),
    );
    possible_resource_dirs.push(PathBuf::from(".").join("binaries").join(platform_dir));

    for resource_dir in possible_resource_dirs {
        let binary_path = resource_dir.join(binary_name);
        log::debug!("Checking path: {}", binary_path.display());
        if binary_path.exists() {
            log::info!("Found bundled {}: {}", binary_name, binary_path.display());
            return Some(binary_path);
        }
    }

    log::error!(
        "Bundled {} not found in any expected location. Searched paths above.",
        binary_name
    );
    None
}
pub(crate) fn find_ffmpeg(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let binary_name = "ffmpeg";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "ffmpeg";

    #[cfg(target_os = "windows")]
    let binary_name_exe = "ffmpeg.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name_exe = "ffmpeg";

    #[cfg(target_os = "windows")]
    let platform_dir = "windows";
    #[cfg(target_os = "macos")]
    let platform_dir = "macos";
    #[cfg(target_os = "linux")]
    let platform_dir = "linux";

    // Bundled resources (platform-specific subdirectory)
    if let Some(bundled) = find_bundled_binary(app, binary_name_exe, platform_dir) {
        return Some(bundled);
    }

    let mut possible_paths: Vec<PathBuf> = Vec::new();

    // Try using 'which' crate to find in PATH
    if let Ok(which_path) = which::which(binary_name) {
        log::info!("Found ffmpeg in PATH: {}", which_path.display());
        return Some(which_path);
    }

    // Fallback to relative path for dev
    possible_paths.push(PathBuf::from(format!(
        "resources/binaries/{}/{}",
        platform_dir, binary_name_exe
    )));
    possible_paths.push(PathBuf::from(format!(
        "src-tauri/resources/binaries/{}/{}",
        platform_dir, binary_name_exe
    )));

    // Platform-specific system locations
    #[cfg(target_os = "windows")]
    {
        possible_paths.push(PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"));
        possible_paths.push(PathBuf::from(
            r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
        ));
        if let Some(home) = dirs::home_dir() {
            possible_paths.push(home.join("scoop").join("shims").join("ffmpeg.exe"));
            possible_paths.push(home.join(".cargo").join("bin").join("ffmpeg.exe"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        possible_paths.push(PathBuf::from("/opt/homebrew/bin/ffmpeg"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));
        possible_paths.push(PathBuf::from("/opt/local/bin/ffmpeg"));
    }

    #[cfg(target_os = "linux")]
    {
        possible_paths.push(PathBuf::from("/usr/bin/ffmpeg"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffmpeg"));
        possible_paths.push(PathBuf::from("/snap/bin/ffmpeg"));
    }

    let found = possible_paths.into_iter().find(|path| path.exists());

    if let Some(ref path) = found {
        log::info!("Found ffmpeg at: {}", path.display());
    } else {
        log::warn!("ffmpeg not found in any of the expected locations");
    }

    found
}
#[allow(dead_code)]
fn find_ffprobe(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let binary_name = "ffprobe.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "ffprobe";

    #[cfg(target_os = "windows")]
    let platform_dir = "windows";
    #[cfg(target_os = "macos")]
    let platform_dir = "macos";
    #[cfg(target_os = "linux")]
    let platform_dir = "linux";

    let mut possible_paths: Vec<PathBuf> = Vec::new();

    // Bundled resources (platform-specific subdirectory)
    if let Some(bundled) = find_bundled_binary(app, binary_name, platform_dir) {
        return Some(bundled);
    }

    // Fallback to relative path for dev
    possible_paths.push(PathBuf::from(format!(
        "resources/binaries/{}/{}",
        platform_dir, binary_name
    )));

    // Platform-specific binary name for PATH lookup
    possible_paths.push(PathBuf::from(binary_name));

    // Platform-specific system locations
    #[cfg(target_os = "windows")]
    {
        possible_paths.push(PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffprobe.exe"));
        if let Some(home) = dirs::home_dir() {
            possible_paths.push(home.join("scoop").join("shims").join("ffprobe.exe"));
            possible_paths.push(home.join("ffprobe.exe"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        possible_paths.push(PathBuf::from("/opt/homebrew/bin/ffprobe"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffprobe"));
    }

    #[cfg(target_os = "linux")]
    {
        possible_paths.push(PathBuf::from("/usr/bin/ffprobe"));
        possible_paths.push(PathBuf::from("/usr/local/bin/ffprobe"));
        possible_paths.push(PathBuf::from("/snap/bin/ffprobe"));
    }

    let found = possible_paths.into_iter().find(|path| path.exists());

    if let Some(ref path) = found {
        log::info!("Found ffprobe at: {}", path.display());
    } else {
        log::warn!("ffprobe not found in any of the expected locations");
    }

    found
}

fn find_aria2(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let binary_name = "aria2c";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "aria2c";

    #[cfg(target_os = "windows")]
    let binary_name_exe = "aria2c.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name_exe = "aria2c";

    #[cfg(target_os = "windows")]
    let platform_dir = "windows";
    #[cfg(target_os = "macos")]
    let platform_dir = "macos";
    #[cfg(target_os = "linux")]
    let platform_dir = "linux";

    // Bundled resources (platform-specific subdirectory)
    if let Some(bundled) = find_bundled_binary(app, binary_name_exe, platform_dir) {
        return Some(bundled);
    }

    // Try using 'which' crate to find in PATH
    if let Ok(which_path) = which::which(binary_name) {
        log::info!("Found aria2c in PATH: {}", which_path.display());
        return Some(which_path);
    }

    None
}

fn find_ytdlp(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let binary_name = "yt-dlp";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "yt-dlp";

    #[cfg(target_os = "windows")]
    let binary_name_exe = "yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name_exe = "yt-dlp";

    #[cfg(target_os = "windows")]
    let platform_dir = "windows";
    #[cfg(target_os = "macos")]
    let platform_dir = "macos";
    #[cfg(target_os = "linux")]
    let platform_dir = "linux";

    // Bundled resources (platform-specific subdirectory)
    if let Some(bundled) = find_bundled_binary(app, binary_name_exe, platform_dir) {
        return Some(bundled);
    }

    // Try using 'which' crate to find in PATH
    if let Ok(which_path) = which::which(binary_name) {
        log::info!("Found yt-dlp in PATH: {}", which_path.display());
        return Some(which_path);
    }

    let mut possible_paths: Vec<PathBuf> = Vec::new();

    // Fallback to relative path for dev
    possible_paths.push(PathBuf::from(format!(
        "resources/binaries/{}/{}",
        platform_dir, binary_name_exe
    )));
    possible_paths.push(PathBuf::from(format!(
        "src-tauri/resources/binaries/{}/{}",
        platform_dir, binary_name_exe
    )));

    // Platform-specific system locations
    #[cfg(target_os = "windows")]
    {
        possible_paths.push(PathBuf::from(r"C:\Program Files\yt-dlp\yt-dlp.exe"));
        possible_paths.push(PathBuf::from(r"C:\Program Files (x86)\yt-dlp\yt-dlp.exe"));
        if let Some(home) = dirs::home_dir() {
            possible_paths.push(home.join("scoop").join("shims").join("yt-dlp.exe"));
            possible_paths.push(home.join(".cargo").join("bin").join("yt-dlp.exe"));
            possible_paths.push(
                home.join("AppData")
                    .join("Local")
                    .join("Programs")
                    .join("Python")
                    .join("Python311")
                    .join("Scripts")
                    .join("yt-dlp.exe"),
            );
            possible_paths.push(home.join("yt-dlp.exe"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        possible_paths.push(PathBuf::from("/opt/homebrew/bin/yt-dlp"));
        possible_paths.push(PathBuf::from("/usr/local/bin/yt-dlp"));
    }

    #[cfg(target_os = "linux")]
    {
        possible_paths.push(PathBuf::from("/usr/bin/yt-dlp"));
        possible_paths.push(PathBuf::from("/usr/local/bin/yt-dlp"));
        possible_paths.push(PathBuf::from("/snap/bin/yt-dlp"));
    }

    let found = possible_paths.into_iter().find(|path| path.exists());

    if let Some(ref path) = found {
        log::info!("Found yt-dlp at: {}", path.display());
    } else {
        log::warn!("yt-dlp not found in any of the expected locations");
    }

    found
}
