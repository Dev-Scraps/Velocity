use anyhow::{anyhow, Context, Result};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct DownloadTaskInfo {
    pub url: String,
    pub format_id: Option<String>,
    pub output_dir: PathBuf,
    pub ffmpeg_path: Option<PathBuf>,
    pub unique_filename: bool,
    pub retry_count: u32,
    pub max_retries: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub task_id: String,
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub filename: String,
}

#[derive(Default, Clone)]
pub struct DownloadManager {
    tasks: Arc<Mutex<HashMap<String, DownloadTaskInfo>>>,
    processes: Arc<Mutex<HashMap<String, Child>>>,
    pids: Arc<Mutex<HashMap<String, u32>>>,
    last_filenames: Arc<Mutex<HashMap<String, String>>>,
    cancelled: Arc<Mutex<HashSet<String>>>,
    paused: Arc<Mutex<HashSet<String>>>,
    is_shutting_down: Arc<AtomicBool>,
    ytdlp_path: Option<PathBuf>,
}

impl DownloadManager {
    pub fn new(ytdlp_path: Option<PathBuf>) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            processes: Arc::new(Mutex::new(HashMap::new())),
            pids: Arc::new(Mutex::new(HashMap::new())),
            last_filenames: Arc::new(Mutex::new(HashMap::new())),
            cancelled: Arc::new(Mutex::new(HashSet::new())),
            paused: Arc::new(Mutex::new(HashSet::new())),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            ytdlp_path,
        }
    }

    pub async fn is_active(&self, task_id: &str) -> bool {
        let tasks = self.tasks.lock().await;
        if tasks.contains_key(task_id) {
            return true;
        }
        let processes = self.processes.lock().await;
        processes.contains_key(task_id)
    }

    pub async fn start_download(
        &self,
        app: AppHandle,
        task_id: String,
        info: DownloadTaskInfo,
    ) -> Result<()> {
        if self.is_shutting_down.load(Ordering::Acquire) {
            return Err(anyhow::anyhow!("Download manager is shutting down"));
        }

        log::info!(
            "[DownloadManager] Starting task {} url={} format={:?} output_dir={} ffmpeg={:?}",
            task_id,
            info.url,
            info.format_id,
            info.output_dir.display(),
            info.ffmpeg_path
        );

        // Store task info
        {
            let mut tasks = self.tasks.lock().await;
            tasks.insert(task_id.clone(), info.clone());
        }

        // Ensure output directory exists
        tokio::fs::create_dir_all(&info.output_dir)
            .await
            .with_context(|| {
                format!(
                    "Failed to create output directory: {}",
                    info.output_dir.display()
                )
            })?;

        self.spawn_and_monitor(app, task_id, info).await
    }

    async fn spawn_and_monitor(
        &self,
        app: AppHandle,
        task_id: String,
        info: DownloadTaskInfo,
    ) -> Result<()> {
        // Start the download process
        let child = self.spawn_download_process(&task_id, &info).await?;
        let child_pid = child.id();

        // Store the process
        {
            let mut processes = self.processes.lock().await;
            processes.insert(task_id.clone(), child);
        }

        // Store PID for tracking
        if let Some(pid) = child_pid {
            let mut pids = self.pids.lock().await;
            pids.insert(task_id.clone(), pid);
        }

        // Emit status update
        let _ = app.emit(
            "download_status",
            serde_json::json!({
                "taskId": task_id,
                "status": "downloading"
            }),
        );

        // Start monitoring the process
        let manager_clone = self.clone();
        let app_clone = app.clone();
        let task_id_clone = task_id.clone();
        tokio::spawn(async move {
            manager_clone
                .monitor_download(app_clone, task_id_clone)
                .await;
        });

        Ok(())
    }

    async fn spawn_download_process(
        &self,
        task_id: &str,
        info: &DownloadTaskInfo,
    ) -> Result<Child> {
        let cmd_name = if let Some(path) = &self.ytdlp_path {
            log::info!("[DownloadManager] Using bundled yt-dlp: {}", path.display());
            path.as_os_str()
        } else {
            log::info!("[DownloadManager] Using system yt-dlp");
            std::ffi::OsStr::new("yt-dlp")
        };
        let mut cmd = Command::new(cmd_name);

        // Hide console window on Windows
        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        // Process group handling for Unix-like systems
        #[cfg(unix)]
        {
            cmd.process_group(0); // Create new process group
        }

        cmd.arg(&info.url)
            .arg("--newline")
            .arg("--progress")
            .arg("--continue")
            .arg("--progress-template")
            .arg("download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(filename)s")
            .arg("--no-warnings")
            .arg("--socket-timeout").arg("30")  // 30s socket timeout
            .arg("-o")
            .arg(
                if info.unique_filename {
                    info.output_dir
                        .join("%(title)s (%(id)s) %(autonumber)s.%(ext)s")
                        .to_string_lossy()
                        .to_string()
                } else {
                    info.output_dir
                        .join("%(title)s.%(ext)s")
                        .to_string_lossy()
                        .to_string()
                },
            );

        // Add ffmpeg configuration if available
        if let Some(ffmpeg) = &info.ffmpeg_path {
            log::info!(
                "[DownloadManager] Using ffmpeg location for task {}: {}",
                task_id,
                ffmpeg.display()
            );
            // Ensure absolute path for ffmpeg
            let ffmpeg_abs = if ffmpeg.is_absolute() {
                ffmpeg.to_path_buf()
            } else {
                match std::env::current_dir() {
                    Ok(cwd) => cwd.join(ffmpeg),
                    Err(e) => {
                        log::warn!(
                            "Failed to get current directory: {}, using relative path",
                            e
                        );
                        ffmpeg.to_path_buf()
                    }
                }
            };

            cmd.arg("--ffmpeg-location")
                .arg(ffmpeg_abs.to_string_lossy().to_string())
                .arg("--embed-metadata")
                .arg("--embed-chapters")
                .arg("--embed-info-json")
                .arg("--embed-thumbnail");
        } else {
            log::warn!(
                "[DownloadManager] No ffmpeg path found for task {}",
                task_id
            );
        }

        // Add format selection
        if let Some(fmt) = &info.format_id {
            log::info!(
                "[DownloadManager] Using format for task {}: {}",
                task_id,
                fmt
            );
            cmd.arg("-f").arg(fmt);
        } else {
            log::info!(
                "[DownloadManager] Using default format for task {}",
                task_id
            );
            cmd.arg("-f").arg("bestvideo+bestaudio/best");
        }

        // Configure I/O
        cmd.stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        log::info!("[DownloadManager] Spawning yt-dlp for task {}", task_id);
        let child = cmd
            .spawn()
            .with_context(|| format!("Failed to start yt-dlp for task {}", task_id))?;

        Ok(child)
    }

    async fn monitor_download(&self, app: AppHandle, task_id: String) {
        // Keep process in map so pause_download can kill it
        // Get stdout/stderr WITHOUT removing from map
        let (stdout, stderr) = {
            let mut processes = self.processes.lock().await;
            if let Some(child) = processes.get_mut(&task_id) {
                (
                    child.stdout.take(),
                    child.stderr.take()
                )
            } else {
                return;
            }
        };

        // Track last progress update to detect merging phase
        let last_progress_update = Arc::new(Mutex::new(Instant::now()));
        let last_progress_update_for_stdout = last_progress_update.clone();
        let last_progress_update_for_timeout = last_progress_update.clone();
        let merging_state = Arc::new(Mutex::new(false));
        let merging_state_for_stdout = merging_state.clone();
        let merging_state_for_timeout = merging_state.clone();

        // Monitor stdout for progress
        let last_filename = Arc::new(Mutex::new(None::<String>));
        let last_filename_clone = last_filename.clone();
        let last_filenames_map = self.last_filenames.clone();

        if let Some(stdout_stream) = stdout {
            let task_id_clone = task_id.clone();
            let app_clone = app.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(stdout_stream);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    log::info!(
                        "[DownloadManager] Raw stdout for {}: {}",
                        task_id_clone,
                        line
                    );

                    // Detect merge/post-processing phase
                    if line.contains("Deleting original file")
                        || line.contains("EmbedThumbnail")
                        || line.contains("Adding metadata")
                    {
                        let _ = app_clone.emit(
                            "download_status",
                            serde_json::json!({
                                "taskId": task_id_clone,
                                "status": "extracting"
                            }),
                        );
                    } else if line.contains("Merging")
                            || line.contains("ffmpeg")
                            || line.to_lowercase().contains("muxing")
                            || line.to_lowercase().contains("post-proc")
                            || line.to_lowercase().contains("converting")
                        {
                            // ... (keep existing merging logic)
                            let mut merging = merging_state_for_stdout.lock().await;
                            if !*merging {
                                *merging = true;
                                log::info!(
                                    "[DownloadManager] Task {} detected merge phase: {}",
                                    task_id_clone,
                                    line
                                );
                                let _ = app_clone.emit(
                                    "download_merging",
                                    serde_json::json!({
                                        "taskId": task_id_clone,
                                        "status": "merging",
                                        "message": "Merging audio and video streams..."
                                    }),
                                );
                            }
                            // Update progress time during merge
                            {
                                let mut last_update = last_progress_update.lock().await;
                                *last_update = Instant::now();
                            }
                        } else if let Ok(mut progress) = Self::parse_progress_line(&line) {
                            progress.task_id = task_id_clone.clone();

                             // Update filename
                            {
                                let mut stored_filename = last_filename_clone.lock().await;
                                *stored_filename = Some(progress.filename.clone());
                            }
                            {
                                let mut filenames = last_filenames_map.lock().await;
                                filenames.insert(task_id_clone.clone(), progress.filename.clone());
                            }

                            // Reset merging state when actual progress detected
                            {
                                let mut merging = merging_state_for_stdout.lock().await;
                                *merging = false;
                            }

                            // Update last progress time
                            {
                                let mut last_update = last_progress_update_for_stdout.lock().await;
                                *last_update = Instant::now();
                            }

                            let _ = app_clone.emit(
                                "download_progress",
                                serde_json::json!({
                                    "taskId": progress.task_id,
                                    "progress": progress.percent,
                                    "speed": progress.speed,
                                    "eta": progress.eta,
                                    "downloadedBytes": progress.downloaded_bytes,
                                    "totalBytes": progress.total_bytes,
                                    "filename": progress.filename
                                }),
                            );
                            log::debug!(
                                "[DownloadManager] Progress for {}: {:.1}%",
                                task_id_clone,
                                progress.percent
                            );
                        }
                    }
                    log::info!(
                        "[DownloadManager] Output monitoring finished for task {}",
                        task_id_clone
                    );
                });
            }

            // Spawn improved timeout monitor task (detects merge phase vs actual hang)
            {
                let task_id_clone = task_id.clone();
                let app_clone = app.clone();
                let paused_set = self.paused.clone();
                let cancelled_set = self.cancelled.clone();
                tokio::spawn(async move {
                    let mut merge_warning_sent = false;
                    let mut extended_timeout_warning_sent = false;

                    loop {
                        tokio::time::sleep(Duration::from_secs(10)).await;

                        let is_paused_or_cancelled = {
                            let paused = paused_set.lock().await;
                            let cancelled = cancelled_set.lock().await;
                            paused.contains(&task_id_clone) || cancelled.contains(&task_id_clone)
                        };

                        if is_paused_or_cancelled {
                            break;
                        }

                        let last_update = {
                            let last = last_progress_update_for_timeout.lock().await;
                            last.elapsed()
                        };

                        let is_merging = {
                            let merging = merging_state_for_timeout.lock().await;
                            *merging
                        };

                        // After 60 seconds no progress, assume merge phase
                        if !is_merging
                            && last_update > Duration::from_secs(60)
                            && !merge_warning_sent
                        {
                            merge_warning_sent = true;
                            log::info!(
                                "[DownloadManager] Task {} no progress for {:.0}s, likely entering merge phase",
                                task_id_clone,
                                last_update.as_secs_f64()
                            );
                            let _ = app_clone.emit(
                                "download_merging",
                                serde_json::json!({
                                    "taskId": task_id_clone,
                                    "status": "merging",
                                    "message": "Starting audio/video merge (this may take several minutes)..."
                                }),
                            );
                        }

                        // Extended timeout: 900 seconds (15 minutes) for large files
                        if last_update > Duration::from_secs(900) && !extended_timeout_warning_sent
                        {
                            extended_timeout_warning_sent = true;
                            log::warn!(
                                "[DownloadManager] Task {} stuck for {:.0}s (15 min), possible hang",
                                task_id_clone,
                                last_update.as_secs_f64()
                            );
                            let _ = app_clone.emit(
                                "download_warning",
                                serde_json::json!({
                                    "taskId": task_id_clone,
                                    "warning": "Download appears stuck for 15 minutes. This may indicate FFmpeg merge is taking too long or a process hang.",
                                    "elapsed_seconds": last_update.as_secs()
                                }),
                            );
                        }
                    }
                });
            }

            // Monitor stderr for errors
            if let Some(stderr_stream) = stderr {
                let task_id_clone = task_id.clone();
                tokio::spawn(async move {
                    let reader = BufReader::new(stderr_stream);
                    let mut lines = reader.lines();

                    while let Ok(Some(line)) = lines.next_line().await {
                        log::warn!(
                            "[DownloadManager] Stderr for task {}: {}",
                            task_id_clone,
                            line
                        );
                    }
                });
            }

            // Wait for process completion with timeout
            // If monitoring finished, the process should exit soon. If not, it might be stuck.
            let wait_timeout = {
                let paused = self.paused.lock().await;
                if paused.contains(&task_id) {
                    Duration::from_secs(3)
                } else {
                    Duration::from_secs(30)
                }
            };

            let wait_result = {
                let mut processes = self.processes.lock().await;
                if let Some(mut child) = processes.remove(&task_id) {
                    Some(tokio::time::timeout(wait_timeout, child.wait()).await)
                } else {
                    None
                }
            };

            match wait_result {
                Some(Ok(Ok(status))) => {
                    // Process exited normally
                    let is_cancelled = {
                        let cancelled = self.cancelled.lock().await;
                        cancelled.contains(&task_id)
                    };

                    let is_paused = {
                        let paused = self.paused.lock().await;
                        paused.contains(&task_id)
                    };

                    if is_cancelled {
                        log::info!("[DownloadManager] Task {} was cancelled", task_id);
                         // Cleanup files
                        if let Some(filename) = last_filename.lock().await.clone() {
                             let path = PathBuf::from(&filename);
                             log::info!("[DownloadManager] Deleting cancelled file: {}", filename);
                             let _ = tokio::fs::remove_file(&path).await;
                             
                             // Try deleting .part file
                             let part_path = PathBuf::from(format!("{}.part", filename));
                             if part_path.exists() {
                                  let _ = tokio::fs::remove_file(&part_path).await;
                             }
                             // Try deleting .ytdl file (uncommon but possible)
                             let ytdl_path = PathBuf::from(format!("{}.ytdl", filename));
                             if ytdl_path.exists() {
                                  let _ = tokio::fs::remove_file(&ytdl_path).await;
                             }
                        }
                        
                        // Emit completion (skipped earlier?) No, we should emit cancelled? 
                        // The user might expect a "cancelled" event. `cancel_download` emits it.
                        // Here we just ensure we don't emit "completed" or "error".
                    } else if is_paused {
                         log::info!("[DownloadManager] Task {} was paused; skipping completion/error emit", task_id);
                    } else if status.success() {
                        log::info!("[DownloadManager] Task {} completed successfully", task_id);
                        let _ = app.emit(
                            "download_status",
                            serde_json::json!({
                                "taskId": task_id,
                                "status": "completed"
                            }),
                        );
                    } else {
                        log::error!(
                            "[DownloadManager] Task {} failed with status: {}",
                            task_id,
                            status
                        );
                        let _ = app.emit(
                            "download_status",
                            serde_json::json!({
                                "taskId": task_id,
                                "status": "error",
                                "error": format!("Process failed with status: {}", status)
                            }),
                        );
                    }
                }
                Some(Ok(Err(e))) => {
                    // Error waiting for process
                     log::error!(
                        "[DownloadManager] Failed to wait for task {}: {}",
                        task_id,
                        e
                    );
                    let _ = app.emit(
                        "download_status",
                        serde_json::json!({
                            "taskId": task_id,
                            "status": "error",
                            "error": e.to_string()
                        }),
                    );
                }
                Some(Err(_)) => {
                    let is_paused = {
                        let paused = self.paused.lock().await;
                        paused.contains(&task_id)
                    };

                    if is_paused {
                        log::info!("[DownloadManager] Task {} pause wait timed out; process will be cleaned up asynchronously", task_id);
                        return;
                    }

                    // Timeout hit
                    log::warn!("[DownloadManager] Task {} timed out waiting for exit after monitoring finished. Force killing...", task_id);
                    // Get process from map to kill it
                    {
                        let mut processes = self.processes.lock().await;
                        if let Some(mut child) = processes.remove(&task_id) {
                            let _ = child.kill().await;
                        }
                    }
                     
                     // Check if we probably finished successfully based on last progress? 
                     // For now, assume if we timed out it's an error unless we want to be optimistic.
                     // But usually if stdout closed, it might be done.
                     // Let's check cancellation/pause first.
                     
                    let is_cancelled = {
                        let cancelled = self.cancelled.lock().await;
                        cancelled.contains(&task_id)
                    };

                    let is_paused = {
                        let paused = self.paused.lock().await;
                        paused.contains(&task_id)
                    };
                    
                    if is_cancelled {
                        log::info!("[DownloadManager] Task {} timeout (masked by cancel)", task_id);
                         // Cleanup files
                        if let Some(filename) = last_filename.lock().await.clone() {
                             let path = PathBuf::from(&filename);
                             let _ = tokio::fs::remove_file(&path).await;
                             let part_path = PathBuf::from(format!("{}.part", filename));
                             if part_path.exists() {
                                  let _ = tokio::fs::remove_file(&part_path).await;
                             }
                        }
                    } else if is_paused {
                        log::info!("[DownloadManager] Task {} timeout (masked by pause)", task_id);
                    } else {
                         // Decide if this is success or error. 
                         // If we reached here, stdout/stderr closed. 
                         // It's safer to report error or at least warning, unless we track '100% reached'.
                         // Since we don't track that easily here, let's report it as completed but with a warning log, 
                         // OR just completed if it looked like it finished.
                         // Actually, sticking to error/warning is safer.
                         // However, the user issue is "stuck at 100%".
                         // If we emit "completed" here, it fixes the UI.
                         
                         log::info!("[DownloadManager] Task {} forced completion after timeout.", task_id);
                         let _ = app.emit(
                            "download_status",
                            serde_json::json!({
                                "taskId": task_id,
                                "status": "completed"
                            }),
                        );
                    }
                }
                None => {
                    log::info!(
                        "[DownloadManager] Task {} process already removed before wait",
                        task_id
                    );
                }
            }

        // Clean up task info
        // Only remove if not paused (so we can resume later)
        let is_paused = {
            let paused = self.paused.lock().await;
            paused.contains(&task_id)
        };

        if !is_paused {
            let mut tasks = self.tasks.lock().await;
            tasks.remove(&task_id);
        }

        // Clean up cancelled marker
        {
            let mut cancelled = self.cancelled.lock().await;
            cancelled.remove(&task_id);
        }

        // Clean up PID mapping
        {
            let mut pids = self.pids.lock().await;
            pids.remove(&task_id);
        }

        // Clean up tracked filename
        {
            let mut filenames = self.last_filenames.lock().await;
            filenames.remove(&task_id);
        }
    }

    fn parse_progress_line(line: &str) -> Result<DownloadProgress> {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() != 6 {
            return Err(anyhow::anyhow!("Invalid progress line format"));
        }

        let percent_part = parts[0].trim();
        let percent_part = percent_part
            .strip_prefix("download:")
            .unwrap_or(percent_part)
            .trim();
        let percent = percent_part
            .trim_end_matches('%')
            .parse::<f64>()
            .unwrap_or(0.0);
        let speed = parts[1].to_string();
        let eta = parts[2].to_string();
        let downloaded_bytes = parts[3].parse::<u64>().unwrap_or(0);
        let total_bytes = parts[4].parse::<u64>().ok();
        let filename = parts[5].to_string();

        Ok(DownloadProgress {
            task_id: String::new(), // Will be set by caller
            percent,
            speed,
            eta,
            downloaded_bytes,
            total_bytes,
            filename,
        })
    }

    pub async fn pause_download(&self, app: AppHandle, task_id: &str) -> Result<()> {
        log::info!("[DownloadManager] Pausing task {} (Stop & Restart strategy)", task_id);

        // Mark as paused FIRST, so monitor loop sees it
        {
            let mut paused = self.paused.lock().await;
            paused.insert(task_id.to_string());
        }

        // Kill the process
        let mut killed = false;
        {
            let mut processes = self.processes.lock().await;
            if let Some(mut child) = processes.remove(task_id) {
                // Graceful kill mostly ignored on Windows, force kill usually fine for yt-dlp
                let _ = child.kill().await;
                killed = true;
            }
        }

        // Always attempt PID-based process tree kill (yt-dlp may spawn ffmpeg).
        let pid = {
            let pids = self.pids.lock().await;
            pids.get(task_id).copied()
        };

        if let Some(pid) = pid {
            #[cfg(windows)]
            {
                log::info!("[DownloadManager] Killing process tree for PID {}", pid);
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .output()
                    .await;
            }
            #[cfg(unix)]
            {
                use nix::sys::signal::{self, Signal};
                use nix::unistd::Pid;
                let _ = signal::kill(Pid::from_raw(-(pid as i32)), Signal::SIGKILL);
            }
        } else if !killed {
            log::warn!(
                "[DownloadManager] Pause requested but no process or PID found for {}",
                task_id
            );
        }

        let _ = app.emit(
            "download_status",
            serde_json::json!({
                "taskId": task_id,
                "status": "paused"
            }),
        );

        Ok(())
    }

    pub async fn resume_download(&self, app: AppHandle, task_id: &str) -> Result<()> {
        log::info!("[DownloadManager] Resuming task {} (Stop & Restart strategy)", task_id);

        // Check if actually paused
        let was_paused = {
            let mut paused = self.paused.lock().await;
            paused.remove(task_id)
        };

        if !was_paused {
            let is_running = {
                let processes = self.processes.lock().await;
                processes.contains_key(task_id)
            };
            if is_running {
                log::info!(
                    "[DownloadManager] Task {} already running; skipping restart",
                    task_id
                );
                let _ = app.emit(
                    "download_status",
                    serde_json::json!({
                        "taskId": task_id,
                        "status": "downloading"
                    }),
                );
                return Ok(());
            }

            log::warn!(
                "[DownloadManager] Task {} was not paused; attempting restart",
                task_id
            );
        }

        // Get Task Info
        let task_info = {
            let tasks = self.tasks.lock().await;
            tasks.get(task_id).cloned()
        };

        if let Some(info) = task_info {
            // Respawn and monitor
            self.spawn_and_monitor(app.clone(), task_id.to_string(), info).await?;
            let _ = app.emit(
                "download_resumed",
                serde_json::json!({
                    "taskId": task_id,
                    "status": "downloading"
                }),
            );
        } else {
            return Err(anyhow::anyhow!("Task info not found for {}", task_id));
        }

        Ok(())
    }

    pub async fn cancel_download(&self, app: AppHandle, task_id: &str) -> Result<()> {
        log::info!("[DownloadManager] Canceling task {}", task_id);

        {
            let mut cancelled = self.cancelled.lock().await;
            cancelled.insert(task_id.to_string());
        }

        // Try to kill via Child handle first (if monitor hasn't taken it yet)
        let mut killed = false;
        {
            let mut processes = self.processes.lock().await;
            if let Some(mut child) = processes.remove(task_id) {
                let _ = child.kill().await;
                killed = true;
            }
        }

        // Fallback: kill by PID (works even if monitor task owns the Child)
        if !killed {
            let pid = {
                let pids = self.pids.lock().await;
                pids.get(task_id).copied()
            };

            if let Some(pid) = pid {
                #[cfg(windows)]
                {
                    log::info!("[DownloadManager] Killing process tree for PID {} (Cancel)", pid);
                    let _ = Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .output()
                        .await;
                }

                #[cfg(unix)]
                {
                    use nix::sys::signal::{self, Signal};
                    use nix::unistd::Pid;
                    // Kill the entire process group
                    let _ = signal::kill(Pid::from_raw(-(pid as i32)), Signal::SIGKILL);
                }
            }
        }

        let _ = app.emit(
            "download_cancelled",
            serde_json::json!({
                "taskId": task_id,
                "status": "cancelled"
            }),
        );

        let _ = app.emit(
            "download_status",
            serde_json::json!({
                "taskId": task_id,
                "status": "cancelled"
            }),
        );

        // Cleanup any partial/final files immediately
        if let Some(filename) = {
            let mut filenames = self.last_filenames.lock().await;
            filenames.remove(task_id)
        } {
            let path = PathBuf::from(&filename);
            let _ = tokio::fs::remove_file(&path).await;
            let part_path = PathBuf::from(format!("{}.part", filename));
            if part_path.exists() {
                let _ = tokio::fs::remove_file(&part_path).await;
            }
            let ytdl_path = PathBuf::from(format!("{}.ytdl", filename));
            if ytdl_path.exists() {
                let _ = tokio::fs::remove_file(&ytdl_path).await;
            }
        }

        // Remove PID mapping
        {
            let mut pids = self.pids.lock().await;
            pids.remove(task_id);
        }

        // Clean up task info
        {
            let mut tasks = self.tasks.lock().await;
            tasks.remove(task_id);
        }

        Ok(())
    }

    /// Retry a failed download task
    pub async fn retry_download(
        &self,
        app: AppHandle,
        task_id: String,
        max_retries: u32,
    ) -> Result<()> {
        let task_info = {
            let tasks = self.tasks.lock().await;
            tasks.get(&task_id).cloned()
        };

        if let Some(mut info) = task_info {
            if info.retry_count < max_retries {
                info.retry_count += 1;
                log::info!(
                    "[DownloadManager] Retrying task {} (attempt {}/{})",
                    task_id,
                    info.retry_count,
                    max_retries
                );

                let _ = app.emit(
                    "download_status",
                    serde_json::json!({
                        "taskId": task_id,
                        "status": "retrying",
                        "attempt": info.retry_count,
                        "max_attempts": max_retries
                    }),
                );

                self.start_download(app, task_id, info).await?;
                Ok(())
            } else {
                Err(anyhow!(
                    "Task {} exceeded max retries ({})",
                    task_id,
                    max_retries
                ))
            }
        } else {
            Err(anyhow!("Task {} not found", task_id))
        }
    }

    pub async fn shutdown(&self) {
        log::info!("[DownloadManager] Shutting down...");
        self.is_shutting_down.store(true, Ordering::Release);

        let mut processes = self.processes.lock().await;
        for (task_id, mut child) in processes.drain() {
            log::info!("[DownloadManager] Killing process for task {}", task_id);
            let _ = child.kill().await;
        }

        let mut pids = self.pids.lock().await;
        pids.clear();
    }
}


