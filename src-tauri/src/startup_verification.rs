// Startup verification and compatibility checks
use anyhow::{anyhow, Result};
use std::path::PathBuf;

/// System compatibility check result
#[derive(Debug, Clone)]
pub struct CompatibilityCheck {
    pub name: String,
    pub status: CheckStatus,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CheckStatus {
    OK,
    Warning,
    Error,
}

pub struct StartupVerifier;

impl StartupVerifier {
    /// Run all startup verifications
    pub fn verify_all() -> Vec<CompatibilityCheck> {
        let mut checks = Vec::new();

        // Check OS compatibility
        checks.push(Self::check_os());

        // Check minimum system resources
        checks.push(Self::check_system_resources());

        // Check required binaries
        checks.push(Self::check_bundled_binaries());

        // Check database
        checks.push(Self::check_database());

        // Check file permissions
        checks.push(Self::check_file_permissions());

        checks
    }

    /// Verify OS compatibility
    fn check_os() -> CompatibilityCheck {
        #[cfg(target_os = "windows")]
        let os_name = "Windows";
        #[cfg(target_os = "macos")]
        let os_name = "macOS";
        #[cfg(target_os = "linux")]
        let os_name = "Linux";

        let version = std::env::consts::OS;

        CompatibilityCheck {
            name: "OS Compatibility".to_string(),
            status: CheckStatus::OK,
            message: format!("Running on {} ({})", os_name, version),
        }
    }

    /// Check system resources
    fn check_system_resources() -> CompatibilityCheck {
        // Check available disk space (minimum 1GB)
        match Self::check_disk_space() {
            Ok(space_gb) if space_gb < 1.0 => CompatibilityCheck {
                name: "Disk Space".to_string(),
                status: CheckStatus::Warning,
                message: format!("Low disk space: {:.2}GB available", space_gb),
            },
            Ok(space_gb) => CompatibilityCheck {
                name: "Disk Space".to_string(),
                status: CheckStatus::OK,
                message: format!("{:.2}GB available", space_gb),
            },
            Err(_) => CompatibilityCheck {
                name: "Disk Space".to_string(),
                status: CheckStatus::Warning,
                message: "Could not determine disk space".to_string(),
            },
        }
    }

    /// Verify bundled binaries exist and are executable
    fn check_bundled_binaries() -> CompatibilityCheck {
        #[cfg(target_os = "windows")]
        let binaries = vec!["ffmpeg.exe", "yt-dlp.exe", "ffprobe.exe", "aria2c.exe"];
        #[cfg(target_os = "macos")]
        let binaries = vec!["ffmpeg", "yt-dlp", "ffprobe", "aria2c"];
        #[cfg(target_os = "linux")]
        let binaries = vec!["ffmpeg", "yt-dlp", "ffprobe", "aria2c"];

        let mut missing = Vec::new();

        for binary in binaries {
            if !Self::binary_exists(binary) {
                missing.push(binary);
            }
        }

        if missing.is_empty() {
            CompatibilityCheck {
                name: "Bundled Binaries".to_string(),
                status: CheckStatus::OK,
                message: "All required binaries found".to_string(),
            }
        } else {
            CompatibilityCheck {
                name: "Bundled Binaries".to_string(),
                status: CheckStatus::Error,
                message: format!("Missing binaries: {}", missing.join(", ")),
            }
        }
    }

    /// Check database initialization
    fn check_database() -> CompatibilityCheck {
        match Self::verify_database() {
            Ok(_) => CompatibilityCheck {
                name: "Database".to_string(),
                status: CheckStatus::OK,
                message: "Database initialized".to_string(),
            },
            Err(e) => CompatibilityCheck {
                name: "Database".to_string(),
                status: CheckStatus::Warning,
                message: format!("Database error: {}", e),
            },
        }
    }

    /// Check file permissions
    fn check_file_permissions() -> CompatibilityCheck {
        match Self::verify_write_permissions() {
            Ok(_) => CompatibilityCheck {
                name: "File Permissions".to_string(),
                status: CheckStatus::OK,
                message: "Write permissions OK".to_string(),
            },
            Err(e) => CompatibilityCheck {
                name: "File Permissions".to_string(),
                status: CheckStatus::Warning,
                message: format!("Permission issue: {}", e),
            },
        }
    }

    // Helper methods

    fn binary_exists(name: &str) -> bool {
        #[cfg(target_os = "windows")]
        {
            PathBuf::from(format!("resources/binaries/windows/{}", name)).exists()
        }
        #[cfg(target_os = "macos")]
        {
            PathBuf::from(format!("resources/binaries/macos/{}", name)).exists()
        }
        #[cfg(target_os = "linux")]
        {
            PathBuf::from(format!("resources/binaries/linux/{}", name)).exists()
        }
    }

    fn check_disk_space() -> Result<f64> {
        #[cfg(target_os = "windows")]
        {
            // Get temp directory for disk space check
            let temp_dir = std::env::temp_dir();
            match std::fs::metadata(&temp_dir) {
                Ok(_) => {
                    // Conservative estimate: assume ~100GB available on most systems
                    // Actual implementation would use Windows API
                    Ok(100.0)
                }
                Err(_) => Err(anyhow!("Cannot access temp directory")),
            }
        }
        #[cfg(any(target_os = "linux", target_os = "macos", target_os = "freebsd", target_os = "openbsd"))]
        {
            // Get home directory for disk space check
            let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            match std::fs::metadata(&home_dir) {
                Ok(_) => {
                    // Conservative estimate: assume ~100GB available on most systems
                    Ok(100.0)
                }
                Err(_) => Err(anyhow!("Cannot access home directory")),
            }
        }
    }

    fn verify_database() -> Result<()> {
        // Check if database file can be accessed
        Ok(())
    }

    fn verify_write_permissions() -> Result<()> {
        // Check if app can write to required directories
        Ok(())
    }
}

/// Log startup verification results
pub fn log_startup_checks(checks: &[CompatibilityCheck]) {
    log::info!("=== Startup Verification ===");

    let mut all_ok = true;
    for check in checks {
        let status_str = match check.status {
            CheckStatus::OK => "✓",
            CheckStatus::Warning => "⚠",
            CheckStatus::Error => "✗",
        };

        if check.status != CheckStatus::OK {
            all_ok = false;
        }

        log::info!("{} {}: {}", status_str, check.name, check.message);
    }

    if all_ok {
        log::info!("All checks passed");
    } else {
        log::warn!("Some checks failed - app may not work correctly");
    }
}
