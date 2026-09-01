use git2::{
    ApplyLocation, ApplyOptions, Diff, DiffOptions, IndexAddOption,
    Repository, Signature, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub head_commit_sha: Option<String>,
    pub head_commit_short: Option<String>,
    pub head_commit_message: Option<String>,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    pub is_dirty: bool,
    #[serde(default)]
    pub ahead_count: usize,
    #[serde(default)]
    pub behind_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffToken {
    pub content: String,
    pub is_highlighted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_type: String, // "add" | "delete" | "context" | "header"
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub tokens: Option<Vec<DiffToken>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub hunk_index: usize,
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub is_staged: bool,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "modified" | "added" | "deleted" | "renamed" | "untracked"
    pub is_staged: bool,
    pub additions: usize,
    pub deletions: usize,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoDiffData {
    pub info: RepoInfo,
    pub files: Vec<FileDiff>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitResult {
    pub commit_sha: String,
    pub commit_short: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub commit_short: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub commit_short: String,
}

pub struct GitEngine;

impl GitEngine {
    pub fn get_repo_info(repo_path: &str) -> Result<RepoInfo, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repository at '{}': {}", repo_path, e))?;

        let actual_path = repo
            .workdir()
            .unwrap_or_else(|| repo.path())
            .to_string_lossy()
            .to_string();

        let name = Path::new(&actual_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Repository".to_string());

        let branch = match repo.head() {
            Ok(head) => {
                if head.is_branch() {
                    head.shorthand().unwrap_or("HEAD").to_string()
                } else {
                    format!("Detached (HEAD at {})", &head.target().map(|oid| oid.to_string()[..7.min(oid.to_string().len())].to_string()).unwrap_or_default())
                }
            }
            Err(_) => "main (empty)".to_string(),
        };

        let head_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let head_commit_sha = head_commit.as_ref().map(|c| c.id().to_string());
        let head_commit_short = head_commit.as_ref().map(|c| c.id().to_string()[..7.min(c.id().to_string().len())].to_string());
        let head_commit_message = head_commit.as_ref().and_then(|c| c.message().map(|m| m.trim().to_string()));

        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true);
        status_opts.recurse_untracked_dirs(true);

        let statuses = repo
            .statuses(Some(&mut status_opts))
            .map_err(|e| format!("Failed to read repo statuses: {}", e))?;

        let mut staged_count = 0;
        let mut unstaged_count = 0;
        let mut untracked_count = 0;

        for entry in statuses.iter() {
            let s = entry.status();
            if s.is_index_new() || s.is_index_modified() || s.is_index_deleted() || s.is_index_renamed() || s.is_index_typechange() {
                staged_count += 1;
            }
            if s.is_wt_modified() || s.is_wt_deleted() || s.is_wt_renamed() || s.is_wt_typechange() {
                unstaged_count += 1;
            }
            if s.is_wt_new() {
                untracked_count += 1;
            }
        }

        let is_dirty = staged_count > 0 || unstaged_count > 0 || untracked_count > 0;

        let mut ahead_count = 0;
        let mut behind_count = 0;

        if let Ok(head) = repo.head() {
            if head.is_branch() {
                if let Some(shorthand) = head.shorthand() {
                    if let Ok(local_branch) = repo.find_branch(shorthand, git2::BranchType::Local) {
                        if let Ok(upstream_branch) = local_branch.upstream() {
                            if let (Some(local_oid), Some(upstream_oid)) = (
                                local_branch.get().target(),
                                upstream_branch.get().target(),
                            ) {
                                if let Ok((ahead, behind)) = repo.graph_ahead_behind(local_oid, upstream_oid) {
                                    ahead_count = ahead;
                                    behind_count = behind;
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(RepoInfo {
            path: actual_path,
            name,
            branch,
            head_commit_sha,
            head_commit_short,
            head_commit_message,
            staged_count,
            unstaged_count,
            untracked_count,
            is_dirty,
            ahead_count,
            behind_count,
        })
    }

    pub fn get_diffs(repo_path: &str) -> Result<RepoDiffData, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repository at '{}': {}", repo_path, e))?;

        let info = Self::get_repo_info(repo_path)?;
        let mut files: Vec<FileDiff> = Vec::new();

        // 1. Parse Staged Changes (HEAD vs Index)
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        let mut diff_opts = DiffOptions::new();
        diff_opts.context_lines(3);
        diff_opts.include_untracked(false);

        let staged_diff = repo
            .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .ok();

        if let Some(diff) = staged_diff {
            Self::extract_diff_files(&repo, &diff, true, &mut files)?;
        }

        // 2. Parse Unstaged Changes (Index vs Working Directory)
        let mut wt_diff_opts = DiffOptions::new();
        wt_diff_opts.context_lines(3);
        wt_diff_opts.include_untracked(true);
        wt_diff_opts.recurse_untracked_dirs(true);
        wt_diff_opts.show_untracked_content(true);

        let unstaged_diff = repo
            .diff_index_to_workdir(None, Some(&mut wt_diff_opts))
            .ok();

        if let Some(diff) = unstaged_diff {
            Self::extract_diff_files(&repo, &diff, false, &mut files)?;
        }

        // 3. Fallback for Untracked files that may not have appeared in diff
        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true);
        status_opts.recurse_untracked_dirs(true);

        if let Ok(statuses) = repo.statuses(Some(&mut status_opts)) {
            for entry in statuses.iter() {
                if entry.status().is_wt_new() {
                    let path_str = entry.path().unwrap_or_default().to_string();
                    if !files.iter().any(|f| f.path == path_str && !f.is_staged) {
                        let (hunks, additions, deletions) = Self::generate_file_hunks_fallback(
                            &repo,
                            &path_str,
                            "untracked",
                            false,
                        );

                        if !hunks.is_empty() {
                            files.push(FileDiff {
                                path: path_str,
                                old_path: None,
                                status: "untracked".to_string(),
                                is_staged: false,
                                additions,
                                deletions,
                                hunks,
                            });
                        }
                    }
                }
            }
        }

        Ok(RepoDiffData { info, files })
    }

    fn extract_diff_files(
        repo: &Repository,
        diff: &Diff,
        is_staged: bool,
        files: &mut Vec<FileDiff>,
    ) -> Result<(), String> {
        for (delta_idx, delta) in diff.deltas().enumerate() {
            let old_file = delta.old_file();
            let new_file = delta.new_file();
            let new_path = new_file
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let old_path = old_file
                .path()
                .map(|p| p.to_string_lossy().to_string());

            let status_str = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                git2::Delta::Untracked => "untracked",
                _ => "modified",
            }
            .to_string();

            let patch = git2::Patch::from_diff(diff, delta_idx).ok().flatten();
            let mut hunks = Vec::new();
            let mut additions = 0;
            let mut deletions = 0;

            if let Some(patch) = patch {
                let num_hunks = patch.num_hunks();
                for h_idx in 0..num_hunks {
                    if let Ok((hunk, _)) = patch.hunk(h_idx) {
                        let header = String::from_utf8_lossy(hunk.header()).trim().to_string();
                        let mut lines = Vec::new();
                        let num_lines = patch.num_lines_in_hunk(h_idx).unwrap_or(0);

                        for l_idx in 0..num_lines {
                            if let Ok(line) = patch.line_in_hunk(h_idx, l_idx) {
                                let origin = line.origin();
                                let line_type = match origin {
                                    '+' => {
                                        additions += 1;
                                        "add"
                                    }
                                    '-' => {
                                        deletions += 1;
                                        "delete"
                                    }
                                    ' ' => "context",
                                    'H' => "header",
                                    _ => "context",
                                }
                                .to_string();

                                let content = String::from_utf8_lossy(line.content())
                                    .trim_end_matches(&['\r', '\n'][..])
                                    .to_string();

                                lines.push(DiffLine {
                                    line_type,
                                    content,
                                    old_lineno: line.old_lineno(),
                                    new_lineno: line.new_lineno(),
                                    tokens: None,
                                });
                            }
                        }

                        Self::compute_intra_line_diffs(&mut lines);

                        hunks.push(DiffHunk {
                            hunk_index: h_idx,
                            header,
                            old_start: hunk.old_start(),
                            old_lines: hunk.old_lines(),
                            new_start: hunk.new_start(),
                            new_lines: hunk.new_lines(),
                            is_staged,
                            lines,
                        });
                    }
                }
            }

            // If hunks are empty (e.g. untracked or binary/unbuffered delta), synthesize hunks
            if hunks.is_empty() {
                let (fallback_hunks, fb_add, fb_del) = Self::generate_file_hunks_fallback(
                    repo,
                    &new_path,
                    &status_str,
                    is_staged,
                );
                hunks = fallback_hunks;
                additions = fb_add;
                deletions = fb_del;
            }

            files.push(FileDiff {
                path: new_path,
                old_path,
                status: status_str,
                is_staged,
                additions,
                deletions,
                hunks,
            });
        }

        Ok(())
    }

    fn generate_file_hunks_fallback(
        repo: &Repository,
        relative_path: &str,
        status: &str,
        is_staged: bool,
    ) -> (Vec<DiffHunk>, usize, usize) {
        let workdir = repo.workdir().unwrap_or_else(|| repo.path());
        let full_path = workdir.join(relative_path);

        if status == "deleted" {
            if let Some(old_content) = Self::get_blob_content(repo, relative_path) {
                let lines_vec: Vec<DiffLine> = old_content
                    .lines()
                    .enumerate()
                    .map(|(idx, line)| DiffLine {
                        line_type: "delete".to_string(),
                        content: line.to_string(),
                        old_lineno: Some((idx + 1) as u32),
                        new_lineno: None,
                        tokens: None,
                    })
                    .collect();
                let count = lines_vec.len() as u32;
                let hunk = DiffHunk {
                    hunk_index: 0,
                    header: format!("@@ -1,{} +0,0 @@", count),
                    old_start: 1,
                    old_lines: count,
                    new_start: 0,
                    new_lines: 0,
                    is_staged,
                    lines: lines_vec,
                };
                return (vec![hunk], 0, count as usize);
            }
        }

        if full_path.is_file() {
            if let Ok(new_content) = std::fs::read_to_string(&full_path) {
                let old_content_opt = Self::get_blob_content(repo, relative_path);

                if let Some(old_content) = old_content_opt {
                    let old_bytes = old_content.as_bytes();
                    let new_bytes = new_content.as_bytes();

                    if let Ok(patch) = git2::Patch::from_buffers(
                        old_bytes,
                        Some(Path::new(relative_path)),
                        new_bytes,
                        Some(Path::new(relative_path)),
                        None,
                    ) {
                        let mut hunks = Vec::new();
                        let mut additions = 0;
                        let mut deletions = 0;

                        for h_idx in 0..patch.num_hunks() {
                            if let Ok((hunk, _)) = patch.hunk(h_idx) {
                                let header = String::from_utf8_lossy(hunk.header()).trim().to_string();
                                let mut lines = Vec::new();
                                let num_lines = patch.num_lines_in_hunk(h_idx).unwrap_or(0);

                                for l_idx in 0..num_lines {
                                    if let Ok(line) = patch.line_in_hunk(h_idx, l_idx) {
                                        let origin = line.origin();
                                        let line_type = match origin {
                                            '+' => {
                                                additions += 1;
                                                "add"
                                            }
                                            '-' => {
                                                deletions += 1;
                                                "delete"
                                            }
                                            ' ' => "context",
                                            _ => "context",
                                        }
                                        .to_string();

                                        let content = String::from_utf8_lossy(line.content())
                                            .trim_end_matches(&['\r', '\n'][..])
                                            .to_string();

                                        lines.push(DiffLine {
                                            line_type,
                                            content,
                                            old_lineno: line.old_lineno(),
                                            new_lineno: line.new_lineno(),
                                            tokens: None,
                                        });
                                    }
                                }

                                Self::compute_intra_line_diffs(&mut lines);

                                hunks.push(DiffHunk {
                                    hunk_index: h_idx,
                                    header,
                                    old_start: hunk.old_start(),
                                    old_lines: hunk.old_lines(),
                                    new_start: hunk.new_start(),
                                    new_lines: hunk.new_lines(),
                                    is_staged,
                                    lines,
                                });
                            }
                        }

                        if !hunks.is_empty() {
                            return (hunks, additions, deletions);
                        }
                    }
                }

                // Untracked / New file: all lines as additions
                let lines_vec: Vec<DiffLine> = new_content
                    .lines()
                    .enumerate()
                    .map(|(idx, line)| DiffLine {
                        line_type: "add".to_string(),
                        content: line.to_string(),
                        old_lineno: None,
                        new_lineno: Some((idx + 1) as u32),
                        tokens: None,
                    })
                    .collect();

                let count = lines_vec.len() as u32;
                let hunk = DiffHunk {
                    hunk_index: 0,
                    header: format!("@@ -0,0 +1,{} @@", count),
                    old_start: 0,
                    old_lines: 0,
                    new_start: 1,
                    new_lines: count,
                    is_staged,
                    lines: lines_vec,
                };
                return (vec![hunk], count as usize, 0);
            }
        }

        (Vec::new(), 0, 0)
    }

    fn get_blob_content(repo: &Repository, relative_path: &str) -> Option<String> {
        // 1. Try reading from Index
        if let Ok(index) = repo.index() {
            if let Some(entry) = index.get_path(Path::new(relative_path), 0) {
                if let Ok(blob) = repo.find_blob(entry.id) {
                    if let Ok(content) = std::str::from_utf8(blob.content()) {
                        return Some(content.to_string());
                    }
                }
            }
        }

        // 2. Try reading from HEAD commit tree
        if let Ok(head) = repo.head() {
            if let Ok(commit) = head.peel_to_commit() {
                if let Ok(tree) = commit.tree() {
                    if let Ok(entry) = tree.get_path(Path::new(relative_path)) {
                        if let Ok(blob) = repo.find_blob(entry.id()) {
                            if let Ok(content) = std::str::from_utf8(blob.content()) {
                                return Some(content.to_string());
                            }
                        }
                    }
                }
            }
        }

        None
    }

    pub fn stage_files(repo_path: &str, relative_paths: &[String]) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get repo index: {}", e))?;

        let workdir = repo.workdir().unwrap_or_else(|| repo.path());

        for relative_path in relative_paths {
            let full_path = workdir.join(relative_path);
            if full_path.exists() {
                index
                    .add_path(Path::new(relative_path))
                    .map_err(|e| format!("Failed to add path '{}' to index: {}", relative_path, e))?;
            } else {
                index
                    .remove_path(Path::new(relative_path))
                    .map_err(|e| format!("Failed to remove path '{}' from index: {}", relative_path, e))?;
            }
        }

        index
            .write()
            .map_err(|e| format!("Failed to write git index: {}", e))?;
        Ok(())
    }

    pub fn unstage_files(repo_path: &str, relative_paths: &[String]) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

        if let Some(commit) = head {
            let path_refs: Vec<&Path> = relative_paths.iter().map(|p| Path::new(p.as_str())).collect();
            repo.reset_default(Some(&commit.into_object()), &path_refs)
                .map_err(|e| format!("Failed to unstage paths from head: {}", e))?;
        } else {
            // Initial commit scenario - remove from index
            let mut index = repo
                .index()
                .map_err(|e| format!("Failed to get index: {}", e))?;
            for relative_path in relative_paths {
                let _ = index.remove_path(Path::new(relative_path));
            }
            index
                .write()
                .map_err(|e| format!("Failed to write index: {}", e))?;
        }

        Ok(())
    }

    pub fn stage_file(repo_path: &str, relative_path: &str) -> Result<(), String> {
        Self::stage_files(repo_path, &[relative_path.to_string()])
    }

    pub fn unstage_file(repo_path: &str, relative_path: &str) -> Result<(), String> {
        Self::unstage_files(repo_path, &[relative_path.to_string()])
    }

    pub fn stage_all(repo_path: &str) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get repo index: {}", e))?;

        index
            .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
            .map_err(|e| format!("Failed to stage all files: {}", e))?;

        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;
        Ok(())
    }

    pub fn unstage_all(repo_path: &str) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        if let Ok(head) = repo.head() {
            if let Ok(commit) = head.peel_to_commit() {
                repo.reset_default(Some(&commit.into_object()), &["*"])
                    .map_err(|e| format!("Failed to unstage all: {}", e))?;
                return Ok(());
            }
        }

        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;
        index
            .clear()
            .map_err(|e| format!("Failed to clear index: {}", e))?;
        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;
        Ok(())
    }

    pub fn discard_file(repo_path: &str, relative_path: &str) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let workdir = repo.workdir().unwrap_or_else(|| repo.path());
        let full_path = workdir.join(relative_path);

        // Check if untracked
        let mut status_opts = StatusOptions::new();
        status_opts.pathspec(relative_path);
        let statuses = repo.statuses(Some(&mut status_opts)).ok();

        let is_untracked = statuses
            .as_ref()
            .and_then(|s| s.get(0))
            .map(|e| e.status().is_wt_new())
            .unwrap_or(false);

        if is_untracked {
            if full_path.is_file() {
                std::fs::remove_file(&full_path)
                    .map_err(|e| format!("Failed to delete untracked file: {}", e))?;
            } else if full_path.is_dir() {
                std::fs::remove_dir_all(&full_path)
                    .map_err(|e| format!("Failed to delete untracked directory: {}", e))?;
            }
            return Ok(());
        }

        // Checkout file from index/HEAD
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.path(relative_path);
        checkout_opts.force();

        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Failed to checkout head for file: {}", e))?;

        Ok(())
    }

    fn apply_patch_cmd(
        workdir: &std::path::Path,
        patch_data: &[u8],
        cached: bool,
        reverse: bool,
    ) -> Result<(), String> {
        let mut cmd = std::process::Command::new("git");
        cmd.arg("-C").arg(workdir).arg("apply");
        
        if cached {
            cmd.arg("--cached");
        }
        if reverse {
            cmd.arg("--reverse");
        }
        cmd.arg("--recount")
           .arg("--unidiff-zero")
           .arg("--whitespace=nowarn")
           .arg("-");
        
        cmd.stdin(std::process::Stdio::piped())
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn git apply: {}", e))?;
        
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin.write_all(patch_data).map_err(|e| format!("Failed to write patch to git apply: {}", e))?;
            stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }

        let output = child.wait_with_output().map_err(|e| format!("Failed to wait on git apply: {}", e))?;
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("git apply failed: {}", stderr.trim()))
        }
    }

    fn apply_patch_libgit2(
        repo: &Repository,
        patch_data: &[u8],
        location: ApplyLocation,
    ) -> Result<(), String> {
        let hunk_diff = git2::Diff::from_buffer(patch_data)
            .map_err(|e| format!("Failed to parse hunk diff: {}", e))?;

        let mut apply_opts = ApplyOptions::new();
        repo.apply(&hunk_diff, location, Some(&mut apply_opts))
            .map_err(|e| format!("Failed to apply hunk: {}", e))?;

        if matches!(location, ApplyLocation::Index) {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn build_hunk_patch(
        patch: &git2::Patch,
        relative_path: &str,
        hunk_index: usize,
    ) -> Result<Vec<u8>, String> {
        let delta = patch.delta();
        let old_path_str = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| relative_path.to_string());
        let new_path_str = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| relative_path.to_string());

        let mut patch_buf = Vec::new();
        patch_buf.extend_from_slice(format!("diff --git a/{} b/{}\n", old_path_str, new_path_str).as_bytes());

        match delta.status() {
            git2::Delta::Added | git2::Delta::Untracked => {
                let mode_str = if delta.new_file().mode() == git2::FileMode::BlobExecutable {
                    "100755"
                } else {
                    "100644"
                };
                patch_buf.extend_from_slice(format!("new file mode {}\n", mode_str).as_bytes());
                patch_buf.extend_from_slice(format!("--- /dev/null\n+++ b/{}\n", new_path_str).as_bytes());
            }
            git2::Delta::Deleted => {
                let mode_str = if delta.old_file().mode() == git2::FileMode::BlobExecutable {
                    "100755"
                } else {
                    "100644"
                };
                patch_buf.extend_from_slice(format!("deleted file mode {}\n", mode_str).as_bytes());
                patch_buf.extend_from_slice(format!("--- a/{}\n+++ /dev/null\n", old_path_str).as_bytes());
            }
            _ => {
                patch_buf.extend_from_slice(format!("--- a/{}\n+++ b/{}\n", old_path_str, new_path_str).as_bytes());
            }
        }

        let (hunk, _) = patch.hunk(hunk_index)
            .map_err(|e| format!("Failed to get hunk {}: {}", hunk_index, e))?;

        let old_lines_part = if hunk.old_lines() == 1 {
            format!("{}", hunk.old_start())
        } else {
            format!("{},{}", hunk.old_start(), hunk.old_lines())
        };
        let new_lines_part = if hunk.new_lines() == 1 {
            format!("{}", hunk.new_start())
        } else {
            format!("{},{}", hunk.new_start(), hunk.new_lines())
        };
        let hunk_header = format!("@@ -{} +{} @@\n", old_lines_part, new_lines_part);
        patch_buf.extend_from_slice(hunk_header.as_bytes());

        let num_lines = patch.num_lines_in_hunk(hunk_index).unwrap_or(0);
        for l in 0..num_lines {
            if let Ok(line) = patch.line_in_hunk(hunk_index, l) {
                let origin = line.origin();
                if origin == '+' || origin == '-' || origin == ' ' {
                    patch_buf.push(origin as u8);
                    let content = line.content();
                    patch_buf.extend_from_slice(content);
                    if !content.ends_with(b"\n") {
                        patch_buf.push(b'\n');
                    }
                }
            }
        }

        Ok(patch_buf)
    }

    fn find_matching_patch<'a>(
        diff: &'a git2::Diff,
        relative_path: &str,
    ) -> Option<(usize, git2::Patch<'a>)> {
        let norm_target = relative_path.replace('\\', "/");
        let norm_target = norm_target.trim_start_matches("./").trim_start_matches('/');

        for (idx, delta) in diff.deltas().enumerate() {
            let p1 = delta.new_file().path().map(|p| p.to_string_lossy().replace('\\', "/"));
            let p2 = delta.old_file().path().map(|p| p.to_string_lossy().replace('\\', "/"));
            if p1.as_deref() == Some(norm_target) || p2.as_deref() == Some(norm_target) {
                if let Ok(Some(patch)) = git2::Patch::from_diff(diff, idx) {
                    return Some((idx, patch));
                }
            }
        }

        if let Ok(Some(patch)) = git2::Patch::from_diff(diff, 0) {
            return Some((0, patch));
        }

        None
    }

    pub fn stage_hunk(repo_path: &str, relative_path: &str, hunk_index: usize) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let workdir = repo.workdir().unwrap_or_else(|| repo.path()).to_path_buf();

        // Check if untracked file
        let mut status_opts = StatusOptions::new();
        status_opts.pathspec(relative_path);
        if let Ok(statuses) = repo.statuses(Some(&mut status_opts)) {
            if statuses.iter().any(|s| s.status().is_wt_new()) {
                return Self::stage_file(repo_path, relative_path);
            }
        }

        let mut diff_opts = DiffOptions::new();
        diff_opts.pathspec(relative_path);
        diff_opts.context_lines(3);
        diff_opts.include_untracked(true);
        diff_opts.show_untracked_content(true);

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to compute diff: {}", e))?;

        let patch_match = Self::find_matching_patch(&diff, relative_path);
        if patch_match.is_none() {
            return Self::stage_file(repo_path, relative_path);
        }

        let (_delta_idx, patch) = patch_match.unwrap();
        let hunk_count = patch.num_hunks();
        if hunk_count <= 1 || hunk_index >= hunk_count {
            return Self::stage_file(repo_path, relative_path);
        }

        let patch_buf = Self::build_hunk_patch(&patch, relative_path, hunk_index)?;

        if let Err(cmd_err) = Self::apply_patch_cmd(&workdir, &patch_buf, true, false) {
            if Self::apply_patch_libgit2(&repo, &patch_buf, ApplyLocation::Index).is_err() {
                // If single hunk apply fails, fallback to staging the whole file
                Self::stage_file(repo_path, relative_path)
                    .map_err(|e| format!("{}. Fallback stage failed: {}", cmd_err, e))?;
            }
        }

        Ok(())
    }

    pub fn unstage_hunk(repo_path: &str, relative_path: &str, hunk_index: usize) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let workdir = repo.workdir().unwrap_or_else(|| repo.path()).to_path_buf();

        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        let mut diff_opts = DiffOptions::new();
        diff_opts.pathspec(relative_path);
        diff_opts.context_lines(3);

        let diff = repo
            .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to compute staged diff: {}", e))?;

        let patch_match = Self::find_matching_patch(&diff, relative_path);
        if patch_match.is_none() {
            return Self::unstage_file(repo_path, relative_path);
        }

        let (_delta_idx, patch) = patch_match.unwrap();
        let hunk_count = patch.num_hunks();
        if hunk_count <= 1 || hunk_index >= hunk_count {
            return Self::unstage_file(repo_path, relative_path);
        }

        let patch_buf = Self::build_hunk_patch(&patch, relative_path, hunk_index)?;

        if let Err(cmd_err) = Self::apply_patch_cmd(&workdir, &patch_buf, true, true) {
            let (hunk, _) = patch.hunk(hunk_index)
                .map_err(|e| format!("Failed to get hunk: {}", e))?;

            let mut rev_buf = Vec::new();
            let rev_git_header = format!("diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n", path = relative_path);
            rev_buf.extend_from_slice(rev_git_header.as_bytes());
            let rev_header = format!("@@ -{},{} +{},{} @@\n", hunk.new_start(), hunk.new_lines(), hunk.old_start(), hunk.old_lines());
            rev_buf.extend_from_slice(rev_header.as_bytes());

            let num_lines = patch.num_lines_in_hunk(hunk_index).unwrap_or(0);
            for l in 0..num_lines {
                if let Ok(line) = patch.line_in_hunk(hunk_index, l) {
                    let origin = line.origin();
                    if origin == '+' {
                        rev_buf.push(b'-');
                        rev_buf.extend_from_slice(line.content());
                    } else if origin == '-' {
                        rev_buf.push(b'+');
                        rev_buf.extend_from_slice(line.content());
                    } else if origin == ' ' {
                        rev_buf.push(b' ');
                        rev_buf.extend_from_slice(line.content());
                    }
                }
            }

            if Self::apply_patch_libgit2(&repo, &rev_buf, ApplyLocation::Index).is_err() {
                Self::unstage_file(repo_path, relative_path)
                    .map_err(|e| format!("{}. Fallback unstage failed: {}", cmd_err, e))?;
            }
        }

        Ok(())
    }

    pub fn discard_hunk(repo_path: &str, relative_path: &str, hunk_index: usize) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let workdir = repo.workdir().unwrap_or_else(|| repo.path()).to_path_buf();

        let mut diff_opts = DiffOptions::new();
        diff_opts.pathspec(relative_path);
        diff_opts.context_lines(3);
        diff_opts.include_untracked(true);
        diff_opts.show_untracked_content(true);

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to compute diff: {}", e))?;

        let patch_match = Self::find_matching_patch(&diff, relative_path);
        if patch_match.is_none() {
            return Self::discard_file(repo_path, relative_path);
        }

        let (_delta_idx, patch) = patch_match.unwrap();
        let hunk_count = patch.num_hunks();
        if hunk_count <= 1 || hunk_index >= hunk_count {
            return Self::discard_file(repo_path, relative_path);
        }

        let patch_buf = Self::build_hunk_patch(&patch, relative_path, hunk_index)?;

        if let Err(cmd_err) = Self::apply_patch_cmd(&workdir, &patch_buf, false, true) {
            let (hunk, _) = patch.hunk(hunk_index)
                .map_err(|e| format!("Failed to get hunk: {}", e))?;

            let mut rev_buf = Vec::new();
            let rev_git_header = format!("diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n", path = relative_path);
            rev_buf.extend_from_slice(rev_git_header.as_bytes());
            let rev_header = format!("@@ -{},{} +{},{} @@\n", hunk.new_start(), hunk.new_lines(), hunk.old_start(), hunk.old_lines());
            rev_buf.extend_from_slice(rev_header.as_bytes());

            let num_lines = patch.num_lines_in_hunk(hunk_index).unwrap_or(0);
            for l in 0..num_lines {
                if let Ok(line) = patch.line_in_hunk(hunk_index, l) {
                    let origin = line.origin();
                    if origin == '+' {
                        rev_buf.push(b'-');
                        rev_buf.extend_from_slice(line.content());
                    } else if origin == '-' {
                        rev_buf.push(b'+');
                        rev_buf.extend_from_slice(line.content());
                    } else if origin == ' ' {
                        rev_buf.push(b' ');
                        rev_buf.extend_from_slice(line.content());
                    }
                }
            }

            if Self::apply_patch_libgit2(&repo, &rev_buf, ApplyLocation::WorkDir).is_err() {
                Self::discard_file(repo_path, relative_path)
                    .map_err(|e| format!("{}. Fallback discard failed: {}", cmd_err, e))?;
            }
        }

        Ok(())
    }

    pub fn commit_staged(repo_path: &str, message: &str) -> Result<CommitResult, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get repo index: {}", e))?;

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("Failed to write tree from index: {}", e))?;
        index
            .write()
            .map_err(|e| format!("Failed to flush index: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("Failed to find tree: {}", e))?;

        let sig = repo.signature().unwrap_or_else(|_| {
            Signature::now("AgentDeck User", "user@agentdeck.local").expect("Valid default signature")
        });

        let mut parents = Vec::new();
        if let Ok(head) = repo.head() {
            if let Ok(head_commit) = head.peel_to_commit() {
                parents.push(head_commit);
            }
        }

        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        let commit_oid = repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                message.trim(),
                &tree,
                &parent_refs,
            )
            .map_err(|e| format!("Failed to create commit: {}", e))?;

        let commit_sha = commit_oid.to_string();
        let commit_short = commit_sha[..7.min(commit_sha.len())].to_string();

        Ok(CommitResult {
            commit_sha,
            commit_short,
            message: message.trim().to_string(),
        })
    }

    pub fn commit_amend(repo_path: &str, message: &str) -> Result<CommitResult, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get repo index: {}", e))?;

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("Failed to write tree: {}", e))?;
        index.write().map_err(|e| format!("Failed to flush index: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("Failed to find tree: {}", e))?;

        let sig = repo.signature().unwrap_or_else(|_| {
            Signature::now("AgentDeck User", "user@agentdeck.local").expect("Valid default signature")
        });

        let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

        let new_commit_oid = head_commit
            .amend(
                Some("HEAD"),
                Some(&sig),
                Some(&sig),
                None,
                Some(message.trim()),
                Some(&tree),
            )
            .map_err(|e| format!("Failed to amend commit: {}", e))?;

        let commit_sha = new_commit_oid.to_string();
        let commit_short = commit_sha[..7.min(commit_sha.len())].to_string();

        Ok(CommitResult {
            commit_sha,
            commit_short,
            message: message.trim().to_string(),
        })
    }

    pub fn list_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let mut branches_res = Vec::new();
        let branches = repo
            .branches(None)
            .map_err(|e| format!("Failed to list branches: {}", e))?;

        let head_branch_name = repo.head().ok().and_then(|h| {
            if h.is_branch() {
                h.shorthand().map(|s| s.to_string())
            } else {
                None
            }
        });

        for branch_res in branches {
            if let Ok((branch, branch_type)) = branch_res {
                let name = branch
                    .name()
                    .ok()
                    .flatten()
                    .unwrap_or_default()
                    .to_string();

                if name.is_empty() {
                    continue;
                }

                let is_current = if let Some(ref current) = head_branch_name {
                    &name == current
                } else {
                    branch.is_head()
                };

                let is_remote = branch_type == git2::BranchType::Remote;
                let commit_short = branch
                    .get()
                    .peel_to_commit()
                    .ok()
                    .map(|c| c.id().to_string()[..7.min(c.id().to_string().len())].to_string());

                branches_res.push(BranchInfo {
                    name,
                    is_current,
                    is_remote,
                    commit_short,
                });
            }
        }

        branches_res.sort_by(|a, b| {
            if a.is_current {
                std::cmp::Ordering::Less
            } else if b.is_current {
                std::cmp::Ordering::Greater
            } else {
                a.name.cmp(&b.name)
            }
        });

        Ok(branches_res)
    }

    pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        // Disallow checking out remote branches directly
        if branch_name.starts_with("remotes/")
            || branch_name.starts_with("refs/remotes/")
            || repo.find_branch(branch_name, git2::BranchType::Remote).is_ok()
        {
            if repo.find_branch(branch_name, git2::BranchType::Local).is_err() {
                return Err(format!(
                    "Cannot checkout remote branch '{}'. Checking out remote branches directly is not allowed. Please create a local tracking branch.",
                    branch_name
                ));
            }
        }

        // Verify local branch exists
        let local_branch = repo
            .find_branch(branch_name, git2::BranchType::Local)
            .map_err(|_| format!("Local branch not found: '{}'", branch_name))?;

        let branch_ref = local_branch
            .get()
            .name()
            .ok_or_else(|| format!("Invalid reference for branch '{}'", branch_name))?
            .to_string();

        let obj = repo
            .revparse_single(&branch_ref)
            .map_err(|e| format!("Branch ref not found '{}': {}", branch_ref, e))?;

        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.safe();

        repo.checkout_tree(&obj, Some(&mut checkout_opts))
            .map_err(|e| format!("Failed to checkout tree for branch '{}': {}", branch_name, e))?;

        repo.set_head(&branch_ref)
            .map_err(|e| format!("Failed to set HEAD to '{}': {}", branch_name, e))?;

        Ok(())
    }

    pub fn create_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let target_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to peel HEAD to commit: {}", e))?;

        let _ = repo
            .branch(branch_name, &target_commit, false)
            .map_err(|e| format!("Failed to create branch '{}': {}", branch_name, e))?;

        Self::checkout_branch(repo_path, branch_name)
    }

    pub fn stash_save(repo_path: &str, message: Option<&str>) -> Result<(), String> {
        let mut repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let sig = repo.signature().unwrap_or_else(|_| {
            Signature::now("AgentDeck User", "user@agentdeck.local").expect("Valid signature")
        });

        let msg = message.unwrap_or("AgentDeck Stash");
        repo.stash_save(&sig, msg, Some(git2::StashFlags::DEFAULT))
            .map_err(|e| format!("Failed to stash changes: {}", e))?;

        Ok(())
    }

    pub fn stash_pop(repo_path: &str) -> Result<(), String> {
        let mut repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let mut apply_opts = git2::StashApplyOptions::new();
        repo.stash_pop(0, Some(&mut apply_opts))
            .map_err(|e| format!("Failed to pop stash: {}", e))?;

        Ok(())
    }

    pub fn list_stashes(repo_path: &str) -> Result<Vec<StashInfo>, String> {
        let mut repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;

        let mut stashes = Vec::new();
        repo.stash_foreach(|idx, name, oid| {
            stashes.push(StashInfo {
                index: idx,
                message: name.to_string(),
                commit_short: oid.to_string()[..7.min(oid.to_string().len())].to_string(),
            });
            true
        })
        .map_err(|e| format!("Failed to list stashes: {}", e))?;

        Ok(stashes)
    }

    pub fn pull(repo_path: &str, remote: Option<&str>, branch: Option<&str>) -> Result<String, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;
        let workdir = repo.workdir().unwrap_or_else(|| repo.path()).to_path_buf();

        let mut cmd = std::process::Command::new("git");
        cmd.arg("-C").arg(&workdir).arg("pull");

        if let Some(r) = remote {
            if !r.trim().is_empty() {
                cmd.arg(r.trim());
            }
        }
        if let Some(b) = branch {
            if !b.trim().is_empty() {
                cmd.arg(b.trim());
            }
        }

        let output = cmd.output().map_err(|e| format!("Failed to execute git pull: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if output.status.success() {
            let msg = if !stdout.is_empty() {
                stdout
            } else if !stderr.is_empty() {
                stderr
            } else {
                "Pull successful (already up to date)".to_string()
            };
            Ok(msg)
        } else {
            let err_msg = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                format!("git pull failed with status code {:?}", output.status.code())
            };
            Err(err_msg)
        }
    }

    pub fn push(
        repo_path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
        set_upstream: bool,
    ) -> Result<String, String> {
        let repo = Repository::discover(repo_path)
            .map_err(|e| format!("Failed to discover git repo: {}", e))?;
        let workdir = repo.workdir().unwrap_or_else(|| repo.path()).to_path_buf();

        let mut cmd = std::process::Command::new("git");
        cmd.arg("-C").arg(&workdir).arg("push");

        if set_upstream {
            cmd.arg("-u");
        }

        if let Some(r) = remote {
            if !r.trim().is_empty() {
                cmd.arg(r.trim());
            }
        }
        if let Some(b) = branch {
            if !b.trim().is_empty() {
                cmd.arg(b.trim());
            }
        }

        let output = cmd.output().map_err(|e| format!("Failed to execute git push: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if output.status.success() {
            let msg = if !stderr.is_empty() && stdout.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                "Push successful (everything up-to-date)".to_string()
            };
            Ok(msg)
        } else {
            // Auto retry with -u origin <current_branch> if no upstream configured
            if stderr.contains("no upstream branch") || stderr.contains("--set-upstream") {
                if let Ok(head) = repo.head() {
                    if let Some(shorthand) = head.shorthand() {
                        let remote_name = remote.unwrap_or("origin");
                        let mut retry_cmd = std::process::Command::new("git");
                        retry_cmd
                            .arg("-C")
                            .arg(&workdir)
                            .arg("push")
                            .arg("-u")
                            .arg(remote_name)
                            .arg(shorthand);

                        if let Ok(retry_output) = retry_cmd.output() {
                            if retry_output.status.success() {
                                let retry_stdout = String::from_utf8_lossy(&retry_output.stdout).trim().to_string();
                                let retry_stderr = String::from_utf8_lossy(&retry_output.stderr).trim().to_string();
                                let msg = if !retry_stderr.is_empty() {
                                    retry_stderr
                                } else if !retry_stdout.is_empty() {
                                    retry_stdout
                                } else {
                                    format!("Pushed and set upstream to {}/{}", remote_name, shorthand)
                                };
                                return Ok(msg);
                            }
                        }
                    }
                }
            }

            let err_msg = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                format!("git push failed with status code {:?}", output.status.code())
            };
            Err(err_msg)
        }
    }

    fn compute_intra_line_diffs(lines: &mut [DiffLine]) {
        let mut i = 0;
        while i < lines.len() {
            if lines[i].line_type == "delete" {
                let del_start = i;
                while i < lines.len() && lines[i].line_type == "delete" {
                    i += 1;
                }
                let del_end = i;

                let add_start = i;
                while i < lines.len() && lines[i].line_type == "add" {
                    i += 1;
                }
                let add_end = i;

                let del_count = del_end - del_start;
                let add_count = add_end - add_start;

                if del_count > 0 && add_count > 0 {
                    let min_count = del_count.min(add_count);
                    for pair_idx in 0..min_count {
                        let del_idx = del_start + pair_idx;
                        let add_idx = add_start + pair_idx;

                        let del_text = &lines[del_idx].content;
                        let add_text = &lines[add_idx].content;

                        let diff = similar::TextDiff::from_words(del_text, add_text);
                        let mut del_tokens = Vec::new();
                        let mut add_tokens = Vec::new();

                        for change in diff.iter_all_changes() {
                            let tag = change.tag();
                            let val = change.value();
                            match tag {
                                similar::ChangeTag::Delete => {
                                    del_tokens.push(DiffToken {
                                        content: val.to_string(),
                                        is_highlighted: true,
                                    });
                                }
                                similar::ChangeTag::Insert => {
                                    add_tokens.push(DiffToken {
                                        content: val.to_string(),
                                        is_highlighted: true,
                                    });
                                }
                                similar::ChangeTag::Equal => {
                                    del_tokens.push(DiffToken {
                                        content: val.to_string(),
                                        is_highlighted: false,
                                    });
                                    add_tokens.push(DiffToken {
                                        content: val.to_string(),
                                        is_highlighted: false,
                                    });
                                }
                            }
                        }

                        lines[del_idx].tokens = Some(del_tokens);
                        lines[add_idx].tokens = Some(add_tokens);
                    }
                }
            } else {
                i += 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn create_test_repo() -> (tempfile::TempDir, PathBuf) {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        
        let _repo = Repository::init(&path).unwrap();
        let file_path = path.join("hello.txt");
        fs::write(&file_path, "line 1\nline 2\nline 3\nline 4\nline 5\n").unwrap();
        
        GitEngine::stage_file(path.to_str().unwrap(), "hello.txt").unwrap();
        GitEngine::commit_staged(path.to_str().unwrap(), "Initial commit").unwrap();
        
        (temp_dir, path)
    }

    #[test]
    fn test_stage_and_unstage_hunk() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");

        // Modify file
        fs::write(&file_path, "line 1\nline 2 MODIFIED\nline 3\nline 4\nline 5\n").unwrap();

        // Check diffs
        let diffs = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs.files.len(), 1);
        assert_eq!(diffs.files[0].is_staged, false);
        assert_eq!(diffs.files[0].hunks.len(), 1);

        // Stage hunk 0
        GitEngine::stage_hunk(path_str, "hello.txt", 0).unwrap();

        // Check diffs - should now be staged
        let diffs_after_stage = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_after_stage.files.len(), 1);
        assert_eq!(diffs_after_stage.files[0].is_staged, true);

        // Unstage hunk 0
        GitEngine::unstage_hunk(path_str, "hello.txt", 0).unwrap();

        // Check diffs - should now be unstaged
        let diffs_after_unstage = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_after_unstage.files.len(), 1);
        assert_eq!(diffs_after_unstage.files[0].is_staged, false);
    }

    #[test]
    fn test_discard_hunk() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");

        // Modify file
        fs::write(&file_path, "line 1\nline 2 MODIFIED\nline 3\nline 4\nline 5\n").unwrap();

        // Discard hunk
        GitEngine::discard_hunk(path_str, "hello.txt", 0).unwrap();

        // File should be back to original
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "line 1\nline 2\nline 3\nline 4\nline 5\n");

        let diffs = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs.files.len(), 0);
    }

    #[test]
    fn test_stage_partial_multi_hunk() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().to_path_buf();
        let path_str = path.to_str().unwrap();
        
        Repository::init(&path).unwrap();
        let file_path = path.join("multi.txt");
        let initial_lines: Vec<String> = (1..=30).map(|i| format!("line {}", i)).collect();
        fs::write(&file_path, initial_lines.join("\n") + "\n").unwrap();
        
        GitEngine::stage_file(path_str, "multi.txt").unwrap();
        GitEngine::commit_staged(path_str, "Initial multi").unwrap();

        // Make two separate modifications far apart
        let mut modified_lines = initial_lines.clone();
        modified_lines[1] = "line 2 MODIFIED HUNK 0".to_string();
        modified_lines[25] = "line 26 MODIFIED HUNK 1".to_string();
        fs::write(&file_path, modified_lines.join("\n") + "\n").unwrap();

        let diffs = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs.files.len(), 1);
        assert_eq!(diffs.files[0].hunks.len(), 2);

        // Stage ONLY hunk 0
        GitEngine::stage_hunk(path_str, "multi.txt", 0).unwrap();

        let diffs_after = GitEngine::get_diffs(path_str).unwrap();
        // Should now have both a staged file (with hunk 0) and an unstaged file (with hunk 1)
        let staged_file = diffs_after.files.iter().find(|f| f.is_staged).unwrap();
        let unstaged_file = diffs_after.files.iter().find(|f| !f.is_staged).unwrap();
        
        assert_eq!(staged_file.hunks.len(), 1);
        assert_eq!(unstaged_file.hunks.len(), 1);

        // Unstage hunk 0
        GitEngine::unstage_hunk(path_str, "multi.txt", 0).unwrap();

        let diffs_after_unstage = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_after_unstage.files.iter().filter(|f| f.is_staged).count(), 0);
        let all_unstaged = diffs_after_unstage.files.iter().find(|f| !f.is_staged).unwrap();
        assert_eq!(all_unstaged.hunks.len(), 2);
    }

    #[test]
    fn test_stage_untracked_file_hunk() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let new_file = path.join("brand_new.txt");
        fs::write(&new_file, "brand new content\n").unwrap();

        let diffs = GitEngine::get_diffs(path_str).unwrap();
        let untracked = diffs.files.iter().find(|f| f.path == "brand_new.txt").unwrap();
        assert_eq!(untracked.is_staged, false);

        // Stage hunk of untracked file
        GitEngine::stage_hunk(path_str, "brand_new.txt", 0).unwrap();

        let diffs_after = GitEngine::get_diffs(path_str).unwrap();
        let staged = diffs_after.files.iter().find(|f| f.path == "brand_new.txt").unwrap();
        assert_eq!(staged.is_staged, true);
    }

    #[test]
    fn test_stage_deleted_file_hunk() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");
        fs::remove_file(&file_path).unwrap();

        let diffs = GitEngine::get_diffs(path_str).unwrap();
        let deleted = diffs.files.iter().find(|f| f.path == "hello.txt").unwrap();
        assert_eq!(deleted.is_staged, false);

        // Stage hunk of deleted file
        GitEngine::stage_hunk(path_str, "hello.txt", 0).unwrap();

        let diffs_after = GitEngine::get_diffs(path_str).unwrap();
        let staged = diffs_after.files.iter().find(|f| f.path == "hello.txt").unwrap();
        assert_eq!(staged.is_staged, true);

        // Unstage hunk of deleted file
        GitEngine::unstage_hunk(path_str, "hello.txt", 0).unwrap();

        let diffs_unstage = GitEngine::get_diffs(path_str).unwrap();
        let unstaged = diffs_unstage.files.iter().find(|f| f.path == "hello.txt").unwrap();
        assert_eq!(unstaged.is_staged, false);
    }

    #[test]
    fn test_intra_line_diffing() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");

        fs::write(&file_path, "line 1\nline 2 MODIFIED_WORD\nline 3\nline 4\nline 5\n").unwrap();

        let diffs = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs.files.len(), 1);
        let hunk = &diffs.files[0].hunks[0];
        
        let del_line = hunk.lines.iter().find(|l| l.line_type == "delete").unwrap();
        let add_line = hunk.lines.iter().find(|l| l.line_type == "add").unwrap();

        assert!(del_line.tokens.is_some());
        assert!(add_line.tokens.is_some());

        let add_tokens = add_line.tokens.as_ref().unwrap();
        let highlighted = add_tokens.iter().filter(|t| t.is_highlighted).collect::<Vec<_>>();
        assert!(!highlighted.is_empty());
        assert!(highlighted.iter().any(|t| t.content.contains("MODIFIED_WORD")));
    }

    #[test]
    fn test_branch_operations() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();

        let branches = GitEngine::list_branches(path_str).unwrap();
        assert!(!branches.is_empty());

        // Create new branch
        GitEngine::create_branch(path_str, "feature-v2").unwrap();
        let branches_after = GitEngine::list_branches(path_str).unwrap();
        let current = branches_after.iter().find(|b| b.is_current).unwrap();
        assert_eq!(current.name, "feature-v2");

        // Switch back
        let default_branch = branches[0].name.clone();
        GitEngine::checkout_branch(path_str, &default_branch).unwrap();
        let branches_final = GitEngine::list_branches(path_str).unwrap();
        let current_final = branches_final.iter().find(|b| b.is_current).unwrap();
        assert_eq!(current_final.name, default_branch);
    }

    #[test]
    fn test_stash_operations() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");

        fs::write(&file_path, "modified content for stash\n").unwrap();
        let diffs = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs.files.len(), 1);

        // Stash
        GitEngine::stash_save(path_str, Some("test stash")).unwrap();
        let diffs_after_stash = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_after_stash.files.len(), 0);

        // Pop
        GitEngine::stash_pop(path_str).unwrap();
        let diffs_after_pop = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_after_pop.files.len(), 1);
    }

    #[test]
    fn test_commit_amend() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();
        let file_path = path.join("hello.txt");

        fs::write(&file_path, "amended line\n").unwrap();
        GitEngine::stage_file(path_str, "hello.txt").unwrap();

        let amend_res = GitEngine::commit_amend(path_str, "Amended Initial commit").unwrap();
        assert_eq!(amend_res.message, "Amended Initial commit");

        let info = GitEngine::get_repo_info(path_str).unwrap();
        assert_eq!(info.head_commit_message, Some("Amended Initial commit".to_string()));
    }

    #[test]
    fn test_push_and_pull() {
        let bare_dir = tempfile::tempdir().unwrap();
        let bare_path = bare_dir.path();
        let _bare_repo = Repository::init_bare(bare_path).unwrap();

        let (_tmp, client_path) = create_test_repo();
        let client_path_str = client_path.to_str().unwrap();

        // Add bare repo as origin
        let client_repo = Repository::open(&client_path).unwrap();
        client_repo.remote("origin", bare_path.to_str().unwrap()).unwrap();

        // Push to origin
        let push_res = GitEngine::push(client_path_str, Some("origin"), Some("master"), true)
            .or_else(|_| GitEngine::push(client_path_str, Some("origin"), Some("main"), true));
        assert!(push_res.is_ok());

        // Pull from origin
        let pull_res = GitEngine::pull(client_path_str, Some("origin"), None);
        assert!(pull_res.is_ok());
    }

    #[test]
    fn test_stage_and_unstage_multiple_files_batch() {
        let (_tmp, path) = create_test_repo();
        let path_str = path.to_str().unwrap();

        let f1 = path.join("file1.txt");
        let f2 = path.join("file2.txt");
        let f3 = path.join("file3.txt");

        fs::write(&f1, "content 1\n").unwrap();
        fs::write(&f2, "content 2\n").unwrap();
        fs::write(&f3, "content 3\n").unwrap();

        let diffs_before = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_before.files.iter().filter(|f| !f.is_staged).count(), 3);
        assert_eq!(diffs_before.files.iter().filter(|f| f.is_staged).count(), 0);

        // Stage 2 of the 3 files in a single batch
        GitEngine::stage_files(path_str, &["file1.txt".to_string(), "file3.txt".to_string()]).unwrap();

        let diffs_after = GitEngine::get_diffs(path_str).unwrap();
        let staged_paths: Vec<String> = diffs_after.files.iter().filter(|f| f.is_staged).map(|f| f.path.clone()).collect();
        let unstaged_paths: Vec<String> = diffs_after.files.iter().filter(|f| !f.is_staged).map(|f| f.path.clone()).collect();

        assert_eq!(staged_paths.len(), 2);
        assert!(staged_paths.contains(&"file1.txt".to_string()));
        assert!(staged_paths.contains(&"file3.txt".to_string()));
        assert_eq!(unstaged_paths.len(), 1);
        assert!(unstaged_paths.contains(&"file2.txt".to_string()));

        // Unstage batch
        GitEngine::unstage_files(path_str, &["file1.txt".to_string(), "file3.txt".to_string()]).unwrap();

        let diffs_final = GitEngine::get_diffs(path_str).unwrap();
        assert_eq!(diffs_final.files.iter().filter(|f| f.is_staged).count(), 0);
        assert_eq!(diffs_final.files.iter().filter(|f| !f.is_staged).count(), 3);
    }

    #[test]
    fn test_checkout_remote_branch_disallowed() {
        let bare_dir = tempfile::tempdir().unwrap();
        let bare_path = bare_dir.path();
        let _bare_repo = Repository::init_bare(bare_path).unwrap();

        let (_tmp, client_path) = create_test_repo();
        let client_path_str = client_path.to_str().unwrap();

        // Add bare repo as origin
        let client_repo = Repository::open(&client_path).unwrap();
        client_repo.remote("origin", bare_path.to_str().unwrap()).unwrap();

        // Push to origin
        let push_res = GitEngine::push(client_path_str, Some("origin"), Some("master"), true)
            .or_else(|_| GitEngine::push(client_path_str, Some("origin"), Some("main"), true));
        assert!(push_res.is_ok());

        let branches = GitEngine::list_branches(client_path_str).unwrap();
        let remote_branch = branches.iter().find(|b| b.is_remote).expect("Expected a remote branch");
        assert!(remote_branch.is_remote);

        // Attempting to checkout remote branch directly must fail
        let checkout_res = GitEngine::checkout_branch(client_path_str, &remote_branch.name);
        assert!(checkout_res.is_err());
        let err_msg = checkout_res.err().unwrap();
        assert!(err_msg.contains("Cannot checkout remote branch"));

        // Attempting nonexistent branch
        let nonexist_res = GitEngine::checkout_branch(client_path_str, "nonexistent-branch-12345");
        assert!(nonexist_res.is_err());
        assert!(nonexist_res.err().unwrap().contains("Local branch not found"));
    }
}
