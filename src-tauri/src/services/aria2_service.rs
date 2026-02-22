use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aria2DownloadTask {
    pub id: String,
    pub url: String,
    pub output_dir: String,
    pub filename: Option<String>,
    pub connections: u32,
    pub status: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: u64,
}

pub struct Aria2Service {
    aria2_path: Option<PathBuf>,
}

impl Aria2Service {
    pub fn new(aria2_path: Option<PathBuf>) -> Self {
        Self { aria2_path }
    }

    pub async fn start_download(
        &self,
        app: AppHandle,
        url: String,
        output_dir: String,
        filename: Option<String>,
        connections: u32,
    ) -> Result<String> {
        let task_id = uuid::Uuid::new_v4().to_string();
        let output_path = if let Some(name) = filename {
            format!("{}/{}", output_dir, name)
        } else {
            output_dir.clone()
        };

        let aria2_path = self
            .aria2_path
            .clone()
            .or_else(|| Self::find_system_aria2())
            .ok_or_else(|| anyhow::anyhow!("aria2c not found"))?;

        let aria2_path_clone = aria2_path.clone();
        let url_clone = url.clone();
        let output_path_clone = output_path.clone();
        let connections_clone = connections;
        let task_id_clone = task_id.clone();
        let app_clone = app.clone();

        // Emit initial status
        let _ = app.emit("aria2_status", serde_json::json!({
            "taskId": task_id,
            "status": "downloading"
        }));

        tokio::spawn(async move {
            let mut cmd = Command::new(&aria2_path_clone);
            cmd.arg("-d")
                .arg(&output_path_clone)
                .arg("-x")
                .arg(connections_clone.to_string())
                .arg("--summary-interval=1")
                .arg(&url_clone)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());

            #[cfg(windows)]
            {
                cmd.creation_flags(0x08000000);
            }

            let mut child = match cmd.spawn() {
                Ok(child) => child,
                Err(err) => {
                    let _ = app_clone.emit("aria2_status", serde_json::json!({
                        "taskId": task_id_clone,
                        "status": "error",
                        "error": err.to_string(),
                    }));
                    return;
                }
            };

            if let Some(stdout) = child.stdout.take() {
                let app_stdout = app_clone.clone();
                let task_stdout = task_id_clone.clone();
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        let _ = app_stdout.emit("aria2_log", serde_json::json!({
                            "taskId": task_stdout,
                            "line": line,
                        }));
                        if let Some(progress) = parse_progress_line(&line) {
                            let _ = app_stdout.emit("aria2_progress", serde_json::json!({
                                "taskId": task_stdout,
                                "progress": progress.progress,
                                "speed": progress.speed,
                                "eta": progress.eta,
                            }));
                        }
                    }
                });
            }

            if let Some(stderr) = child.stderr.take() {
                let app_stderr = app_clone.clone();
                let task_stderr = task_id_clone.clone();
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        let _ = app_stderr.emit("aria2_log", serde_json::json!({
                            "taskId": task_stderr,
                            "line": line,
                            "level": "error",
                        }));
                    }
                });
            }

            let status = match child.wait().await {
                Ok(status) => status,
                Err(err) => {
                    let _ = app_clone.emit("aria2_status", serde_json::json!({
                        "taskId": task_id_clone,
                        "status": "error",
                        "error": err.to_string(),
                    }));
                    return;
                }
            };

            if status.success() {
                let _ = app_clone.emit("aria2_status", serde_json::json!({
                    "taskId": task_id_clone,
                    "status": "completed"
                }));
            } else {
                let _ = app_clone.emit("aria2_status", serde_json::json!({
                    "taskId": task_id_clone,
                    "status": "error"
                }));
            }
        });

        Ok(task_id)
    }

    fn find_system_aria2() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(path) = which::which("aria2c.exe") {
                return Some(path);
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(path) = which::which("aria2c") {
                return Some(path);
            }
        }
        None
    }
}

struct ParsedProgress {
    progress: f64,
    speed: Option<String>,
    eta: Option<String>,
}

fn parse_progress_line(line: &str) -> Option<ParsedProgress> {
    if !line.contains('%') || !line.contains("DL:") {
        return None;
    }

    let progress = line
        .split('(')
        .nth(1)
        .and_then(|part| part.split('%').next())
        .and_then(|value| value.trim().parse::<f64>().ok());

    let speed = line
        .split("DL:")
        .nth(1)
        .and_then(|part| part.split_whitespace().next())
        .map(|value| value.to_string());

    let eta = line
        .split("ETA:")
        .nth(1)
        .and_then(|part| part.split_whitespace().next())
        .map(|value| value.trim_end_matches(']').to_string());

    progress.map(|value| ParsedProgress {
        progress: value,
        speed,
        eta,
    })
}
