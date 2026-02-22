use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use super::migrations::Migrator;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme_mode: String,
    pub color_theme: String,
    pub font: String,
    pub audio_only_mode: bool,
    pub download_directory: String,
    pub language: String,
    pub auto_sync: bool,
    pub video_quality: String,
    pub audio_quality: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_mode: "system".to_string(),
            color_theme: "blue".to_string(),
            font: "Inter".to_string(),
            audio_only_mode: false,
            download_directory: dirs::download_dir()
                .unwrap_or_else(|| dirs::home_dir().unwrap().join("Downloads"))
                .to_string_lossy()
                .to_string(),
            language: "en".to_string(),
            auto_sync: true,
            video_quality: "1080p".to_string(),
            audio_quality: "320k".to_string(),
        }
    }
}

pub struct SettingsService {
    conn: Connection,
}

impl SettingsService {
    pub fn new(db_path: &PathBuf) -> Result<Self> {
        // Ensure migrations are run
        Migrator::migrate(db_path)?;
        
        let conn = Connection::open(db_path)?;
        
        Ok(SettingsService { conn })
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT value FROM settings WHERE key = ?1"
        )?;
        
        let result = stmt.query_row([key], |row| {
            Ok(row.get::<_, String>(0)?)
        });
        
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<AppSettings> {
        let mut stmt = self.conn.prepare(
            "SELECT key, value FROM settings"
        )?;
        
        let settings_rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })?.collect::<Result<Vec<_>>>()?;
        
        let mut settings = AppSettings::default();
        
        for (key, value) in settings_rows {
            match key.as_str() {
                "theme_mode" => settings.theme_mode = value,
                "color_theme" => settings.color_theme = value,
                "font" => settings.font = value,
                "audio_only_mode" => settings.audio_only_mode = value.parse().unwrap_or(false),
                "download_directory" => settings.download_directory = value,
                "language" => settings.language = value,
                "auto_sync" => settings.auto_sync = value.parse().unwrap_or(true),
                "video_quality" => settings.video_quality = value,
                "audio_quality" => settings.audio_quality = value,
                _ => {}
            }
        }
        
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let audio_only_mode_str = settings.audio_only_mode.to_string();
        let auto_sync_str = settings.auto_sync.to_string();
        
        let settings_data = vec![
            ("theme_mode", &settings.theme_mode),
            ("color_theme", &settings.color_theme),
            ("font", &settings.font),
            ("audio_only_mode", &audio_only_mode_str),
            ("download_directory", &settings.download_directory),
            ("language", &settings.language),
            ("auto_sync", &auto_sync_str),
            ("video_quality", &settings.video_quality),
            ("audio_quality", &settings.audio_quality),
        ];
        
        for (key, value) in settings_data {
            self.set_setting(key, value)?;
        }
        
        Ok(())
    }

    pub fn reset_to_defaults(&self) -> Result<()> {
        let default_settings = AppSettings::default();
        self.save_settings(&default_settings)
    }
}
