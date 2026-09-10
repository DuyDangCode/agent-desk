use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path as AxumPath, State,
    },
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::SocketAddr,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::channel,
        Arc,
    },
    time::Duration,
};
use tower_http::cors::{Any, CorsLayer};

#[path = "../../src-tauri/src/git/mod.rs"]
pub mod git;
use git::*;

#[derive(Clone)]
struct AppContext {
    pty_sessions: Arc<Mutex<HashMap<String, Arc<PtySessionState>>>>,
    watcher_tx: Arc<Mutex<Option<tokio::sync::broadcast::Sender<String>>>>,
    active_repo: Arc<Mutex<Option<String>>>,
}

struct PtySessionState {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    running: Arc<AtomicBool>,
    child_pid: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct SpawnPtyReq {
    session_id: String,
    cwd: Option<String>,
    shell: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
}

#[derive(Debug, Deserialize)]
struct WritePtyReq {
    session_id: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct ResizePtyReq {
    session_id: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Deserialize)]
struct RepoReq {
    path: String,
}

#[derive(Debug, Deserialize)]
struct FileActionReq {
    path: String,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
struct FilesActionReq {
    path: String,
    relative_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct HunkActionReq {
    path: String,
    relative_path: String,
    hunk_index: usize,
}

#[derive(Debug, Deserialize)]
struct CommitReq {
    path: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ListDirsReq {
    path: Option<String>,
}

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

#[derive(Debug, Deserialize)]
struct BranchReq {
    path: String,
    branch_name: String,
}

#[derive(Debug, Deserialize)]
struct StashReq {
    path: String,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PushPullReq {
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    set_upstream: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CreateDirReq {
    #[serde(alias = "parentPath")]
    parent_path: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct ReadFileReq {
    #[serde(alias = "repoPath")]
    path: String,
    #[serde(alias = "relativePath")]
    relative_path: String,
}

#[tokio::main]
async fn main() {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let (watch_tx, _) = tokio::sync::broadcast::channel::<String>(100);

    let ctx = AppContext {
        pty_sessions: Arc::new(Mutex::new(HashMap::new())),
        watcher_tx: Arc::new(Mutex::new(Some(watch_tx))),
        active_repo: Arc::new(Mutex::new(None)),
    };

    let app = Router::new()
        .route("/api/default-dir", get(get_default_dir))
        .route("/api/fs/list-dirs", post(list_dirs_handler))
        .route("/api/fs/create-dir", post(create_dir_handler))
        .route("/api/fs/read-file", post(read_file_handler))
        .route("/api/repo/init", post(init_repo_handler))
        .route("/api/repo/open", post(open_repo_handler))
        .route("/api/repo/diffs", post(get_diffs_handler))
        .route("/api/repo/stage-file", post(stage_file_handler))
        .route("/api/repo/unstage-file", post(unstage_file_handler))
        .route("/api/repo/stage-files", post(stage_files_handler))
        .route("/api/repo/unstage-files", post(unstage_files_handler))
        .route("/api/repo/stage-all", post(stage_all_handler))
        .route("/api/repo/unstage-all", post(unstage_all_handler))
        .route("/api/repo/stage-hunk", post(stage_hunk_handler))
        .route("/api/repo/unstage-hunk", post(unstage_hunk_handler))
        .route("/api/repo/discard-hunk", post(discard_hunk_handler))
        .route("/api/repo/discard-file", post(discard_file_handler))
        .route("/api/repo/commit", post(commit_handler))
        .route("/api/repo/commit-amend", post(commit_amend_handler))
        .route("/api/repo/branches", post(list_branches_handler))
        .route("/api/repo/checkout-branch", post(checkout_branch_handler))
        .route("/api/repo/create-branch", post(create_branch_handler))
        .route("/api/repo/stash-save", post(stash_save_handler))
        .route("/api/repo/stash-pop", post(stash_pop_handler))
        .route("/api/repo/stashes", post(list_stashes_handler))
        .route("/api/repo/pull", post(pull_repo_handler))
        .route("/api/repo/push", post(push_repo_handler))
        .route("/api/pty/spawn", post(spawn_pty_handler))
        .route("/api/pty/write", post(write_pty_handler))
        .route("/api/pty/resize", post(resize_pty_handler))
        .route("/api/pty/kill", post(kill_pty_handler))
        .route("/api/pty/process-info", post(pty_process_info_handler))
        .route("/agent-events", post(agent_events_handler))
        .route("/api/agent-events", post(agent_events_handler))
        .route("/api/component-picked", post(component_picked_handler))
        .route("/component-picked", post(component_picked_handler))
        .route("/api/component-steer", post(component_steer_handler))
        .route("/component-steer", post(component_steer_handler))
        .route("/api/notifications/desktop", post(desktop_notification_handler))
        .route("/api/integrations", get(get_integrations_handler))
        .route("/api/integrations/install", post(install_integration_handler))
        .route("/api/integrations/uninstall", post(uninstall_integration_handler))
        .route("/api/preview", axum::routing::any(preview_handler))
        .route("/proxy/:port", axum::routing::any(proxy_gateway_handler))
        .route("/proxy/:port/*path", axum::routing::any(proxy_gateway_handler))
        .fallback(proxy_fallback_handler)
        .route("/ws/pty/:session_id", get(pty_ws_handler))
        .route("/ws/events", get(events_ws_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(ctx);

    let addr = SocketAddr::from(([127, 0, 0, 1], 4020));
    log::info!("AgentDeck Core Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind server address");

    axum::serve(listener, app).await.expect("Server error");
}

async fn get_default_dir() -> Json<serde_json::Value> {
    let dir = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        });
    Json(serde_json::json!({ "path": dir }))
}

async fn list_dirs_handler(
    Json(req): Json<ListDirsReq>,
) -> Result<Json<DirectoryListing>, (axum::http::StatusCode, String)> {
    let home_path = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    let target_path_str = req
        .path
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
                    // Skip hidden folders (except .git check)
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

    Ok(Json(DirectoryListing {
        current_path,
        parent_path,
        home_path,
        directories,
    }))
}

async fn create_dir_handler(
    Json(req): Json<CreateDirReq>,
) -> Result<Json<String>, (axum::http::StatusCode, String)> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Directory name cannot be empty".to_string()));
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') || name == "." || name == ".." {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Invalid directory name".to_string()));
    }
    let target = PathBuf::from(&req.parent_path).join(name);
    if target.exists() {
        return Err((axum::http::StatusCode::BAD_REQUEST, format!("Directory '{}' already exists", name)));
    }
    fs::create_dir_all(&target)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e)))?;
    Ok(Json(target.to_string_lossy().to_string()))
}

async fn read_file_handler(
    Json(req): Json<ReadFileReq>,
) -> Result<Json<String>, (axum::http::StatusCode, String)> {
    let rel = std::path::Path::new(&req.relative_path);
    if rel.is_absolute() || req.relative_path.contains("..") || req.relative_path.contains('\0') {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Invalid relative file path".to_string()));
    }
    let full_path = PathBuf::from(&req.path).join(rel);
    match fs::read_to_string(&full_path) {
        Ok(content) => Ok(Json(content)),
        Err(e) => Err((axum::http::StatusCode::NOT_FOUND, format!("Failed to read file: {}", e))),
    }
}

async fn init_repo_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<RepoInfo>, (axum::http::StatusCode, String)> {
    GitEngine::init_repo(&req.path)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn open_repo_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<RepoReq>,
) -> Result<Json<RepoInfo>, (axum::http::StatusCode, String)> {
    let info = GitEngine::get_repo_info(&req.path)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    
    // Arm debounced watcher
    let repo_path = info.path.clone();
    *ctx.active_repo.lock() = Some(repo_path.clone());
    
    if let Some(tx) = ctx.watcher_tx.lock().as_ref() {
        let tx_clone = tx.clone();
        let repo_path_buf = PathBuf::from(&repo_path);
        
        std::thread::Builder::new()
            .name("fs-debouncer".to_string())
            .spawn(move || {
                let (deb_tx, deb_rx) = channel();
                if let Ok(mut debouncer) = new_debouncer(Duration::from_millis(200), deb_tx) {
                    let _ = debouncer.watcher().watch(&repo_path_buf, RecursiveMode::Recursive);
                    while let Ok(res) = deb_rx.recv() {
                        if let Ok(events) = res {
                            let has_valid_changes = events.iter().any(|e| {
                                let s = e.path.to_string_lossy();
                                !s.contains("/.git/") && !s.contains("/node_modules/") && !s.contains("/target/") && !s.contains("/dist/")
                            });
                            if has_valid_changes {
                                let _ = tx_clone.send(serde_json::json!({
                                    "event": "repo-changed",
                                    "repo_path": repo_path_buf.to_string_lossy().to_string()
                                }).to_string());
                            }
                        }
                    }
                }
            })
            .ok();
    }

    Ok(Json(info))
}

async fn get_diffs_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<RepoDiffData>, (axum::http::StatusCode, String)> {
    GitEngine::get_diffs(&req.path)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stage_file_handler(
    Json(req): Json<FileActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stage_file(&req.path, &req.relative_path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn unstage_file_handler(
    Json(req): Json<FileActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::unstage_file(&req.path, &req.relative_path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stage_files_handler(
    Json(req): Json<FilesActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stage_files(&req.path, &req.relative_paths)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn unstage_files_handler(
    Json(req): Json<FilesActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::unstage_files(&req.path, &req.relative_paths)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stage_all_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stage_all(&req.path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn unstage_all_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::unstage_all(&req.path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stage_hunk_handler(
    Json(req): Json<HunkActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stage_hunk(&req.path, &req.relative_path, req.hunk_index)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn unstage_hunk_handler(
    Json(req): Json<HunkActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::unstage_hunk(&req.path, &req.relative_path, req.hunk_index)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn discard_hunk_handler(
    Json(req): Json<HunkActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::discard_hunk(&req.path, &req.relative_path, req.hunk_index)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn discard_file_handler(
    Json(req): Json<FileActionReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::discard_file(&req.path, &req.relative_path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn commit_handler(
    Json(req): Json<CommitReq>,
) -> Result<Json<CommitResult>, (axum::http::StatusCode, String)> {
    GitEngine::commit_staged(&req.path, &req.message)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn commit_amend_handler(
    Json(req): Json<CommitReq>,
) -> Result<Json<CommitResult>, (axum::http::StatusCode, String)> {
    GitEngine::commit_amend(&req.path, &req.message)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn list_branches_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<Vec<BranchInfo>>, (axum::http::StatusCode, String)> {
    GitEngine::list_branches(&req.path)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn checkout_branch_handler(
    Json(req): Json<BranchReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::checkout_branch(&req.path, &req.branch_name)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn create_branch_handler(
    Json(req): Json<BranchReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::create_branch(&req.path, &req.branch_name)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stash_save_handler(
    Json(req): Json<StashReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stash_save(&req.path, req.message.as_deref())
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn stash_pop_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    GitEngine::stash_pop(&req.path)
        .map(|_| Json(serde_json::json!({ "success": true })))
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn list_stashes_handler(
    Json(req): Json<RepoReq>,
) -> Result<Json<Vec<StashInfo>>, (axum::http::StatusCode, String)> {
    GitEngine::list_stashes(&req.path)
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn pull_repo_handler(
    Json(req): Json<PushPullReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    tokio::task::spawn_blocking(move || {
        GitEngine::pull(&req.path, req.remote.as_deref(), req.branch.as_deref())
    })
    .await
    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Task join error: {}", e)))?
    .map(|msg| Json(serde_json::json!({ "success": true, "message": msg })))
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn push_repo_handler(
    Json(req): Json<PushPullReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    tokio::task::spawn_blocking(move || {
        GitEngine::push(
            &req.path,
            req.remote.as_deref(),
            req.branch.as_deref(),
            req.set_upstream.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Task join error: {}", e)))?
    .map(|msg| Json(serde_json::json!({ "success": true, "message": msg })))
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))
}

async fn spawn_pty_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<SpawnPtyReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    // If session already exists and is running, preserve it
    {
        let sessions = ctx.pty_sessions.lock();
        if let Some(existing) = sessions.get(&req.session_id) {
            if existing.running.load(Ordering::Relaxed) {
                return Ok(Json(serde_json::json!({ "session_id": req.session_id })));
            }
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: req.rows.unwrap_or(24).max(1),
            cols: req.cols.unwrap_or(80).max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let shell_cmd = req.shell.unwrap_or_else(|| {
        if cfg!(windows) {
            std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    });

    let mut cmd = CommandBuilder::new(&shell_cmd);
    if !cfg!(windows) && (shell_cmd.ends_with("bash") || shell_cmd.ends_with("zsh")) {
        cmd.args(["-l"]);
    }

    if let Some(ref dir) = req.cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("LANG", "en_US.UTF-8");
    cmd.env("LC_ALL", "en_US.UTF-8");
    cmd.env("AGENTDECK_SESSION_ID", &req.session_id);
    cmd.env("AGENTDECK_PORT", "4020");
    if let Some(ref dir) = req.cwd {
        if !dir.is_empty() {
            cmd.env("AGENTDECK_PROJECT_PATH", dir);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let child_pid = child.process_id();

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let session = Arc::new(PtySessionState {
        master: Mutex::new(pair.master),
        writer: Arc::new(Mutex::new(writer)),
        running: Arc::new(AtomicBool::new(true)),
        child_pid,
    });

    ctx.pty_sessions.lock().insert(req.session_id.clone(), session);

    Ok(Json(serde_json::json!({
        "success": true,
        "session_id": req.session_id
    })))
}

async fn write_pty_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<WritePtyReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let session_opt = {
        let sessions = ctx.pty_sessions.lock();
        sessions.get(&req.session_id).cloned()
    };

    if let Some(session) = session_opt {
        let mut writer = session.writer.lock();
        writer
            .write_all(req.data.as_bytes())
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        writer
            .flush()
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        Ok(Json(serde_json::json!({ "success": true })))
    } else {
        Err((axum::http::StatusCode::NOT_FOUND, "PTY session not found".to_string()))
    }
}

async fn resize_pty_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<ResizePtyReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let session_opt = {
        let sessions = ctx.pty_sessions.lock();
        sessions.get(&req.session_id).cloned()
    };

    if let Some(session) = session_opt {
        let master = session.master.lock();
        master
            .resize(PtySize {
                rows: req.rows.max(1),
                cols: req.cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        Ok(Json(serde_json::json!({ "success": true })))
    } else {
        Ok(Json(serde_json::json!({ "success": false, "reason": "PTY session not found" })))
    }
}

#[derive(Debug, Deserialize)]
struct KillPtyReq {
    session_id: String,
}

async fn kill_pty_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<KillPtyReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let mut sessions = ctx.pty_sessions.lock();
    if let Some(session) = sessions.remove(&req.session_id) {
        session.running.store(false, Ordering::Relaxed);
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
struct PtyProcessInfoReq {
    session_id: String,
}

async fn pty_process_info_handler(
    State(ctx): State<AppContext>,
    Json(req): Json<PtyProcessInfoReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let session_opt = {
        let sessions = ctx.pty_sessions.lock();
        sessions.get(&req.session_id).cloned()
    };

    if let Some(session) = session_opt {
        let child_pid = session.child_pid;
        if let Some(pid) = child_pid {
            if let Some((fg_pid, comm, cmdline)) = inspect_foreground_process(pid) {
                let (is_agent, matched_agent) = match_agent_binary(&comm, &cmdline);
                return Ok(Json(serde_json::json!({
                    "session_id": req.session_id,
                    "pid": fg_pid,
                    "binary_name": comm,
                    "cmdline": cmdline,
                    "is_agent": is_agent,
                    "matched_agent": matched_agent,
                })));
            }
        }
        Ok(Json(serde_json::json!({
            "session_id": req.session_id,
            "pid": child_pid,
            "binary_name": "shell",
            "cmdline": null,
            "is_agent": false,
            "matched_agent": null,
        })))
    } else {
        Err((axum::http::StatusCode::NOT_FOUND, "PTY session not found".to_string()))
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

async fn pty_ws_handler(
    State(ctx): State<AppContext>,
    AxumPath(session_id): AxumPath<String>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_pty_ws(socket, session_id, ctx))
}

async fn handle_pty_ws(socket: WebSocket, session_id: String, ctx: AppContext) {
    let session_opt = {
        let sessions = ctx.pty_sessions.lock();
        sessions.get(&session_id).cloned()
    };

    if let Some(session) = session_opt {
        let reader_res = {
            let master = session.master.lock();
            master.try_clone_reader()
        };

        if let Ok(mut reader) = reader_res {
            let (mut ws_tx, mut ws_rx) = socket.split();
            let running = session.running.clone();

            // Background reader from PTY -> WebSocket
            let (data_tx, mut data_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);

            std::thread::Builder::new()
                .name(format!("pty-ws-reader-{}", session_id))
                .spawn(move || {
                    let mut buf = [0u8; 8192];
                    while running.load(Ordering::Relaxed) {
                        match reader.read(&mut buf) {
                            Ok(0) => break,
                            Ok(n) => {
                                if data_tx.blocking_send(buf[..n].to_vec()).is_err() {
                                    break;
                                }
                            }
                            Err(_) => break,
                        }
                    }
                })
                .ok();

            tokio::spawn(async move {
                while let Some(chunk) = data_rx.recv().await {
                    if ws_tx.send(Message::Binary(chunk)).await.is_err() {
                        break;
                    }
                }
            });

            // WebSocket incoming -> PTY writer
            while let Some(Ok(msg)) = ws_rx.next().await {
                match msg {
                    Message::Text(txt) => {
                        let mut w = session.writer.lock();
                        let _ = w.write_all(txt.as_bytes());
                        let _ = w.flush();
                    }
                    Message::Binary(bin) => {
                        let mut w = session.writer.lock();
                        let _ = w.write_all(&bin);
                        let _ = w.flush();
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        }
    }
}

async fn events_ws_handler(
    State(ctx): State<AppContext>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_events_ws(socket, ctx))
}

async fn handle_events_ws(mut socket: WebSocket, ctx: AppContext) {
    let tx_opt = ctx.watcher_tx.lock().clone();
    if let Some(tx) = tx_opt {
        let mut rx = tx.subscribe();
        while let Ok(msg) = rx.recv().await {
            if socket.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    }
}

#[path = "../../src-tauri/src/integrations/mod.rs"]
pub mod integrations;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventReq {
    #[serde(rename = "type")]
    pub event_type: String,
    pub agent: String,
    #[serde(alias = "session_id", skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(alias = "terminal_id", skip_serializing_if = "Option::is_none")]
    pub terminal_id: Option<String>,
    #[serde(alias = "workspace_id", skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<u64>,
}

async fn agent_events_handler(
    State(ctx): State<AppContext>,
    Json(event): Json<AgentEventReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    println!("[AgentDeck Server] Received agent event: {:?} (agent: {}, type: {})", event.session_id, event.agent, event.event_type);
    let watcher_tx = ctx.watcher_tx.lock();
    if let Some(ref tx) = *watcher_tx {
        let payload = serde_json::json!({
            "event": "agent-event",
            "data": event,
        });
        let _ = tx.send(payload.to_string());
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn component_picked_handler(
    State(ctx): State<AppContext>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    println!("[AgentDeck Server] Received component picked event: {:?}", payload);
    let watcher_tx = ctx.watcher_tx.lock();
    if let Some(ref tx) = *watcher_tx {
        let event_payload = serde_json::json!({
            "event": "agentdeck:component-picked",
            "data": payload,
        });
        let _ = tx.send(event_payload.to_string());
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn component_steer_handler(
    State(ctx): State<AppContext>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    println!("[AgentDeck Server] Received component steer event: {:?}", payload);
    let watcher_tx = ctx.watcher_tx.lock();
    if let Some(ref tx) = *watcher_tx {
        let event_payload = serde_json::json!({
            "event": "agentdeck:steer-component",
            "data": payload,
        });
        let _ = tx.send(event_payload.to_string());
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
struct DesktopNotifReq {
    title: String,
    body: String,
    urgency: Option<String>,
}

async fn desktop_notification_handler(
    Json(req): Json<DesktopNotifReq>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let mut cmd = std::process::Command::new("notify-send");
    cmd.arg(&req.title).arg(&req.body);
    cmd.arg("-a").arg("AgentDeck");
    let urg = req.urgency.as_deref().unwrap_or("normal");
    cmd.arg("-u").arg(urg);
    let icon_candidates = [
        "/home/thanhduy/Projects/agent_deck/src-tauri/icons/128x128.png",
        "agent-deck",
        "utilities-terminal",
    ];
    for candidate in icon_candidates {
        if std::path::Path::new(candidate).exists() || !candidate.contains('/') {
            cmd.arg("-i").arg(candidate);
            break;
        }
    }
    let _ = cmd.spawn();
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn get_integrations_handler() -> Json<Vec<integrations::AgentIntegrationInfo>> {
    Json(integrations::IntegrationManager::get_all_integrations())
}

#[derive(Debug, Deserialize)]
struct IntegrationActionReq {
    agent: String,
}

async fn install_integration_handler(
    Json(req): Json<IntegrationActionReq>,
) -> Result<Json<integrations::AgentIntegrationInfo>, (axum::http::StatusCode, String)> {
    if req.agent == "claude" {
        integrations::IntegrationManager::install_claude_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else if req.agent == "antigravity" {
        integrations::IntegrationManager::install_antigravity_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else if req.agent == "opencode" {
        integrations::IntegrationManager::install_opencode_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else {
        Err((axum::http::StatusCode::BAD_REQUEST, format!("Unsupported agent: {}", req.agent)))
    }
}

async fn uninstall_integration_handler(
    Json(req): Json<IntegrationActionReq>,
) -> Result<Json<integrations::AgentIntegrationInfo>, (axum::http::StatusCode, String)> {
    if req.agent == "claude" {
        integrations::IntegrationManager::uninstall_claude_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else if req.agent == "antigravity" {
        integrations::IntegrationManager::uninstall_antigravity_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else if req.agent == "opencode" {
        integrations::IntegrationManager::uninstall_opencode_integration()
            .map(Json)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e))
    } else {
        Err((axum::http::StatusCode::BAD_REQUEST, format!("Unsupported agent: {}", req.agent)))
    }
}

#[path = "../../src-tauri/src/preview.rs"]
pub mod preview;

async fn proxy_gateway_handler(
    req: axum::extract::Request,
) -> axum::response::Response {
    handle_proxy_request(req).await
}

async fn proxy_fallback_handler(
    req: axum::extract::Request,
) -> axum::response::Response {
    handle_proxy_request(req).await
}

async fn preview_handler(
    req: axum::extract::Request,
) -> axum::response::Response {
    handle_proxy_request(req).await
}

async fn handle_proxy_request(
    req: axum::extract::Request,
) -> axum::response::Response {
    let method = req.method().to_string();
    let uri_str = req.uri().to_string();
    let mut headers_vec = Vec::new();
    for (name, val) in req.headers() {
        if let Ok(val_str) = val.to_str() {
            headers_vec.push((name.as_str().to_string(), val_str.to_string()));
        }
    }

    let body_bytes = axum::body::to_bytes(req.into_body(), 10 * 1024 * 1024)
        .await
        .unwrap_or_default()
        .to_vec();

    let (target_port, forward_path) = preview::resolve_request_target_port(&format!("{} {}", method, uri_str), &headers_vec);

    match preview::forward_proxy_request(target_port, &method, &forward_path, &headers_vec, &body_bytes).await {
        Ok(res) => {
            let mut builder = axum::response::Response::builder()
                .status(axum::http::StatusCode::from_u16(res.status_code).unwrap_or(axum::http::StatusCode::OK))
                .header(axum::http::header::CONTENT_TYPE, res.content_type);

            for (k, v) in res.headers {
                if !k.eq_ignore_ascii_case("content-type") && !k.eq_ignore_ascii_case("content-length") {
                    if let (Ok(hk), Ok(hv)) = (axum::http::HeaderName::from_bytes(k.as_bytes()), axum::http::HeaderValue::from_str(&v)) {
                        builder = builder.header(hk, hv);
                    }
                }
            }

            builder.body(axum::body::Body::from(res.body)).unwrap_or_else(|_| {
                axum::response::Response::builder()
                    .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                    .body(axum::body::Body::empty())
                    .unwrap()
            })
        }
        Err(err) => {
            if method == "GET" && (forward_path == "/" || forward_path.ends_with(".html") || !forward_path.contains('.')) {
                let offline = preview::render_dev_server_offline_html(&format!("http://localhost:{}", target_port));
                axum::response::Response::builder()
                    .status(axum::http::StatusCode::OK)
                    .header(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")
                    .header(axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(axum::body::Body::from(offline))
                    .unwrap()
            } else {
                axum::response::Response::builder()
                    .status(axum::http::StatusCode::BAD_GATEWAY)
                    .header(axum::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")
                    .header(axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(axum::body::Body::from(format!("Proxy error: {}", err)))
                    .unwrap()
            }
        }
    }
}


