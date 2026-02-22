use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

pub const AUTH_COOKIES: &[&str] = &[
    "SAPISID",
    "__Secure-1PAPISID",
    "HSID",
    "SID",
    "__Secure-1PSID",
    "PREF",
];

pub const IDENTITY_COOKIES: &[&str] = &[
    "SSID",
    "APISID",
    "__Secure-3PAPISID",
    "LOGIN_INFO",
];

/// Common website domain patterns for yt-dlp supported sites
pub const KNOWN_DOMAINS: &[(&str, &str)] = &[
    ("youtube.com", ".youtube.com"),
    ("youtu.be", ".youtube.com"),
    ("vimeo.com", ".vimeo.com"),
    ("dailymotion.com", ".dailymotion.com"),
    ("twitch.tv", ".twitch.tv"),
    ("twitter.com", ".twitter.com"),
    ("x.com", ".x.com"),
    ("instagram.com", ".instagram.com"),
    ("facebook.com", ".facebook.com"),
    ("bilibili.com", ".bilibili.com"),
    ("nicovideo.jp", ".nicovideo.jp"),
    ("crunchyroll.com", ".crunchyroll.com"),
    ("reddit.com", ".reddit.com"),
    ("tiktok.com", ".tiktok.com"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookieValidationResult {
    pub is_valid: bool,
    pub message: String,
    pub auth_cookies: Vec<String>,
    pub identity_cookies: Vec<String>,
}

pub struct CookieManager;

impl CookieManager {
    /// Extract domain from a URL (e.g., "https://vimeo.com/123" -> "vimeo.com")
    pub fn extract_domain(url: &str) -> Option<String> {
        // Remove protocol
        let without_protocol = url
            .strip_prefix("https://")
            .or_else(|| url.strip_prefix("http://"))
            .unwrap_or(url);

        // Get host part
        let host = without_protocol
            .split('/')
            .next()
            .unwrap_or(without_protocol);

        // Remove port if present
        let domain = host.split(':').next().unwrap_or(host);

        // Remove www. prefix
        let clean_domain = domain
            .strip_prefix("www.")
            .unwrap_or(domain);

        if clean_domain.is_empty() {
            None
        } else {
            Some(clean_domain.to_lowercase())
        }
    }

    /// Get domain pattern for a given URL (e.g., "youtube.com" -> ".youtube.com")
    pub fn get_domain_pattern(url: &str) -> Option<String> {
        let domain = Self::extract_domain(url)?;

        // Check known domains first
        for (known, pattern) in KNOWN_DOMAINS {
            if domain.ends_with(known) {
                return Some(pattern.to_string());
            }
        }

        // Default pattern
        Some(format!(".{}", domain))
    }

    /// Detect domains from cookie file content
    pub fn detect_domains_from_content(content: &str) -> Vec<String> {
        let mut domains = std::collections::HashSet::new();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 7 {
                let domain = parts[0].trim().trim_start_matches('.');
                if !domain.is_empty() && domain.contains('.') {
                    domains.insert(domain.to_lowercase());
                }
            }
        }

        domains.into_iter().collect()
    }

    pub fn dict_to_netscape(cookies_dict: &HashMap<String, String>) -> String {
        let mut lines = vec!["# Netscape HTTP Cookie File".to_string()];
        let expiry = chrono::Utc::now().timestamp() + (365 * 24 * 60 * 60);

        for (name, value) in cookies_dict {
            let domain = ".youtube.com";
            let flag = "TRUE";
            let path = "/";
            let secure = "TRUE";
            lines.push(format!(
                "{}\t{}\t{}\t{}\t{}\t{}\t{}",
                domain, flag, path, secure, expiry, name, value
            ));
        }

        lines.join("\n")
    }

    /// Convert cookie dict to Netscape format for a specific domain
    pub fn dict_to_netscape_for_domain(cookies_dict: &HashMap<String, String>, domain: &str) -> String {
        let mut lines = vec![
            "# Netscape HTTP Cookie File".to_string(),
            format!("# Generated for domain: {}", domain),
        ];
        let expiry = chrono::Utc::now().timestamp() + (365 * 24 * 60 * 60);
        let domain_pattern = if domain.starts_with('.') {
            domain.to_string()
        } else {
            format!(".{}", domain)
        };

        for (name, value) in cookies_dict {
            let flag = "TRUE";
            let path = "/";
            let secure = "TRUE";
            lines.push(format!(
                "{}\t{}\t{}\t{}\t{}\t{}\t{}",
                domain_pattern, flag, path, secure, expiry, name, value
            ));
        }

        lines.join("\n")
    }

    pub fn load_from_file(file_path: &PathBuf) -> Result<HashMap<String, String>> {
        if !file_path.exists() {
            anyhow::bail!("Cookie file not found: {:?}", file_path);
        }

        let file_size = fs::metadata(file_path)
            .context("Failed to get file metadata")?
            .len();

        if file_size == 0 {
            anyhow::bail!("Cookie file is empty: {:?}", file_path);
        }

        log::info!(
            "Loading cookies from: {:?} ({} bytes)",
            file_path,
            file_size
        );

        let content = fs::read_to_string(file_path)
            .context("Failed to read cookie file")?;

        if file_path.extension().map_or(false, |e| e == "txt") {
            let cookies = Self::parse_netscape_format(&content)?;
            log::info!("Loaded {} cookies from Netscape format", cookies.len());
            return Ok(cookies);
        }

        if file_path.extension().map_or(false, |e| e == "json") {
            let cookies = Self::parse_json_format(&content)?;
            log::info!("Loaded {} cookies from JSON format", cookies.len());
            return Ok(cookies);
        }

        let cookies = Self::parse_netscape_format(&content)?;
        if !cookies.is_empty() {
            log::info!("Parsed as Netscape format: {} cookies", cookies.len());
            return Ok(cookies);
        }

        let cookies = Self::parse_json_format(&content)?;
        if !cookies.is_empty() {
            log::info!("Parsed as JSON format: {} cookies", cookies.len());
            return Ok(cookies);
        }

        anyhow::bail!("Could not parse cookies from {:?}", file_path);
    }

    pub fn parse_netscape_format(content: &str) -> Result<HashMap<String, String>> {
        let mut cookies = HashMap::new();
        let mut lines_parsed = 0;

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 7 {
                let name = parts[5].trim();
                let value = if parts.len() > 6 {
                    parts[6].trim()
                } else {
                    ""
                };

                if !name.is_empty() && !value.is_empty() {
                    cookies.insert(name.to_string(), value.to_string());
                    lines_parsed += 1;
                    log::trace!("Parsed cookie: {}", name);
                }
            }
        }

        log::info!("Parsed {} cookies from Netscape format", lines_parsed);
        Ok(cookies)
    }

    pub fn parse_json_format(content: &str) -> Result<HashMap<String, String>> {
        let value: serde_json::Value = serde_json::from_str(content)
            .context("Failed to parse JSON")?;

        let mut cookies = HashMap::new();

        if let Some(obj) = value.as_object() {
            for (key, val) in obj {
                if let Some(str_val) = val.as_str() {
                    cookies.insert(key.clone(), str_val.to_string());
                }
            }
            log::info!("Parsed JSON dict format: {} cookies", cookies.len());
        } else if let Some(arr) = value.as_array() {
            for item in arr {
                if let Some(obj) = item.as_object() {
                    let name = obj.get("name")
                        .or_else(|| obj.get("key"))
                        .and_then(|v| v.as_str());
                    let value = obj.get("value").and_then(|v| v.as_str());

                    if let (Some(n), Some(v)) = (name, value) {
                        cookies.insert(n.to_string(), v.to_string());
                    }
                }
            }
            log::info!("Parsed JSON list format: {} cookies", cookies.len());
        }

        Ok(cookies)
    }

    pub fn validate_cookies(cookies: &Option<HashMap<String, String>>) -> CookieValidationResult {
        if cookies.is_none() {
            return CookieValidationResult {
                is_valid: false,
                message: "No cookies provided".to_string(),
                auth_cookies: vec![],
                identity_cookies: vec![],
            };
        }

        let cookies = cookies.as_ref().unwrap();

        if cookies.is_empty() {
            return CookieValidationResult {
                is_valid: false,
                message: "Cookie dictionary is empty".to_string(),
                auth_cookies: vec![],
                identity_cookies: vec![],
            };
        }

        let mut auth_found = Vec::new();
        for cookie_name in AUTH_COOKIES {
            if let Some(value) = cookies.get(*cookie_name) {
                if !value.is_empty() {
                    auth_found.push(cookie_name.to_string());
                }
            }
        }

        let mut identity_found = Vec::new();
        for cookie_name in IDENTITY_COOKIES {
            if let Some(value) = cookies.get(*cookie_name) {
                if !value.is_empty() {
                    identity_found.push(cookie_name.to_string());
                }
            }
        }

        if auth_found.is_empty() {
            return CookieValidationResult {
                is_valid: false,
                message: format!(
                    "Cookies missing YouTube authentication tokens. Found: {:?}... Expected one of: {:?}",
                    cookies.keys().take(5).collect::<Vec<_>>(),
                    AUTH_COOKIES
                ),
                auth_cookies: vec![],
                identity_cookies: vec![],
            };
        }

        log::info!("Valid auth cookies found: {:?}", auth_found);
        if !identity_found.is_empty() {
            log::info!("Identity cookies: {:?}", identity_found);
        }

        CookieValidationResult {
            is_valid: true,
            message: format!(
                "Valid YouTube cookies ({} auth tokens, {} identity tokens)",
                auth_found.len(),
                identity_found.len()
            ),
            auth_cookies: auth_found,
            identity_cookies: identity_found,
        }
    }

    pub fn extract_to_dict(cookies_str: &str) -> HashMap<String, String> {
        let mut cookies = HashMap::new();

        for cookie in cookies_str.split(';') {
            let cookie = cookie.trim();
            if let Some(pos) = cookie.find('=') {
                let name = cookie[..pos].trim().to_string();
                let value = cookie[pos + 1..].trim().to_string();
                cookies.insert(name, value);
            }
        }

        cookies
    }

    pub fn parse_netscape_string(cookies_str: &str) -> Result<HashMap<String, String>> {
        Self::parse_netscape_format(cookies_str)
    }

    pub fn create_netscape_file(cookies_dict: &HashMap<String, String>) -> Result<PathBuf> {
        if cookies_dict.is_empty() {
            anyhow::bail!("Invalid cookies for file creation");
        }

        let mut lines = vec![
            "# Netscape HTTP Cookie File".to_string(),
            "# Generated for yt-dlp YouTube extraction".to_string(),
            "".to_string(),
        ];

        for (name, value) in cookies_dict {
            if !name.is_empty() && !value.is_empty() {
                for domain in [".youtube.com", ".google.com"] {
                    let line = format!(
                        "{}\tTRUE\t/\tTRUE\t2147483647\t{}\t{}",
                        domain, name, value
                    );
                    lines.push(line);
                }
            }
        }

        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join(format!(
            "cookies_{}.txt",
            chrono::Utc::now().timestamp_millis()
        ));

        fs::write(&file_path, lines.join("\n"))
            .context("Failed to write cookie file")?;

        log::info!("Created temporary cookie file: {:?}", file_path);
        Ok(file_path)
    }

    pub fn cleanup_temp_file(file_path: &PathBuf) -> bool {
        if !file_path.exists() {
            return false;
        }

        match fs::remove_file(file_path) {
            Ok(_) => {
                log::debug!("Cleaned up temp file: {:?}", file_path);
                true
            }
            Err(e) => {
                log::warn!("Error cleaning up temp file {:?}: {}", file_path, e);
                false
            }
        }
    }
}

