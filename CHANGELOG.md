# 📜 Changelog

All notable changes to the **AgentDeck** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Targeted enhancements and architectural milestones planned for [Version 3.0.0](docs/versions/version-3-enterprise-ecosystem.md) Phase 2–4:
- **Planned:** Remote LAN/VPN Terminal Access — PWA frontend accessible from any device on the same network via browser (local IP or QR code), connecting to the desktop Axum server's WebSocket PTY streams.
- **Planned:** Pre-steer and post-edit automated diagnostic hooks (linters and test runners).

---

## [3.1.0] - 2026-09-11

### Added
- **Pi Agent & Codex Agent Integration:**
  - Added detection manifest `agent-detection/pi.toml` with blocked permission patterns, idle detection, and working spinners.
  - Added Quick Launch dropdown options for Pi Agent and Codex Agent in terminal session controls.
  - Added process inspection and foreground binary detection for `pi` and `codex`.
  - Added comprehensive test suite `tests/quickLaunchAgents.test.ts` (boundary, collision prevention, buffer evaluation).
- **Process Inspection Architecture:**
  - Extracted shared Linux process inspection logic (`inspect_foreground_process`, `find_agent_in_tree`, `match_agent_binary`) into dedicated `src-tauri/src/process_info.rs` module shared by desktop and server runtimes.
- **Agent Lifecycle & Event Types:**
  - Added `working` event type to `AgentEventType` and `bin/agentdeck-agent-event`.
  - Added OpenCode event listener integration for `tool.execute.before`, `chat.message`, and `session.status`.

### Changed
- **Simplified Status & Notification UI:**
  - Standardized agent blocked state indicator across Header, Sidebar, and StatusBar to "Require input" with a subtle pulse animation.
  - Streamlined desktop notifications to simple format: title `<Agent>` and body `[<Project>] Input required`.
  - Consolidated ANSI stripping by unifying on `stripAnsiCodes` from `agentDetection.ts`.
- **Documentation:**
  - Updated `README.md` with notes on manual one-click refresh button and filesystem watcher synchronization limits.

### Removed
- Removed obsolete `ActivityBar.svelte` and `ProjectBar.svelte` components.
- Removed redundant `agent.md` stub in favor of canonical `AGENT.md`.
- Stripped unused Cargo and npm dependencies (`uuid`, `crossbeam-channel`, `libdbus-sys`, `@tauri-apps/plugin-shell`).

---

## [3.0.0] - 2026-09-08

### Summary
Major release rebranding the platform to **Kestrel** (formerly AgentDeck) and introducing the **Version 3.0 Platform Ecosystem**: Live Web Preview with full Smart Reverse Proxy, Native Webview Window Pop-out, Interactive DOM Element Crosshair Inspector with In-Window Steer Modal, Kernel-Level PTY Process Inspection, Configurable TOML Agent Detection Rules, Global Agent State Machine with Auditory Alerts, Dynamic Session Title Renaming, and Collapsible Project Sessions Tree.

Full specification: [`docs/versions/version-3-enterprise-ecosystem.md`](docs/versions/version-3-enterprise-ecosystem.md)

### Added
- **🦅 Rebranding to Kestrel:**
  - Updated package name to `kestrel`, window product name to `Kestrel`, and identifier to `com.kestrel.app`.
  - Upgraded high-resolution application branding icons (`public/kestrel-icon.png`, `public/icon.png`, `public/favicon.png`, `src-tauri/icons/*`).
- **🌐 Embedded Preview Browser & Smart Reverse Proxy Gateway:**
  - High-performance transparent reverse proxy gateway hosted on port 4020 in the Rust backend (`preview.rs` and Axum handler in `server/src/main.rs`).
  - Seamless forwarding for HTML, JS modules, CSS, asset chunks, and API requests to target local dev servers (Vite, Next.js, Webpack, ports `5173`, `3000`, `8080`).
  - Graceful Dev Server Offline screen with live status polling and auto-reconnect when dev server is offline or restarting.
  - Dual preview modes: embedded responsive iframe canvas (`WebviewPane.svelte`) with viewport presets (Full Desktop with proportional scale down, Tablet 768px, Mobile 375px) and external separate native Tauri Webview window (`agentdeck-preview`).
  - Native preview window management IPC commands: `open_native_preview_window`, `close_native_preview_window`, `is_native_preview_open`, `focus_native_preview_window`, `reload_native_preview_window`, `set_native_preview_inspect`.
