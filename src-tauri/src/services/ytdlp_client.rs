use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use dirs;
use md5::{Digest, Md5};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::ytdlp_config::{CACHE_ENABLED, CACHE_TTL_MINUTES};

#[derive(Clone)]
pub struct CacheEntry {
    pub data: Value,
    pub expires_at: DateTime<Utc>,
}

impl CacheEntry {
    pub fn new(data: Value, ttl_minutes: i64) -> Self {
        Self {
            data,
            expires_at: Utc::now() + Duration::minutes(ttl_minutes),
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }
}

pub struct YtDlpClient {
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    use_cache: bool,
    ffmpeg_path: Option<PathBuf>,
    ytdlp_path: Option<PathBuf>,
}

impl YtDlpClient {
    pub fn new(use_cache: bool) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            use_cache,
            ffmpeg_path: Self::find_ffmpeg(),
            ytdlp_path: None,
        }
    }

    pub fn new_with_path(use_cache: bool, ytdlp_path: Option<PathBuf>) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            use_cache,
            ffmpeg_path: Self::find_ffmpeg(),
            ytdlp_path,
        }
    }

    pub fn default() -> Self {
        Self::new(CACHE_ENABLED)
    }

    fn find_ffmpeg() -> Option<PathBuf> {
        let possible_paths = vec![
            PathBuf::from("ffmpeg.exe"),
            PathBuf::from("ffmpeg"),
            PathBuf::from("resources/binaries/ffmpeg.exe"),
            PathBuf::from("resources/binaries/ffmpeg"),
            PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"),
            dirs::home_dir()
                .map(|h| h.join("ffmpeg").join("bin").join("ffmpeg.exe"))
                .unwrap_or_default(),
            dirs::home_dir()
                .map(|h| {
                    h.join("scoop")
                        .join("apps")
                        .join("ffmpeg")
                        .join("current")
                        .join("bin")
                        .join("ffmpeg.exe")
                })
                .unwrap_or_default(),
        ];

        for path in possible_paths {
            if path.exists() {
                log::info!("Found FFmpeg at: {:?}", path);
                return Some(path);
            }
        }

        log::warn!("FFmpeg not found in any standard location");
        None
    }

    pub fn set_ffmpeg_path(&mut self, path: PathBuf) {
        if path.exists() {
            log::info!("FFmpeg path set to: {:?}", path);
            self.ffmpeg_path = Some(path);
        }
    }

    fn generate_cache_key(
        &self,
        url: &str,
        flat: bool,
        cookies: &Option<HashMap<String, String>>,
    ) -> String {
        let cookie_hash = if let Some(cookies) = cookies {
            let cookie_str = serde_json::to_string(cookies).unwrap_or_default();
            let mut hasher = Md5::new();
            hasher.update(cookie_str.as_bytes());
            format!("{:x}", hasher.finalize())[..8].to_string()
        } else {
            "none".to_string()
        };

        let mut hasher = Md5::new();
        hasher.update(format!("{}{}{}", url, flat, cookie_hash).as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn extract(
        &self,
        url: &str,
        flat: bool,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<Value> {
        let cache_key = self.generate_cache_key(url, flat, &cookies);

        if self.use_cache {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired() {
                    log::debug!("Cache hit for: {}", url);
                    return Ok(entry.data.clone());
                } else {
                    log::debug!("Cache expired for: {}", url);
                }
            }
        }

        log::info!(
            "Extracting info from: {} (flat={}, auth={})",
            url,
            flat,
            cookies.is_some()
        );

        let cookie_file_path = if let Some(cookies) = cookies {
            if !cookies.is_empty() {
                use super::cookie::CookieManager;
                match CookieManager::create_netscape_file(&cookies) {
                    Ok(path) => {
                        log::debug!("Created temporary cookie file: {:?}", path);
                        Some(path)
                    }
                    Err(e) => {
                        log::warn!(
                            "Failed to create cookie file: {}. Proceeding without cookies.",
                            e
                        );
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        let url_owned = url.to_string();
        let cookie_file_clone = cookie_file_path.clone();
        let ffmpeg_path_clone = self.ffmpeg_path.clone();
        let ytdlp_path_clone = self.ytdlp_path.clone();

        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name = if let Some(path) = &ytdlp_path_clone {
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
            
            cmd.arg("--dump-single-json")
                .arg("--no-config")
                .arg("--no-playlist")
                .arg(&url_owned)
                .arg("--no-warnings")
                .arg("--no-check-certificate")
                .arg("--prefer-insecure")
                .arg("--socket-timeout")
                .arg("30");
            if let Some(ffmpeg) = ffmpeg_path_clone {
                cmd.arg("--ffmpeg-location")
                    .arg(ffmpeg.to_string_lossy().to_string());
            }

            if let Some(cookie_path) = cookie_file_clone {
                cmd.arg("--cookies")
                    .arg(cookie_path.to_string_lossy().to_string());
            }

            if flat {
                cmd.arg("--flat-playlist");
            }

            log::debug!("Executing yt-dlp command: {:?}", cmd);

            let output = cmd.output().map_err(|e| {
                anyhow::anyhow!(
                    "Failed to execute yt-dlp: {}. Please ensure yt-dlp is installed and in PATH.",
                    e
                )
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                log::error!(
                    "yt-dlp failed for {}: status={:?}, stderr={}, stdout={}",
                    url_owned,
                    output.status.code(),
                    stderr,
                    stdout
                );

                if stderr.contains("Video unavailable") {
                    anyhow::bail!("Video is unavailable or private");
                } else if stderr.contains("This video is not available") {
                    anyhow::bail!("Video is not available in your region");
                } else if stderr.contains("Sign in to confirm") {
                    anyhow::bail!("Authentication required. Please provide valid cookies.");
                } else if stderr.contains("HTTP Error 429") {
                    anyhow::bail!("Rate limited by YouTube. Please try again later.");
                } else {
                    anyhow::bail!(
                        "yt-dlp error: {}",
                        stderr.lines().next().unwrap_or("Unknown error")
                    );
                }
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            log::debug!("yt-dlp output for {}: {} bytes", url_owned, stdout.len());

            if stdout.is_empty() {
                anyhow::bail!("yt-dlp returned empty output");
            }

            Ok::<String, anyhow::Error>(stdout.to_string())
        })
        .await
        .context("Failed to spawn extraction task")??;

        if let Some(cookie_path) = cookie_file_path {
            use super::cookie::CookieManager;
            CookieManager::cleanup_temp_file(&cookie_path);
        }

        let json_value: Value =
            serde_json::from_str(&result).context("Failed to parse yt-dlp output as JSON")?;

        if self.use_cache {
            let mut cache = self.cache.write().await;
            cache.insert(
                cache_key,
                CacheEntry::new(json_value.clone(), CACHE_TTL_MINUTES),
            );

            if cache.len() > 100 {
                cache.retain(|_, entry| !entry.is_expired());

                if cache.len() > 100 {
                    log::info!("Cache size limit reached, clearing old entries");
                    let keep_count = 80;
                    let remove_count = cache.len() - keep_count;
                    let mut entries: Vec<_> = cache.iter().collect();
                    entries.sort_by_key(|(_, entry)| entry.expires_at);
                    let keys_to_remove: Vec<_> = entries
                        .iter()
                        .take(remove_count)
                        .map(|(k, _)| (*k).clone())
                        .collect();
                    for key in keys_to_remove {
                        cache.remove(&key);
                    }
                }
            }
        }

        log::info!("Successfully extracted info from: {}", url);
        Ok(json_value)
    }

    pub async fn extract_batch(
        &self,
        urls: Vec<String>,
        flat: bool,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<HashMap<String, Value>> {
        let mut results = HashMap::new();
        let _tasks: Vec<tokio::task::JoinHandle<(String, Result<HashMap<String, Value>>)>> =
            Vec::new();

        log::info!("Starting batch extraction for {} URLs", urls.len());

        const BATCH_SIZE: usize = 5;
        for chunk in urls.chunks(BATCH_SIZE) {
            let mut chunk_tasks = Vec::new();

            for url in chunk {
                let url_clone = url.clone();
                let cookies_clone = cookies.clone();
                let client = self.clone();

                let task = tokio::spawn(async move {
                    (
                        url_clone.clone(),
                        client.extract(&url_clone, flat, cookies_clone).await,
                    )
                });

                chunk_tasks.push(task);
            }

            for task in chunk_tasks {
                match task.await {
                    Ok((url, Ok(result))) => {
                        results.insert(url, result);
                    }
                    Ok((url, Err(e))) => {
                        log::error!("Failed to extract {}: {}", url, e);
                    }
                    Err(e) => {
                        log::error!("Task panicked: {}", e);
                    }
                }
            }

            if urls.len() > BATCH_SIZE {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }

        log::info!(
            "Batch extraction completed: {}/{} successful",
            results.len(),
            urls.len()
        );

        Ok(results)
    }

    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        let count = cache.len();
        cache.clear();
        log::info!("Cache cleared: {} entries removed", count);
    }
}

impl Clone for YtDlpClient {
    fn clone(&self) -> Self {
        Self {
            cache: Arc::clone(&self.cache),
            use_cache: self.use_cache,
            ffmpeg_path: self.ffmpeg_path.clone(),
            ytdlp_path: self.ytdlp_path.clone(),
        }
    }
}