pub struct CookieService;

impl CookieService {
    pub fn create_netscape_file(cookie_str: &str) -> Result<PathBuf> {
        if cookie_str.trim().is_empty() {
            anyhow::bail!("Cookie string is empty");
        }

        let content = if cookie_str.contains("Netscape") {
            cookie_str.to_string()
        } else {
            let mut content = "# Netscape HTTP Cookie File\n".to_string();
            for line in cookie_str.split(';') {
                if let Some(pos) = line.find('=') {
                    let k = line[..pos].trim();
                    let v = line[pos + 1..].trim();
                    if !k.is_empty() && !v.is_empty() {
                        for domain in [".youtube.com", ".google.com"] {
                            content += &format!(
                                "{}\tTRUE\t/\tTRUE\t2147483647\t{}\t{}\n",
                                domain, k, v
                            );
                        }
                    }
                }
            }
            content
        };

        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join(format!(
            "cookies_{}.txt",
            chrono::Utc::now().timestamp_millis()
        ));

        fs::write(&file_path, content)
            .context("Failed to write cookie file")?;

        log::info!("Created cookie file: {:?}", file_path);
        Ok(file_path)
    }

    pub fn cleanup(path: &PathBuf) {
        if path.exists() {
            match fs::remove_file(path) {
                Ok(_) => log::debug!("Cleaned up: {:?}", path),
                Err(e) => log::warn!("Error cleaning up {:?}: {}", path, e),
            }
        }
    }
}

pub struct CookieFileManager {
    path: Option<PathBuf>,
}

impl CookieFileManager {
    pub fn new(cookies: &HashMap<String, String>) -> Result<Self> {
        let path = CookieManager::create_netscape_file(cookies)?;
        Ok(Self { path: Some(path) })
    }

    pub fn path(&self) -> Option<&PathBuf> {
        self.path.as_ref()
    }
}

impl Drop for CookieFileManager {
    fn drop(&mut self) {
        if let Some(ref path) = self.path {
            CookieManager::cleanup_temp_file(path);
        }
    }
}
