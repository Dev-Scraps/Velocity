use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Migrator;

impl Migrator {
    pub fn migrate(db_path: &Path) -> Result<()> {
        let conn = Connection::open(db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Create migrations table if it doesn't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                version INTEGER NOT NULL UNIQUE,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Get current migration version
        let current_version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM migrations",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let has_download_metadata = Self::column_exists(&conn, "download_tasks", "url")?
            && Self::column_exists(&conn, "download_tasks", "output_dir")?
            && Self::column_exists(&conn, "download_tasks", "unique_filename")?;

        // Apply migrations in order
        let migrations = vec![
            (
                1,
                Migrator::migration_001_create_initial_tables as fn(&_) -> Result<()>,
            ),
            (
                2,
                Migrator::migration_002_add_indexes as fn(&_) -> Result<()>,
            ),
            (
                3,
                Migrator::migration_003_add_settings_table as fn(&_) -> Result<()>,
            ),
            (
                4,
                Migrator::migration_004_create_download_tasks_table as fn(&_) -> Result<()>,
            ),
            (
                5,
                Migrator::migration_005_update_download_tasks_schema as fn(&_) -> Result<()>,
            ),
            (
                6,
                Migrator::migration_006_add_composite_indexes as fn(&_) -> Result<()>,
            ),
            (
                7,
                Migrator::migration_007_create_cookies_table as fn(&_) -> Result<()>,
            ),
            (
                8,
                Migrator::migration_008_add_download_task_metadata as fn(&_) -> Result<()>,
            ),
            (
                9,
                Migrator::migration_009_create_website_cookies_table as fn(&_) -> Result<()>,
            ),
        ];

        for (version, migration_fn) in migrations {
            if version > current_version {
                println!("Applying migration {}", version);
                migration_fn(&conn)?;
                conn.execute("INSERT INTO migrations (version) VALUES (?1)", [version])?;
                println!("Migration {} applied successfully", version);
            }
        }

        if current_version >= 8 && !has_download_metadata {
            println!("Repairing download_tasks metadata columns");
            Self::migration_008_add_download_task_metadata(&conn)?;
        }

        Ok(())
    }

    fn migration_001_create_initial_tables(conn: &Connection) -> Result<()> {
        // Create playlists table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                video_count INTEGER DEFAULT 0,
                thumbnail_url TEXT,
                uploader TEXT,
                channel TEXT,
                channel_id TEXT,
                view_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create videos table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                channel_name TEXT,
                channel_id TEXT,
                view_count INTEGER,
                upload_date TEXT,
                duration TEXT,
                thumbnail_url TEXT,
                is_short BOOLEAN DEFAULT FALSE,
                is_liked BOOLEAN DEFAULT FALSE,
                is_downloaded BOOLEAN DEFAULT FALSE,
                playlist_id TEXT,
                position INTEGER,
                completion_percentage REAL DEFAULT 0.0,
                file_path TEXT,
                file_size INTEGER,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // Create download_history table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS download_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT NOT NULL,
                title TEXT NOT NULL,
                channel TEXT,
                downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )",
            [],
        )?;

