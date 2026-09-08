# 🏛️ AGENTDECK — COMPREHENSIVE TECHNICAL ARCHITECTURE
### *System Blueprint, Core Subsystems & Multi-Phase Architectural Evolution*

---

## 1. Executive Architectural Overview

**AgentDeck** is engineered as a high-performance, ultra-low memory desktop control harness for terminal-first AI coding agents (Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, and local LLM runners).

The architecture bridges the gap between **autonomous multi-file CLI agent execution** and **human-in-the-loop verification**, coupling an embedded pseudo-terminal (PTY) supervisor with an in-process Git differential engine and a horizontal multi-project navigation deck.

### Architectural Invariants:
1. **Zero-Latency Terminal Isolation:** Terminal PTY I/O streaming is processed on dedicated OS threads, fully decoupled from Git diff synthesis, filesystem debouncers, and UI rendering frames.
2. **Native In-Process Git (`libgit2`):** Git diff parsing, index tree modifications, and commits execute in-process via `git2-rs`, completely eliminating child process fork overhead and dangling `.git/index.lock` contention.
3. **Dual Runtime Parity:** The Svelte 5 frontend functions identically whether hosted inside the **Tauri v2** native desktop Webview shell or served over HTTP/WebSocket via the standalone **Rust Backend Server** (`server/`).
4. **Strict Memory Boundaries:** Idle memory footprint must remain `< 50MB` for single-project MVP (V1) and `< 90MB` under 3 concurrent multi-project PTY workloads (V2).

---

## 2. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Frontend["Human Control Canvas (Svelte 5 / Webview)"]
        direction TB
        ProjectBar["Horizontal Project Bar (ProjectBar.svelte)"]
        Header["Workspace Header & Git Branch (Header.svelte)"]
        ActivityBar["Activity Dock (ActivityBar.svelte)"]
        
        subgraph Canvas["Workspace Panes Canvas"]
            TermView["Terminal Cockpit (xterm.js + WebGL)"]
            FileTree["Modified Files Tree (FileList.svelte)"]
            DiffCanvas["Real-Time Diff Viewer (DiffView.svelte)"]
            MarkdownCanvas["Markdown Preview (MarkdownPreview.svelte)"]
        end
        
        subgraph Modals["Steering & Gate Modals"]
            SteerDlg["Context Steer Modal (SteerModal.svelte)"]
            CommitDlg["Commit Panel (CommitPanel.svelte)"]
            FolderDlg["Desktop File Explorer (FolderPickerModal.svelte)"]
        end
        
        AppStore["Svelte 5 Runes State Store (appState.svelte.ts)"]
        IPCBridge["Universal IPC Bridge (tauri.ts)"]
    end

    subgraph NativeBackend["Native Core Runtime (Rust / Tauri v2 / Axum)"]
        direction TB
        
        subgraph PTYSub["PTY Supervisor (portable-pty)"]
            PtyMaster["Master PTY Controller"]
            PtyReader["Async Stdout Reader Thread"]
            PtyWriter["Stdin Streamer (Bracketed Paste)"]
        end
        
        subgraph GitSub["Git Differential Engine (git2-rs)"]
            TreeParser["In-Memory Tree Parser"]
            MyersFallback["Myers In-Memory Buffer Fallback"]
            IntraLine["Intra-Line Token Engine (similar)"]
            StagingEngine["Index Staging & Commit Release"]
        end
        
        subgraph WatcherSub["Filesystem Supervisor (notify-debouncer-mini)"]
            KernelWatcher["Kernel Watcher (inotify / kqueue / IOCP)"]
            DebouncerWindow["200ms Event Debouncer"]
            PathFilter["Path Ignore Engine (.git/target/node_modules)"]
        end
        
        subgraph StorageSub["State & Persistence Layer"]
            ConfigStore["Config & Template Store (tauri-plugin-store)"]
        end
        
        IPC_Handler["Tauri Command Handlers / Axum Router"]
    end

    subgraph ExternalAgents["Terminal-First Coding Agents"]
        direction LR
        AGY["Antigravity (AGY)"]
        OpenCode["OpenCode"]
        Claude["Claude Code"]
        Aider["Aider"]
        CustomCLI["Bash / Zsh / Local LLM"]
    end

    %% Wiring
    ProjectBar <--> AppStore
    TermView <--> AppStore
    DiffCanvas <--> AppStore
    AppStore <--> IPCBridge

    IPCBridge <== "Tauri IPC / WebSocket" ==> IPC_Handler
    
    IPC_Handler <--> PtyMaster
    PtyMaster <== "POSIX TTY / ConPTY" ==> ExternalAgents
    PtyReader -. "pty-output event" .-> IPCBridge
    
    IPC_Handler <--> TreeParser
    IPC_Handler <--> StagingEngine
    
    KernelWatcher ==> DebouncerWindow ==> PathFilter
    PathFilter -. "repo-changed event" .-> IPCBridge