- **🎯 Visual Crosshair Element Inspector & In-Window Component Steering:**
  - Automatic injection of `AGENTDECK_INSPECTOR_JS` into previewed applications.
  - Interactive element hover highlight bounding boxes, CSS class inspection, and source tag mapping (`data-component`, `data-source-file`, `data-source-line`).
  - In-window floating Steer popup modal and component picker enabling immediate feedback injection directly from the preview page.
  - Bi-directional IPC endpoints (`/api/component-picked` and `/api/component-steer`) supported across both native Tauri event bus and HTTP server.
  - Formatted component metadata and human instructions streamed directly into agent terminal stdin via bracketed paste (`\x1b[200~` ... `\x1b[201~`).
  - Auto-detection of dev server URLs (`detectDevServerUrl`) scanning terminal stdout for local URLs.
- **🔍 Kernel-Level Process Inspection & Agent Detection Engine:**
  - Direct Linux kernel process inspection (`inspect_foreground_process` in `pty/mod.rs` and `server/src/main.rs`) via `/proc/<pid>/stat`, terminal process group (`tpgid`), and `/proc/<pid>/task/<pid>/children` process tree traversal.
  - Modular, user-extensible TOML rule definitions in `agent-detection/` for **Google Antigravity (`antigravity.toml`)**, **Anthropic Claude Code (`claude.toml`)**, **OpenCode (`opencode.toml`)**, **Aider AI (`aider.toml`)**, **Google Gemini CLI (`gemini.toml`)**, **Cursor (`cursor.toml`)**, and **Codex (`codex.toml`)**.
  - Global Agent State Machine (`agentDetection.ts`) tracking lifecycle transitions: `idle` ➔ `running` ➔ `blocked` (permission required) ➔ `completed`.
  - Auditory attention chime alert (`playAlertSound`) upon agent blocked or waiting for input/confirmation.
  - Dynamic session tab title renaming based on active foreground process (e.g., "Claude Code", "Antigravity (AGY)", "OpenCode", "Neovim", "Cargo", "Python"), strictly preserving user-set custom titles (`isCustomTitle`).
- **🗂️ Collapsible Project Sessions Tree & Terminal Customization:**
  - Collapsible project sessions tree in `Sidebar.svelte` showing attached repositories with nested terminal sessions, direct inline `+` session creation, attention pulse rings, and agent status badges.
  - Terminal Settings Modal allowing on-the-fly configuration of font size, font family, line height, cursor style, and scrollback history.
  - Responsive table layout with horizontal scrolling wrappers for markdown preview.

---

## [2.0.0] - 2026-09-02

### Summary
Major release introducing the **Horizontal Multi-Project Navigation Deck**, parallel workspace state isolation, split terminal grid, intra-line word diffs, prompt template manager, AI commit synthesis, and out-of-band agent input/permission notifications.

Full specification: [`docs/versions/version-2-multi-agent-power.md`](docs/versions/version-2-multi-agent-power.md)

### Added
- **🔔 Coding Agent Input & Permission Notification System:**
  - Reliable two-channel notification system detecting when coding agents (Claude Code, OpenCode, Antigravity CLI) require user input, permission/tool approval, or wait idle.
  - Standalone CLI Event Bridge (`bin/agentdeck-agent-event`) normalizing agent hook payloads and securely posting to local listener over HTTP.
  - Automatic PTY environment variable injection (`AGENTDECK_SESSION_ID`, `AGENTDECK_PROJECT_PATH`, `AGENTDECK_PORT`).
  - Local HTTP `/agent-events` and `/api/agent-events` endpoints with dual runtime parity.
  - Frontend `NotificationManager` (`notifications.ts`) with sliding window deduplication, window focus detection, and native Linux desktop `notify-send`.
  - In-app attention toasts, pulsing tab indicators, and agent integration installer for Claude Code, Google Antigravity, and OpenCode.
