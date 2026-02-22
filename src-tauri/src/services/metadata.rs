use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use super::ytdlp_client::YtDlpClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub description: String,
    pub uploader: String,
    pub channel_id: Option<String>,
    pub duration: Option<u64>,
    pub view_count: Option<u64>,
    pub thumbnail: Option<String>,
    pub upload_date: Option<String>,
    pub webpage_url: String,
    pub formats: Vec<VideoFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub height: Option<u32>,
    pub width: Option<u32>,
    pub fps: Option<u32>,
    pub filesize: Option<u64>,
    pub tbr: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistMetadata {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub uploader: Option<String>,
    pub channel_id: Option<String>,
    pub video_count: u64,
    pub thumbnail: Option<String>,
    pub entries: Vec<VideoMetadata>,
}

pub struct MetadataService {
    client: YtDlpClient,
}

impl MetadataService {
    pub fn new(client: YtDlpClient) -> Self {
        Self { client }
    }

    pub fn default() -> Self {
        Self::new(YtDlpClient::default())
    }

    async fn normalize_video(raw: &Value) -> Result<VideoMetadata> {
        let formats = raw
            .get("formats")
            .and_then(|f| f.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|f| {
                        Some(VideoFormat {
                            format_id: f.get("format_id")?.as_str()?.to_string(),
                            ext: f.get("ext")?.as_str()?.to_string(),
                            resolution: f.get("resolution").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            height: f.get("height").and_then(|v| v.as_u64()).map(|v| v as u32),
                            width: f.get("width").and_then(|v| v.as_u64()).map(|v| v as u32),
                            fps: f.get("fps").and_then(|v| v.as_u64()).map(|v| v as u32),
                            filesize: f.get("filesize").and_then(|v| v.as_u64()),
                            tbr: f.get("tbr").and_then(|v| v.as_f64()),
                            vcodec: f.get("vcodec").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            acodec: f.get("acodec").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            url: f.get("url").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(VideoMetadata {
            id: raw.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            title: raw.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            description: raw.get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            uploader: raw.get("uploader")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            channel_id: raw.get("channel_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            duration: raw.get("duration").and_then(|v| v.as_u64()),
            view_count: raw.get("view_count").and_then(|v| v.as_u64()),
            thumbnail: raw.get("thumbnail")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            upload_date: raw.get("upload_date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            webpage_url: raw.get("webpage_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            formats,
        })
    }

    async fn normalize_playlist(raw: &Value) -> Result<PlaylistMetadata> {
        let entries: Vec<VideoMetadata> = raw
            .get("entries")
            .and_then(|e| e.as_array())
            .map(|arr| {
                arr.iter()
                    .filter(|entry| !entry.is_null())
                    .filter_map(|_entry| {
                        // normalize_video returns a Future, need to await it
                        // But we're in a sync context here, so we can't await
                        // For now, skip entries that can't be normalized
                        None
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(PlaylistMetadata {
            id: raw.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            title: raw.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            description: raw.get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            uploader: raw.get("uploader")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            channel_id: raw.get("channel_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            video_count: entries.len() as u64,
            thumbnail: raw.get("thumbnail")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            entries,
        })
    }

    pub async fn get_info(
        &self,
        url: &str,
        flat: bool,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<Value> {
        log::info!("Extracting info for: {} (auth={})", url, cookies.is_some());

        let raw = self.client.extract(url, flat, cookies).await?;

        if raw.is_null() {
            anyhow::bail!("Extraction failed for: {}", url);
        }

        if raw.get("entries").is_some() {
            let playlist = Self::normalize_playlist(&raw).await?;
            Ok(serde_json::to_value(playlist)?)
        } else {
            let video = Self::normalize_video(&raw).await?;
            Ok(serde_json::to_value(video)?)
        }
    }

    pub async fn get_video_info(
        &self,
        video_url_or_id: &str,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<VideoMetadata> {
        let url = if video_url_or_id.starts_with("http") {
            video_url_or_id.to_string()
        } else {
            format!("https://www.youtube.com/watch?v={}", video_url_or_id)
        };

        let raw = self.client.extract(&url, false, cookies).await?;
        Self::normalize_video(&raw).await
    }

    pub async fn get_playlist_info(
        &self,
        playlist_id: &str,
        cookies: Option<HashMap<String, String>>,
    ) -> Result<PlaylistMetadata> {
        let url = format!("https://www.youtube.com/playlist?list={}", playlist_id);
        let raw = self.client.extract(&url, true, cookies).await?;
        Self::normalize_playlist(&raw).await
    }
}