```

---

## 3. Core Subsystems Breakdown

### 3.1. PTY Supervisor & Terminal Cockpit (`portable-pty` + `@xterm/xterm`)

The PTY Supervisor manages the lifecycle, stream multiplexing, and terminal rendering of system shells and AI coding agents.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                 PTY LIFECYCLE PIPELINE                                │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Spawn Request: Tauri Command `create_pty(session_id, cwd, shell)`                  │
│ 2. System TTY Allocation: `portable_pty::native_pty_system().openpty(PtySize)`       │
│ 3. Child Command Spawn: Fork process with `LANG=en_US.UTF-8` & `LC_ALL=en_US.UTF-8`   │
│ 4. Non-Blocking Reader Loop: Dedicated OS thread polling master PTY buffer            │
│ 5. Event Stream: Chunks emitted via `app.emit("pty-output:{session_id}", data)`       │
│ 6. Frontend Render: `@xterm/xterm` WebGL canvas consumes UTF-8 with Unicode 11 addon  │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

#### Evolution Across Milestones:
* **Version 1.0 (MVP) — Single/Multi-Session PTY:**
  * Uses `portable-pty` with isolated master/slave pairs.
  * Async reading loop on a background thread emitting to Tauri event channels.
  * WebGL GPU-accelerated rendering in `@xterm/xterm` with `@xterm/addon-unicode11` and `@xterm/addon-fit`.
  * Real-time agent detection scanning command invocations and stdout banners (`agy`, `antigravity`, `opencode`, `claude`, `aider`, `gemini`, `goose`).
* **Version 2.0 (Multi-Agent Control) — Multi-PTY Registry, Slot-Based Split Deck & Theme Synchronization:**
  * **Session Registry:** `Arc<Mutex<HashMap<SessionId, PtyProcess>>>` managed via Tokio channels with thread-safe lifecycle control and spawn idempotency.
  * **Unified Slot-Based DOM Mounting & Pool:** Each terminal session owns a persistent `HTMLDivElement` wrapper. Visible sessions are mounted directly into DOM slot containers (`pane1SlotElement`, `pane2SlotElement`), while background sessions reside in an offscreen zero-overhead pool (`hiddenPoolElement`), preserving 100% of WebGL canvas buffers and PTY output streaming across navigation.
  * **Interactive Multi-Pane Split Cockpit:** `TerminalView.svelte` supporting Single Pane, Side-by-Side Split Horizontal, and Stacked Split Vertical with draggable reactive resizing (`terminalSplitPercent`, 20%–80%).
  * **Integrated Pane Toolbars & State Isolation:** Independent toolbars for Pane 1 and Pane 2 with session switcher dropdowns, 1-click **Swap Panes** (`Alt+X`), **New Session in this Pane**, **Maximize to Single**, and **Close Session**.
  * **Targeted Session Injection & Steering:** `targetPane` routing (`'primary' | 'secondary' | 'auto'`) ensures prompt injection, Quick Launch, and agent spawns target the focused active pane without hijacking sibling panes.
  * **Cohesive Theme Engine & Viewport Harmony:** Synchronizes `--deck-border`, `--deck-card`, and `--deck-surface` palettes across Dracula, Nord, OneDark, GitHub Dark, and Light themes, with borderless canvas mounting, transparent viewport scrollbar tracks, and internal `8px 12px` text padding.
  * **Terminal Scroll Fidelity & TUI Compatibility:** Smart bottom pinning via `term.write` completion callbacks, direct container `wheel` listeners, and floating "Scroll to Bottom" buttons for seamless navigation in curses/Ink CLI agents (Antigravity CLI).
  * **Comprehensive Navigation Hotkeys:** Project cycling (`Ctrl+Shift+[` / `Ctrl+Shift+]`), terminal session creation/close/focus (`Ctrl+Shift+T`, `Ctrl+Shift+W`, `Ctrl+Shift+P`), and session cycling (`Ctrl+Shift+Left/Right`).
  * **Agent Exit Detection & Lifecycle Clean-Up:** Automatically resets tab session status badges (🤖 to 💻) and restores shell titles when agent subprocesses exit.
  * **Scoped Project Working Directory:** PTYs inherit their specific attached project directory (`cwd = project.path`).
* **Version 3.0 (Platform & Extensibility) — Remote LAN/VPN Terminal Access:**
  * **PWA Remote Terminal:** The desktop Axum HTTP/WebSocket server (already running on port `4020`) streams PTY sessions to any device on the same Wi-Fi/LAN/VPN. The Svelte frontend is packaged as a Progressive Web App (PWA) accessible from phone/tablet browsers via local IP address or QR code scan, rendering a remote `@xterm/xterm` canvas connected to live PTY sessions.

---

### 3.2. Git & Differential Review Engine (`git2-rs` + In-Memory Myers Fallback)

The Differential Review Engine is designed to deliver real-time spatial awareness without spawning child processes.

```mermaid
sequenceDiagram
    autonumber
    participant Agent as CLI Coding Agent
    participant Disk as Local Filesystem
    participant Watcher as Debounced Watcher (Rust)
    participant Git as libgit2 Engine (Rust)
    participant UI as Diff Canvas (Svelte 5)

    Agent->>Disk: Writes modified files (batch write burst)
    Disk-->>Watcher: Kernel event triggered (inotify/kqueue)
    Watcher->>Watcher: Debounce window (200ms aggregation)
    Watcher->>Watcher: Filter ignored paths (.git, node_modules, target)
    Watcher-->>UI: Emit `repo-changed` payload with `repo_path`
    UI->>Git: Invoke `get_repository_diffs(repo_path)`
    Git->>Git: Parse Git HEAD & Index tree
    alt File is untracked or unstaged
        Git->>Git: Myers fallback buffer diff (`git2::Patch::from_buffers`)
    else File is tracked & staged
        Git->>Git: Tree-to-index / index-to-workdir diff
    end
    Git-->>UI: Return structured `RepoDiffData` JSON
    UI->>UI: Update file list & active side-by-side / unified diff canvas
