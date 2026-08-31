use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, Debouncer};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoChangedPayload {
    pub repo_path: String,
    pub changed_paths: Vec<String>,
}

pub struct WatcherManager {
    watchers: Arc<Mutex<HashMap<String, Debouncer<notify::RecommendedWatcher>>>>,
}

impl Default for WatcherManager {
    fn default() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl WatcherManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn watch(&self, app: AppHandle, repo_path: &str) -> Result<(), String> {
        let path = PathBuf::from(repo_path);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", repo_path));
        }

        let mut watchers = self.watchers.lock();
        if watchers.contains_key(repo_path) {
            return Ok(());
        }

        let (tx, rx) = channel();
        let mut debouncer = new_debouncer(Duration::from_millis(200), tx)
            .map_err(|e| format!("Failed to create file debouncer: {}", e))?;

        debouncer
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        let repo_path_string = repo_path.to_string();
        let app_clone = app.clone();

        std::thread::Builder::new()
            .name(format!("repo-file-watcher-{}", repo_path))
            .spawn(move || {
                while let Ok(res) = rx.recv() {
                    match res {
                        Ok(events) => {
                            let mut changed = Vec::new();
                            for event in events {
                                if !Self::is_ignored_path(&event.path) {
                                    changed.push(event.path.to_string_lossy().to_string());
                                }
                            }

                            if !changed.is_empty() {
                                let _ = app_clone.emit(
                                    "repo-changed",
                                    RepoChangedPayload {
                                        repo_path: repo_path_string.clone(),
                                        changed_paths: changed,
                                    },
                                );
                            }
                        }
                        Err(err) => {
                            log::debug!("Debouncer error: {:?}", err);
                        }
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn watcher thread: {}", e))?;

        watchers.insert(repo_path.to_string(), debouncer);
        Ok(())
    }

    pub fn unwatch(&self, repo_path: &str) {
        let mut watchers = self.watchers.lock();
        if let Some(mut debouncer) = watchers.remove(repo_path) {
            let _ = debouncer.watcher().unwatch(Path::new(repo_path));
        }
    }

    pub fn stop_all(&self) {
        let mut watchers = self.watchers.lock();
        for (path, mut debouncer) in watchers.drain() {
            let _ = debouncer.watcher().unwatch(Path::new(&path));
        }
    }

    fn is_ignored_path(path: &Path) -> bool {
        let s = path.to_string_lossy();
        s.contains("/.git/")
            || s.contains("\\.git\\")
            || s.ends_with("/.git")
            || s.ends_with("\\.git")
            || s.contains("/node_modules/")
            || s.contains("\\node_modules\\")
            || s.contains("/target/")
            || s.contains("\\target\\")
            || s.contains("/dist/")
            || s.contains("\\dist\\")
            || s.contains("/.svelte-kit/")
            || s.contains("\\.svelte-kit\\")
            || s.contains("/.cargo/")
            || s.contains("\\.cargo\\")
    }
}

