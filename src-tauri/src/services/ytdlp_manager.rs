use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,
    pub progress: Option<f64>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub downloaded: Option<u64>,
    pub total: Option<u64>,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub title: Option<String>,
    pub resolution: Option<String>,
    pub duration: Option<u64>,
    pub uploader: Option<String>,
    pub format_id: Option<String>,
    pub error: Option<String>,
    pub url: String,
}

#[allow(dead_code)]
pub struct YtDlpManager {
    ffmpeg_path: PathBuf,
    ffprobe_path: Option<PathBuf>,
    ytdlp_path: Option<PathBuf>,
}

impl YtDlpManager {
    pub fn new(ffmpeg_path: PathBuf) -> Result<Self> {
        Self::new_with_paths(ffmpeg_path, None)
    }

    pub fn new_with_paths(ffmpeg_path: PathBuf, ytdlp_path: Option<PathBuf>) -> Result<Self> {
        if !ffmpeg_path.exists() {
            anyhow::bail!("FFmpeg not found at: {:?}", ffmpeg_path);
        }

        let ffprobe_path = ffmpeg_path
            .parent()
            .map(|p| p.join("ffprobe"))
            .filter(|p| p.exists());

        log::info!("YtDlpManager initialized with FFmpeg: {:?}, yt-dlp: {:?}", ffmpeg_path, ytdlp_path);

        Ok(Self {
            ffmpeg_path,
            ffprobe_path,
            ytdlp_path,
        })
    }

    pub async fn download_high_res(
        &self,
        url: &str,
        output_dir: &Path,
        _cookies: Option<String>,
        _min_height: u32,
        _preferred_format: &str,
    ) -> Result<DownloadResult> {
        tokio::fs::create_dir_all(output_dir)
            .await
            .context("Failed to create output directory")?;

        let url_owned = url.to_string();
        let output_dir_owned = output_dir.to_path_buf();
        let ytdlp_path_clone = self.ytdlp_path.clone();
        
        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name = if let Some(path) = &ytdlp_path_clone {
                log::info!("Using bundled yt-dlp: {}", path.display());
                path.as_os_str()
            } else {
                log::info!("Using system yt-dlp");
                std::ffi::OsStr::new("yt-dlp")
            };
            
            let mut cmd = Command::new(cmd_name);
            
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
            
            cmd.arg("--dump-single-json")
                .arg("--no-config")
                .arg("--no-playlist")
                .arg(url_owned.clone())
                .current_dir(&output_dir_owned);

            let output = cmd.output().map_err(|e| {
                anyhow::anyhow!(
                    "Failed to execute yt-dlp: {}. Please ensure yt-dlp is installed and in PATH.",
                    e
                )
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("yt-dlp error: {}", stderr);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.is_empty() {
                anyhow::bail!("yt-dlp returned empty output");
            }

            Ok::<String, anyhow::Error>(stdout.to_string())
        })
        .await
        .context("Failed to spawn download task")??;

        let json_value: Value =
            serde_json::from_str(&result).context("Failed to parse download result")?;

        let file_path = json_value
            .get("_filename")
            .or_else(|| {
                json_value
                    .get("requested_downloads")?
                    .get(0)?
                    .get("filepath")
            })
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let resolution = json_value
            .get("height")
            .and_then(|v| v.as_u64())
            .map(|h| format!("{}p", h))
            .or_else(|| {
                json_value
                    .get("format")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            });

        Ok(DownloadResult {
            success: true,
            file_path,
            title: json_value
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            resolution,
            duration: json_value.get("duration").and_then(|v| v.as_u64()),
            uploader: json_value
                .get("uploader")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            format_id: json_value
                .get("format_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            error: None,
            url: url.to_string(),
        })
    }

    pub async fn get_video_info(&self, url: &str, _cookies: Option<String>) -> Result<Value> {
        let url = url.to_string();
        let ytdlp_path_clone = self.ytdlp_path.clone();
        
        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name = if let Some(path) = &ytdlp_path_clone {
                log::info!("Using bundled yt-dlp: {}", path.display());
                path.as_os_str()
            } else {
                log::info!("Using system yt-dlp");
                std::ffi::OsStr::new("yt-dlp")
            };
            
            let mut cmd = Command::new(cmd_name);
            
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
            
            cmd.arg("--dump-single-json")
                .arg("--no-config")
                .arg("--no-playlist")
                .arg(&url);

            let output = cmd.output().map_err(|e| {
                anyhow::anyhow!(
                    "Failed to execute yt-dlp: {}. Please ensure yt-dlp is installed and in PATH.",
                    e
                )
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("yt-dlp error: {}", stderr);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.is_empty() {
                anyhow::bail!("yt-dlp returned empty output");
            }

            Ok::<String, anyhow::Error>(stdout.to_string())
        })
        .await
        .context("Failed to spawn info task")?
        .context("Failed to get video info")?;

        let json_value: Value =
            serde_json::from_str(&result).context("Failed to parse video info")?;

        Ok(json_value)
    }

    pub async fn download_audio(
        &self,
        url: &str,
        output_dir: &Path,
        _cookies: Option<String>,
    ) -> Result<DownloadResult> {
        tokio::fs::create_dir_all(output_dir)
            .await
            .context("Failed to create output directory")?;

        let url_owned = url.to_string();
        let output_dir_owned = output_dir.to_path_buf();
        let ytdlp_path_clone = self.ytdlp_path.clone();
        
        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name = if let Some(path) = &ytdlp_path_clone {
                log::info!("Using bundled yt-dlp: {}", path.display());
                path.as_os_str()
            } else {
                log::info!("Using system yt-dlp");
                std::ffi::OsStr::new("yt-dlp")
            };
            
            let mut cmd = Command::new(cmd_name);
            
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
            
            cmd.arg("--dump-single-json")
                .arg("--no-config")
                .arg("--no-playlist")
                .arg("-x") // extract audio
                .arg("--audio-format")
                .arg("mp3")
                .arg(url_owned.clone())
                .current_dir(&output_dir_owned);

            let output = cmd.output().map_err(|e| {
                anyhow::anyhow!(
                    "Failed to execute yt-dlp: {}. Please ensure yt-dlp is installed and in PATH.",
                    e
                )
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                anyhow::bail!("yt-dlp error: {}", stderr);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.is_empty() {
                anyhow::bail!("yt-dlp returned empty output");
            }

            Ok::<String, anyhow::Error>(stdout.to_string())
        })
        .await
        .context("Failed to spawn audio download task")??;

        let json_value: Value =
            serde_json::from_str(&result).context("Failed to parse audio download result")?;

        let file_path = json_value
            .get("_filename")
            .or_else(|| {
                json_value
                    .get("requested_downloads")?
                    .get(0)?
                    .get("filepath")
            })
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(DownloadResult {
            success: true,
            file_path,
            title: json_value
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            resolution: Some("Audio".to_string()),
            duration: json_value.get("duration").and_then(|v| v.as_u64()),
            uploader: json_value
                .get("uploader")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            format_id: Some("audio".to_string()),
            error: None,
            url: url.to_string(),
        })
    }
}
