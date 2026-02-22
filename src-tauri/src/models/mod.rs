use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    pub duration: u64,
    pub thumbnail_url: String,
    pub view_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StreamInfo {
    pub video_url: String,
    pub audio_url: String,
    pub subtitle_urls: Vec<String>,
    pub expiry: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaylistInfo {
    pub videos: Vec<VideoInfo>,
    pub title: String,
    pub channel: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserPlaylist {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub video_count: u64,
    pub thumbnail_url: String,
    pub is_private: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadHistoryItem {
    pub id: Option<i32>,
    pub video_id: String,
    pub title: String,
    pub channel: Option<String>,
    pub downloaded_at: Option<String>,
    pub file_path: String,
    pub file_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub id: String,
    pub video_id: Option<String>,
    pub url: Option<String>,
    pub output_dir: Option<String>,
    pub unique_filename: Option<bool>,
    pub title: String,
    pub status: String,
    pub progress: f64,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub format_id: Option<String>,
    pub resolution: Option<String>,
    pub codec_info: Option<String>,
    pub file_size: Option<String>,
    pub fps: Option<i64>,
    pub thumbnail_url: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

// Database models - matching the database service
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub video_count: i64,
    pub thumbnail_url: Option<String>,
    pub uploader: Option<String>,
    pub channel: Option<String>,
    pub channel_id: Option<String>,
    pub view_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub id: String,
    pub title: String,
    pub channel_name: Option<String>,
    pub channel_id: Option<String>,
    pub view_count: Option<i64>,
    pub upload_date: Option<String>,
    pub duration: Option<String>,
    pub thumbnail_url: Option<String>,
    pub is_short: bool,
    pub is_liked: bool,
    pub is_downloaded: bool,
    pub playlist_id: Option<String>,
    pub position: Option<i64>,
    pub completion_percentage: Option<f32>,
    pub file_path: Option<String>,
    pub file_size: Option<i64>,
}

/// Website cookie storage for multi-site authentication
/// Supports yt-dlp's 1000+ website compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteCookie {
    pub id: String,
    pub name: String,
    /// The website URL or domain (e.g., "youtube.com", "vimeo.com")
    pub website_url: String,
    /// Domain pattern for cookie matching (e.g., ".youtube.com")
    pub domain_pattern: String,
    /// Cookie content in Netscape format
    pub content: String,
    /// Whether this is the default cookie for this domain
    pub is_default: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}
