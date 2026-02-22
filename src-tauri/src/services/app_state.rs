use std::path::PathBuf;
use anyhow::{Context, Result};

pub struct AppState {
    data_dir: PathBuf,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let data_dir = dirs::data_local_dir()
            .context("Failed to get local data directory")?
            .join("velocity");
        
        // Create data directory if it doesn't exist
        std::fs::create_dir_all(&data_dir)
            .with_context(|| format!("Failed to create data directory: {}", data_dir.display()))?;
        
        log::info!("App data directory: {}", data_dir.display());
        
        Ok(AppState { data_dir })
    }
    
    pub fn get_history_file(&self) -> PathBuf {
        self.data_dir.join("history.json")
    }
    
    pub fn get_cookies_file(&self) -> PathBuf {
        self.data_dir.join("cookies.txt")
    }

    pub fn get_database_file(&self) -> PathBuf {
        self.data_dir.join("velocity.db")
    }

    pub fn get_logs_dir(&self) -> PathBuf {
        let logs_dir = self.data_dir.join("logs");
        // Create logs directory if it doesn't exist
        let _ = std::fs::create_dir_all(&logs_dir);
        logs_dir
    }

    pub fn get_temp_dir(&self) -> PathBuf {
        let temp_dir = self.data_dir.join("temp");
        // Create temp directory if it doesn't exist
        let _ = std::fs::create_dir_all(&temp_dir);
        temp_dir
    }

    pub fn get_downloads_dir(&self) -> Result<PathBuf> {
        let downloads_dir = dirs::download_dir()
            .context("Failed to get downloads directory")?
            .join("velocity");
        
        std::fs::create_dir_all(&downloads_dir)
            .with_context(|| format!("Failed to create downloads directory: {}", downloads_dir.display()))?;
        
        Ok(downloads_dir)
    }

    pub fn cleanup_temp_files(&self) -> Result<()> {
        let temp_dir = self.get_temp_dir();
        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir)
                .with_context(|| format!("Failed to clean temp directory: {}", temp_dir.display()))?;
            
            // Recreate empty temp directory
            std::fs::create_dir_all(&temp_dir)
                .with_context(|| format!("Failed to recreate temp directory: {}", temp_dir.display()))?;
        }
        
        log::info!("Cleaned up temporary files");
        Ok(())
    }
}
