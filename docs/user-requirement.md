# USER REQUIREMENTS DOCUMENT (URD): AGENTDECK
### *The Human-Centric Review Harness & Workspace for CLI Coding Agents*

---

## 1. Introduction & Purpose

### 1.1 Purpose
This User Requirements Document (URD) establishes the comprehensive functional, non-functional, and workflow requirements for **AgentDeck**—an ultra-lightweight desktop platform designed as a control bridge and human-in-the-loop review harness for terminal-based AI coding agents (such as Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, Codex, and local LLM runners).

### 1.2 Target Audience
* **AI-Assisted Software Engineers & Architects:** Developers supervising automated multi-file code generation who require spatial awareness, diff tracking, and fast steering.
* **Code Reviewers & Tech Leads:** Engineers responsible for quality, security, and verification before committing agent-generated code.
* **Open-Source Maintainers:** Developers seeking a lightweight, high-performance workspace without the memory overhead of traditional Electron-based IDEs.

### 1.3 Scope
AgentDeck serves as the desktop harness combining an embedded multi-session pseudo-terminal (PTY) with an interactive, real-time Git differential canvas. It does not replace or bundle proprietary LLMs directly; rather, it interfaces universally with any CLI agent running in a terminal session.

---

## 2. User Personas & Problem Analysis

### 2.1 User Personas

| Persona | Role | Primary Goals | Key Frustrations |
| :--- | :--- | :--- | :--- |
| **Alex (Senior Full-Stack Dev)** | Orchestrating CLI agents for feature implementation and refactoring | Review multi-file diffs rapidly, keep terminal output interactive, steer agents when hallucinations occur | Detached CLI output, copy-pasting file/line coordinates back to terminal, laggy Git GUIs |
| **Priya (Systems / Backend Dev)** | Running local LLMs and agent runners alongside heavy Docker/compile workloads | Minimal system overhead (<50MB RAM), fast startup, reliable POSIX/ConPTY emulation | Heavy IDEs/Electron apps consuming 1–2GB RAM just to show a diff viewer |
| **Marcus (Tech Lead / Maintainer)** | Ensuring code quality, security, and architectural consistency | Granular hunk-by-hunk verification, discarding bad modifications, atomic staging and commits | Agents making batch modifications where partial rollbacks and selective staging are tedious via CLI |
| **Elena (Microservices Engineer)** | Developing across multiple interdependent services (Frontend, Backend API, Worker) | Attach multiple project folders, navigate projects via horizontal bar, run agents in parallel | Having to open multiple app windows or re-open folders constantly, losing terminal sessions and diff state |

### 2.2 Core User Pain Points & Needs
1. **The Reviewer’s Blind Spot:** Users struggle to visualize structural code modifications when CLI agents write to dozens of files simultaneously.
2. **High Friction in Steering & Feedback:** Pointing out an error requires manual typing of file paths, line numbers, and context into the prompt, breaking developer flow.
3. **Tooling Bloat & Resource Contention:** Heavy development tools conflict with local agent inference and build processes. Users need native performance and minimal RAM consumption.
4. **Multi-Project Fragmentation:** Real-world workflows require managing multiple projects/repositories in parallel (e.g. backend API, frontend client, infrastructure). Opening multiple IDE instances wastes memory and fractures focus; users need a single cockpit with horizontal project navigation tabs to attach and switch projects in parallel.

---

## 3. User Workflows & Journey Scenarios

### 3.1 Primary Workflow: Human-in-the-Loop Agent Orchestration

```
[1. Open Workspace / Attach Projects] ──► [2. Launch CLI Agent / Quick Launch] ──► [3. Observe Real-Time Diffs]
                                                                                               │
                                                                                               ▼
[5. Stage, Commit & Gate] ◄── [4. Multi-Line Drag "Steer" (Bracketed Paste Stdin Inject)] ────┘
```

### 3.2 Key Use Case Scenarios

* **UC-01: Multi-File In-Flight Review**
  * *Trigger:* Agent receives a prompt and writes changes across multiple project files.
  * *Action:* AgentDeck automatically detects filesystem writes via debounced kernel events, updating the modified file list and active diff views in real time.
  * *Outcome:* User reviews code changes visually without switching windows or manually triggering Git diffs.

