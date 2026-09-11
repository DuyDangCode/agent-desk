fn read_proc(pid: u32) -> (String, String) {
    let comm = std::fs::read_to_string(format!("/proc/{}/comm", pid))
        .unwrap_or_default()
        .trim()
        .to_string();
    let cmdline = std::fs::read_to_string(format!("/proc/{}/cmdline", pid))
        .unwrap_or_default()
        .replace('\0', " ")
        .trim()
        .to_string();
    (comm, cmdline)
}

fn read_children(pid: u32) -> Vec<u32> {
    std::fs::read_to_string(format!("/proc/{}/task/{}/children", pid, pid))
        .unwrap_or_default()
        .split_whitespace()
        .filter_map(|s| s.parse::<u32>().ok())
        .collect()
}

pub fn match_agent_binary(comm: &str, cmdline: &str) -> (bool, Option<String>) {
    const KNOWN_AGENTS: &[(&str, &[&str])] = &[
        ("claude", &["claude", "claude-code"]),
        ("antigravity", &["agy", "antigravity", "antigravity-cli"]),
        ("gemini", &["gemini", "gemini-cli"]),
        ("cursor", &["cursor", "cursor-agent"]),
        ("codex", &["codex", "codex-cli"]),
        ("pi", &["pi", "pi-agent"]),
        ("opencode", &["opencode"]),
        ("aider", &["aider"]),
        ("goose", &["goose"]),
    ];

    let comm_lower = comm.to_lowercase();
    let cmdline_lower = cmdline.to_lowercase();
    let is_wrapper = matches!(
        comm_lower.as_str(),
        "node" | "python" | "python3" | "bun" | "deno" | "sh" | "bash" | "zsh" | ""
    );

    for (agent_name, aliases) in KNOWN_AGENTS {
        for alias in *aliases {
            if comm_lower == *alias || comm_lower.ends_with(&format!("/{}", alias)) {
                return (true, Some(agent_name.to_string()));
            }
            if is_wrapper {
                let matched = if alias.len() <= 2 {
                    cmdline_lower == *alias
                        || cmdline_lower.starts_with(&format!("{} ", alias))
                        || cmdline_lower.contains(&format!(" {} ", alias))
                        || cmdline_lower.contains(&format!("/{} ", alias))
                        || cmdline_lower.ends_with(&format!(" {}", alias))
                        || cmdline_lower.ends_with(&format!("/{}", alias))
                } else {
                    cmdline_lower.contains(alias)
                };
                if matched {
                    return (true, Some(agent_name.to_string()));
                }
            }
        }
    }

    (false, None)
}

pub fn find_agent_in_tree(pid: u32, depth: u32) -> Option<(u32, String, String)> {
    if depth > 4 {
        return None;
    }

    let child_pids = read_children(pid);
    for &child_pid in child_pids.iter().rev() {
        let (comm, cmdline) = read_proc(child_pid);
        if !comm.is_empty() && match_agent_binary(&comm, &cmdline).0 {
            return Some((child_pid, comm, cmdline));
        }
    }

    for &child_pid in child_pids.iter().rev() {
        if let Some(agent) = find_agent_in_tree(child_pid, depth + 1) {
            return Some(agent);
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
                    let (comm, cmdline) = read_proc(tpgid as u32);
                    if !comm.is_empty() {
                        if match_agent_binary(&comm, &cmdline).0 {
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
    for child_pid in read_children(shell_pid).into_iter().rev() {
        let (comm, cmdline) = read_proc(child_pid);
        if !comm.is_empty() && !matches!(comm.as_str(), "bash" | "zsh" | "sh" | "fish") {
            return Some((child_pid, comm, cmdline));
        }
    }

    None
}
