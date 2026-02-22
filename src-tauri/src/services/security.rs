use std::path::PathBuf;
use anyhow::{Result, Context};
use log::{info, warn, error};
use md5;
use hex;

pub struct SecurityManager;

impl SecurityManager {
    pub fn new() -> Self {
        Self
    }

    /// Validate file path to prevent directory traversal
    pub fn validate_file_path(path: &str, base_dir: &PathBuf) -> Result<PathBuf> {
        let path = PathBuf::from(path);
        
        // Check for directory traversal attempts
        if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(anyhow::anyhow!("Path traversal detected"));
        }
        
        // Resolve the path and ensure it's within base directory
        let full_path = base_dir.join(&path);
        let canonical_path = std::fs::canonicalize(&full_path)
            .with_context(|| format!("Failed to canonicalize path: {:?}", full_path))?;
        let canonical_base = std::fs::canonicalize(base_dir)
            .with_context(|| format!("Failed to canonicalize base dir: {:?}", base_dir))?;
        
        if !canonical_path.starts_with(&canonical_base) {
            return Err(anyhow::anyhow!("Path outside allowed directory"));
        }
        
        Ok(full_path)
    }

    /// Sanitize filename to prevent injection attacks
    pub fn sanitize_filename(filename: &str) -> String {
        let mut sanitized = String::new();
        
        for c in filename.chars() {
            match c {
                // Allow alphanumeric, spaces, hyphens, underscores, and dots
                'a'..='z' | 'A'..='Z' | '0'..='9' | ' ' | '-' | '_' | '.' => {
                    sanitized.push(c);
                }
                // Replace other characters with underscore
                _ => {
                    sanitized.push('_');
                }
            }
        }
        
        // Remove leading/trailing dots and spaces
        sanitized.trim_matches(|c| c == '.' || c == ' ').to_string()
    }

    /// Validate URL to prevent malicious downloads
    pub fn validate_url(url: &str) -> Result<()> {
        // Check for allowed protocols
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(anyhow::anyhow!("Only HTTP/HTTPS URLs are allowed"));
        }
        
        // Check for suspicious patterns
        let suspicious_patterns = [
            "javascript:",
            "data:",
            "vbscript:",
            "file:",
            "ftp:",
        ];
        
        for pattern in &suspicious_patterns {
            if url.to_lowercase().contains(pattern) {
                return Err(anyhow::anyhow!("Suspicious URL pattern detected: {}", pattern));
            }
        }
        
        Ok(())
    }

    /// Generate secure hash for file integrity
    pub fn calculate_file_hash(file_path: &PathBuf) -> Result<String> {
        use std::fs::File;
        use std::io::Read;
        
        let mut file = File::open(file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;
        
        let mut hasher = md5::Md5::new();
        let mut buffer = [0; 8192];
        
        loop {
            let bytes_read = file.read(&mut buffer)
                .with_context(|| "Failed to read file")?;
            
            if bytes_read == 0 {
                break;
            }
            
            hasher.update(&buffer[..bytes_read]);
        }
        
        let hash = hasher.finalize();
        Ok(hex::encode(hash))
    }

    /// Verify file integrity using hash
    pub fn verify_file_integrity(file_path: &PathBuf, expected_hash: &str) -> Result<bool> {
        let actual_hash = Self::calculate_file_hash(file_path)?;
        Ok(actual_hash == expected_hash)
    }

    /// Check if file size is within reasonable limits
    pub fn validate_file_size(size: u64, max_size_mb: u64) -> Result<()> {
        let max_size_bytes = max_size_mb * 1024 * 1024;
        
        if size > max_size_bytes {
            return Err(anyhow::anyhow!(
                "File size {} MB exceeds maximum allowed size {} MB",
                size / (1024 * 1024),
                max_size_mb
            ));
        }
        
        Ok(())
    }

    /// Generate secure temporary filename
    pub fn generate_temp_filename(original_name: &str) -> String {
        use uuid::Uuid;
        
        let uuid = Uuid::new_v4().to_string();
        let sanitized_name = Self::sanitize_filename(original_name);
        
        if let Some(ext) = std::path::Path::new(&sanitized_name).extension() {
            format!("{}_{}.{}", uuid, sanitized_name, ext.to_string_lossy())
        } else {
            format!("{}_{}", uuid, sanitized_name)
        }
    }

    /// Validate cookie data for security
    pub fn validate_cookie_data(cookie_data: &str) -> Result<()> {
        // Check for suspicious patterns in cookie data
        let suspicious_patterns = [
            "<script",
            "javascript:",
            "vbscript:",
            "onload=",
            "onerror=",
        ];
        
        let lower_data = cookie_data.to_lowercase();
        for pattern in &suspicious_patterns {
            if lower_data.contains(pattern) {
                return Err(anyhow::anyhow!("Suspicious pattern in cookie data: {}", pattern));
            }
        }
        
        // Check for reasonable cookie size
        if cookie_data.len() > 1024 * 1024 { // 1MB
            return Err(anyhow::anyhow!("Cookie data too large"));
        }
        
        Ok(())
    }

    /// Secure file permissions
    pub fn set_secure_permissions(file_path: &PathBuf) -> Result<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            use std::fs;
            
            let mut perms = fs::metadata(file_path)
                .with_context(|| format!("Failed to get metadata for {:?}", file_path))?
                .permissions();
            
            // Set read/write for owner only
            perms.set_mode(0o600);
            
            fs::set_permissions(file_path, perms)
                .with_context(|| format!("Failed to set permissions for {:?}", file_path))?;
        }
        
        #[cfg(windows)]
        {
            // Windows permissions are handled differently
            info!("File permissions not modified on Windows");
        }
        
        Ok(())
    }

    /// Rate limiting helper
    pub struct RateLimiter {
        last_request: std::sync::Mutex<std::time::Instant>,
        min_interval: std::time::Duration,
    }

    impl RateLimiter {
        pub fn new(min_interval_ms: u64) -> Self {
            Self {
                last_request: std::sync::Mutex::new(std::time::Instant::now()),
                min_interval: std::time::Duration::from_millis(min_interval_ms),
            }
        }

        pub fn check_rate_limit(&self) -> bool {
            let mut last_request = self.last_request.lock().unwrap();
            let now = std::time::Instant::now();
            
            if now.duration_since(*last_request) >= self.min_interval {
                *last_request = now;
                true
            } else {
                false
            }
        }
    }

    /// Input validation for user data
    pub fn validate_input(input: &str, max_length: usize) -> Result<String> {
        if input.len() > max_length {
            return Err(anyhow::anyhow!("Input too long"));
        }

        // Remove potentially dangerous characters
        let sanitized = input
            .chars()
            .filter(|c| {
                // Allow printable ASCII and some Unicode characters
                c.is_ascii_graphic() || c.is_alphanumeric()
            })
            .collect::<String>();

        Ok(sanitized)
    }
}
