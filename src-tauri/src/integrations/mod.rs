use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIntegrationInfo {
    pub agent: String,
    pub name: String,
    pub detected: bool,
    pub installed: bool,
    pub config_path: Option<String>,
    pub hook_command: Option<String>,
    pub description: String,
}

pub struct IntegrationManager;

impl IntegrationManager {
    fn home_dir() -> PathBuf {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"))
    }

    fn claude_config_path() -> PathBuf {
        Self::home_dir().join(".claude").join("settings.json")
    }

    fn antigravity_config_path() -> PathBuf {
        Self::home_dir().join(".gemini").join("config").join("hooks.json")
    }

    fn opencode_config_path() -> PathBuf {
        Self::home_dir().join(".config").join("opencode").join("opencode.json")
    }

    fn opencode_plugin_path() -> PathBuf {
        Self::home_dir().join(".config").join("opencode").join("plugins").join("agentdeck.js")
    }

    fn bridge_binary_target() -> PathBuf {
        Self::home_dir().join(".local").join("bin").join("agentdeck-agent-event")
    }

    fn project_bridge_script() -> PathBuf {
        if let Ok(cwd) = std::env::current_dir() {
            let direct = cwd.join("bin").join("agentdeck-agent-event");
            if direct.exists() {
                return direct;
            }
        }
        // Fallback relative to common workspace locations
        PathBuf::from("/home/thanhduy/Projects/agent_deck/bin/agentdeck-agent-event")
    }

    pub fn detect_claude() -> bool {
        if let Ok(output) = Command::new("which").arg("claude").output() {
            if output.status.success() {
                return true;
            }
        }
        // Check common local installation paths
        let home = Self::home_dir();
        home.join(".claude").exists()
            || home.join(".local/bin/claude").exists()
            || home.join(".npm-global/bin/claude").exists()
            || Path::new("/usr/local/bin/claude").exists()
    }

    pub fn detect_opencode() -> bool {
        if let Ok(output) = Command::new("which").arg("opencode").output() {
            if output.status.success() {
                return true;
            }
        }
        let home = Self::home_dir();
        home.join(".opencode").exists() || home.join(".config/opencode").exists()
    }

    pub fn detect_antigravity() -> bool {
        if let Ok(output) = Command::new("which").arg("agy").output() {
            if output.status.success() {
                return true;
            }
        }
        let home = Self::home_dir();
        home.join(".gemini/antigravity-cli").exists() || home.join(".local/bin/agy").exists()
    }

