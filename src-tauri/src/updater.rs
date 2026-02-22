// Auto-updater configuration and helpers
use tauri::Emitter;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates(app: AppHandle) {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    log::info!("Velocity update available: {}", update.version);
                    let _ = app.emit("tauri://update-available", Some(serde_json::json!({
                        "version": update.version,
                        "body": update.body
                    })));

                    let mut downloaded = 0;
                    let app_clone = app.clone();
                    let version = update.version.clone();

                    match update
                        .download_and_install(
                            |chunk_length, content_length| {
                                downloaded += chunk_length;
                                log::info!("Downloaded {} of {:?}", downloaded, content_length);
                                let _ = app_clone.emit("tauri://update-progress", Some(serde_json::json!({
                                    "downloaded": downloaded,
                                    "total": content_length
                                })));
                            },
                            || {
                                log::info!("Download finished");
                            },
                        )
                        .await
                    {
                        Ok(_) => {
                            log::info!("Update installed successfully");
                            let _ = app.emit("tauri://update-installed", Some(serde_json::json!({
                                "version": version
                            })));
                            let _ = app.emit("tauri://update-ready", None::<()>);
                        }
                        Err(e) => {
                            log::error!("Failed to download and install update: {}", e);
                            let _ = app.emit("tauri://update-failed", Some(serde_json::json!({
                                "error": e.to_string()
                            })));
                        }
                    }
                }
                Ok(None) => {
                    log::info!("Velocity is up to date");
                    let _ = app.emit("tauri://update-not-available", None::<()>);
                }
                Err(e) => {
                    log::error!("Failed to check for updates: {}", e);
                    let _ = app.emit("tauri://update-error", Some(serde_json::json!({
                        "error": e.to_string()
                    })));
                }
            }
        }
        Err(e) => {
            log::error!("Failed to get updater: {}", e);
        }
    }
}

pub async fn install_update_on_next_startup(app: AppHandle) {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    log::info!("Installing update to be applied on next restart");
                    let version = update.version.clone();

                    match update
                        .download_and_install(
                            |chunk_length, content_length| {
                                log::info!("Downloaded {} of {:?}", chunk_length, content_length);
                            },
                            || {
                                log::info!("Download finished");
                            },
                        )
                        .await
                    {
                        Ok(_) => {
                            log::info!("Update prepared for next restart");
                            let _ = app.emit("tauri://update-ready-restart", Some(serde_json::json!({
                                "version": version
                            })));
                        }
                        Err(e) => {
                            log::error!("Failed to prepare update: {}", e);
                        }
                    }
                }
                Ok(None) => {
                    log::info!("No update available");
                }
                Err(e) => {
                    log::error!("Failed to check for updates: {}", e);
                }
            }
        }
        Err(e) => {
            log::error!("Failed to get updater: {}", e);
        }
    }
}

pub fn get_current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
