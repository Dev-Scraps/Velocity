use anyhow::Result;
use std::io::{BufReader, BufRead, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Emitter;

pub struct PythonWorker {
    process: Option<std::process::Child>,
    python_path: Option<PathBuf>,
}

impl PythonWorker {
    pub fn new() -> Self {
        PythonWorker { 
            process: None, 
            python_path: None,
        }
    }

    pub fn new_with_path(python_path: Option<PathBuf>) -> Self {
        PythonWorker { 
            process: None, 
            python_path,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;

        // Try multiple paths for the worker
        let possible_paths = vec![
            current_dir.join("python").join("worker.py"),           // If running from root
            current_dir.parent().unwrap().join("python").join("worker.py"), // If running from src-tauri
        ];

        let worker_path = possible_paths
            .into_iter()
            .find(|p| p.exists())
            .ok_or_else(|| format!("Worker not found. Checked paths relative to {:?}", current_dir))?;

        eprintln!("[Rust] Starting Python worker from: {:?}", worker_path);

        // Try to use bundled worker.exe first (production), fallback to python (development)
        let child = if cfg!(not(debug_assertions)) {
            // Production: Try bundled worker.exe
            let worker_exe = current_dir.join("worker.exe");
            if worker_exe.exists() {
                eprintln!("[Rust] Using bundled worker.exe");
                let mut cmd = Command::new(&worker_exe);
                
                // Hide console window on Windows
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                
                // Process group handling for Unix-like systems
                #[cfg(unix)]
                {
                    use std::os::unix::process::CommandExt;
                    cmd.process_group(0); // Create new process group
                }
                
                cmd.stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to spawn worker.exe: {}", e))?
            } else {
                // Fallback to python
                eprintln!("[Rust] worker.exe not found, using python interpreter");
                let python_cmd = if let Some(path) = &self.python_path {
                    eprintln!("[Rust] Using bundled python: {}", path.display());
                    path.as_os_str()
                } else {
                    eprintln!("[Rust] Using system python");
                    std::ffi::OsStr::new("python")
                };
                
                let mut cmd = Command::new(python_cmd);
                
                // Hide console window on Windows
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }
                
                // Process group handling for Unix-like systems
                #[cfg(unix)]
                {
                    use std::os::unix::process::CommandExt;
                    cmd.process_group(0); // Create new process group
                }
                
                cmd.arg("-u") // Unbuffered output
                    .arg(&worker_path)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to spawn Python worker: {}", e))?
            }
        } else {
            // Development: Use python interpreter
            eprintln!("[Rust] Development mode - using python interpreter");
            let python_cmd = if let Some(path) = &self.python_path {
                eprintln!("[Rust] Using bundled python: {}", path.display());
                path.as_os_str()
            } else {
                eprintln!("[Rust] Using system python");
                std::ffi::OsStr::new("python")
            };
            
            let mut cmd = Command::new(python_cmd);
            
            // Hide console window on Windows
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            
            // Process group handling for Unix-like systems
            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                cmd.process_group(0); // Create new process group
            }
            
            cmd.arg("-u") // Unbuffered output
                .arg(&worker_path)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn Python worker: {}", e))?
        };

        std::thread::sleep(std::time::Duration::from_millis(500));

        self.process = Some(child);
        eprintln!("[Rust] Python worker started successfully");
        Ok(())
    }

    pub fn send_request(&mut self, method: &str, params: serde_json::Value, app: &tauri::AppHandle) -> Result<serde_json::Value, String> {
        if self.process.is_none() {
            self.start()?;
        }

        let child = self.process.as_mut().ok_or("Worker not running")?;
        let request_id = 1; // Simple ID for now

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        });

        if let Some(stdin) = child.stdin.as_mut() {
            writeln!(stdin, "{}", request).map_err(|e| format!("Failed to write to stdin: {}", e))?;
        }

        if let Some(stdout) = child.stdout.as_mut() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            // Loop until we get the response for our request
            while let Some(Ok(line)) = lines.next() {
                // Ignore empty lines
                if line.trim().is_empty() {
                    continue;
                }

                // Try to parse as JSON - if it fails, it's a log message, ignore it
                let response: serde_json::Value = match serde_json::from_str(&line) {
                    Ok(v) => v,
                    Err(_e) => {
                        // Not JSON, likely a log message, skip it
                        continue;
                    }
                };

                // Check if it's a response to our request
                if let Some(id) = response.get("id") {
                    if id.as_u64() == Some(request_id) {
                        if let Some(result) = response.get("result") {
                            return Ok(result.clone());
                        }
                        if let Some(error) = response.get("error") {
                            return Err(format!("Worker error: {}", error));
                        }
                        // If we have the right ID but no result or error, return an error
                        return Err(format!("Worker returned invalid response: {}", line));
                    }
                }

                // Check if it's a notification (no id, has method)
                if response.get("id").is_none() {
                     if let Some(method) = response.get("method").and_then(|m| m.as_str()) {
                        if let Some(params) = response.get("params") {
                             let _ = app.emit(method, params);
                        }
                     }
                }
            }
        }

        Err("Worker stream closed unexpectedly".to_string())
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for PythonWorker {
    fn drop(&mut self) {
        self.stop();
    }
}
