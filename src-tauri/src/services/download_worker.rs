use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::{YtDlpManager, DownloadResult, DownloadProgress};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadType {
    Video,
    Audio,
    SeparateStreams,
}

impl DownloadType {
    pub fn as_str(&self) -> &'static str {
        match self {
            DownloadType::Video => "video",
            DownloadType::Audio => "audio",
            DownloadType::SeparateStreams => "separate_streams",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub download_type: DownloadType,
    pub output_dir: Option<String>,
    pub format_ids: Option<String>,
    pub cookies: Option<String>,
    pub min_height: Option<u32>,
    pub preferred_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStatus {
    pub task_id: String,
    pub status: String,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub last_update: i64,
    pub error: Option<String>,
    pub final_filename: Option<String>,
}

pub struct DownloadWorker {
    manager: Arc<Mutex<YtDlpManager>>,
}

impl DownloadWorker {
    pub fn new(manager: YtDlpManager) -> Self {
        Self {
            manager: Arc::new(Mutex::new(manager)),
        }
    }

    pub async fn download(&self, task: DownloadTask) -> Result<DownloadStatus> {
        log::info!("[Worker] Starting download: {}", task.url);

        let output_dir = task
            .output_dir
            .unwrap_or_else(|| {
                dirs::download_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("velocity")
                    .to_string_lossy()
                    .to_string()
            });

        let output_path = PathBuf::from(&output_dir);
        tokio::fs::create_dir_all(&output_path)
            .await
            .context("Failed to create output directory")?;

        let result: Result<DownloadResult, anyhow::Error> = match task.download_type {
            DownloadType::Video => {
                let min_height = task.min_height.unwrap_or(720);
                let preferred_format = task.preferred_format.unwrap_or_else(|| "mp4".to_string());
                
                let manager = self.manager.lock().await;
                manager
                    .download_high_res(&task.url, &output_path, task.cookies, min_height, &preferred_format)
                    .await
            }
            DownloadType::Audio => {
                let manager = self.manager.lock().await;
                manager.download_audio(&task.url, &output_path, task.cookies).await
            }
            DownloadType::SeparateStreams => {
                let min_height = task.min_height.unwrap_or(1080);
                let preferred_format = task.preferred_format.unwrap_or_else(|| "mp4".to_string());
                
                let manager = self.manager.lock().await;
                manager
                    .download_high_res(&task.url, &output_path, task.cookies, min_height, &preferred_format)
                    .await
            }
        };

        match result {
            Ok(download_result) => {
                log::info!("[Worker] Download completed: {:?}", download_result.file_path);
                
                Ok(DownloadStatus {
                    task_id: task.id,
                    status: "completed".to_string(),
                    progress: 1.0,
                    speed: "0B/s".to_string(),
                    eta: "0:00".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    last_update: chrono::Utc::now().timestamp(),
                    error: None,
                    final_filename: download_result.file_path,
                })
            }
            Err(e) => {
                log::error!("[Worker] Download failed: {}", e);
                
                Ok(DownloadStatus {
                    task_id: task.id,
                    status: "error".to_string(),
                    progress: 0.0,
                    speed: "0B/s".to_string(),
                    eta: "0:00".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    last_update: chrono::Utc::now().timestamp(),
                    error: Some(e.to_string().to_string()),
                    final_filename: None,
                })
            }
        }
    }

    pub async fn download_with_progress<F>(
        &self,
        task: DownloadTask,
        mut progress_callback: F,
    ) -> Result<DownloadStatus>
    where
        F: FnMut(DownloadProgress) + Send + 'static,
    {
        log::info!("[Worker] Starting download with progress: {}", task.url);

        let output_dir = task
            .output_dir
            .unwrap_or_else(|| {
                dirs::download_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("velocity")
                    .to_string_lossy()
                    .to_string()
            });

        let output_path = PathBuf::from(&output_dir);
        tokio::fs::create_dir_all(&output_path)
            .await
            .context("Failed to create output directory")?;

        let task_id = task.id.clone();
        let _task_url = task.url.clone();

        let result: Result<DownloadResult, anyhow::Error> = match task.download_type {
            DownloadType::Video => {
                let min_height = task.min_height.unwrap_or(720);
                let preferred_format = task.preferred_format.unwrap_or_else(|| "mp4".to_string());
                
                let manager = self.manager.lock().await;
                manager
                    .download_high_res(&task.url, &output_path, task.cookies, min_height, &preferred_format)
                    .await
            }
            DownloadType::Audio => {
                let manager = self.manager.lock().await;
                manager.download_audio(&task.url, &output_path, task.cookies).await
            }
            DownloadType::SeparateStreams => {
                let min_height = task.min_height.unwrap_or(1080);
                let preferred_format = task.preferred_format.unwrap_or_else(|| "mp4".to_string());
                
                let manager = self.manager.lock().await;
                manager
                    .download_high_res(&task.url, &output_path, task.cookies, min_height, &preferred_format)
                    .await
            }
        };

        match result {
            Ok(download_result) => {
                log::info!("[Worker] Download completed: {:?}", download_result.file_path);
                
                progress_callback(DownloadProgress {
                    status: "finished".to_string(),
                    progress: Some(1.0),
                    speed: Some("0B/s".to_string()),
                    eta: Some("0:00".to_string()),
                    downloaded: Some(0),
                    total: Some(0),
                    filename: download_result.file_path.clone(),
                });
                
                Ok(DownloadStatus {
                    task_id,
                    status: "completed".to_string(),
                    progress: 1.0,
                    speed: "0B/s".to_string(),
                    eta: "0:00".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    last_update: chrono::Utc::now().timestamp(),
                    error: None,
                    final_filename: download_result.file_path,
                })
            }
            Err(e) => {
                log::error!("[Worker] Download failed: {}", e);
                
                Ok(DownloadStatus {
                    task_id,
                    status: "error".to_string(),
                    progress: 0.0,
                    speed: "0B/s".to_string(),
                    eta: "0:00".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    last_update: chrono::Utc::now().timestamp(),
                    error: Some(e.to_string().to_string()),
                    final_filename: None,
                })
            }
        }
    }

    pub fn find_ffmpeg() -> Option<PathBuf> {
        let possible_paths = vec![
            // Bundled resources (platform-specific subdirectory)
            #[cfg(target_os = "windows")]
            PathBuf::from("resources/binaries/windows/ffmpeg.exe"),
            #[cfg(target_os = "macos")]
            PathBuf::from("resources/binaries/macos/ffmpeg"),
            #[cfg(target_os = "linux")]
            PathBuf::from("resources/binaries/linux/ffmpeg"),
            // PATH lookup
            #[cfg(target_os = "windows")]
            PathBuf::from("ffmpeg.exe"),
            #[cfg(not(target_os = "windows"))]
            PathBuf::from("ffmpeg"),
            // Platform-specific system locations
            #[cfg(target_os = "windows")]
            PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            #[cfg(target_os = "windows")]
            PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"),
            #[cfg(target_os = "macos")]
            PathBuf::from("/opt/homebrew/bin/ffmpeg"),
            #[cfg(target_os = "macos")]
            PathBuf::from("/usr/local/bin/ffmpeg"),
            #[cfg(target_os = "linux")]
            PathBuf::from("/usr/bin/ffmpeg"),
            #[cfg(target_os = "linux")]
            PathBuf::from("/usr/local/bin/ffmpeg"),
        ];

        possible_paths.into_iter().find(|path| path.exists())
    }
}

pub struct DownloadQueue {
    worker: DownloadWorker,
}

impl DownloadQueue {
    pub fn new(worker: DownloadWorker) -> Self {
        Self { worker }
    }

    pub async fn enqueue(&self, task: DownloadTask) -> Result<DownloadStatus> {
        self.worker.download(task).await
    }

    pub async fn enqueue_with_progress<F>(
        &self,
        task: DownloadTask,
        progress_callback: F,
    ) -> Result<DownloadStatus>
    where
        F: FnMut(DownloadProgress) + Send + 'static,
    {
        self.worker.download_with_progress(task, progress_callback).await
    }
}