    pub fn get_claude_info() -> AgentIntegrationInfo {
        let detected = Self::detect_claude();
        let config_path = Self::claude_config_path();
        let mut installed = false;

        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    installed = Self::is_hook_installed_in_json(&json);
                }
            }
        }

        AgentIntegrationInfo {
            agent: "claude".to_string(),
            name: "Claude Code".to_string(),
            detected,
            installed,
            config_path: Some(config_path.to_string_lossy().to_string()),
            hook_command: Some("agentdeck-agent-event --agent claude".to_string()),
            description: "Official Notification & PreToolUse lifecycle hooks for Claude Code CLI".to_string(),
        }
    }

    pub fn get_antigravity_info() -> AgentIntegrationInfo {
        let detected = Self::detect_antigravity();
        let config_path = Self::antigravity_config_path();
        let mut installed = false;

        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if content.contains("agentdeck-agent-event") {
                    installed = true;
                }
            }
        }
        if !installed {
            let ws_hook = PathBuf::from("/home/thanhduy/Projects/agent_deck/.agents/hooks.json");
            if ws_hook.exists() {
                if let Ok(content) = fs::read_to_string(&ws_hook) {
                    if content.contains("agentdeck-agent-event") {
                        installed = true;
                    }
                }
            }
        }

        AgentIntegrationInfo {
            agent: "antigravity".to_string(),
            name: "Antigravity (AGY)".to_string(),
            detected,
            installed,
            config_path: Some(config_path.to_string_lossy().to_string()),
            hook_command: Some("agentdeck-agent-event --agent antigravity".to_string()),
            description: "Agent Deck notification hooks for Google Antigravity CLI (AGY)".to_string(),
        }
    }

    pub fn get_all_integrations() -> Vec<AgentIntegrationInfo> {
        let mut list = Vec::new();
        list.push(Self::get_claude_info());
        list.push(Self::get_antigravity_info());
        list.push(Self::get_opencode_info());
        list
    }

    pub fn get_opencode_info() -> AgentIntegrationInfo {
        let detected = Self::detect_opencode();
        let plugin_path = Self::opencode_plugin_path();
        let installed = plugin_path.exists();

        AgentIntegrationInfo {
            agent: "opencode".to_string(),
            name: "OpenCode".to_string(),
            detected,
            installed,
            config_path: Some(plugin_path.to_string_lossy().to_string()),
            hook_command: Some("agentdeck-agent-event --agent opencode".to_string()),
            description: "Lifecycle events & permission plugin for OpenCode CLI".to_string(),
        }
    }

    fn is_hook_installed_in_json(json: &serde_json::Value) -> bool {
        if let Some(hooks) = json.get("hooks") {
            if let Some(notif) = hooks.get("Notification").and_then(|v| v.as_array()) {
                for item in notif {
                    if let Some(inner_hooks) = item.get("hooks").and_then(|v| v.as_array()) {
                        for h in inner_hooks {
                            if let Some(cmd) = h.get("command").and_then(|c| c.as_str()) {
                                if cmd.contains("agentdeck-agent-event") {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        false
    }

    pub fn ensure_bridge_binary_installed() -> Result<(), String> {
        let target = Self::bridge_binary_target();
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create ~/.local/bin directory: {}", e))?;
        }

        let source = Self::project_bridge_script();
        if !source.exists() {
            return Err(format!("Bridge script not found at {:?}", source));
        }

        // Copy or update bridge script
        fs::copy(&source, &target)
            .map_err(|e| format!("Failed to copy bridge script to ~/.local/bin: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&target) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&target, perms);
            }
        }

        Ok(())
    }

    pub fn install_claude_integration() -> Result<AgentIntegrationInfo, String> {
        // 1. Ensure bridge script is placed in PATH
        Self::ensure_bridge_binary_installed()?;

        // 2. Locate or create ~/.claude directory
        let config_path = Self::claude_config_path();
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create ~/.claude directory: {}", e))?;
        }

        // 3. Read existing or initialize default
        let mut json: serde_json::Value = if config_path.exists() {
            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read existing claude settings: {}", e))?;

            // Create timestamped backup before touching
            let backup_path = config_path.with_extension(format!("json.bak.{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()));
            let _ = fs::copy(&config_path, backup_path);

            serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        // 4. Ensure root is object
        if !json.is_object() {
            json = serde_json::json!({});
        }

        // Check if already installed
        if Self::is_hook_installed_in_json(&json) {
            return Ok(Self::get_claude_info());
        }

        // 5. Ensure "hooks" object exists
        let root = json.as_object_mut().unwrap();
        if !root.contains_key("hooks") || !root["hooks"].is_object() {
            root.insert("hooks".to_string(), serde_json::json!({}));
        }
        let hooks = root["hooks"].as_object_mut().unwrap();

        // 6. Append Notification Hook
        let notif_entry = serde_json::json!({
            "matcher": "",
            "hooks": [
                {
                    "type": "command",
                    "command": "agentdeck-agent-event --agent claude"
                }
            ]
        });

        if !hooks.contains_key("Notification") || !hooks["Notification"].is_array() {
            hooks.insert("Notification".to_string(), serde_json::json!([notif_entry]));
        } else {
            hooks["Notification"].as_array_mut().unwrap().push(notif_entry);
        }

        // 7. Write atomically
        let formatted = serde_json::to_string_pretty(&json)
            .map_err(|e| format!("Failed to serialize claude settings: {}", e))?;
        let tmp_path = config_path.with_extension("tmp");
        fs::write(&tmp_path, formatted)
            .map_err(|e| format!("Failed to write temporary config: {}", e))?;
        fs::rename(&tmp_path, &config_path)
            .map_err(|e| format!("Failed to save claude config: {}", e))?;

        log::info!("Successfully installed AgentDeck Claude Code integration in {:?}", config_path);
        Ok(Self::get_claude_info())
    }

    pub fn uninstall_claude_integration() -> Result<AgentIntegrationInfo, String> {
        let config_path = Self::claude_config_path();
        if !config_path.exists() {
            return Ok(Self::get_claude_info());
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read claude config: {}", e))?;
        let mut json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(j) => j,
            Err(_) => return Ok(Self::get_claude_info()),
        };

        if let Some(hooks) = json.get_mut("hooks").and_then(|h| h.as_object_mut()) {
            if let Some(notif) = hooks.get_mut("Notification").and_then(|n| n.as_array_mut()) {
                notif.retain(|item| {
                    if let Some(inner_hooks) = item.get("hooks").and_then(|v| v.as_array()) {
                        !inner_hooks.iter().any(|h| {
                            h.get("command")
                                .and_then(|c| c.as_str())
                                .map(|c| c.contains("agentdeck-agent-event"))
                                .unwrap_or(false)
                        })
                    } else {
                        true
                    }
                });
            }
        }

        let formatted = serde_json::to_string_pretty(&json)
            .map_err(|e| format!("Failed to serialize claude settings: {}", e))?;
        let tmp_path = config_path.with_extension("tmp");
        fs::write(&tmp_path, formatted)
            .map_err(|e| format!("Failed to write temporary config: {}", e))?;
        fs::rename(&tmp_path, &config_path)
            .map_err(|e| format!("Failed to save claude config: {}", e))?;

        log::info!("Successfully uninstalled AgentDeck Claude Code integration from {:?}", config_path);
        Ok(Self::get_claude_info())
    }

    pub fn install_antigravity_integration() -> Result<AgentIntegrationInfo, String> {
        Self::ensure_bridge_binary_installed()?;

        let config_path = Self::antigravity_config_path();
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create ~/.gemini/config directory: {}", e))?;
        }

        let mut json: serde_json::Value = if config_path.exists() {
            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read existing hooks.json: {}", e))?;
            let backup_path = config_path.with_extension(format!("json.bak.{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()));
            let _ = fs::copy(&config_path, backup_path);
            serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if !json.is_object() {
            json = serde_json::json!({});
        }

        let hook_config = serde_json::json!({
            "PreToolUse": [
                {
                    "matcher": "ask_question|ask_user",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "agentdeck-agent-event --agent antigravity --type input_required"
                        }
                    ]
                }
            ],
            "Stop": [
                {
                    "type": "command",
                    "command": "agentdeck-agent-event --agent antigravity --type idle"
                }
            ]
        });

        json.as_object_mut().unwrap().insert("agentdeck-notification".to_string(), hook_config);

        let formatted = serde_json::to_string_pretty(&json)
            .map_err(|e| format!("Failed to serialize hooks.json: {}", e))?;
        let tmp_path = config_path.with_extension("tmp");
        fs::write(&tmp_path, formatted)
            .map_err(|e| format!("Failed to write temporary hooks config: {}", e))?;
        fs::rename(&tmp_path, &config_path)
            .map_err(|e| format!("Failed to save hooks config: {}", e))?;

        // Also ensure .agents/hooks.json in project root has it for workspace discovery
        let ws_agents_dir = PathBuf::from("/home/thanhduy/Projects/agent_deck/.agents");
        if ws_agents_dir.exists() {
            let ws_hooks_file = ws_agents_dir.join("hooks.json");
            let _ = fs::write(&ws_hooks_file, serde_json::to_string_pretty(&json).unwrap_or_default());
        }

        log::info!("Successfully installed AgentDeck Antigravity integration in {:?}", config_path);
        Ok(Self::get_antigravity_info())
    }

    pub fn uninstall_antigravity_integration() -> Result<AgentIntegrationInfo, String> {
        let config_path = Self::antigravity_config_path();
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(obj) = json.as_object_mut() {
                        obj.remove("agentdeck-notification");
                    }
                    if let Ok(formatted) = serde_json::to_string_pretty(&json) {
                        let tmp_path = config_path.with_extension("tmp");
                        if fs::write(&tmp_path, formatted).is_ok() {
                            let _ = fs::rename(&tmp_path, &config_path);
                        }
                    }
                }
            }
        }

        let ws_hooks = PathBuf::from("/home/thanhduy/Projects/agent_deck/.agents/hooks.json");
        if ws_hooks.exists() {
            let _ = fs::remove_file(ws_hooks);
        }

        log::info!("Successfully uninstalled AgentDeck Antigravity integration");
        Ok(Self::get_antigravity_info())
    }

    pub fn install_opencode_integration() -> Result<AgentIntegrationInfo, String> {
        let plugin_path = Self::opencode_plugin_path();
        if let Some(parent) = plugin_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
        }

        let plugin_code = r#"// AgentDeck Notification Plugin for OpenCode
import http from 'node:http';

function postEvent(payload) {
  const port = process.env.AGENTDECK_PORT || '4020';
  const dataString = JSON.stringify(payload);
  const req = http.request({
    hostname: '127.0.0.1',
    port: parseInt(port, 10),
    path: '/agent-events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataString),
    },
    timeout: 1000,
  });
  req.on('error', () => {});
  req.write(dataString);
  req.end();
}

export default async function agentdeckPlugin() {
  return {
    async 'permission.ask'(input) {
      postEvent({
        type: 'permission_required',
        agent: 'opencode',
        sessionId: process.env.AGENTDECK_SESSION_ID,
        cwd: process.env.AGENTDECK_PROJECT_PATH,
        message: input?.title || input?.type || 'Tool permission required',
        timestamp: Date.now(),
      });
    },
    async 'event'(input) {
      if (input?.event?.type === 'session.idle') {
        postEvent({
          type: 'idle',
          agent: 'opencode',
          sessionId: process.env.AGENTDECK_SESSION_ID,
          cwd: process.env.AGENTDECK_PROJECT_PATH,
          message: 'OpenCode is idle and waiting for instructions',
          timestamp: Date.now(),
        });
      }
    },
  };
}
"#;

        fs::write(&plugin_path, plugin_code)
            .map_err(|e| format!("Failed to write opencode plugin: {}", e))?;

        let config_path = Self::opencode_config_path();
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(obj) = json.as_object_mut() {
                        let plugin_str = plugin_path.to_string_lossy().to_string();
                        if !obj.contains_key("plugin") {
                            obj.insert("plugin".to_string(), serde_json::json!([plugin_str]));
                        } else if let Some(arr) = obj.get_mut("plugin").and_then(|p| p.as_array_mut()) {
                            if !arr.iter().any(|v| v.as_str() == Some(&plugin_str)) {
                                arr.push(serde_json::json!(plugin_str));
                            }
                        }
                        if let Ok(formatted) = serde_json::to_string_pretty(&json) {
                            let _ = fs::write(&config_path, formatted);
                        }
                    }
                }
            }
        }

        log::info!("Successfully installed AgentDeck OpenCode plugin at {:?}", plugin_path);
        Ok(Self::get_opencode_info())
    }

    pub fn uninstall_opencode_integration() -> Result<AgentIntegrationInfo, String> {
        let plugin_path = Self::opencode_plugin_path();
        if plugin_path.exists() {
            let _ = fs::remove_file(&plugin_path);
        }

        let config_path = Self::opencode_config_path();
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(arr) = json.get_mut("plugin").and_then(|p| p.as_array_mut()) {
                        arr.retain(|v| !v.as_str().map(|s| s.contains("agentdeck")).unwrap_or(false));
                        if let Ok(formatted) = serde_json::to_string_pretty(&json) {
                            let _ = fs::write(&config_path, formatted);
                        }
                    }
                }
            }
        }

        log::info!("Successfully uninstalled AgentDeck OpenCode plugin");
        Ok(Self::get_opencode_info())
    }
}
