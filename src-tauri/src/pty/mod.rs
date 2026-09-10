use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutputPayload {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyExitPayload {
    pub session_id: String,
    pub exit_code: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyProcessInfo {
    pub session_id: String,
    pub pid: Option<u32>,
    pub binary_name: Option<String>,
    pub cmdline: Option<String>,
    pub is_agent: bool,
    pub matched_agent: Option<String>,
}

pub struct PtySession {
    pub id: String,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub running: Arc<AtomicBool>,
    pub child_pid: Option<u32>,
}

#[derive(Default)]
pub struct PtyManager {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        app: AppHandle,
        session_id: String,
        cwd: Option<String>,
        shell: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        // If session already exists and is running, preserve it
        {
            let sessions = self.sessions.lock();
            if let Some(session) = sessions.get(&session_id) {
                if session.running.load(Ordering::Relaxed) {
                    return Ok(session_id);
                }
            }
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY pair: {}", e))?;

        let shell_cmd = shell.unwrap_or_else(|| {
            if cfg!(windows) {
                std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            }
        });

        let mut cmd = CommandBuilder::new(&shell_cmd);
        if let Some(ref dir) = cwd {
            if !dir.is_empty() {
                cmd.cwd(dir);
            }
        }

        // Set terminal environment variables
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("LANG", "en_US.UTF-8");
        cmd.env("LC_ALL", "en_US.UTF-8");
        cmd.env("AGENTDECK_SESSION_ID", &session_id);
        cmd.env("AGENTDECK_PORT", "4020");
        if let Some(ref dir) = cwd {
            if !dir.is_empty() {
                cmd.env("AGENTDECK_PROJECT_PATH", dir);
            }
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn child command: {}", e))?;

        let child_pid = child.process_id();

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();
        let session_id_clone = session_id.clone();
        let app_clone = app.clone();

        // Background reader thread
        std::thread::Builder::new()
            .name(format!("pty-reader-{}", session_id))
            .spawn(move || {
                let mut buf = [0u8; 8192];
                while running_clone.load(Ordering::Relaxed) {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buf[..n]).to_string();
                            let _ = app_clone.emit(
                                "pty-output",
                                PtyOutputPayload {
                                    session_id: session_id_clone.clone(),
                                    data,
                                },
                            );
                        }
                        Err(e) => {
                            log::debug!("PTY read error (may be closed): {}", e);
                            break;
                        }
                    }
                }

                let exit_status = child.wait().ok();
                let exit_code = exit_status.and_then(|s| if s.success() { Some(0) } else { None });

                let _ = app_clone.emit(
                    "pty-exit",
                    PtyExitPayload {
                        session_id: session_id_clone,
                        exit_code,
                    },
                );
            })
            .map_err(|e| format!("Failed to spawn PTY reader thread: {}", e))?;

        let session = PtySession {
            id: session_id.clone(),
            master: pair.master,
            writer: Arc::new(Mutex::new(writer)),
            running,
            child_pid,
        };

        self.sessions.lock().insert(session_id.clone(), session);
        Ok(session_id)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(session_id) {
            let mut writer = session.writer.lock();
            writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            writer.flush().map_err(|e| format!("Failed to flush PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {}", session_id))
        }
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(session_id) {
            session
                .master
                .resize(PtySize {
                    rows: rows.max(1),
                    cols: cols.max(1),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {}", session_id))
        }
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        if let Some(session) = sessions.remove(session_id) {
            session.running.store(false, Ordering::Relaxed);
            Ok(())
        } else {
            Ok(())
        }
    }

    pub fn get_process_info(&self, session_id: &str) -> Result<PtyProcessInfo, String> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(session_id) {
            let child_pid = session.child_pid;
            if let Some(pid) = child_pid {
                if let Some((fg_pid, comm, cmdline)) = inspect_foreground_process(pid) {
                    let (is_agent, matched_agent) = match_agent_binary(&comm, &cmdline);
                    return Ok(PtyProcessInfo {
                        session_id: session_id.to_string(),
                        pid: Some(fg_pid),
                        binary_name: Some(comm),
                        cmdline: Some(cmdline),
                        is_agent,
                        matched_agent,
                    });
                }
            }
            Ok(PtyProcessInfo {
                session_id: session_id.to_string(),
                pid: child_pid,
                binary_name: Some("shell".to_string()),
                cmdline: None,
                is_agent: false,
                matched_agent: None,
            })
        } else {
            Err(format!("PTY session not found: {}", session_id))
        }
    }
}

pub fn match_agent_binary(comm: &str, cmdline: &str) -> (bool, Option<String>) {
    const KNOWN_AGENTS: &[(&str, &[&str])] = &[
        ("claude", &["claude", "claude-code"]),
        ("antigravity", &["agy", "antigravity", "antigravity-cli"]),
        ("gemini", &["gemini", "gemini-cli"]),
        ("cursor", &["cursor", "cursor-agent"]),
        ("codex", &["codex", "codex-cli"]),
        ("opencode", &["opencode"]),
        ("aider", &["aider"]),
        ("goose", &["goose"]),
    ];

    let comm_lower = comm.to_lowercase();
    let cmdline_lower = cmdline.to_lowercase();

    for (agent_name, aliases) in KNOWN_AGENTS {
        for alias in *aliases {
            if comm_lower == *alias || comm_lower.ends_with(&format!("/{}", alias)) {
                return (true, Some(agent_name.to_string()));
            }
            if (comm_lower == "node" || comm_lower == "python" || comm_lower == "python3" || comm_lower == "bun" || comm_lower == "deno" || comm_lower == "sh" || comm_lower == "bash" || comm_lower == "zsh" || comm_lower.is_empty())
                && (cmdline_lower.contains(&format!("/{}", alias)) || cmdline_lower.contains(&format!(" {} ", alias)) || cmdline_lower.starts_with(alias) || cmdline_lower.ends_with(alias) || cmdline_lower.contains(alias))
            {
                return (true, Some(agent_name.to_string()));
            }
        }
    }

    (false, None)
}

fn find_agent_in_tree(pid: u32, depth: u32) -> Option<(u32, String, String)> {
    if depth > 4 {
        return None;
    }

    if let Ok(children_content) = std::fs::read_to_string(format!("/proc/{}/task/{}/children", pid, pid)) {
        let child_pids: Vec<u32> = children_content
            .split_whitespace()
            .filter_map(|s| s.parse::<u32>().ok())
            .collect();

        // Check if any direct child matches a known agent
        for &child_pid in child_pids.iter().rev() {
            let comm = std::fs::read_to_string(format!("/proc/{}/comm", child_pid))
                .unwrap_or_default()
                .trim()
                .to_string();
            let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", child_pid))
                .unwrap_or_default()
                .replace('\0', " ")
                .trim()
                .to_string();
            if !comm.is_empty() {
                let (is_agent, _) = match_agent_binary(&comm, &cmdline);
                if is_agent {
                    return Some((child_pid, comm, cmdline));
                }
            }
        }

        // Search subchildren
        for &child_pid in child_pids.iter().rev() {
            if let Some(agent) = find_agent_in_tree(child_pid, depth + 1) {
                return Some(agent);
            }
        }
    }

    None
}

pub fn inspect_foreground_process(shell_pid: u32) -> Option<(u32, String, String)> {
    // 1. Search for any running agent in the process tree of shell_pid
    if let Some(agent) = find_agent_in_tree(shell_pid, 0) {
        return Some(agent);
    }

    // 2. Try reading /proc/<shell_pid>/stat to get tpgid (terminal process group)
    if let Ok(stat_content) = std::fs::read_to_string(format!("/proc/{}/stat", shell_pid)) {
        if let Some(after_paren) = stat_content.rfind(')') {
            let fields: Vec<&str> = stat_content[after_paren + 1..].split_whitespace().collect();
            // fields[0]=state, [1]=ppid, [2]=pgrp, [3]=session, [4]=tty_nr, [5]=tpgid
            if fields.len() > 5 {
                let pgrp = fields[2].parse::<i32>().unwrap_or(0);
                let tpgid = fields[5].parse::<i32>().unwrap_or(0);
                if tpgid > 0 && tpgid != pgrp {
                    let comm = std::fs::read_to_string(format!("/proc/{}/comm", tpgid))
                        .unwrap_or_default()
                        .trim()
                        .to_string();
                    let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", tpgid))
                        .unwrap_or_default()
                        .replace('\0', " ")
                        .trim()
                        .to_string();
                    if !comm.is_empty() {
                        let (is_agent, _) = match_agent_binary(&comm, &cmdline);
                        if is_agent {
                            return Some((tpgid as u32, comm, cmdline));
                        }
                        if let Some(agent) = find_agent_in_tree(tpgid as u32, 0) {
                            return Some(agent);
                        }
                        return Some((tpgid as u32, comm, cmdline));
                    }
                }
            }
        }
    }

    // 3. Fallback: inspect direct children of shell_pid for active non-shell task
    if let Ok(children_content) = std::fs::read_to_string(format!("/proc/{}/task/{}/children", shell_pid, shell_pid)) {
        let child_pids: Vec<u32> = children_content
            .split_whitespace()
            .filter_map(|s| s.parse::<u32>().ok())
            .collect();
        for child_pid in child_pids.into_iter().rev() {
            let comm = std::fs::read_to_string(format!("/proc/{}/comm", child_pid))
                .unwrap_or_default()
                .trim()
                .to_string();
            let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", child_pid))
                .unwrap_or_default()
                .replace('\0', " ")
                .trim()
                .to_string();
            if !comm.is_empty() && comm != "bash" && comm != "zsh" && comm != "sh" && comm != "fish" {
                return Some((child_pid, comm, cmdline));
            }
        }
    }

    None
}
