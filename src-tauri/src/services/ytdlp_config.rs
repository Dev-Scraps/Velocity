use std::collections::HashMap;

pub const HTTP_HEADERS: &[(&str, &str)] = &[
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    ("Accept-Language", "en-US,en;q=0.9"),
    ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
];

pub const CACHE_ENABLED: bool = true;
pub const CACHE_TTL_MINUTES: i64 = 60;

pub fn get_http_headers() -> HashMap<String, String> {
    HTTP_HEADERS
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

pub struct YtDlpConfig {
    pub quiet: bool,
    pub no_warnings: bool,
    pub extract_flat: bool,
    pub socket_timeout: u64,
    pub nocheckcertificate: bool,
    pub prefer_insecure: bool,
    pub ignoreerrors: bool,
    pub no_color: bool,
    pub skip_download: bool,
    pub http_headers: HashMap<String, String>,
}

impl Default for YtDlpConfig {
    fn default() -> Self {
        Self {
            quiet: true,
            no_warnings: false,
            extract_flat: false,
            socket_timeout: 30,
            nocheckcertificate: false,
            prefer_insecure: false,
            ignoreerrors: false,
            no_color: true,
            skip_download: true,
            http_headers: get_http_headers(),
        }
    }
}

impl YtDlpConfig {
    pub fn flat() -> Self {
        let mut config = Self::default();
        config.extract_flat = true;
        config
    }

    pub fn full() -> Self {
        let mut config = Self::default();
        config.extract_flat = false;
        config
    }

    pub fn playlist() -> Self {
        let mut config = Self::default();
        config.extract_flat = true;
        config
    }

    pub fn download() -> Self {
        let mut config = Self::default();
        config.skip_download = false;
        config.quiet = false;
        config
    }
}
