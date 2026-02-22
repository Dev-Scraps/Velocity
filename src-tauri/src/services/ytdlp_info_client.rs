use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// Basic cache implementation similar to YtDlpClient but simplified
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InfoCacheEntry {
    pub data: Value,
    pub expires_at: DateTime<Utc>,
}

impl InfoCacheEntry {
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

#[derive(Clone)]
pub struct YtDlpInfoClient {
    cache: Arc<RwLock<HashMap<String, InfoCacheEntry>>>,
    cache_ttl_minutes: i64,
    ytdlp_path: Option<PathBuf>,
}

impl YtDlpInfoClient {
    pub fn new(cache_ttl_minutes: i64) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_minutes,
            ytdlp_path: None,
        }
    }

    pub fn new_with_path(cache_ttl_minutes: i64, ytdlp_path: Option<PathBuf>) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_minutes,
            ytdlp_path,
        }
    }

    pub fn default() -> Self {
        Self::new(60) // Default 1 hour TTL
    }

    fn generate_cache_key(&self, url: &str) -> String {
        let mut hasher = Md5::new();
        hasher.update(url.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn extract_info(&self, url: &str, cookies_file: Option<PathBuf>) -> Result<Value> {
        let cache_key = self.generate_cache_key(url);

        // Check cache
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired() {
                    log::debug!("[InfoClient] Cache hit for: {}", url);
                    return Ok(entry.data.clone());
                }
            }
        }

        log::info!("[InfoClient] Fetching info for: {}", url);

        let url_owned = url.to_string();
        let ytdlp_path_clone = self.ytdlp_path.clone();
        
        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name: &std::ffi::OsStr = if let Some(path) = &ytdlp_path_clone {
                log::info!("[InfoClient] Using bundled yt-dlp: {}", path.display());
                path.as_os_str()
            } else {
                log::info!("[InfoClient] Using system yt-dlp");
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

            // Explicitly NOT adding ffmpeg location
            if let Some(cookies) = cookies_file {
                 cmd.arg("--cookies").arg(cookies);
            }

            log::debug!("[InfoClient] Executing command: {:?}", cmd);

            let output = cmd.output().map_err(|e| {
                anyhow::anyhow!(
                    "Failed to execute yt-dlp: {}. Please ensure yt-dlp is installed and in PATH.",
                    e
                )
            })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::error!(
                    "[InfoClient] yt-dlp failed for {}: stderr={}",
                    url_owned,
                    stderr
                );
                anyhow::bail!("yt-dlp error: {}", stderr);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.is_empty() {
                anyhow::bail!("yt-dlp returned empty output");
            }

            Ok::<String, anyhow::Error>(stdout.to_string())
        })
        .await
        .context("Failed to spawn extraction task")??;

        let json_value: Value =
            serde_json::from_str(&result).context("Failed to parse yt-dlp output as JSON")?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            cache.insert(
                cache_key,
                InfoCacheEntry::new(json_value.clone(), self.cache_ttl_minutes),
            );

            // Simple cache cleanup if too large
            if cache.len() > 100 {
                cache.retain(|_, entry| !entry.is_expired());
            }
        }

        Ok(json_value)
    }

    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
        log::info!("[InfoClient] Cache cleared");
    }

    pub async fn get_direct_url(
        &self,
        url: &str,
        cookies_file: Option<PathBuf>,
        format: &str,
    ) -> Result<Option<String>> {
        let url_owned = url.to_string();
        let format_owned = format.to_string();
        let ytdlp_path_clone = self.ytdlp_path.clone();

        let result: String = tokio::task::spawn_blocking(move || {
            let cmd_name: &std::ffi::OsStr = if let Some(path) = &ytdlp_path_clone {
                log::info!("[InfoClient] Using bundled yt-dlp: {}", path.display());
                path.as_os_str()
            } else {
                log::info!("[InfoClient] Using system yt-dlp");
                std::ffi::OsStr::new("yt-dlp")
            };

            let mut cmd = std::process::Command::new(cmd_name);

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000);
            }

            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                cmd.process_group(0);
            }

            cmd.arg("--get-url")
                .arg("--no-config")
                .arg("--no-playlist")
                .arg("--no-warnings")
                .arg("--no-check-certificate")
                .arg("--prefer-insecure")
                .arg("--format")
                .arg(format_owned)
                .arg(&url_owned);

            if let Some(cookies) = cookies_file {
                cmd.arg("--cookies").arg(cookies);
            }

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

            Ok::<String, anyhow::Error>(String::from_utf8_lossy(&output.stdout).to_string())
        })
        .await
        .context("Failed to spawn get-url task")??;

        let direct_url = result.lines().next().map(|line| line.trim()).unwrap_or("");
        if direct_url.is_empty() {
            Ok(None)
        } else {
            Ok(Some(direct_url.to_string()))
        }
    }
}
