use crate::git::{BranchInfo, CommitResult, GitEngine, RepoDiffData, RepoInfo, StashInfo};
use crate::pty::PtyManager;
use crate::watcher::WatcherManager;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[derive(Debug, Serialize)]
pub struct FolderItem {
    pub name: String,
    pub path: String,
    pub is_git_repo: bool,
}

#[derive(Debug, Serialize)]
pub struct DirectoryListing {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub home_path: String,
    pub directories: Vec<FolderItem>,
}

#[tauri::command]
pub fn get_default_working_dir() -> String {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        })
}

#[tauri::command]
pub fn list_directory_folders(path: Option<String>) -> Result<DirectoryListing, String> {
    let home_path = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    let target_path_str = path
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| home_path.clone())
        });

    let target_path = PathBuf::from(&target_path_str);
    let canonical = target_path
        .canonicalize()
        .unwrap_or(target_path);

    let current_path = canonical.to_string_lossy().to_string();
    let parent_path = canonical
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let mut directories = Vec::new();

    if let Ok(entries) = fs::read_dir(&canonical) {
        let mut subdirs: Vec<PathBuf> = Vec::new();
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let p = entry.path();
                    let file_name = p.file_name().unwrap_or_default().to_string_lossy();
                    if !file_name.starts_with('.') || file_name == ".git" {
                        subdirs.push(p);
                    }
                }
            }
        }

        subdirs.sort_by(|a, b| {
            a.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase()
                .cmp(&b.file_name().unwrap_or_default().to_string_lossy().to_lowercase())
        });

        for dir in subdirs {
            let name = dir
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let is_git = dir.join(".git").exists() || dir.join("HEAD").exists();
            directories.push(FolderItem {
                name,
                path: dir.to_string_lossy().to_string(),
                is_git_repo: is_git,
            });
        }
    }

    Ok(DirectoryListing {
        current_path,
        parent_path,
        home_path,
        directories,
    })
}

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    pty_manager: State<PtyManager>,
    session_id: String,
    cwd: Option<String>,
    shell: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    pty_manager.spawn(app, session_id, cwd, shell, cols, rows)
}

#[tauri::command]
pub fn write_pty(
    pty_manager: State<PtyManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    pty_manager.write(&session_id, &data)
}