* **UC-02: Multi-Line Drag Selection & Point-and-Click Steering**
  * *Trigger:* User notices a multi-line bug, anti-pattern, or logic flaw in the diff canvas.
  * *Action:* User drags across the lines (or Shift+Clicks), clicks "Steer Selection", enters instructions in the Steer Modal, and presses `Ctrl+Enter`.
  * *Outcome:* AgentDeck formats a structured context packet and streams it into the target agent PTY stdin using Bracketed Paste Mode (`\x1b[200~` ... `\x1b[201~`) without breaking the terminal UI.

* **UC-03: Granular Staging and Hallucination Discard**
  * *Trigger:* Agent completes code generation, but modified unnecessary files or introduced unwanted formatting.
  * *Action:* User stages approved hunks and discards unwanted changes directly in the review canvas.
  * *Outcome:* Clean, atomic commits are created using native `libgit2` before code is pushed to version control.

* **UC-04: Parallel Multi-Project Orchestration & Horizontal Navigation Bar**
  * *Trigger:* User works concurrently on multiple repositories/folders (e.g., `client-ui`, `server-api`, `shared-types`).
  * *Action:* User clicks `+` on the horizontal project bar to attach multiple project folders. Clicking project tabs instantly switches active workspace context (diff view, file list, repository info, and project-scoped terminal sessions) while background agent tasks and file watchers continue running in parallel.
  * *Outcome:* Seamless multi-project multitasking in a single ultra-lightweight desktop window without lost session state or memory bloat.

---

## 4. Functional Requirements (FR)

