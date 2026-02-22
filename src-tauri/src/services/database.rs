use super::migrations::Migrator;
use crate::models::{DownloadHistoryItem, DownloadTask, Playlist, Video};
use rusqlite::{params, Connection, Result, Row};
use std::path::PathBuf;

/// Helper function to extract a Video from a database row
/// This eliminates code duplication across multiple query methods
fn video_from_row(row: &Row) -> Result<Video> {
    Ok(Video {
        id: row.get(0)?,
        title: row.get(1)?,
        channel_name: row.get(2)?,
        channel_id: row.get(3)?,
        view_count: row.get(4)?,
        upload_date: row.get(5)?,
        duration: row.get(6)?,
        thumbnail_url: row.get(7)?,
        is_short: row.get::<_, i32>(8)? == 1,
        is_liked: row.get::<_, i32>(9)? == 1,
        is_downloaded: row.get::<_, i32>(10)? == 1,
        playlist_id: row.get(11)?,
        position: row.get(12)?,
        completion_percentage: row.get(13)?,
        file_path: row.get(14)?,
        file_size: row.get(15)?,
    })
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &PathBuf) -> Result<Self> {
        // Run migrations first
        Migrator::migrate(db_path)?;

        let conn = Connection::open(db_path)?;

        // Enable WAL mode for better performance
        conn.pragma_update(None, "journal_mode", &"WAL")?;
        conn.pragma_update(None, "synchronous", &"NORMAL")?;
        conn.pragma_update(None, "cache_size", &10000)?;

        Ok(Database { conn })
    }

    pub fn get_all_playlists(&self) -> Result<Vec<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, description, video_count, thumbnail_url, uploader, channel, channel_id, view_count 
             FROM playlists 
             ORDER BY title"
        )?;

        let playlists = stmt
            .query_map([], |row| {
                Ok(Playlist {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    video_count: row.get(3)?,
                    thumbnail_url: row.get(4)?,
                    uploader: row.get(5)?,
                    channel: row.get(6)?,
                    channel_id: row.get(7)?,
                    view_count: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(playlists)
    }

    pub fn upsert_playlist(&self, playlist: &Playlist) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO playlists 
             (id, title, description, video_count, thumbnail_url, uploader, channel, channel_id, view_count, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)",
            params![
                playlist.id,
                playlist.title,
                playlist.description,
                playlist.video_count,
                playlist.thumbnail_url,
                playlist.uploader,
                playlist.channel,
                playlist.channel_id,
                playlist.view_count
            ],
        )?;
        Ok(())
    }

    pub fn get_liked_videos(&self) -> Result<Vec<Video>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, channel_name, channel_id, view_count, upload_date, duration, thumbnail_url, 
                    is_short, is_liked, is_downloaded, playlist_id, position, completion_percentage, file_path, file_size
             FROM videos 
             WHERE is_liked = 1 
             ORDER BY added_at DESC"
        )?;

        let videos = stmt
            .query_map([], |row| video_from_row(row))?
            .collect::<Result<Vec<_>>>()?;

        Ok(videos)
    }

    pub fn get_downloaded_videos(&self) -> Result<Vec<Video>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, channel_name, channel_id, view_count, upload_date, duration, thumbnail_url, 
                    is_short, is_liked, is_downloaded, playlist_id, position, completion_percentage, file_path, file_size
             FROM videos 
             WHERE is_downloaded = 1 
             ORDER BY added_at DESC"
        )?;

        let videos = stmt
            .query_map([], |row| video_from_row(row))?
            .collect::<Result<Vec<_>>>()?;

        Ok(videos)
    }

    pub fn get_videos_by_playlist(&self, playlist_id: &str) -> Result<Vec<Video>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, channel_name, channel_id, view_count, upload_date, duration, thumbnail_url, 
                    is_short, is_liked, is_downloaded, playlist_id, position, completion_percentage, file_path, file_size
             FROM videos 
             WHERE playlist_id = ?1 
             ORDER BY position"
        )?;

        let videos = stmt
            .query_map([playlist_id], |row| video_from_row(row))?
            .collect::<Result<Vec<_>>>()?;

        Ok(videos)
    }

    pub fn search_videos(&self, query: &str) -> Result<Vec<Video>> {
        let pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, title, channel_name, channel_id, view_count, upload_date, duration, thumbnail_url, 
                    is_short, is_liked, is_downloaded, playlist_id, position, completion_percentage, file_path, file_size
             FROM videos 
             WHERE title LIKE ?1 OR channel_name LIKE ?1 
             ORDER BY added_at DESC 
             LIMIT 50"
        )?;

        let videos = stmt
            .query_map([&pattern], |row| video_from_row(row))?
            .collect::<Result<Vec<_>>>()?;

        Ok(videos)
    }

    pub fn upsert_video(&self, video: &Video) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO videos 
             (id, title, channel_name, channel_id, view_count, upload_date, duration, thumbnail_url, 
              is_short, is_liked, is_downloaded, playlist_id, position, completion_percentage, file_path, file_size)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                video.id,
                video.title,
                video.channel_name,
                video.channel_id,
                video.view_count,
                video.upload_date,
                video.duration,
                video.thumbnail_url,
                video.is_short,
                video.is_liked,
                video.is_downloaded,
                video.playlist_id,
                video.position,
                video.completion_percentage,
                video.file_path,
                video.file_size
            ],
        )?;
        Ok(())
    }

    pub fn add_to_download_history(&self, item: &DownloadHistoryItem) -> Result<()> {
        self.conn.execute(
            "INSERT INTO download_history (video_id, title, channel, file_path, file_size)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                item.video_id,
                item.title,
                item.channel,
                item.file_path,
                item.file_size
            ],
        )?;
        Ok(())
    }

    pub fn get_download_history(&self) -> Result<Vec<DownloadHistoryItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, video_id, title, channel, downloaded_at, file_path, file_size
             FROM download_history 
             ORDER BY downloaded_at DESC",
        )?;

        let items = stmt
            .query_map([], |row| {
                Ok(DownloadHistoryItem {
                    id: Some(row.get(0)?),
                    video_id: row.get(1)?,
                    title: row.get(2)?,
                    channel: row.get(3)?,
                    downloaded_at: row.get(4)?,
                    file_path: row.get(5)?,
                    file_size: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(items)
    }

    pub fn clear_download_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM download_history", [])?;
        Ok(())
    }

    pub fn delete_downloaded_video(&self, video_id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM videos WHERE id = ?1", [video_id])?;

        Ok(())
    }

    pub fn upsert_download_task(&self, task: &DownloadTask) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO download_tasks
             (id, video_id, url, output_dir, unique_filename, title, status, progress, speed, eta, format_id, resolution, codec_info, file_size, fps, thumbnail_url, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CURRENT_TIMESTAMP)",
            params![
                task.id,
                task.video_id,
                task.url,
                task.output_dir,
                task.unique_filename,
                task.title,
                task.status,
                task.progress,
                task.speed,
                task.eta,
                task.format_id,
                task.resolution,
                task.codec_info,
                task.file_size,
                task.fps,
                task.thumbnail_url,
            ],
        )?;
        Ok(())
    }

    pub fn get_download_tasks(&self) -> Result<Vec<DownloadTask>> {
        // Simple query without query_map to avoid rusqlite API issues
        let mut stmt = self.conn.prepare(
            "SELECT id, video_id, url, output_dir, unique_filename, title, status, progress, speed, eta, format_id, resolution, codec_info, file_size, fps, thumbnail_url, created_at, updated_at
             FROM download_tasks
             ORDER BY updated_at DESC",
        )?;

        let mut tasks = Vec::new();
        let mut rows = stmt.query([])?;

        while let Some(row) = rows.next()? {
            tasks.push(DownloadTask {
                id: row.get(0)?,
                video_id: row.get(1)?,
                url: row.get(2)?,
                output_dir: row.get(3)?,
                unique_filename: row.get(4)?,
                title: row.get(5)?,
                status: row.get(6)?,
                progress: row.get(7)?,
                speed: row.get(8)?,
                eta: row.get(9)?,
                format_id: row.get(10)?,
                resolution: row.get(11)?,
                codec_info: row.get(12)?,
                file_size: row.get(13)?,
                fps: row.get(14)?,
                thumbnail_url: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            });
        }

        Ok(tasks)
    }

    pub fn delete_download_task(&self, task_id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM download_tasks WHERE id = ?1", [task_id])?;
        Ok(())
    }

    pub fn sync_download_folder(&self, download_dir: &PathBuf) -> Result<()> {
        use std::fs;

        if !download_dir.exists() {
            return Ok(());
        }

        // First, clear downloaded flags for database entries whose files no longer exist
        {
            let mut stmt = self.conn.prepare(
                "SELECT id, file_path FROM videos WHERE is_downloaded = 1 AND file_path IS NOT NULL AND file_path != ''",
            )?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let video_id: String = row.get(0)?;
                let file_path: String = row.get(1)?;
                if !std::path::Path::new(&file_path).exists() {
                    self.conn.execute(
                        "UPDATE videos SET is_downloaded = 0, file_path = NULL, file_size = NULL WHERE id = ?1",
                        params![video_id],
                    )?;
                }
            }
        }

        // Scan for video files
        let entries = fs::read_dir(&download_dir).map_err(|e| {
            rusqlite::Error::InvalidColumnName(format!("Failed to read download directory: {}", e))
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| {
                rusqlite::Error::InvalidColumnName(format!("Failed to read directory entry: {}", e))
            })?;
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext = extension.to_string_lossy().to_lowercase();
                    if ext == "mp4" || ext == "mkv" || ext == "webm" || ext == "avi" || ext == "mov"
                    {
                        // Extract video ID from filename or use filename as ID
                        let filename = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown");

                        // Try to extract YouTube video ID from filename
                        let video_id = self.extract_video_id_from_filename(filename);

                        // Get file size
                        let metadata = fs::metadata(&path).map_err(|e| {
                            rusqlite::Error::InvalidColumnName(format!(
                                "Failed to get file metadata: {}",
                                e
                            ))
                        })?;
                        let file_size = metadata.len();

                        // Check if video exists in database
                        let exists: Result<i32> = self.conn.query_row(
                            "SELECT COUNT(*) FROM videos WHERE id = ?1 OR file_path = ?2",
                            [video_id.as_str(), path.to_str().unwrap_or("")],
                            |row| row.get(0),
                        );

                        if let Ok(0) = exists {
                            // Video not in database, add it
                            let title = self.clean_filename(filename);
                            self.conn.execute(
                                "INSERT INTO videos (id, title, is_downloaded, file_path, file_size, added_at) 
                                 VALUES (?1, ?2, 1, ?3, ?4, datetime('now'))",
                                params![video_id, title, path.to_str().unwrap_or(""), file_size]
                            )?;
                        } else if exists.is_ok() {
                            // Video exists, update download status and file info
                            self.conn.execute(
                                "UPDATE videos SET is_downloaded = 1, file_path = ?1, file_size = ?2 
                                 WHERE id = ?3 OR file_path = ?4",
                                params![path.to_str().unwrap_or(""), file_size, video_id, path.to_str().unwrap_or("")]
                            )?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn extract_video_id_from_filename(&self, filename: &str) -> String {
        // Try to extract YouTube video ID from filename
        // YouTube URLs have patterns like: watch?v=VIDEO_ID or youtu.be/VIDEO_ID
        if let Some(start) = filename.find("watch?v=") {
            let start_idx = start + 8;
            if start_idx < filename.len() {
                let end_idx = filename[start_idx..]
                    .find(&[' ', '-', '.', '_'][..])
                    .map(|i| start_idx + i)
                    .unwrap_or(filename.len());
                return filename[start_idx..end_idx].to_string();
            }
        }

        if let Some(start) = filename.find("youtu.be/") {
            let start_idx = start + 9;
            if start_idx < filename.len() {
                let end_idx = filename[start_idx..]
                    .find(&[' ', '-', '.', '_'][..])
                    .map(|i| start_idx + i)
                    .unwrap_or(filename.len());
                return filename[start_idx..end_idx].to_string();
            }
        }

        // If no video ID found, use a hash of the filename
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        filename.hash(&mut hasher);
        format!("local_{}", hasher.finish())
    }

    fn clean_filename(&self, filename: &str) -> String {
        // Remove file extension
        let name = filename
            .rsplit_once('.')
            .map(|(name, _)| name)
            .unwrap_or(filename);

        // Remove common YouTube patterns and clean up
        let binding = name
            .replace(" - YouTube", "")
            .replace("watch?v=", "")
            .replace("youtu.be/", "")
            .replace("  ", " ");
        let cleaned = binding.trim();

        if cleaned.is_empty() {
            filename.to_string()
        } else {
            cleaned.to_string()
        }
    }

    pub fn save_cookies(&self, content: &str) -> Result<()> {
        // Check if cookies already exist
        let count: i32 = self
            .conn
            .query_row("SELECT COUNT(*) FROM cookies", [], |row| row.get(0))?;

        if count > 0 {
            // Update existing cookies
            self.conn.execute(
                "UPDATE cookies SET content = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                params![content],
            )?;
        } else {
            // Insert new cookies
            self.conn.execute(
                "INSERT INTO cookies (id, content) VALUES (1, ?1)",
                params![content],
            )?;
        }

        Ok(())
    }

    pub fn load_cookies(&self) -> Result<Option<String>> {
        let result = self
            .conn
            .query_row("SELECT content FROM cookies WHERE id = 1", [], |row| {
                row.get::<_, String>(0)
            });

        match result {
            Ok(content) => Ok(Some(content)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_cookies(&self) -> Result<()> {
        self.conn.execute("DELETE FROM cookies WHERE id = 1", [])?;
        Ok(())
    }

    pub fn cookies_table_exists(&self) -> Result<bool> {
        let result: Result<String> = self.conn.query_row(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='cookies'",
            [],
            |row| row.get(0),
        );
        Ok(result.is_ok())
    }

    pub fn cookies_count(&self) -> Result<i64> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM cookies", [], |row| row.get(0))?;
        Ok(count)
    }

    // ============================================================
    // Website Cookies - Multi-site cookie storage
    // ============================================================

    pub fn get_all_website_cookies(&self) -> Result<Vec<crate::models::WebsiteCookie>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, website_url, domain_pattern, content, is_default, created_at, updated_at
             FROM website_cookies
             ORDER BY website_url, name"
        )?;

        let mut cookies = Vec::new();
        let mut rows = stmt.query([])?;

        while let Some(row) = rows.next()? {
            cookies.push(crate::models::WebsiteCookie {
                id: row.get(0)?,
                name: row.get(1)?,
                website_url: row.get(2)?,
                domain_pattern: row.get(3)?,
                content: row.get(4)?,
                is_default: row.get::<_, i32>(5)? == 1,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            });
        }

        Ok(cookies)
    }

    pub fn get_cookies_for_domain(&self, domain: &str) -> Result<Option<crate::models::WebsiteCookie>> {
        // First try to find a default cookie for this domain
        let domain_pattern = if domain.starts_with('.') {
            domain.to_string()
        } else {
            format!(".{}", domain)
        };

        // Try exact domain match first, then pattern match
        let result = self.conn.query_row(
            "SELECT id, name, website_url, domain_pattern, content, is_default, created_at, updated_at
             FROM website_cookies
             WHERE (domain_pattern = ?1 OR domain_pattern = ?2 OR website_url = ?3)
             ORDER BY is_default DESC, updated_at DESC
             LIMIT 1",
            params![domain_pattern, domain, domain],
            |row| {
                Ok(crate::models::WebsiteCookie {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    website_url: row.get(2)?,
                    domain_pattern: row.get(3)?,
                    content: row.get(4)?,
                    is_default: row.get::<_, i32>(5)? == 1,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        );

        match result {
            Ok(cookie) => Ok(Some(cookie)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn upsert_website_cookie(&self, cookie: &crate::models::WebsiteCookie) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO website_cookies
             (id, name, website_url, domain_pattern, content, is_default, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)",
            params![
                cookie.id,
                cookie.name,
                cookie.website_url,
                cookie.domain_pattern,
                cookie.content,
                cookie.is_default,
                cookie.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_website_cookie(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM website_cookies WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn set_default_cookie_for_domain(&self, id: &str, domain_pattern: &str) -> Result<()> {
        // First, unset all defaults for this domain
        self.conn.execute(
            "UPDATE website_cookies SET is_default = FALSE WHERE domain_pattern = ?1",
            [domain_pattern],
        )?;

        // Then set the specified cookie as default
        self.conn.execute(
            "UPDATE website_cookies SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [id],
        )?;

        Ok(())
    }

    pub fn get_website_cookies_by_domain(&self, domain: &str) -> Result<Vec<crate::models::WebsiteCookie>> {
        let domain_pattern = if domain.starts_with('.') {
            domain.to_string()
        } else {
            format!(".{}", domain)
        };

        let mut stmt = self.conn.prepare(
            "SELECT id, name, website_url, domain_pattern, content, is_default, created_at, updated_at
             FROM website_cookies
             WHERE domain_pattern = ?1 OR domain_pattern = ?2 OR website_url = ?3
             ORDER BY is_default DESC, name"
        )?;

        let mut cookies = Vec::new();
        let mut rows = stmt.query(params![domain_pattern, domain, domain])?;

        while let Some(row) = rows.next()? {
            cookies.push(crate::models::WebsiteCookie {
                id: row.get(0)?,
                name: row.get(1)?,
                website_url: row.get(2)?,
                domain_pattern: row.get(3)?,
                content: row.get(4)?,
                is_default: row.get::<_, i32>(5)? == 1,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            });
        }

        Ok(cookies)
    }
}
