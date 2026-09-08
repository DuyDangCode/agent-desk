# AGENTDECK - VERSION 1.0 (MVP) SPECIFICATION & TASK LIST
### *The Minimum Viable Product: Core Human-in-the-Loop Review Harness*

---

## 1. Executive Summary & V1 Objective

**Version 1.0 (MVP)** delivers the foundational control bridge of AgentDeck. The primary goal is to validate and deliver the **core human-in-the-loop steering loop** with ultra-low resource usage (<50MB idle RAM):

```
┌─────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
│  Multi-Session PTY      │  ──►  │ Real-Time Live Diff      │  ──►  │   Multi-Line "Steer"     │
│ (Antigravity/OpenCode/  │       │ (Debounced kernel watch; │       │ (Bracketed paste prompt  │
│  Claude/Aider Sessions) │       │  in-memory Myers diffs)  │       │  injection into stdin)   │
└─────────────────────────┘       └──────────────────────────┘       └──────────────────────────┘
                                                                                   │
                                                                                   ▼
                                                                     ┌──────────────────────────┐
                                                                     │ Granular Hunk Staging &  │
                                                                     │ Atomic libgit2 Commits   │
                                                                     └──────────────────────────┘
```

The MVP focuses strictly on **Must-Have (P0)** requirements defined in [docs/user-requirement.md](file:///home/thanhduy/Projects/agent_deck/docs/user-requirement.md), ensuring zero-latency terminal interaction, debounced live diff viewing, 1-click context injection, and native Git commit gating.

---

## 2. MVP Technology Stack

| Layer | Component | Version / Library | Purpose in V1 |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | Tauri v2 | `tauri ^2.0` | Native window management, secure IPC, low memory footprint |
| **Backend Core** | Rust | Edition 2021 | High-performance asynchronous systems runtime |
| **PTY Engine** | `portable-pty` | `portable-pty ^0.8` | Cross-platform virtual TTY master/slave handling & I/O streaming |
| **Git Operations** | `git2-rs` | `git2 ^0.19` (libgit2) | In-memory tree parsing, hunk diffing, staging & committing |
| **File Watcher** | `notify-debouncer-mini` | `notify-debouncer-mini ^0.4` | Kernel-level file system event debouncing (`inotify`, `kqueue`) |
| **Frontend UI** | Svelte 5 + Vite | Svelte 5 (Runes) | Fine-grained reactivity, zero-VDOM overhead |
| **Terminal Canvas**| `@xterm/xterm` | `xterm ^5.5` + WebGL + Unicode11 | Hardware-accelerated ANSI terminal rendering |
| **Styling** | Tailwind CSS | `tailwindcss ^3.4` | Clean, high-contrast dark layout |

---

## 3. MVP Functional Scope & Requirements

### 3.1 Module 1: Workspace & Environment (`WS`)
* **[V1-REQ-WS-01] Folder & Git Repository Loading:** User can pick and open a local Git repository directory.
* **[V1-REQ-WS-02] Desktop File Explorer (`FolderPickerModal`):** Visual directory navigation with Places sidebar (Home, Workspace, Root, Recent), breadcrumbs, manual path entry, and live Git repository detection.
* **[V1-REQ-WS-03] Repository Status Bar:** Display active repository name, current Git branch, dirty status (modified file count), and short commit SHA.
* **[V1-REQ-WS-04] Watcher Initialization:** Automatically register kernel-level file watcher and debouncer on repository root upon opening.

### 3.2 Module 2: Native Embedded PTY & Terminal Cockpit (`TERM`)
* **[V1-REQ-TERM-01] Multi-Session PTY Supervision:** Spawn and manage isolated system shells (`bash`, `zsh`, `powershell`, or default `$SHELL`) via `portable-pty`.
* **[V1-REQ-TERM-02] High-Performance Terminal Rendering:** GPU-accelerated ANSI terminal via `@xterm/xterm`, `@xterm/addon-webgl`, and `@xterm/addon-unicode11`.
* **[V1-REQ-TERM-03] Tab Management & Inline Renaming:** Switch between terminal tabs with double-click inline renaming and independent process lifecycle management.
* **[V1-REQ-TERM-04] Real-Time Agent Auto-Detection:** Automatically detects agent launches (`agy`, `antigravity`, `opencode`, `claude`, `aider`, `gemini`, `goose`) from typed input and stdout banners, displaying active 🤖 Agent badges.
* **[V1-REQ-TERM-05] ⚡ Quick Launch Dropdown:** 1-click launcher for AI coding agents and shell utilities (`git status`, `git diff`, `clear`).

### 3.3 Module 3: Real-Time Differential & Review Canvas (`DIFF`)
* **[V1-REQ-DIFF-01] Debounced Auto-Refresh:** Automatically detect file writes by agents and refresh diff status within `< 200ms` without blocking the terminal.
* **[V1-REQ-DIFF-02] Modified Files Tree/List:** List all modified, newly added, deleted, and untracked files with status indicators (M, A, D, U).
* **[V1-REQ-DIFF-03] Side-by-Side & Unified Diffs:** Render side-by-side (split) and unified (inline) diff views with syntax highlighting.
* **[V1-REQ-DIFF-04] Working-Tree Myers Diff Synthesis:** Uses in-memory buffer diffing (`git2::Patch::from_buffers`) to synthesize hunks for unstaged and newly created untracked files.

### 3.4 Module 4: Human Steering & Context Injection (`STEER`)
* **[V1-REQ-STR-01] Multi-Line Drag & Shift+Click Selection:** Highlight single lines or contiguous multi-line ranges via mouse drag or Shift+Click with glowing visual indicators.
* **[V1-REQ-STR-02] Floating Steering Toolbar:** Floating action bar displaying selected line range (`L12 - L25`), "Steer Selection", "Copy Snippet", and "Clear".
* **[V1-REQ-STR-03] "Steer Agent" Dialog & Safety Gate:** Interactive modal with target agent session selection, no-agent warning gate, and 1-click agent launchers (*"Launch Antigravity & Steer"*, *"Launch OpenCode & Steer"*, etc.).
* **[V1-REQ-STR-04] 🛡️ Bracketed Paste Stdin Injection:** Stream structured review packets wrapped in Bracketed Paste escape sequences (`\x1b[200~` ... `\x1b[201~`) with `\r` into target PTY stdin to prevent newline execution glitches.

### 3.5 Module 5: Staging, Discard & Commit Gate (`GIT`)
* **[V1-REQ-GIT-01] Granular Hunk Staging:** Buttons to Stage/Unstage individual diff hunks or entire files into the Git index.
* **[V1-REQ-GIT-02] Hunk Discard / Rollback:** Revert/discard unwanted hunks or entire modified files with confirmation safety dialogs.
* **[V1-REQ-GIT-03] Commit Panel:** Textarea for commit message and a "Commit Staged Changes" button executing an in-process commit via `git2-rs`.

---

## 4. Work Breakdown Structure (WBS) & Task Checklist

### Phase 1: Rust Backend & Core Architecture (Tauri v2)
- [x] **Task 1.1: Project Scaffolding**
  - Initialize Tauri v2 project with Rust backend and Svelte 5 frontend.
  - Configure `Cargo.toml` with `tauri`, `portable-pty`, `git2`, `notify-debouncer-mini`, `tokio`, `serde`, and `serde_json`.
- [x] **Task 1.2: PTY Management Module (`src-tauri/src/pty/` & `server/src/main.rs`)**
  - Implement multi-session PTY process spawner using `portable-pty`.
  - Implement non-blocking asynchronous read loop streaming PTY output to Tauri frontend events and WebSocket channels.
  - Set UTF-8 locale environment variables (`LANG=en_US.UTF-8`, `LC_ALL=en_US.UTF-8`, `TERM=xterm-256color`, `COLORTERM=truecolor`).
  - Implement Tauri command `write_pty(session_id, data)`, `resize_pty(...)`, and `kill_pty(...)`.
- [x] **Task 1.3: Git Engine Module (`src-tauri/src/git/`)**
  - Implement `open_repository(path)` and retrieve branch, head commit, and dirty status.
  - Implement `get_repository_diffs(path)` using `git2` with Myers buffer fallback (`generate_file_hunks_fallback`) for untracked and unstaged files.
  - Implement `stage_hunk(path, file, hunk_idx)` and `unstage_hunk(...)`.
  - Implement `discard_hunk(path, file, hunk_idx)` and `discard_file(path, file)`.
  - Implement `commit_staged(path, message)`.
- [x] **Task 1.4: Real-time Filesystem Watcher (`src-tauri/src/watcher/`)**
  - Set up `notify-debouncer-mini` watching the active repository root.
  - Filter out `.git/`, `node_modules/`, `target/`, and ignored directories.
  - Emit debounced `repo-changed` event to frontend.
- [x] **Task 1.5: Desktop File Listing Engine (`src-tauri/src/commands.rs` & `server/src/main.rs`)**
  - Implement `list_directory_folders` command supporting Places, home path, and Git repo detection.

---

### Phase 2: Frontend Layout & Terminal Cockpit (Svelte 5)
- [x] **Task 2.1: Workspace Layout Shell**
  - Implement responsive two-column split layout (Left: Terminal Cockpit, Right: Review & Diff Canvas).
  - Implement resizable split pane handler with draggable divider.
  - Implement Top Status Bar (Repo path picker, Branch name, Staged/Unstaged counts).
- [x] **Task 2.2: Terminal Canvas Component (`TerminalView.svelte`)**
  - Integrate `@xterm/xterm` with `@xterm/addon-webgl`, `@xterm/addon-fit`, and `@xterm/addon-unicode11`.
  - Implement multi-session tab manager with independent terminal instances and background persistence.
  - Implement inline tab renaming on double-click.
  - Implement real-time typed command and stdout agent detection.
  - Implement ⚡ Quick Launch dropdown select box.
- [x] **Task 2.3: Multi-Theme Engine & Settings Modal (`theme.svelte.ts` & `SettingsModal.svelte`)**
  - Implement Black (Dark), White (Light), and System OS sync with instant CSS variable cascade.
  - Implement Settings Modal (`Ctrl+,`) with theme switcher, keyboard shortcuts guide, and metadata.

---

### Phase 3: Real-Time Diff Viewer & Review Canvas
- [x] **Task 3.1: Modified File List Component (`FileList.svelte`)**
  - Display list of changed files with badge indicators (Staged vs. Unstaged, Modified, Added, Deleted, Untracked).
  - Search filter and 1-click selection to load file diff into active viewer.
- [x] **Task 3.2: Diff Renderer Component (`DiffView.svelte`)**
  - Implement Side-by-Side (split) and Unified (inline) view toggles.
  - Render diff hunks with colored line additions (green), deletions (red), and line numbers.
  - Add "Stage Hunk", "Unstage Hunk", and "Discard Hunk" action buttons on each hunk header.
  - Implement multi-line mouse drag and Shift+Click range selection.
  - Implement floating steering action toolbar.
- [x] **Task 3.3: Reactive Auto-Refresh Integration**
  - Listen to Tauri `repo-changed` events to trigger diff refresh in the background without stealing UI focus or stuttering terminal rendering.

---

### Phase 4: Bi-Directional Context Injection ("Steer Agent")
- [x] **Task 4.1: Diff Selection & Steer Trigger**
  - Capture selected file path, start line, end line, and multi-line code snippet.
  - Floating action bar and right-click trigger options.
- [x] **Task 4.2: "Steer Agent" Modal Component (`SteerModal.svelte`)**
  - Target agent session selector dropdown.
  - No-agent warning safety gate preventing accidental raw shell code dumps.
  - 1-click agent launch & steer buttons (*Antigravity*, *OpenCode*, *Claude*, *Aider*).
  - Quick steering templates & editable feedback textarea.
  - Keyboard shortcuts (`Cmd+Enter` / `Ctrl+Enter` to inject, `Esc` to cancel).
- [x] **Task 4.3: Bracketed Paste Stdin Dispatcher**
  - Format feedback packet into standardized prompt string.
  - Stream formatted string wrapped in Bracketed Paste Mode (`\x1b[200~` ... `\x1b[201~`) with `\r` into target PTY via `write_pty` IPC.
  - Provide visual toast confirmation.

---

### Phase 5: Staging, Discard & Commit Release Gate
- [x] **Task 5.1: Hunk & File Action Bindings**
  - Connect UI buttons to `stage_hunk`, `unstage_hunk`, and `discard_hunk` Tauri commands.
  - Provide confirmation modal before discarding hunks/files to prevent accidental data loss.
- [x] **Task 5.2: Commit Panel Component (`CommitPanel.svelte`)**
  - Text area for commit message input.
  - "Commit Changes" button (enabled only when staged changes > 0 and message is non-empty).
  - Invoke `commit_staged` and display success notification upon completion.

---

## 5. Scope Boundaries: V1 (MVP) vs. Future Releases

| Feature / Capability | V1 (MVP) | V2+ (Post-MVP Roadmap) |
| :--- | :---: | :---: |
| **Multi-Session Terminal Tabs** | ✅ Included | Included |
| **Real-Time Agent Auto-Detection** | ✅ Included | Included |
| **Desktop File Explorer** | ✅ Included | Included |
| **Multi-Line Drag & Shift+Click Steer** | ✅ Included | Included |
| **Bracketed Paste Stdin Protection** | ✅ Included | Included |
| **Side-by-Side & Unified Diff Canvas** | ✅ Included | Included |
| **Kernel-Level Debounced Live Refresh** | ✅ Included | Included |
| **Hunk Staging, Discard & Native Commit** | ✅ Included | Included |
| **Intra-Line Word/Character Diffs** | ❌ Deferred | ✅ V2.0 |
| **Prompt Template Customizer** | ❌ Deferred | ✅ V2.0 |
| **AI-Generated Commit Messages** | ❌ Deferred | ✅ V2.0 |
| **Remote LAN/VPN Terminal Access** | ❌ Deferred | ✅ V3.0 |
| **WASM Plugin Runtime & MCP Bridge** | ❌ Deferred | ✅ V3.0 |

---

## 6. Definition of Done (DoD) for MVP

1. **Working Build:** Desktop app and standalone server compile and run cleanly with `< 50MB` idle RAM.
2. **Terminal Stability:** User can launch `agy`, `opencode`, `claude`, `aider`, or system shell without input lag, font clipping, or resizing bugs.
3. **Live Sync:** Changes written by agents in terminal appear on the diff canvas within 200ms automatically for both tracked and untracked files.
4. **Context Injection:** Dragging across diff lines allows sending structured feedback directly into the running agent prompt using bracketed paste mode.
5. **Atomic Commit:** User can stage selected hunks, discard hallucinations, and commit directly from AgentDeck.