### 4.1 Multi-Project Management & Horizontal Navigation Bar (`PROJ`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-PROJ-01** | **Must** | ✅ Implemented | The user must be able to attach multiple project folders/repositories simultaneously into a unified workspace. |
| **FR-PROJ-02** | **Must** | ✅ Implemented | The application must render a dedicated top **Horizontal Project Bar** showing all attached projects with tab pills, project folder icons, active Git branch, dirty file count badge, and active agent indicators. |
| **FR-PROJ-03** | **Must** | ✅ Implemented | The user must be able to click any project tab or use keyboard shortcuts (`Ctrl+Shift+[` / `Ctrl+Shift+]`, `Ctrl+Alt+Left/Right`, or `Ctrl+1..9`) to switch active project context instantly. |
| **FR-PROJ-04** | **Must** | ✅ Implemented | The system must provide isolated workspace state per attached project (separate Git status, file diff list, selected diff, view mode, and project-scoped PTY terminal sessions running in that project's working directory). |
| **FR-PROJ-05** | **Must** | ✅ Implemented | The user must be able to attach new projects with 1-click via the `+` button on the horizontal bar or the Folder Picker dialog. |
| **FR-PROJ-06** | **Should** | ✅ Implemented | The user must be able to close/detach projects from the horizontal bar (`x` button) with safe confirmation when active agents or unsaved diffs exist. |
| **FR-PROJ-07** | **Should** | ✅ Implemented | The application must persist the list of attached projects and active selection in local storage across app restarts. |
| **FR-PROJ-08** | **Should** | ✅ Implemented | The backend must support concurrent multi-repository file watching so background project tabs show real-time dirty status badges when agents make changes. |

### 4.2 Workspace & Repository Management (`WS`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-WS-01** | **Must** | ✅ Implemented | The user must be able to open any local folder containing a Git repository. |
| **FR-WS-02** | **Must** | ✅ Implemented | The application must initialize a zero-cost in-memory Git indexer and native filesystem watcher upon workspace load. |
| **FR-WS-03** | **Should** | ✅ Implemented | The user must be able to navigate directories and switch workspaces via a visual File Explorer with Places and breadcrumbs. |
| **FR-WS-04** | **Should** | ✅ Implemented | The application must display repository metadata (active branch, dirty working tree status, commit hash). |
| **FR-WS-05** | **Should** | ✅ Implemented | The user must be able to create new subdirectories directly within the File Explorer with name validation and directory traversal prevention. |
| **FR-WS-06** | **Should** | ✅ Implemented | The user must be able to initialize a new Git repository on any plain folder directly from the File Explorer with optional auto-attachment to the workspace deck. |

### 4.3 Terminal Cockpit & Embedded PTY (`TERM`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-TERM-01** | **Must** | ✅ Implemented | The application must provide an embedded native pseudo-terminal (PTY) powered by `portable-pty` supporting POSIX TTY and Windows ConPTY. |
| **FR-TERM-02** | **Must** | ✅ Implemented | The terminal canvas must render ANSI colors, curses/TUI interfaces, progress indicators, and standard navigation keys with GPU acceleration (`@xterm/xterm` + WebGL + Unicode11). |
| **FR-TERM-03** | **Must** | ✅ Implemented | The user must be able to spawn, monitor, and switch between multiple terminal sessions across segregated tabs with inline tab renaming. |
| **FR-TERM-04** | **Must** | ✅ Implemented | The user must be able to run any CLI agent (Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose, custom scripts) with real-time automatic detection. |
| **FR-TERM-05** | **Should** | ✅ Implemented | The user must be able to launch agents and commands via a Quick Launch dropdown select box. |
| **FR-TERM-06** | **Should** | ✅ Implemented | The terminal must automatically resize and adapt PTY dimensions on window split or layout adjustments. |
| **FR-TERM-07** | **Must** | ✅ Implemented | The terminal cockpit must support dynamic split layouts (Single `Alt+S`, Side-by-Side Horizontal `Alt+H`, and Stacked Vertical `Alt+V`) with draggable resizer divider and dedicated pane toolbars. |
| **FR-TERM-08** | **Should** | ✅ Implemented | The system must track active focused panes (`focusedPane: 'primary' | 'secondary'`), display tab badges (`P1`, `P2`), and route prompt steering, quick actions, and scroll-to-bottom to the active pane. |
| **FR-TERM-09** | **Should** | ✅ Implemented | The user must be able to navigate terminal sessions via dedicated hotkeys: `Ctrl+Shift+T` (new terminal session), `Ctrl+Shift+W` (close focused terminal session with single-session safety), `Ctrl+Shift+P` (focus active terminal), and `Ctrl+Shift+Left/Right` (cycle terminal sessions). |
| **FR-TERM-10** | **Should** | ✅ Implemented | The system must automatically reset terminal session status indicators (🤖 to 💻) and restore shell titles when an AI agent process terminates or exits. |

### 4.4 Real-Time Differential & Review Canvas (`DIFF`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-DIFF-01** | **Must** | ✅ Implemented | The system must automatically detect filesystem modifications using kernel-level event aggregation (`notify-debouncer-mini`) and update diffs without UI lag. |
| **FR-DIFF-02** | **Must** | ✅ Implemented | The user must be able to view modified, added, deleted, and untracked files in a collapsible sidebar tree. |
| **FR-DIFF-03** | **Must** | ✅ Implemented | The diff viewer must support both **Side-by-Side (Split)** and **Unified (Inline)** view modes. |
| **FR-DIFF-04** | **Must** | ✅ Implemented | Diffs must synthesize in-memory Myers diffs for untracked and unstaged files. |
| **FR-DIFF-05** | **Should** | ✅ Implemented | The user must be able to filter the diff tree (all, staged vs. unstaged, search query). |
| **FR-DIFF-06** | **Must** | ✅ Implemented | The system provides word-level / character-level intra-line diff highlighting via `similar` crate in Rust. |
| **FR-DIFF-07** | **Must** | ✅ Implemented | The review canvas must support rich Markdown rendering for all markdown files (`.md`, `.markdown`, `.mdx`), allowing users to toggle between raw diff/code and formatted HTML preview with GFM features (tables, checklists, syntax code blocks, headings) and sanitization. |

### 4.5 Human Steering & Bi-Directional Context Injection (`STEER`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-STR-01** | **Must** | ✅ Implemented | The user must be able to select single lines or drag across multi-line ranges in the diff canvas. |
| **FR-STR-02** | **Must** | ✅ Implemented | The system must automatically assemble a structured Human Review Feedback packet containing: Target File Path, Line Range, Code Snippet, and Human Feedback Prompt. |
| **FR-STR-03** | **Must** | ✅ Implemented | The system must stream the generated prompt directly into the target agent’s PTY stdin using Bracketed Paste Mode (`\x1b[200~` ... `\x1b[201~`) with `\r`. |
| **FR-STR-04** | **Should** | ✅ Implemented | The user must be able to choose the target agent session and be protected from accidental raw shell code dumps. |
| **FR-STR-05** | **Should** | ✅ Implemented | The user can select quick steering presets and launch agents with 1 click directly from the steer dialog. |

### 4.6 Staging, Discard & Release Gate (`GIT`)

| ID | Priority | Status | Requirement Description |
| :--- | :---: | :---: | :--- |
| **FR-GIT-01** | **Must** | ✅ Implemented | The user must be able to stage or unstage entire files or specific hunks. |
| **FR-GIT-02** | **Must** | ✅ Implemented | The user must be able to discard changes at the file or hunk level with confirmation safety guards. |
| **FR-GIT-03** | **Must** | ✅ Implemented | The user must be able to enter a commit message and trigger a Git commit natively via `libgit2`. |
| **FR-GIT-04** | **Should** | ✅ Implemented | The application must provide a 1-click "Stage All" and "Unstage All" workflow. |
| **FR-GIT-05** | **Should** | ✅ Implemented | The system provides AI-assisted commit message generation based on staged hunks. |
| **FR-GIT-06** | **Should** | ✅ Implemented | The application must display a real-time persistent loading toast notification with an animated spinner during Git push and pull operations, transitioning to success or error summaries upon completion. |
| **FR-GIT-07** | **Must** | ✅ Implemented | The system must prevent direct checkout of remote Git branches across the UI and Git engine, guiding the user to create a local tracking branch instead. |

---

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance & Resource Footprint
* **NFR-PERF-01 (Memory Usage):** Idle baseline memory consumption must remain `< 50MB` RAM with 1 project, `< 90MB` RAM with 3 attached projects and active PTYs.
* **NFR-PERF-02 (Cold Startup Time):** Application cold start to fully interactive workspace must be `< 400ms`.
* **NFR-PERF-03 (Debounce Efficiency):** File watcher must handle rapid write bursts across multiple attached repositories without UI frame drops.
* **NFR-PERF-04 (Rendering):** Terminal and diff canvas rendering must maintain a consistent 60 FPS under active streaming.

### 5.2 Reliability & Stability
* **NFR-REL-01 (PTY Isolation):** A crash or freeze within a CLI agent subprocess must not crash the AgentDeck desktop application or affect other project sessions.
* **NFR-REL-02 (In-Process Git Safety):** All Git operations executed via `git2-rs` must ensure repository index integrity without leaving dangling locks.
* **NFR-REL-03 (Unicode & Stdin Integrity):** Bracketed paste and Unicode 11 character width alignment prevent TUI distortion or command corruption.

### 5.3 Security & Privacy
* **NFR-SEC-01 (Local-First Operation):** AgentDeck must run 100% locally on the user's machine with zero mandatory telemetry or remote cloud dependencies.
* **NFR-SEC-02 (Sandboxing & System Boundaries):** Frontend Svelte layer must communicate with native OS primitives strictly through validated Tauri v2 IPC / authenticated local backend server.

---

## 6. Verification & Acceptance Criteria

| Requirement Area | Acceptance Verification Method | Status |
| :--- | :--- | :---: |
| **Multi-Project Bar** | Attach 3 different Git repositories; verify horizontal bar displays all 3 project pills with correct names, branch badges, and dirty counters. Switch between them with 0 lag. | ✅ Verified |
| **Parallel PTYs** | Launch an agent in Project A and run tests in Project B; switch back and forth; verify both sessions run continuously without interruption. | ✅ Verified |
| **Split Terminal Cockpit** | Toggle between Single (`Alt+S`), Horizontal (`Alt+H`), and Vertical (`Alt+V`) split layouts; verify draggable resizing and 1-click pane swapping (`Alt+X`). | ✅ Verified |
| **PTY Execution** | Launch `agy`, `opencode`, `claude`, `aider` in the terminal; verify full ANSI rendering, interactive prompts, and resize behaviors. | ✅ Verified |
| **Live Diff Sync** | Execute a multi-file write command via CLI; verify diff tree and side-by-side view refresh automatically within < 200ms. | ✅ Verified |
| **Intra-Line Diffs** | View modified lines; verify exact token/character changes are highlighted with distinct contrast. | ✅ Verified |
| **Multi-Line Steering** | Drag lines 42–48 in diff view, submit instruction; verify structured bracketed paste prompt packet appears in PTY input and triggers execution. | ✅ Verified |
| **Hunk Staging** | Stage Hunk 1 and discard Hunk 2 of a modified file; commit via UI and verify `git log` reflects only Hunk 1. | ✅ Verified |
| **Memory Footprint** | Monitor process memory during 30 minutes of multi-project agent operation; verify RSS memory remains under 90MB with 3 projects. | ✅ Verified |
