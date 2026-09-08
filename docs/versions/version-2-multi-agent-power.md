# AGENTDECK - VERSION 2.0 SPECIFICATION & TASK LIST
### *Multi-Project Deck, Multi-Agent Intelligence & Advanced Review Controls*

---

## 1. Executive Summary & V2 Objective

Building upon the core foundation delivered in [Version 1.0 (MVP)](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md), **Version 2.0** elevates AgentDeck into a high-productivity **Multi-Project & Multi-Agent Control Center**. 

The primary objectives of V2 are:
1. **Multi-Project Management (Horizontal Project Deck):** Attach multiple project folders/repositories simultaneously. A top horizontal bar allows seamless navigation, instant project switching, and parallel multi-project orchestration without losing terminal sessions or review states.
2. **Multi-Agent Session Management:** Run and monitor multiple concurrent CLI agents (e.g., Antigravity, Claude Code, Aider, background test runners) across segregated terminal tabs with independent PTY lifecycles.
3. **Advanced Prompt Steering & Templates:** Introduce customizable prompt templates, instant quick-actions ("Fix Bug", "Add Unit Test", "Explain Code"), and pre-injection packet previews.
4. **Enhanced Diff Canvas:** Add word/character intra-line diff highlighting, staged vs. unstaged filtering, and interactive code folding.
5. **AI-Assisted Release Workflows:** Optional local/custom LLM commit message synthesis from staged diff hunks.

---

## 2. V2 Technology Enhancements

| Component | Technology / Library | Purpose in V2 |
| :--- | :--- | :--- |
| **Project Deck Registry** | Svelte 5 Runes (`ProjectState`) & Local Storage | Parallel workspace state isolation (CWD, diffs, Git metadata, PTY sessions per project) |
| **Multi-Path File Watcher** | `notify-debouncer-mini` multi-path / registry (Rust) | Kernel file watching across all attached repositories simultaneously with debouncing |
| **Session Supervisor** | Multi-PTY Registry (Rust `tokio` channels) | Concurrent PTY lifecycle supervision, isolated buffer streams |
| **Intra-Line Diffing** | `similar` / `imara-diff` (Rust) | Sub-token & character-level diff highlighting for precision review |
| **State Persistence** | `tauri-plugin-store` / `localStorage` | Store attached project list, user prompt templates, layout preferences, and recent workspaces |
| **UI Components** | Svelte 5 Horizontal Project Bar & Split Grid | Top project switcher pills, dynamic multi-terminal layout (grid, split horizontal/vertical, tabs) |
| **AI Synthesis Engine** | Local LLM / OpenAI-compatible API Bridge | Fast commit message generation & diff summarization |

---

## 3. V2 Functional Requirements Breakdown

