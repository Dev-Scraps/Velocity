use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::YtDlpClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistVideoEntry {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub channel_id: String,
    pub duration: String,
    pub duration_seconds: u64,
    pub thumbnail_url: Option<String>,
    pub url: String,
    pub playlist_index: usize,
    pub upload_date: Option<String>,
    pub view_count: Option<u64>,
    pub description: String,
    pub is_live: bool,
    pub is_playable: bool,
    pub availability: String,
    pub formats_available: Option<bool>,
    pub subtitles_available: Option<bool>,
    pub like_count: Option<u64>,
    pub comment_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistContentResponse {
    pub playlist_id: String,
    pub title: String,
    pub uploader: String,
    pub uploader_id: Option<String>,
    pub playlist_count: usize,
    pub entries: Vec<PlaylistVideoEntry>,
    pub error: bool,
    pub description: String,
    pub thumbnail: Option<String>,
    pub message: Option<String>,
}

pub struct PlaylistContent {
    client: YtDlpClient,
}

impl PlaylistContent {
    pub fn new(client: YtDlpClient) -> Self {
        Self { client }
    }

    pub fn default() -> Self {
        Self::new(YtDlpClient::default())
    }

    pub async fn get_items(
        &self,
        playlist_id: &str,
        cookies: Option<HashMap<String, String>>,
        flat: bool,
    ) -> Result<PlaylistContentResponse> {
        let url = format!("https://www.youtube.com/playlist?list={}", playlist_id);
        log::info!(
            "Fetching videos for playlist: {} (auth={})",
            playlist_id,
            cookies.is_some()
        );

        let result = self
            .client
            .extract(&url, flat, cookies)
            .await
            .context("Failed to extract playlist")?;

        if result.is_null() {
            return Ok(PlaylistContentResponse {
                error: true,
                message: Some("Failed to fetch playlist items".to_string()),
                playlist_id: playlist_id.to_string(),
                ..Default::default()
            });
        }

        let empty_entries: Vec<serde_json::Value> = vec![];
        let entries = result
            .get("entries")
            .and_then(|e| e.as_array())
            .unwrap_or(&empty_entries);

        log::info!(
            "Extracted {} videos from playlist {}",
            entries.len(),
            playlist_id
        );

        let mut normalized_entries = Vec::new();
        for (idx, entry) in entries.iter().enumerate() {
            if let Some(video_info) = self.normalize_video_entry(entry, idx + 1) {
                normalized_entries.push(video_info);
            }
        }

        let title = result
            .get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("Unknown Playlist")
            .to_string();

        let uploader = result
            .get("uploader")
            .or_else(|| result.get("channel"))
            .and_then(|u| u.as_str())
            .unwrap_or("Unknown Uploader")
            .to_string();

        let uploader_id = result
            .get("uploader_id")
            .or_else(|| result.get("channel_id"))
            .or_else(|| result.get("channel_url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        let description = result
            .get("description")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string();

        let thumbnail = result
            .get("thumbnail")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                result
                    .get("thumbnails")
                    .and_then(|t| t.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|t| t.get("url"))
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string())
            });

        log::info!(
            "Successfully extracted {} videos",
            normalized_entries.len()
        );

        Ok(PlaylistContentResponse {
            playlist_id: playlist_id.to_string(),
            title,
            uploader,
            uploader_id,
            playlist_count: normalized_entries.len(),
            entries: normalized_entries,
            error: false,
            description,
            thumbnail,
            message: None,
        })
    }

    fn normalize_video_entry(&self, entry: &serde_json::Value, playlist_index: usize) -> Option<PlaylistVideoEntry> {
        if !entry.is_object() {
            return None;
        }

        let video_id = entry
            .get("id")
            .or_else(|| entry.get("video_id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())?;

        if video_id.is_empty() {
            log::debug!("Skipping entry without video_id: {:?}", entry);
            return None;
        }

        let url = entry
            .get("url")
            .or_else(|| entry.get("webpage_url"))
            .and_then(|u| u.as_str())
            .unwrap_or(&format!("https://www.youtube.com/watch?v={}", video_id))
            .to_string();

        let duration = entry.get("duration").and_then(|d| d.as_u64()).unwrap_or(0);
        let duration_str = if duration > 0 {
            Self::format_duration(duration)
        } else {
            "0:00".to_string()
        };

        let uploader = entry
            .get("uploader")
            .or_else(|| entry.get("channel"))
            .and_then(|u| u.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let uploader_id = entry
            .get("uploader_id")
            .or_else(|| entry.get("channel_id"))
            .and_then(|u| u.as_str())
            .unwrap_or("")
            .to_string();

        let thumbnail = entry
            .get("thumbnail")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                entry
                    .get("thumbnails")
                    .and_then(|t| t.as_array())
                    .and_then(|arr| {
                        arr.iter()
                            .filter_map(|t| t.get("height").and_then(|h| h.as_u64()))
                            .max()
                            .and_then(|max_height| {
                                arr.iter()
                                    .find(|t| t.get("height").and_then(|h| h.as_u64()) == Some(max_height))
                                    .and_then(|t| t.get("url"))
                                    .and_then(|u| u.as_str())
                                    .map(|s| s.to_string())
                            })
                    })
            });

        Some(PlaylistVideoEntry {
            id: video_id,
            title: entry
                .get("title")
                .and_then(|t| t.as_str())
                .unwrap_or("Unknown Title")
                .to_string(),
            channel: uploader,
            channel_id: uploader_id,
            duration: duration_str,
            duration_seconds: duration,
            thumbnail_url: thumbnail,
            url,
            playlist_index,
            upload_date: entry
                .get("upload_date")
                .or_else(|| entry.get("release_date"))
                .and_then(|d| d.as_str())
                .map(|s| s.to_string()),
            view_count: entry.get("view_count").and_then(|v| v.as_u64()),
            description: entry
                .get("description")
                .and_then(|d| d.as_str())
                .unwrap_or("")
                .to_string(),
            is_live: entry.get("is_live").and_then(|l| l.as_bool()).unwrap_or(false),
            is_playable: entry
                .get("is_playable")
                .and_then(|p| p.as_bool())
                .unwrap_or(true),
            availability: entry
                .get("availability")
                .and_then(|a| a.as_str())
                .unwrap_or("public")
                .to_string(),
            formats_available: None,
            subtitles_available: None,
            like_count: None,
            comment_count: None,
        })
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

    pub async fn get_items_detailed(
        &self,
        playlist_id: &str,
        cookies: Option<HashMap<String, String>>,
        include_full_metadata: bool,
    ) -> Result<PlaylistContentResponse> {
        log::info!("Fetching detailed info for playlist {}", playlist_id);

        let mut result = self.get_items(playlist_id, cookies.clone(), true).await?;

        if result.error {
            return Ok(result);
        }

        if include_full_metadata && !result.entries.is_empty() {
            log::info!(
                "Fetching full metadata for {} videos",
                result.entries.len()
            );

            for entry in &mut result.entries {
                match self.client.extract(&entry.url, false, cookies.clone()).await {
                    Ok(full_info) => {
                        entry.formats_available = Some(
                            full_info
                                .get("formats")
                                .and_then(|f| f.as_array())
                                .map(|arr| !arr.is_empty())
                                .unwrap_or(false),
                        );
                        entry.subtitles_available = Some(
                            full_info
                                .get("subtitles")
                                .or_else(|| full_info.get("automatic_captions"))
                                .and_then(|s| s.as_object())
                                .map(|obj| !obj.is_empty())
                                .unwrap_or(false),
                        );
                        entry.like_count = full_info.get("like_count").and_then(|l| l.as_u64());
                        entry.comment_count =
                            full_info.get("comment_count").and_then(|c| c.as_u64());
                    }
                    Err(e) => {
                        log::debug!(
                            "Could not fetch full metadata for {}: {}",
                            entry.id,
                            e
                        );
                    }
                }
            }
        }

        Ok(result)
    }
}

impl Default for PlaylistContentResponse {
    fn default() -> Self {
        Self {
            playlist_id: String::new(),
            title: String::new(),
            uploader: String::new(),
            uploader_id: None,
            playlist_count: 0,
            entries: Vec::new(),
            error: false,
            description: String::new(),
            thumbnail: None,
            message: None,
        }
    }
}