#[tauri::command]
pub fn resize_pty(
    pty_manager: State<PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(
    pty_manager: State<PtyManager>,
    session_id: String,
) -> Result<(), String> {
    pty_manager.kill(&session_id)
}

#[tauri::command]
pub fn get_pty_process_info(
    pty_manager: State<PtyManager>,
    session_id: String,
) -> Result<crate::pty::PtyProcessInfo, String> {
    pty_manager.get_process_info(&session_id)
}

#[tauri::command]
pub fn open_repository(
    app: AppHandle,
    watcher_manager: State<WatcherManager>,
    path: String,
) -> Result<RepoInfo, String> {
    let info = GitEngine::get_repo_info(&path)?;
    let _ = watcher_manager.watch(app, &info.path);
    Ok(info)
}

#[tauri::command]
pub fn unwatch_repository(
    watcher_manager: State<WatcherManager>,
    path: String,
) -> Result<(), String> {
    watcher_manager.unwatch(&path);
    Ok(())
}

#[tauri::command]
pub fn get_repository_diffs(path: String) -> Result<RepoDiffData, String> {
    GitEngine::get_diffs(&path)
}

#[tauri::command]
pub fn stage_file(path: String, relative_path: String) -> Result<(), String> {
    GitEngine::stage_file(&path, &relative_path)
}

#[tauri::command]
pub fn unstage_file(path: String, relative_path: String) -> Result<(), String> {
    GitEngine::unstage_file(&path, &relative_path)
}

#[tauri::command]
pub fn stage_files(path: String, relative_paths: Vec<String>) -> Result<(), String> {
    GitEngine::stage_files(&path, &relative_paths)
}

#[tauri::command]
pub fn unstage_files(path: String, relative_paths: Vec<String>) -> Result<(), String> {
    GitEngine::unstage_files(&path, &relative_paths)
}

#[tauri::command]
pub fn stage_all(path: String) -> Result<(), String> {
    GitEngine::stage_all(&path)
}

#[tauri::command]
pub fn unstage_all(path: String) -> Result<(), String> {
    GitEngine::unstage_all(&path)
}

#[tauri::command]
pub fn stage_hunk(path: String, relative_path: String, hunk_index: usize) -> Result<(), String> {
    GitEngine::stage_hunk(&path, &relative_path, hunk_index)
}

#[tauri::command]
pub fn unstage_hunk(path: String, relative_path: String, hunk_index: usize) -> Result<(), String> {
    GitEngine::unstage_hunk(&path, &relative_path, hunk_index)
}

#[tauri::command]
pub fn discard_hunk(path: String, relative_path: String, hunk_index: usize) -> Result<(), String> {
    GitEngine::discard_hunk(&path, &relative_path, hunk_index)
}

#[tauri::command]
pub fn discard_file(path: String, relative_path: String) -> Result<(), String> {
    GitEngine::discard_file(&path, &relative_path)
}

#[tauri::command]
pub fn commit_staged(path: String, message: String) -> Result<CommitResult, String> {
    GitEngine::commit_staged(&path, &message)
}

#[tauri::command]
pub fn commit_amend(path: String, message: String) -> Result<CommitResult, String> {
    GitEngine::commit_amend(&path, &message)
}

#[tauri::command]
pub fn list_branches(path: String) -> Result<Vec<BranchInfo>, String> {
    GitEngine::list_branches(&path)
}

#[tauri::command]
pub fn checkout_branch(path: String, branch_name: String) -> Result<(), String> {
    GitEngine::checkout_branch(&path, &branch_name)
}

#[tauri::command]
pub fn create_branch(path: String, branch_name: String) -> Result<(), String> {
    GitEngine::create_branch(&path, &branch_name)
}

#[tauri::command]
pub fn stash_save(path: String, message: Option<String>) -> Result<(), String> {
    GitEngine::stash_save(&path, message.as_deref())
}

#[tauri::command]
pub fn stash_pop(path: String) -> Result<(), String> {
    GitEngine::stash_pop(&path)
}

#[tauri::command]
pub fn list_stashes(path: String) -> Result<Vec<StashInfo>, String> {
    GitEngine::list_stashes(&path)
}

#[tauri::command]
pub fn pull_repository(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    GitEngine::pull(&path, remote.as_deref(), branch.as_deref())
}

#[tauri::command]
pub fn push_repository(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    set_upstream: Option<bool>,
) -> Result<String, String> {
    GitEngine::push(
        &path,
        remote.as_deref(),
        branch.as_deref(),
        set_upstream.unwrap_or(false),
    )
}

#[tauri::command]
pub fn create_directory(parent_path: String, name: String) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Directory name cannot be empty".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') || name == "." || name == ".." {
        return Err("Invalid directory name".to_string());
    }
    let target = PathBuf::from(&parent_path).join(name);
    if target.exists() {
        return Err(format!("Directory '{}' already exists", name));
    }
    fs::create_dir_all(&target)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn init_repository(path: String) -> Result<RepoInfo, String> {
    GitEngine::init_repo(&path)
}