### 3.1 Module 1: Multi-Project Management & Horizontal Navigation Bar (`MULTI-PROJ`)
* **[V2-REQ-PROJ-01] Multi-Folder Attachment:** Users can attach and maintain multiple active projects/repositories simultaneously in a unified deck.
* **[V2-REQ-PROJ-02] Top Horizontal Project Bar:** A sleek horizontal tab bar showing all attached projects with project name pills, Git branch badges, real-time dirty file counters, active agent badges, and close (`x`) buttons.
* **[V2-REQ-PROJ-03] Parallel Workspace Isolation:** Switching projects instantly toggles active context (diff tree, file diffs, Git branch, and scoped PTY sessions running in the project's root `cwd`) while background agents and watchers continue running.
* **[V2-REQ-PROJ-04] 1-Click Project Addition:** A dedicated `+` button on the horizontal bar to quickly attach new folders via the desktop Folder Picker.
* **[V2-REQ-PROJ-05] Workspace Persistence:** Attached projects list and active project index are stored in local storage and reloaded upon app launch.
* **[V2-REQ-PROJ-06] Keyboard Shortcuts for Project Navigation:** Hotkeys (`Ctrl+Shift+[` / `Ctrl+Shift+]`, `Ctrl+Alt+Left/Right`, or `Ctrl+1..9`) for rapid cycling through attached projects.

### 3.2 Module 2: Multi-Session Terminal Deck (`MULTI-TERM`)
* **[V2-REQ-TERM-01] Multi-Tab Session Registry:** Users can open, close, rename, and rearrange unlimited terminal tabs with dedicated PTY instances.
* **[V2-REQ-TERM-02] Split-Terminal Layouts:** Support side-by-side or stacked terminal panes within the terminal cockpit (e.g., Agent 1 in Pane A, Test runner in Pane B).
* **[V2-REQ-TERM-03] Agent Status Indicators:** Visual activity badges on tabs (Active/Typing, Idle, Process Exited, Alert).
* **[V2-REQ-TERM-04] Target Session Selector for Steering:** When triggering "Steer Agent", user can choose which active terminal session receives the injected prompt.
* **[V2-REQ-TERM-05] Terminal Navigation Hotkeys:** Dedicated keyboard shortcuts for session management (`Ctrl+Shift+T` new session, `Ctrl+Shift+W` close focused session, `Ctrl+Shift+P` focus active terminal, `Ctrl+Shift+Left/Right` cycle sessions).
* **[V2-REQ-TERM-06] Clean Agent Process Exit Reset:** Automatically reset session status badges (🤖 to 💻) and restore shell titles upon agent termination.

### 3.3 Module 3: Advanced Review & Diff Canvas (`ADV-DIFF`)
* **[V2-REQ-DIFF-01] Word/Character-Level Intra-Line Diffs:** Highlight exact tokens changed within modified lines for quick micro-reviews.
* **[V2-REQ-DIFF-02] Advanced File Filters & Search:** Filter modified files by file extension, status (Staged, Unstaged, Untracked), or file name search.
* **[V2-REQ-DIFF-03] Code Folding & Context Expansion:** Collapse unchanged blocks while allowing 1-click context expansion (+5 / +10 lines).
* **[V2-REQ-DIFF-04] Syntax Theme Customization:** Support standard themes (One Dark, GitHub Dark/Light, Dracula, Nord) for terminal and diff viewer.
* **[V2-REQ-DIFF-05] Rich Markdown Render Preview:** Render formatted HTML preview with GFM features (tables, checklists, syntax code blocks, headings) and sanitization for `.md`, `.markdown`, and `.mdx` files, with side-by-side and unified diff coloring.

### 3.4 Module 4: Prompt Template Engine & Quick Steer (`TEMPLATES`)
* **[V2-REQ-STR-01] Customizable Prompt Templates:** User can create and store custom steering templates with variables (e.g., `{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`).
* **[V2-REQ-STR-02] Quick Steer Presets:** 1-click preset actions from the diff context menu:
  * *"Add Comprehensive Unit Test"*
  * *"Fix Type / Linter Error"*
  * *"Optimize for Memory & Speed"*
  * *"Security Hardening"*
* **[V2-REQ-STR-03] Interactive Packet Preview & Editor:** Modal allows full markdown editing of the synthesized prompt before injection.

### 3.5 Module 5: Release & Commit Intelligence (`SMART-GIT`)
* **[V2-REQ-GIT-01] AI-Assisted Commit Message Generation:** 1-click button to summarize all staged hunks into conventional commit format (`feat:`, `fix:`, `refactor:`).
* **[V2-REQ-GIT-02] Quick Branch & Stash Operations:** Create/switch branches and stash uncommitted changes directly from the top status bar.
* **[V2-REQ-GIT-03] Interactive Rebase & Commit Amend:** Amend previous commits or discard uncommitted changes in bulk.
* **[V2-REQ-GIT-04] Real-Time Push/Pull Loading Notifications:** Non-dismissing toast notifications with animated spinner during network operations, transitioning cleanly to completion or error status.
* **[V2-REQ-GIT-05] In-Explorer Directory Creation & Git Initialization:** Directory creation (`New Folder`) with traversal safeguards, and 1-click Git initialization (`Init Git`) for plain directories.

---

## 4. V2 Work Breakdown Structure (WBS) & Task Checklist

### Phase 1: Multi-Project & Backend Core (Rust & Svelte 5)
- [x] **Task 1.1: Multi-Project State Architecture (`appState.svelte.ts`)**
  - Implement `ProjectItem` and multi-project collection state.
  - Scope repository metadata, diff tree, selected file, and terminal sessions to individual projects.
  - Persist attached projects array and `activeProjectId` in local storage.
- [x] **Task 1.2: Horizontal Project Navigation Bar Component (`ProjectBar.svelte`)**
  - Build top horizontal bar with project pills, Git branch badge, dirty file counter, active agent indicators, `+` Add Project button, and close (`x`) actions.
  - Implement smooth horizontal scrolling / overflow handling for many projects.
- [x] **Task 1.3: Multi-Repository Backend Watcher & Git Scoping**
  - Update `src-tauri/src/watcher/` and `server/src/main.rs` to support watching multiple repository paths simultaneously.
  - Broadcast `repo-changed` with `repo_path` payload so the frontend updates the matching project.
- [x] **Task 1.4: Intra-Line Diff Computation**
  - Integrate `similar` crate in `src-tauri/src/git/` to calculate word-level character diffs alongside hunk-level diffs.

---

### Phase 2: Multi-PTY & Split Layouts (Rust / Svelte 5)
- [x] **Task 2.1: Multi-Session PTY Registry**
  - Refactor `src-tauri/src/pty/` to maintain a concurrent map of active PTY sessions (`HashMap<SessionId, PtyProcess>`).
  - Implement session isolation with independent async stdout reading threads and event channels (`pty-output`).
  - Ensure running PTY sessions and agents persist without reset across project navigation.
- [x] **Task 2.2: Terminal Tab Manager & Split Pane Grid**
  - Tab bar with Add Tab (`+`), Close Tab (`x`), Rename, and Drag-to-reorder.
  - Support single, horizontal split, and vertical split panes for simultaneous monitoring.
- [x] **Task 2.3: Global Keyboard Shortcuts & Navigation**
  - Shortcuts for project cycling (`Ctrl+Shift+[` / `Ctrl+Shift+]`, `Ctrl+Alt+Left/Right`), terminal operations (`Ctrl+Shift+T`, `Ctrl+Shift+W`, `Ctrl+Shift+P`, `Ctrl+Shift+Left/Right`), tab switching (`Ctrl+Tab`, `Cmd+1..9`), quick-steer (`Ctrl+Shift+S`), and terminal scrolling (`Shift+End`, `Shift+PageDown`).

---

### Phase 3: Advanced Diff Canvas & Intra-Line Highlighting
- [x] **Task 3.1: Token-Level Diff Renderer**
  - Update `DiffView.svelte` to highlight changed words within modified lines with high-contrast tokens.
- [x] **Task 3.2: Context Expansion & Code Folding**
  - Implement collapsible unchanged code regions with expand buttons (`▲ Show more lines ▼`).
- [x] **Task 3.3: Diff Filters & Search Bar**
  - Add search input and flex-wrapping filter chips (Staged, Unstaged, Extension) above the file list.
- [x] **Task 3.4: Rich Markdown Render Preview & Diff Engine**
  - Build `MarkdownPreview.svelte` and `src/lib/utils/markdown.ts` with GFM parsing, task checklists, code blocks, tables, and XSS sanitization.
  - Add raw diff vs. markdown preview toggle in `DiffView.svelte`.

---

### Phase 4: Prompt Template Manager & Quick Steer
- [x] **Task 4.1: Template Management Settings UI**
  - Create settings modal to add, edit, delete, and reset custom steering templates.
- [x] **Task 4.2: Quick Steer Context Menu & Built-in Templates**
  - Preset actions and built-in templates ("Explain Code & Removal Impact", "Refactor & Clean", "Add Comprehensive Unit Tests", "Fix Bug & Add Validation", "Optimize Memory & Speed", "Security Hardening").
- [x] **Task 4.3: Full-Featured Steer Editor**
  - Rich textarea in `SteerModal.svelte` with live synthesized prompt preview and template selector.

---

### Phase 5: AI Commit Synthesis & Smart Git
- [x] **Task 5.1: LLM Integration Engine**
  - Implement optional local / API bridge (Ollama / Anthropic / OpenAI / Custom) for commit generation.
- [x] **Task 5.2: Commit Generator UI**
  - Add "Generate Commit Message" button in `CommitPanel.svelte` that analyzes staged diffs.
- [x] **Task 5.3: Branch Switcher & Stash UI**
  - Add `BranchModal.svelte` modal dialog for branch switching, branch creation, and stash save/pop operations.
- [x] **Task 5.4: Push/Pull Loading Notifications & File Explorer Operations**
  - Add real-time loading toast with `Loader2` animated spinner for `git push` and `git pull`.
  - Add directory creation (`create_directory`) and 1-click Git initialization (`init_repository`) in `FolderPickerModal.svelte`.

---

## 5. Definition of Done (DoD) for Version 2.0

1. **[x] Multi-Project Navigation:** Users can attach 3+ project repositories and switch between them instantly via the horizontal bar or hotkeys (`Ctrl+Shift+[` / `]`) with zero lag and full state isolation.
2. **[x] Multi-Agent Stability & Persistence:** Concurrent terminal sessions and running agents (`agy`, `opencode`, `claude`, `aider`, `goose`) run across attached projects with zero cross-talk, memory leaks, or UI lag, and persist across project navigation.
3. **[x] Precision Diffing & Markdown Preview:** Intra-line word changes are clearly visible and accurately highlighted, with 1-click GFM Markdown preview for `.md` files.
4. **[x] Template Steering:** Users can trigger preset and custom templates to steer any selected terminal session in under 2 clicks.
5. **[x] Smart Commit & Git Operations:** Automated commit messages reflect staged changes, with animated loading notifications for push/pull operations and safe branch checkout.
6. **[x] File Explorer Operations:** Users can create directories and initialize Git repositories directly inside the desktop browser.
7. **[x] Terminal Scroll Fidelity:** Full-screen Ink/curses TUI applications (Antigravity CLI) auto-scroll to the active prompt and allow seamless end-of-page navigation.
8. **[x] Memory Control:** Memory footprint remains `< 90MB` with 3 active projects, active PTY sessions, and full diff canvas loaded.
