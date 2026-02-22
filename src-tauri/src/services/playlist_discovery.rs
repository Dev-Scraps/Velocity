use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tokio::time::timeout;

use super::YtDlpClient;

pub const PLAYLIST_URLS: &[(&str, &str)] = &[
    // Note: @me/playlists doesn't work with yt-dlp, use alternative approaches
    ("https://www.youtube.com/feed/library", "Library"),
    ("https://www.youtube.com/feed/playlists", "Playlists"),
    ("https://www.youtube.com/@me/playlists", "My Playlists"),
];

pub const SPECIAL_PLAYLISTS: &[(&str, &str)] = &[
    ("LL", "Liked Videos"),
    ("WL", "Watch Later"),
];

pub const VALID_PLAYLIST_PREFIXES: &[&str] = &[
    "PL", "UU", "LL", "WL", "FL", "RD", "OL", "UL", "VL", "CL",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPlaylist {
    pub id: String,
    pub title: String,
    pub playlist_count: u64,
    pub thumbnail: Option<String>,
    pub url: String,
    pub uploader: String,
    pub is_private: bool,
    pub description: String,
    pub playlist_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistDiscoveryResponse {
    pub playlists: Vec<DiscoveredPlaylist>,
    pub count: usize,
    pub status: String,
    pub message: String,
}

pub struct PlaylistDiscovery {
    client: YtDlpClient,
}

impl PlaylistDiscovery {
    pub fn new(client: YtDlpClient) -> Self {
        Self { client }
    }

    pub fn default() -> Self {
        Self::new(YtDlpClient::default())
    }

    pub async fn discover(
        &self,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<PlaylistDiscoveryResponse> {
        let mut all_playlists = Vec::new();
        let mut seen_ids = HashSet::new();

        log::info!("Starting playlist discovery (auth={})", cookies.is_some());

        // 1. Add special playlists (Liked, Watch Later, etc.)
        log::info!("Adding {} special playlists", SPECIAL_PLAYLISTS.len());
        for (sid, title) in SPECIAL_PLAYLISTS {
            all_playlists.push(DiscoveredPlaylist {
                id: sid.to_string(),
                title: title.to_string(),
                playlist_type: "special".to_string(),
                url: format!("https://www.youtube.com/playlist?list={}", sid),
                playlist_count: 0,
                is_private: false,
                thumbnail: None,
                uploader: "YouTube".to_string(),
                description: String::new(),
            });
            seen_ids.insert(sid.to_string());
        }

        if cookies.is_none() {
            log::info!("No cookies provided - returning limited results");
            return Ok(self.build_response(all_playlists, "limited"));
        }

        // 2. Scrape YouTube library/playlists pages with timeout
        log::info!("Discovering private playlists...");

        for (url, desc) in PLAYLIST_URLS {
            match timeout(
                Duration::from_secs(30),
                self.fetch_playlist_page(url, cookies.clone()),
            )
            .await
            {
                Ok(Ok(entries)) => {
                    let entries: Vec<serde_json::Value> = entries;
                    log::info!("Found {} entries in {}", entries.len(), desc);

                    for entry in entries {
                        if entry.is_null() {
                            continue;
                        }

                        if let Some(pid) = self.get_playlist_id(&entry) {
                            if !seen_ids.contains(&pid) && self.is_valid_pid(&pid) {
                                if let Some(playlist_info) = self.parse_playlist_info(&entry, &pid) {
                                    let title = playlist_info.title.clone();
                                    all_playlists.push(playlist_info);
                                    seen_ids.insert(pid.clone());
                                    log::debug!("Added playlist: {} ({})", title, pid);
                                }
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    log::error!("Error fetching {}: {}", desc, e);
                }
                Err(_) => {
                    log::error!("Timeout fetching {}", desc);
                }
            }
        }

        log::info!(
            "Discovery complete - found {} playlists",
            all_playlists.len()
        );

        Ok(self.build_response(all_playlists, "success"))
    }

    async fn fetch_playlist_page(
        &self,
        url: &str,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<Vec<serde_json::Value>> {
        log::info!("Fetching from {}...", &url[..50.min(url.len())]);

        let raw = self
            .client
            .extract(url, true, cookies)
            .await
            .context("Failed to extract playlist page")?;

        Ok(self.extract_entries(&raw))
    }

    fn extract_entries(&self, raw: &serde_json::Value) -> Vec<serde_json::Value> {
        if raw.is_null() {
            return Vec::new();
        }

        let entries = if raw.get("_type").and_then(|t| t.as_str()) == Some("playlist") {
            raw.get("entries")
        } else {
            raw.get("entries")
        };

        entries
            .and_then(|e| e.as_array())
            .map(|arr| arr.clone())
            .unwrap_or_default()
    }

    fn get_playlist_id(&self, entry: &serde_json::Value) -> Option<String> {
        if !entry.is_object() {
            return None;
        }

        // Direct ID
        if let Some(pid) = entry
            .get("id")
            .or_else(|| entry.get("playlist_id"))
            .and_then(|v| v.as_str())
        {
            return Some(pid.to_string());
        }

        // Try to extract from URL
        let url = entry
            .get("url")
            .or_else(|| entry.get("webpage_url"))
            .and_then(|u| u.as_str())
            .unwrap_or("");

        if let Some(pos) = url.find("list=") {
            let after_list = &url[pos + 5..];
            if let Some(end) = after_list.find('&') {
                return Some(after_list[..end].to_string());
            } else {
                return Some(after_list.to_string());
            }
        }

        None
    }

    fn is_valid_pid(&self, pid: &str) -> bool {
        if pid.len() < 2 {
            return false;
        }

        // Check against known prefixes
        for prefix in VALID_PLAYLIST_PREFIXES {
            if pid.starts_with(prefix) {
                return true;
            }
        }

        // Also accept standard playlist IDs
        let valid_starters = ["PL", "OLAK", "RD", "WL", "LL"];
        for starter in &valid_starters {
            if pid.starts_with(starter) {
                return true;
            }
        }

        false
    }

    fn parse_playlist_info(&self, entry: &serde_json::Value, pid: &str) -> Option<DiscoveredPlaylist> {
        let title = entry
            .get("title")
            .or_else(|| entry.get("name"))
            .and_then(|t| t.as_str())
            .unwrap_or("Untitled Playlist")
            .to_string();

        let playlist_count = entry
            .get("playlist_count")
            .or_else(|| entry.get("video_count"))
            .or_else(|| entry.get("entry_count"))
            .and_then(|c| c.as_u64())
            .unwrap_or(0);

        let thumbnail = entry
            .get("thumbnail")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                entry
                    .get("thumbnails")
                    .and_then(|t| t.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|t| t.get("url"))
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string())
            });

        let url = entry
            .get("url")
            .or_else(|| entry.get("webpage_url"))
            .and_then(|u| u.as_str())
            .unwrap_or(&format!("https://www.youtube.com/playlist?list={}", pid))
            .to_string();

        let uploader = entry
            .get("uploader")
            .or_else(|| entry.get("channel"))
            .or_else(|| entry.get("channel_name"))
            .and_then(|u| u.as_str())
            .unwrap_or("You")
            .to_string();

        let is_private = entry
            .get("availability")
            .and_then(|a| a.as_str())
            == Some("private");

        let description = entry
            .get("description")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string();

        Some(DiscoveredPlaylist {
            id: pid.to_string(),
            title,
            playlist_count,
            thumbnail,
            url,
            uploader,
            is_private,
            description,
            playlist_type: "custom".to_string(),
        })
    }

    fn build_response(&self, playlists: Vec<DiscoveredPlaylist>, status: &str) -> PlaylistDiscoveryResponse {
        PlaylistDiscoveryResponse {
            count: playlists.len(),
            message: format!("Found {} playlists", playlists.len()),
            status: status.to_string(),
            playlists,
        }
    }
}