        Ok(())
    }

    fn migration_002_add_indexes(conn: &Connection) -> Result<()> {
        // Add indexes for better performance
        // Check if columns exist before creating indexes
        let mut has_playlist_id = false;
        let mut has_is_liked = false;
        let mut has_is_downloaded = false;
        let mut has_title = false;
        let mut has_channel_name = false;
        let mut has_video_id = false;
        let mut has_downloaded_at = false;

        // Get table schema
        let mut stmt = conn.prepare("PRAGMA table_info(videos)")?;
        let rows = stmt.query_map([], |row| {
            let column_name: String = row.get(1)?;
            match column_name.as_str() {
                "playlist_id" => has_playlist_id = true,
                "is_liked" => has_is_liked = true,
                "is_downloaded" => has_is_downloaded = true,
                "title" => has_title = true,
                "channel_name" => has_channel_name = true,
                _ => {}
            }
            Ok(())
        })?;
        for row in rows {
            row?;
        }
        drop(stmt);

        // Get download_history table schema
        let mut stmt = conn.prepare("PRAGMA table_info(download_history)")?;
        let rows = stmt.query_map([], |row| {
            let column_name: String = row.get(1)?;
            match column_name.as_str() {
                "video_id" => has_video_id = true,
                "downloaded_at" => has_downloaded_at = true,
                _ => {}
            }
            Ok(())
        })?;
        for row in rows {
            row?;
        }
        drop(stmt);

        // Create indexes only if columns exist
        if has_playlist_id {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_videos_playlist_id ON videos(playlist_id)",
                [],
            )?;
        }
        if has_is_liked {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_videos_is_liked ON videos(is_liked)",
                [],
            )?;
        }
        if has_is_downloaded {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_videos_is_downloaded ON videos(is_downloaded)",
                [],
            )?;
        }
        if has_title {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title)",
                [],
            )?;
        }
        if has_channel_name {
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_videos_channel_name ON videos(channel_name)",
                [],
            )?;
        }
        if has_video_id {
            conn.execute("CREATE INDEX IF NOT EXISTS idx_download_history_video_id ON download_history(video_id)", [])?;
        }
        if has_downloaded_at {
            conn.execute("CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON download_history(downloaded_at)", [])?;
        }

        Ok(())
    }

    fn migration_003_add_settings_table(conn: &Connection) -> Result<()> {
        // Create settings table for persistent configuration
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    fn migration_004_create_download_tasks_table(_conn: &Connection) -> Result<()> {
        // This migration is now handled by migration_005_update_download_tasks_schema
        // which drops and recreates the table with the correct schema
        Ok(())
    }

    fn migration_005_update_download_tasks_schema(conn: &Connection) -> Result<()> {
        // Check if the old schema exists and migrate to new schema
        // First, drop the old table and recreate with new schema
        conn.execute("DROP TABLE IF EXISTS download_tasks", [])?;

        // Create the new download_tasks table with correct schema
        conn.execute(
            "CREATE TABLE download_tasks (
                id TEXT PRIMARY KEY,
                video_id TEXT,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0,
                speed TEXT,
                eta TEXT,
                format_id TEXT,
                resolution TEXT,
                codec_info TEXT,
                file_size TEXT,
                fps INTEGER,
                thumbnail_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    fn migration_006_add_composite_indexes(conn: &Connection) -> Result<()> {
        // Create composite indexes for better query performance
        // These indexes optimize queries that filter and sort on multiple columns

        // Index for get_videos_by_playlist which filters by playlist_id and orders by position
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_videos_playlist_position ON videos(playlist_id, position)",
            [],
        )?;

        // Index for liked videos query which filters by is_liked and orders by added_at
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_videos_liked_added_at ON videos(is_liked, added_at)",
            [],
        )?;

        // Index for downloaded videos query which filters by is_downloaded and orders by added_at
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_videos_downloaded_added_at ON videos(is_downloaded, added_at)",
            [],
        )?;

        // Index for search query which orders by added_at
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_videos_added_at ON videos(added_at)",
            [],
        )?;

        Ok(())
    }

    fn migration_007_create_cookies_table(conn: &Connection) -> Result<()> {
        // Create cookies table for persistent storage
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cookies (
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    fn migration_008_add_download_task_metadata(conn: &Connection) -> Result<()> {
        if !Self::column_exists(conn, "download_tasks", "url")? {
            conn.execute("ALTER TABLE download_tasks ADD COLUMN url TEXT", [])?;
        }
        if !Self::column_exists(conn, "download_tasks", "output_dir")? {
            conn.execute(
                "ALTER TABLE download_tasks ADD COLUMN output_dir TEXT",
                [],
            )?;
        }
        if !Self::column_exists(conn, "download_tasks", "unique_filename")? {
            conn.execute(
                "ALTER TABLE download_tasks ADD COLUMN unique_filename BOOLEAN",
                [],
            )?;
        }
        Ok(())
    }

    fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let name: String = row.get(1)?;
            if name == column {
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn migration_009_create_website_cookies_table(conn: &Connection) -> Result<()> {
        // Create website_cookies table for multi-site cookie storage
        conn.execute(
            "CREATE TABLE IF NOT EXISTS website_cookies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                website_url TEXT NOT NULL,
                domain_pattern TEXT NOT NULL,
                content TEXT NOT NULL,
                is_default BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_website_cookies_domain ON website_cookies(domain_pattern)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_website_cookies_url ON website_cookies(website_url)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_website_cookies_default ON website_cookies(domain_pattern, is_default)",
            [],
        )?;

        Ok(())
    }
}