- **🗂️ Multi-Project & Workspace Deck:**
  - Top Horizontal Project Bar (`ProjectBar.svelte`) supporting multi-folder attachment, project pills with Git branch badges, dirty counters, and active agent badges.
  - Parallel Workspace State Isolation retaining independent PTY instances, Myers diff trees, and selected file views per project.
  - Multi-repository filesystem watcher supervisor emitting debounced `repo-changed` events with repository path filtering.
  - Project list and active tab persistence in `localStorage`.
- **🚀 Terminal Cockpit, Split Deck & Multi-PTY Registry:**
  - Multi-session PTY supervisor registry in Rust (`HashMap<SessionId, PtyProcess>`) with dedicated asynchronous Tokio stdout read channels.
  - Dynamic multi-pane split terminal layouts (Single `Alt+S`, Side-by-Side Split Horizontal `Alt+H`, and Stacked Split Vertical `Alt+V`) in `TerminalView.svelte`.
  - Draggable split resizer divider between Pane 1 and Pane 2 with reactive percentage adjustment (`terminalSplitPercent`, 20%–80%).
  - Integrated Pane 1 & Pane 2 header toolbars with pane indicator badges, active glow pills, direct session switcher dropdowns, and 1-click pane swapping (`Alt+X`).
  - Focused pane routing (`focusedPane: 'primary' | 'secondary'`) and target pane support in `addTerminalSession`.
  - Persistent Canvas Session Pool maintaining all terminal instances alive across project navigation without DOM teardown.
  - Smart Bottom Pinning and direct wheel event listener for full-screen curses/Ink TUI CLI agents.
- **🎨 Theme Engine & Borderless Canvas Harmony:**
  - Unified color palettes for **Dracula**, **Nord Ice**, **One Dark Pro**, **GitHub Dark**, and **Light** harmonizing with terminal canvas.
  - Borderless canvas mounting with transparent viewport scrollbars and comfortable text padding.
- **⚡ Advanced Differential Review Engine & Markdown Preview:**
  - Rich Markdown Render Preview (`MarkdownPreview.svelte` & `markdown.ts`) with GFM headers, task checklists (`- [x]`), syntax-highlighted code blocks, tables, and XSS sanitization.
  - Token and character-level intra-line diffing via `similar` crate in Rust.
- **🎯 Prompt Engineering & Steering Templates:**
  - Custom prompt template manager with variable replacement (`{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`, `{{project}}`, `{{branch}}`).
  - Built-in "Explain Code & Removal Impact" template and 1-click quick steer preset actions.
- **🛡️ Smart Git, File Operations & AI Release Gate:**
  - Real-time push and pull loading notification overlay with animated spinner toast (`Loader2 animate-spin`).
  - Directory creation ("New Folder") and 1-click Git initialization ("Init Git") directly in the desktop File Explorer.
  - Automated conventional commit message synthesis from staged hunks via LLM API bridge.
  - Remote branch checkout protection preventing invalid direct remote branch checkouts.

---

## [1.0.0] - 2026-08-30

### Summary
The initial production-ready Minimum Viable Product (MVP) of **AgentDeck**—the human-in-the-loop control harness and review workspace for terminal-first AI coding agents (Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, and local runners).

Full specification: [`docs/versions/version-1-mvp.md`](docs/versions/version-1-mvp.md)