```

#### Evolution Across Milestones:
* **Version 1.0 (MVP) — In-Process Myers Fallback Diffing:**
  * Scans status via `repo.statuses()`.
  * Computes line-by-line diffs using `git2::Patch::from_buffers` for newly created or untracked files.
  * Hunk-level staging (`stage_hunk`) and uncommitted rollback (`discard_hunk`, `discard_file`).
  * Direct commit release gate executing `repo.commit(...)` with signature verification.
* **Version 2.0 (Precision Review & Media Canvas) — Intra-Line Diffing, Markdown Engine & Safe Operations:**
  * Integrates the `similar` crate to compute sub-line token changes within modified lines.
  * **Rich Markdown Render Preview:** Integrated GFM compiler and renderer (`MarkdownPreview.svelte`, `markdown.ts`) for `.md`, `.markdown`, and `.mdx` files with syntax-highlighted code blocks, interactive task checklists, tables, XSS sanitization, and side-by-side/unified diff line annotations.
  * **File Explorer Workspace Operations:** Direct folder creation (`create_directory`) and 1-click Git initialization (`init_repository`) with path sanitization and directory traversal guards.
  * **Persistent Network Push/Pull Feedback:** Indefinite loading toast notification (`toastType: 'loading'`) with animated spinning indicator during active Git push/pull, transitioning to completion or error summaries.
  * **Remote Branch Protection:** Guard against direct remote branch checkout, guiding users to create local branches.
  * Multi-repository diff routing for parallel attached projects.
  * Multi-extension filter chips with flex-wrapping and file search filter.

---

### 3.3. Human Steering & Context Injection Pipeline

The Human Steering loop translates visual review feedback into structured CLI prompts injected directly into the agent's interactive session.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           STEERING CONTEXT PACKET INJECTION                           │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Developer Selection: Mouse drag or Shift+Click across lines (e.g. Lines 42–48)     │
│ 2. Context Synthesis: Structured prompt packet generated in memory:                   │
│    [Human Review Feedback] File: src/auth.ts (Lines 42-48)                            │
│    Snippet:                                                                           │
│    + const token = req.headers.authorization;                                         │
│    + verifyToken(token);                                                              │
│    Feedback / Instruction: Validate JWT expiry before signature check.                │
│                                                                                       │
│ 3. 🛡️ Stdin Bracketed Paste Mode Encoding:                                            │
│    `\x1b[200~` + prompt_packet + `\x1b[201~` + `\r`                                   │
│                                                                                       │
│ 4. Non-Blocking PTY Injection: Streamed into `portable_pty` master stdin              │
│ 5. Safe Execution: Agent receives full block atomically without premature \n triggers │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

#### Evolution Across Milestones:
* **Version 1.0 (MVP) — Multi-Line Selection & Bracketed Paste:**
  * Mouse drag and Shift+Click line range highlighting with floating action bar.
  * Agent safety gating: Warns before injecting into raw shells; provides 1-click agent launch shortcuts (*"Launch Antigravity & Steer"*).
  * Bracketed paste mode framing (`\x1b[200~` ... `\x1b[201~`) with `\r`.
* **Version 2.0 (Prompt Intelligence) — Templates & Context Presets:**
  * Reusable steering template engine (`{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`, `{{project}}`, `{{branch}}`).
  * Built-in **"Explain Code & Removal Impact"** template for deep architectural inquiries (function purpose, design rationale, and removal consequences).
  * 1-click context presets (*"Explain function & removal impact"*, *"Refactor & clean"*, *"Add unit tests"*, *"Fix bug & validation"*, *"Optimize performance"*, *"Security hardening"*).
  * Full-featured markdown preview and edit modal before terminal transmission.
* **Version 3.0 (Automated Governance) — Hooks & Model Context Protocol (MCP):**
  * **Automated Diagnostic Hooks:** Pre-steer linters (`eslint`, `cargo check`, `pytest`) automatically attach diagnostic error messages to steering prompts.
  * **MCP Server Bridge:** AgentDeck acts as an MCP host/tool provider, allowing connected agents to inspect live diff state and file trees directly.

---

### 3.4. Multi-Project Management & State Isolation Layer

The multi-project management subsystem allows developers to attach, monitor, and steer multiple codebases concurrently.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PARALLEL MULTI-PROJECT STATE ISOLATION                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ AppState (Root Svelte 5 Store)                                                         │
│ ├── projects: ProjectItem[]                                                            │
│ │   ├── [Project A: /projects/client-ui]                                               │
│ │   │   ├── repoInfo: { branch: "main", dirty: 3, staged: 1 }                          │
│ │   │   ├── files: FileDiff[] (Scoped to Project A)                                    │
│ │   │   ├── sessions: PtySession[] (CWD = /projects/client-ui)                         │
│ │   │   └── selectedFilePath: "src/App.svelte"                                         │
│ │   │                                                                                  │
│ │   └── [Project B: /projects/server-api]                                              │
│ │       ├── repoInfo: { branch: "feat/jwt", dirty: 0, staged: 0 }                      │
│ │       ├── files: FileDiff[] (Scoped to Project B)                                    │
│ │       ├── sessions: PtySession[] (CWD = /projects/server-api)                        │
│ │       └── selectedFilePath: null                                                     │
│ │                                                                                      │
│ └── activeProjectId: "project-b" ◄── Instant zero-reload context switch                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Key Mechanisms:
* **Parallel Execution:** PTY terminals, agent processes, and filesystem watchers in Project A continue executing in the background when the user switches focus to Project B.
* **Horizontal Project Bar (`ProjectBar.svelte`):** Sleek top tab bar rendering project folder names, active Git branch badges, real-time dirty file counters, active agent badges, and close (`x`) buttons.
* **Local Storage Persistence:** The project list and last active project index are stored in `localStorage` (`agentdeck_projects`), restoring workspaces automatically on startup.
---

### 3.5. Out-of-Band Agent Event Bridge & Notification System

The Agent Event Bridge enables coding agents (Claude Code, OpenCode, Antigravity CLI, etc.) to notify AgentDeck whenever human interaction is required (input prompts, permission dialogs, idle waits).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     OUT-OF-BAND AGENT ATTENTION EVENT PIPELINE                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. CLI Agent Attention Trigger: Agent hook triggers notification command               │
│    `node bin/agentdeck-agent-event --agent claude --type permission_required ...`       │
│                                                                                        │
│ 2. Dual Runtime HTTP Listener: Ingests normalized event at `POST /agent-events`        │
│    - Tauri Desktop Mode: Embedded hyper/tokio listener on `127.0.0.1:4020`             │
│    - Headless Server Mode: Standalone Axum router on `127.0.0.1:4020`                  │
│                                                                                        │
│ 3. Event Fanout: Dispatches Tauri Event `"agent-event"` / WebSocket `/ws/events`       │
│                                                                                        │
│ 4. Frontend Notification Manager (`NotificationManager` in `notifications.ts`):        │
│    - Sliding Window Deduplication (5-second debounce by agent, session/cwd, type)      │
│    - Session Resolver: Maps event to ProjectItem and PtySession deterministically       │
│    - Attention Badge: Displays amber ring & bouncing indicator on terminal tab         │
│    - Interactive Toast: Renders action button ("View Session") navigating to session   │
│                                                                                        │
│ 5. Native Desktop Notification: Invokes OS native `notify-send` when unfocused/hidden  │
│ 6. Automatic Clean-up: Cleared when user types into terminal or switches to session    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Key Components:
* **Standalone CLI Bridge (`bin/agentdeck-agent-event`):** Zero-overhead ESM Node CLI script that parses stdin JSON/CLI flags, reads injected session environment (`AGENTDECK_SESSION_ID`, `AGENTDECK_PROJECT_PATH`, `AGENTDECK_PORT`), and posts out-of-band to `http://127.0.0.1:${port}/agent-events` with a 2.5s timeout.
* **PTY Environment Injection:** Child PTY processes automatically receive `AGENTDECK_SESSION_ID`, `AGENTDECK_PROJECT_PATH`, and `AGENTDECK_PORT` in their environment upon spawn.
* **Dual Runtime Parity:** Tauri v2 native desktop shell and standalone Axum server both expose identical `/agent-events` and `/api/agent-events` endpoints and bridge them to the frontend.
* **Agent Integration Manager (`IntegrationManager` in `src-tauri/src/integrations`):** Safe, atomic detection, installation, and uninstallation of Claude Code hooks in `~/.claude/settings.json`, preserving existing user config and backing up before write.
* **In-App & Native Notifications:** Shows responsive toast with 1-click navigation to the waiting terminal session, and issues native Linux desktop notifications via `notify-send` when the app is unfocused or minimized.

---

### 3.6. Embedded Webview Preview & Direct Component Steering Subsystem (`WebviewPane.svelte` + `webviewSteer.ts`)

The Webview Preview Subsystem provides real-time frontend verification and visual-to-agent prompt synthesis.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   EMBEDDED PREVIEW BROWSER & COMPONENT STEERING                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Dev Server Detection: Scans terminal output for local URLs (Vite/Next.js/ports)     │
│ 2. Embedded Preview Canvas (`WebviewPane.svelte`):                                     │
│    - Responsive Viewports: Full Desktop, Tablet (768px), Mobile (375px)                │
│    - Normalization: Ports (`3000`), hosts (`localhost:5173`) converted to valid URLs  │
│ 3. Interactive Crosshair Inspector (`isInspectMode`):                                  │
│    - Injects inspection script into preview iframe                                     │
│    - Live hover highlighting and element bounding box selection                        │
│    - Context extraction: HTML snippet, CSS classes, tag name, selector,                │
│      and source annotations (`data-component`, `data-source-file`, `data-source-line`) │
│ 4. Structured Prompt Synthesis (`webviewSteer.ts`):                                    │
│    - Formats UI component context + developer review instruction                       │
│ 5. Bracketed Paste Injection: Direct atomic stream into agent PTY session (`\x1b[200~`)│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Key Components:
* **Embedded Webview Pane (`WebviewPane.svelte`):** Toggleable canvas tab and split mode with URL navigation, reload button, device viewport switching, and session target picker.
* **Dev Server Auto-Detector (`detectDevServerUrl` in `webviewSteer.ts`):** Automatically extracts server endpoints (e.g. `http://localhost:5173/`, `http://localhost:3000/`) from terminal logs.
* **DOM Inspector & Prompt Synthesizer (`formatComponentSteerPrompt`, `generateInspectorScript`):** Bridges browser DOM inspection directly into actionable terminal prompts.

---

## 4. Architectural Evolution Matrix (V1 ➔ V2 ➔ V3)

| Architectural Dimension | Version 1.0 (MVP) — Baseline | Version 2.0 — Implemented & Verified | Version 3.0 — Platform & Extensibility |
| :--- | :--- | :--- | :--- |
| **Workspace Scope** | Single active Git repository | **Multi-Project Deck** (Horizontal navigation bar, parallel state isolation, 1-click attach) | **Remote LAN/VPN Access** (PWA frontend accessible from any device on same network via QR code) |
| **Process Boundaries** | Local desktop process + child PTY shells | Local desktop process + concurrent PTY registry map with session persistence | Local desktop + Axum HTTP/WS server streaming PTY to remote PWA clients + WASM plugin sandbox |
| **PTY Concurrency** | Multi-session tabs (single active CWD) | **Multi-PTY Registry & Canvas Pool** (Tokio channels, isolated CWD per project, persistent DOM pool) | **Remote WebSocket PTY Streaming** (Axum WS server → remote `@xterm/xterm` canvas on phone/tablet) |
| **Terminal Canvas** | `@xterm/xterm` + WebGL + Unicode 11 | Split layout deck (single, horizontal split, vertical split) + Smart TUI bottom pinning | PWA remote terminal canvas with same xterm rendering on mobile browsers |
| **Visual Review & Preview** | Side-by-side & unified git diffs | Rich Markdown render preview (`.md`, `.mdx`) | **Embedded Preview Browser** (`WebviewPane`) with responsive viewports & DOM crosshair inspector |
| **Git Diff Engine** | In-process `git2` + Myers buffer fallback | `similar` token intra-line diffing + flex filter chips + AI commit synth | Same engine exposed via Axum REST API for remote PWA clients |
| **Context Steering** | Drag selection + Bracketed Paste injection | Reusable prompt templates, "Explain Code" template & 1-click presets | **Direct UI Component Steering** + Automated pre/post linter hooks + Native MCP server |
| **State Persistence** | `localStorage` (Theme & UI flags) | `localStorage` (Projects, templates, LLM settings, active tabs) | PWA service worker offline cache + `localStorage` on remote devices |
| **Network Protocols** | Tauri IPC / Local WebSocket (Axum) | Tauri IPC / Local WebSocket (Axum) + `/agent-events` HTTP listener | LAN WebSocket PTY streaming, MCP JSON-RPC, WASM Extism |
| **Primary Rust Crates** | `portable-pty`, `git2`, `notify-debouncer-mini` | + `similar`, `tokio` channels | + `extism`, `mcp-sdk` |
| **Memory Target** | **< 50MB RAM** (Idle baseline) | **< 90MB RAM** (3 active projects & PTYs) | **< 120MB RAM** (With PWA server & plugins) |
| **Cold Startup Time** | **< 400ms** | **< 500ms** | **< 600ms** |

---

## 5. Security, Sandboxing & Invariant Guardrails

1. **Local-First Boundary:** All code differential analysis and PTY interactions occur exclusively on the local machine with zero external cloud telemetry or unauthorized network egress.
2. **Safe Terminal Injections:** All steering feedback payloads injected into PTY stdin must enforce Bracketed Paste framing (`\x1b[200~` ... `\x1b[201~`) to eliminate terminal escape sequence injection attacks or accidental newline command executions.
3. **In-Process Git Concurrency:** Repository index operations in `git2-rs` must be protected by thread-safe Mutexes and write locks released immediately after index serialization (`index.write()`).
4. **Filesystem Event Isolation:** File watchers must aggressively filter system-generated build directories (`.git/`, `node_modules/`, `target/`, `.svelte-kit/`, `dist/`) to prevent infinite diff re-render loops.
