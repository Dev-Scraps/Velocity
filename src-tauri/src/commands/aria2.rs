use crate::services::aria2_service::{Aria2Service, Aria2DownloadTask};
use serde::Serialize;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

#[derive(Debug, Serialize)]
pub struct Aria2Metadata {
    pub url: String,
    pub filename: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: Option<u64>,
}

#[tauri::command]
pub async fn aria2_start_download(
    app: AppHandle,
    url: String,
    output_dir: String,
    filename: Option<String>,
    connections: Option<u32>,
    state: State<'_, Mutex<Aria2Service>>,
) -> Result<String, String> {
    let service = state.lock().await;
    let conn = connections.unwrap_or(4);
    service
        .start_download(app, url, output_dir, filename, conn)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn aria2_get_download_info(
    task_id: String,
) -> Result<Aria2DownloadTask, String> {
    // TODO: Implement task tracking
    Ok(Aria2DownloadTask {
        id: task_id,
        url: String::new(),
        output_dir: String::new(),
        filename: None,
        connections: 4,
        status: "queued".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
        speed: 0,
    })
}

#[tauri::command]
pub async fn aria2_fetch_metadata(url: String) -> Result<Aria2Metadata, String> {
    if url.starts_with("magnet:") {
        let filename = extract_magnet_name(&url);
        let display_name = filename.clone().or_else(|| {
            url.split(':')
                .nth(2)
                .and_then(|hash| Some(format!("Magnet-{}", &hash[..8])))
        });
        return Ok(Aria2Metadata {
            url,
            filename: display_name,
            content_type: Some("BitTorrent Magnet Link".to_string()),
            size_bytes: None,
        });
    }

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only HTTP(S) or magnet URLs are supported".to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .head(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let headers = response.headers();
    let content_type = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let size_bytes = headers
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    let filename = headers
        .get(reqwest::header::CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .and_then(extract_filename)
        .or_else(|| url.split('/').last().map(|value| value.to_string()));

    Ok(Aria2Metadata {
        url,
        filename,
        content_type,
        size_bytes,
    })
}

fn extract_filename(content_disposition: &str) -> Option<String> {
    content_disposition
        .split(';')
        .find_map(|part| {
            let trimmed = part.trim();
            trimmed
                .strip_prefix("filename=")
                .map(|value| value.trim_matches('"').to_string())
        })
}

fn extract_magnet_name(url: &str) -> Option<String> {
    url.split('?')
        .nth(1)
        .and_then(|query| {
            query.split('&').find_map(|pair| {
                let mut parts = pair.splitn(2, '=');
                let key = parts.next()?;
                let value = parts.next()?;
                if key == "dn" {
                    return urlencoding::decode(value)
                        .ok()
                        .map(|v| v.replace('+', " ").to_string());
                }
                None
            })
        })
}