### Added
- **Native Embedded PTY Engine:**
  - Integrated `portable-pty` virtual TTY supervisor in Rust supporting POSIX pseudoterminals and Windows ConPTY.
  - Hardware-accelerated GPU terminal canvas powered by `@xterm/xterm`, `@xterm/addon-webgl`, and `@xterm/addon-fit`.
  - Full Unicode 11 character alignment (`@xterm/addon-unicode11`) and mandatory UTF-8 locale environment variable enforcement (`LANG=en_US.UTF-8`, `LC_ALL=en_US.UTF-8`).
  - Multi-session terminal tabs with independent process lifecycles, inline double-click tab renaming, and exit code handling.
  - Real-time agent auto-detection for Antigravity (`agy`), OpenCode (`opencode`), Claude Code (`claude`), Aider (`aider`), Gemini CLI (`gemini`), and Goose (`goose`) with active 🤖 agent badges.
  - Quick Launch dropdown menu for 1-click agent invocation and shell utilities (`git status`, `git diff`, `clear`).
- **Real-Time Git Differential Canvas:**
  - In-process Git engine powered by `git2-rs` (libgit2) eliminating CLI subprocess overhead and dangling lock files.
  - Kernel-level filesystem watcher using `notify-debouncer-mini` with a 200ms debouncing window for instant live diff sync on agent writes.
  - In-memory Myers diff synthesis (`Patch::from_buffers`) fallback for untracked and unstaged working-tree files.
  - Side-by-Side (Split) and Unified (Inline) diff visualization modes with syntax highlighting and line numbers.
  - Collapsible modified file tree with staged, unstaged, and untracked status indicators (M, A, D, U).
- **Multi-Line Drag Steering & Context Injection:**
  - Contiguous multi-line code selection via mouse drag across line numbers or Shift+Click range selection.
  - Floating steering action bar displaying selected line counts and coordinates (e.g., `L12 - L25`).
  - Structured prompt packet synthesis assembling file paths, line ranges, code snippets, and human feedback.
  - Bracketed Paste Mode (`\x1b[200~` ... `\x1b[201~`) stdin streaming with carriage return (`\r`) to prevent premature newline execution in interactive full-screen CLIs.
  - Agent safety gating with 1-click shortcuts (*"Launch Antigravity & Steer"*, *"Launch OpenCode & Steer"*, *"Launch Claude & Steer"*).
- **In-Process Git Staging & Release Gate:**
  - Granular hunk-by-hunk staging and unstaging directly within the diff canvas.
  - Hallucination discard mechanism allowing hunk-level or file-level rollback with confirmation modal.
  - Built-in commit panel (`CommitPanel.svelte`) with staged file summary and native libgit2 commit release gate.
- **Desktop File Explorer & UI Shell:**
  - Native folder browser dialog (`FolderPickerModal.svelte`) with Places sidebar (Home, Workspace, Root, Recent), breadcrumbs, manual path input, and live Git repository detection.
  - Dark, Light, and System OS sync theme engine (`theme.svelte.ts`) with persistent local storage caching.
  - Global Settings Modal (`SettingsModal.svelte` / `Ctrl+,`) with keyboard shortcuts reference and runtime diagnostics.
  - Dual runtime parity: Supports execution via Tauri v2 desktop shell or standalone Axum REST/WebSocket server (`server/`).

### Changed
- Refactored frontend state management to use pure **Svelte 5 Runes** (`$state`, `$derived`, `$effect`) for fine-grained reactivity and zero VDOM overhead.
- Optimized debouncer event filtering to ignore internal runtime folders (`.git`, `node_modules`, `target`, `dist`, `.svelte-kit`).

### Fixed
- Fixed TUI line tearing and box-drawing misalignment in interactive terminal sessions by enforcing `@xterm/addon-unicode11`.
- Resolved multi-line paste execution bugs in Claude Code and Antigravity by wrapping stdin injections in terminal bracketed paste sequences.

---

[Unreleased]: https://github.com/agentdeck/agentdeck/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/agentdeck/agentdeck/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/agentdeck/agentdeck/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/agentdeck/agentdeck/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/agentdeck/agentdeck/releases/tag/v1.0.0
