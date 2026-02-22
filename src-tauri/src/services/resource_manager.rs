use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::PathBuf;
use anyhow::{Result, Context};
use log::{info, warn, error};

pub struct ResourceManager {
    temp_files: Arc<Mutex<Vec<PathBuf>>>,
    active_connections: Arc<Mutex<usize>>,
    max_connections: usize,
}

impl ResourceManager {
    pub fn new(max_connections: usize) -> Self {
        Self {
            temp_files: Arc::new(Mutex::new(Vec::new())),
            active_connections: Arc::new(Mutex::new(0)),
            max_connections,
        }
    }

    pub async fn register_temp_file(&self, path: PathBuf) -> Result<()> {
        let mut temp_files = self.temp_files.lock().await;
        temp_files.push(path);
        info!("Registered temp file: {:?}", path);
        Ok(())
    }

    pub async fn cleanup_temp_files(&self) -> Result<()> {
        let mut temp_files = self.temp_files.lock().await;
        let mut cleanup_count = 0;
        
        for path in temp_files.drain(..) {
            if path.exists() {
                if let Err(e) = tokio::fs::remove_file(&path).await {
                    warn!("Failed to remove temp file {:?}: {}", path, e);
                } else {
                    cleanup_count += 1;
                }
            }
        }
        
        if cleanup_count > 0 {
            info!("Cleaned up {} temporary files", cleanup_count);
        }
        
        Ok(())
    }

    pub async fn acquire_connection(&self) -> Result<()> {
        let mut count = self.active_connections.lock().await;
        
        if *count >= self.max_connections {
            return Err(anyhow::anyhow!("Maximum database connections reached"));
        }
        
        *count += 1;
        info!("Acquired database connection, active: {}", *count);
        Ok(())
    }

    pub async fn release_connection(&self) {
        let mut count = self.active_connections.lock().await;
        if *count > 0 {
            *count -= 1;
            info!("Released database connection, active: {}", *count);
        } else {
            warn!("Attempted to release connection when none are active");
        }
    }

    pub async fn get_active_connections(&self) -> usize {
        *self.active_connections.lock().await
    }

    pub async fn cleanup_on_shutdown(&self) -> Result<()> {
        info!("Starting resource cleanup on shutdown");
        
        // Clean up temp files
        self.cleanup_temp_files().await?;
        
        // Reset connection count
        {
            let mut count = self.active_connections.lock().await;
            *count = 0;
            info!("Reset connection count");
        }
        
        info!("Resource cleanup completed");
        Ok(())
    }
}

impl Drop for ResourceManager {
    fn drop(&mut self) {
        info!("ResourceManager dropped");
    }
}

// Memory usage monitoring
pub struct MemoryMonitor {
    last_check: Arc<Mutex<std::time::Instant>>,
}

impl MemoryMonitor {
    pub fn new() -> Self {
        Self {
            last_check: Arc::new(Mutex::new(std::time::Instant::now())),
        }
    }

    pub async fn check_memory_usage(&self) -> Result<()> {
        let mut last_check = self.last_check.lock().await;
        let now = std::time::Instant::now();
        
        // Only check every 30 seconds
        if now.duration_since(*last_check).as_secs() < 30 {
            return Ok(());
        }
        
        *last_check = now;
        
        // Get memory usage (platform-specific)
        #[cfg(unix)]
        {
            use std::fs;
            if let Ok(status) = fs::read_to_string("/proc/self/status") {
                for line in status.lines() {
                    if line.starts_with("VmRSS:") {
                        if let Some(kb_str) = line.split_whitespace().nth(1) {
                            if let Ok(kb) = kb_str.parse::<u64>() {
                                let mb = kb / 1024;
                                info!("Memory usage: {} MB", mb);
                                
                                if mb > 500 {
                                    warn!("High memory usage detected: {} MB", mb);
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        #[cfg(windows)]
        {
            // Windows memory monitoring would go here
            info!("Memory monitoring not implemented for Windows");
        }
        
        Ok(())
    }
}

// Disk usage monitoring
pub async fn check_disk_usage(path: &PathBuf) -> Result<()> {
    use tokio::fs;
    
    if let Ok(metadata) = fs::metadata(path).await {
        if let Ok(space) = fs::metadata(path.parent().unwrap_or(path)).await {
            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                if let Ok(usage) = std::fs::metadata(path) {
                    let used_mb = usage.blocks() * usage.blksize() / (1024 * 1024);
                    info!("Disk usage for {:?}: {} MB", path, used_mb);
                    
                    if used_mb > 1024 { // 1GB
                        warn!("High disk usage detected: {} MB", used_mb);
                    }
                }
            }
        }
    }
    
    Ok(())
}