#[tauri::command]
pub fn read_file_content(path: String, relative_path: String) -> Result<String, String> {
    let rel = std::path::Path::new(&relative_path);
    if rel.is_absolute() || relative_path.contains("..") || relative_path.contains('\0') {
        return Err("Invalid relative file path".to_string());
    }
    let full_path = PathBuf::from(&path).join(rel);
    fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn show_desktop_notification(
    title: String,
    body: String,
    urgency: Option<String>,
) -> Result<(), String> {
    crate::agent_events::send_desktop_notification(&title, &body, urgency.as_deref())
}

#[tauri::command]
pub fn focus_app_window(app: AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn get_agent_integrations() -> Result<Vec<crate::integrations::AgentIntegrationInfo>, String> {
    Ok(crate::integrations::IntegrationManager::get_all_integrations())
}

#[tauri::command]
pub fn install_agent_integration(agent: String) -> Result<crate::integrations::AgentIntegrationInfo, String> {
    if agent == "claude" {
        crate::integrations::IntegrationManager::install_claude_integration()
    } else if agent == "antigravity" {
        crate::integrations::IntegrationManager::install_antigravity_integration()
    } else if agent == "opencode" {
        crate::integrations::IntegrationManager::install_opencode_integration()
    } else {
        Err(format!("Agent '{}' does not support automated hook installation yet", agent))
    }
}

#[tauri::command]
pub fn uninstall_agent_integration(agent: String) -> Result<crate::integrations::AgentIntegrationInfo, String> {
    if agent == "claude" {
        crate::integrations::IntegrationManager::uninstall_claude_integration()
    } else if agent == "antigravity" {
        crate::integrations::IntegrationManager::uninstall_antigravity_integration()
    } else if agent == "opencode" {
        crate::integrations::IntegrationManager::uninstall_opencode_integration()
    } else {
        Err(format!("Agent '{}' does not support automated uninstallation", agent))
    }
}

#[tauri::command]
pub async fn fetch_preview_page(url: String) -> Result<crate::preview::PreviewPageResult, String> {
    crate::preview::fetch_url_internal(&url).await
}

#[tauri::command]
pub async fn open_native_preview_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri::Manager;
    let target_url = if url.starts_with("http://") || url.starts_with("https://") {
        url
    } else {
        format!("http://{}", url)
    };

    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let _ = existing.navigate(target_url.parse().map_err(|e| format!("Invalid URL: {}", e))?);
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed_url = target_url.parse().map_err(|e| format!("Invalid URL: {}", e))?;
    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        "agentdeck-preview",
        tauri::WebviewUrl::External(parsed_url),
    )
    .title("AgentDeck - Native Web Preview")
    .inner_size(1200.0, 800.0)
    .resizable(true)
    .initialization_script(crate::preview::AGENTDECK_INSPECTOR_JS);

    builder.build().map_err(|e| format!("Failed to create native webview window: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn close_native_preview_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let _ = existing.close();
    }
    Ok(())
}

#[tauri::command]
pub fn is_native_preview_open(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    Ok(app.get_webview_window("agentdeck-preview").is_some())
}

#[tauri::command]
pub fn focus_native_preview_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn reload_native_preview_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let _ = existing.eval("window.location.reload();");
    }
    Ok(())
}

#[tauri::command]
pub async fn report_inspected_component(
    app: tauri::AppHandle,
    payload: serde_json::Value,
) -> Result<(), String> {
    use tauri::Emitter;
    let _ = app.emit("agentdeck:component-picked", payload);
    Ok(())
}

#[tauri::command]
pub async fn steer_selected_component(
    app: tauri::AppHandle,
    meta: serde_json::Value,
    instruction: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let _ = app.emit("agentdeck:steer-component", serde_json::json!({
        "meta": meta,
        "instruction": instruction,
    }));
    let _ = focus_app_window(app);
    Ok(())
}

#[tauri::command]
pub fn close_native_steer_popup(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let _ = existing.eval("window.__AGENTDECK_CLOSE_STEER_POPUP__ && window.__AGENTDECK_CLOSE_STEER_POPUP__();");
    }
    Ok(())
}

#[tauri::command]
pub fn set_native_preview_inspect(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri::Manager;
    if let Some(existing) = app.get_webview_window("agentdeck-preview") {
        let script = format!("window.__AGENTDECK_SET_INSPECT__ && window.__AGENTDECK_SET_INSPECT__({});", enabled);
        let _ = existing.eval(&script);
    }
    Ok(())
}


