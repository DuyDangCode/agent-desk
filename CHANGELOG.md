# 📜 Changelog

All notable changes to the **AgentDeck** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Targeted enhancements and architectural milestones planned for [Version 2.0.0](docs/versions/version-2-multi-agent-power.md) and [Version 3.0.0](docs/versions/version-3-enterprise-ecosystem.md).

### 🗂️ Multi-Project & Workspace Deck (Version 2.0)
- **Added:** Top Horizontal Project Bar (`ProjectBar.svelte`) supporting multi-folder attachment, project pills with Git branch badges, real-time dirty counters, and active agent badges ([`FR-PROJ-01..08`](docs/user-requirement.md#41-multi-project-management--horizontal-navigation-bar-proj)).
- **Added:** Parallel Workspace State Isolation (`ProjectItem`) retaining independent PTY instances with project root `cwd`, dedicated Myers diff trees, and selected file views per project.
- **Added:** Multi-repository filesystem watcher supervisor in Rust (`src-tauri/src/watcher/` & `server/src/main.rs`) emitting debounced `repo-changed` events with repository path filtering.
- **Added:** Project list and active tab persistence in `localStorage` / `tauri-plugin-store`.
- **Added:** 1-click Folder Picker repository attachment and multi-project quick switcher (`Ctrl+1..9`).

### 🚀 Terminal Cockpit, Split Deck & Multi-PTY Registry (Version 2.0)
- **Added:** Multi-session PTY supervisor registry in Rust (`HashMap<SessionId, PtyProcess>`) with dedicated asynchronous Tokio stdout read channels and isolated event streaming (`pty-output`).
- **Added:** Dynamic multi-pane split terminal layouts (Single `Alt+S`, Side-by-Side Split Horizontal `Alt+H`, and Stacked Split Vertical `Alt+V`) in `TerminalView.svelte`.
- **Added:** Draggable split resizer divider between Pane 1 and Pane 2 with reactive percentage adjustment (`terminalSplitPercent`, 20%–80%) and `localStorage` persistence.
- **Added:** Integrated Pane 1 & Pane 2 header toolbars with pane indicator badges (Blue `PANE 1` & Purple `PANE 2`), active glow pills, direct session switcher dropdowns, 1-click **Swap Panes** (`Alt+X`), **New Session in this Pane**, **Maximize to Single Pane**, and **Close Session**.
- **Added:** Pane 2 Ready empty-state cockpit with 1-click **Launch Shell** and **Launch AGY** buttons directly populating the secondary pane.
- **Added:** Focused pane tracking (`focusedPane: 'primary' | 'secondary'`), active pane tab badges (`P1`, `P2`), and focused routing for `⚡ Quick Launch`, typed agent detection, and floating **Scroll to Bottom** buttons.
- **Added:** Target pane support in `addTerminalSession` (`targetPane?: 'primary' | 'secondary' | 'auto'`) and `launchAgentSession`, preventing secondary pane launches from hijacking primary tabs.
- **Added:** Persistent Canvas Session Pool maintaining all terminal instances and background agents alive across project navigation without DOM teardown or PTY kill.
- **Added:** Smart Bottom Pinning and direct wheel event listener in `TerminalView.svelte` for full-screen curses/Ink TUI CLI agents (Antigravity CLI, OpenCode, Claude Code).
- **Added:** Floating "Scroll to Bottom" quick action button and keyboard shortcuts (`Shift+End`, `Shift+PageDown`, `Cmd+Down`, `Ctrl+Down`).
- **Added:** Global keyboard shortcuts for fast project cycling (`Ctrl+Alt+Left/Right`, `Ctrl+1..9`), terminal tab switching (`Ctrl+Tab`), split layouts (`Alt+H`, `Alt+V`, `Alt+S`), pane swapping (`Alt+X`), and focused pane cycling (`Alt+[` / `Alt+]`).

### 🎨 Theme Engine & Borderless Canvas Harmony (Version 2.0)
- **Enhanced:** Re-engineered color palettes for **Dracula** (`#282a36`), **Nord Ice** (`#2e3440`), **One Dark Pro** (`#282c34`), **GitHub Dark** (`#0d1117`), and **Light** (`#ffffff`) in `theme.svelte.ts` so `--deck-border`, `--deck-card`, and `--deck-surface` perfectly harmonize with the terminal background.
- **Enhanced:** Stripped container `p-2` gutter padding and outer focus rings from terminal slots and pane containers, allowing the xterm canvas to mount edge-to-edge seamlessly.
- **Enhanced:** Eliminated permanent vertical scrollbar track lines on `.xterm-viewport` via `overflow-y: auto !important` and transparent scrollbar tracks.
- **Enhanced:** Added comfortable `8px 12px` inner text padding to `.xterm`, `.xterm-screen`, and `.xterm-link-layer`, seamlessly integrated with `FitAddon` column/row computation and matching background colors.
- **Enhanced:** Direct DOM background synchronization on `st.wrapper`, `st.term.element`, and `.xterm-viewport` during theme initialization and switching.

### ⚡ Advanced Differential Review Engine (Version 2.0)
- **Added:** Token and character-level intra-line diffing via the `similar` crate in Rust, providing fine-grained micro-review of agent code modifications.
- **Added:** Code folding for unchanged lines with expandable context windows (`+5` / `+10` lines).
- **Added:** Diff filtering and search toolbar with flex-wrapping filter chips (Staged, Unstaged, Extension) above the file list.

### 🎯 Prompt Engineering & Steering Templates (Version 2.0)
- **Added:** Built-in "Explain Code & Removal Impact" template for deep code reviews (analyzing function role, design rationale, and removal consequence).
- **Added:** Custom prompt template manager with variable replacement (`{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`, `{{project}}`, `{{branch}}`) and CRUD in `SettingsModal.svelte`.
- **Added:** One-click quick steer preset actions ("Explain function & removal impact", "Refactor & clean", "Add unit tests", "Fix bug & validation", "Optimize performance", "Security hardening") with automatic template switching.
- **Added:** Interactive packet preview and markdown editor modal before terminal injection.

### 🛡️ Smart Git & AI Release Gate (Version 2.0)
- **Added:** Automated conventional commit message synthesis (`feat:`, `fix:`, `refactor:`) from staged hunks via local LLM / OpenAI-compatible API bridge in `CommitPanel.svelte`.
- **Added:** Branch switcher, branch creation modal, and stash manager (`BranchModal.svelte`) integrated into the top status bar.

### 🔧 Bug Fixes & Refinements (Version 2.0)
- **Enhanced:** Upgraded terminal syntax themes for **One Dark Pro**, **Dracula**, and **Nord Ice** with complete 16-color ANSI definitions, official background/foreground contrasts, matching cursor accents, and refined selection highlights.
- **Fixed:** Resolved prompt template variable tag insertion to accurately target the cursor/selection position inside the prompt body textarea.
- **Fixed:** Resolved prompt template creation and modal conflict where clicking "New Template" or "Manage Templates" in Steer modal failed to open the Prompt Templates tab or locked the settings window by implementing direct tab routing (`openSettings('templates')`), auto-selecting newly created templates, and elevating modal overlay z-index (`z-[60]`).
- **Fixed:** Resolved terminal canvas blank/freeze upon navigating between terminal and file changes panels in production builds by adding automated WebGL repaint invalidation (`term.refresh(0, rows-1)`) on visibility change and `ResizeObserver`.
- **Fixed:** Resolved terminal session refresh and agent termination when navigating between attached projects by implementing a persistent session pool canvas and idempotency check in `PtyManager::spawn`.
- **Fixed:** Resolved scroll boundary issue in Antigravity CLI and curses TUIs by adding xterm write render callbacks and direct container wheel listeners.
- **Fixed:** Corrected stacking context and z-index hierarchy across top project bar, activity dock tooltips, and terminal WebGL canvas overlays.
- **Fixed:** Fixed file extension filter chips overflow by enabling flex-wrap layout in `FileList.svelte`.
- **Fixed:** Resolved project attachment handler in `FolderPickerModal.svelte` to properly map to `attachProject`.

### 🔮 Remote Workspaces, Extensibility & Ecosystem (Target: V3.0)
- **Added:** Remote SSH PTY protocol bridge (`russh` / `ssh2`) for controlling CLI agents running on remote instances ([`docs/versions/version-3-enterprise-ecosystem.md`](docs/versions/version-3-enterprise-ecosystem.md)).
- **Added:** Docker container harness (`bollard`) with automatic volume diff mirroring.
- **Added:** Time-travel session recording engine (Asciinema-compatible binary log) with interactive scrub bar (`TimeTravel.svelte`).
- **Added:** Sandboxed WebAssembly (WASM / Extism) plugin runtime.
- **Added:** Native Model Context Protocol (MCP) server bridge allowing connected agents to inspect AgentDeck review state.
- **Added:** Pre-steer and post-edit automated diagnostic hooks (linters and test runners).

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

[Unreleased]: https://github.com/agentdeck/agentdeck/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/agentdeck/agentdeck/releases/tag/v1.0.0
