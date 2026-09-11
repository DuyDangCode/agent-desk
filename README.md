# 🦅 Kestrel

### *The Human-Centric Review Harness & Workspace for CLI Coding Agents*
*(Formerly AgentDeck)*

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-blue.svg?logo=tauri)](https://tauri.app/)
[![Version 3.0.0](https://img.shields.io/badge/Version-3.0.0-purple.svg)](docs/versions/version-3-enterprise-ecosystem.md)
[![Rust Core](https://img.shields.io/badge/Rust-2021-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5%20Runes-ff3e00.svg?logo=svelte)](https://svelte.dev/)
[![Memory Footprint](https://img.shields.io/badge/RAM-%3C%2050MB-emerald.svg)](https://github.com/agentdeck/agentdeck)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 What is Kestrel?

**Kestrel** is an open-source, ultra-lightweight desktop workspace engineered to serve as the **control bridge and review harness** for terminal-first AI coding agents (such as Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, and bespoke local LLM runners).

Rather than delegating software construction entirely to autonomous systems or struggling with detached terminal diffs, **Kestrel puts the human reviewer in the pilot seat**. Built with **Tauri v2**, **Rust**, and **Svelte 5**, it pairs a multi-project horizontal navigation deck with a multi-session embedded native pseudo-terminal (PTY) and an interactive Git differential review canvas.

```
┌─────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
│  Multi-Project Deck     │  ──►  │   Live Diff Review       │  ──►  │   Multi-Line "Steer"     │
│ (Horizontal Project Bar │       │ (Kernel watch & refresh; │       │ (Bracketed paste prompt  │
│  & Parallel PTY Agents) │       │  in-memory Myers diffs)  │       │  injection into stdin)   │
└─────────────────────────┘       └──────────────────────────┘       └──────────────────────────┘
                                                                               │
                                                                               ▼
                                                                 ┌──────────────────────────┐
                                                                 │ Granular Hunk Staging &  │
                                                                 │ Atomic libgit2 Commits   │
                                                                 └──────────────────────────┘
```

---

## ✨ Core Features & Highlights

### 1. 🗂️ Multi-Project Management & Horizontal Navigation Bar
* **Parallel Multi-Folder Attachment:** Attach multiple project repositories or folders into a single desktop workspace.
* **Top Horizontal Project Bar:** Switch between projects instantly with sleek project tab pills displaying folder names, active Git branch badges, real-time dirty file counters, and active agent badges.
* **Isolated Parallel Workspaces:** Each attached project maintains independent terminal PTY sessions (running in that project's `cwd`), separate Git diff trees, and selected file views without cross-project state pollution.
* **1-Click Project Addition & Detach:** Attach new folders with the `+` button or Folder Picker, and detach finished projects with safe confirmation guards.
* **Project Hotkey Navigation:** Instant cycling with `Ctrl+Shift+[` (previous project) and `Ctrl+Shift+]` (next project), or jump directly via `Ctrl+1..9` / `Ctrl+Alt+1..9`.
* **Workspace Persistence:** Automatically saves all attached projects and active project focus to local storage, restoring your workspace upon restart.

### 2. 🚀 Multi-Session Embedded PTY Cockpit & Split Deck
* **Hardware-Accelerated ANSI Terminal:** GPU-rendered terminal via `@xterm/xterm`, WebGL addon, and `@xterm/addon-unicode11` for crisp box-drawing and emoji character widths.
* **Dynamic Split-Terminal Panes:** Toggle seamlessly between Single (`Alt+S`), Side-by-Side Horizontal (`Alt+H`), and Stacked Vertical (`Alt+V`) split layouts with a smooth, draggable resizer divider.
* **Integrated Pane Toolbars:** Dedicated header controls for Pane 1 and Pane 2 featuring instant session switcher dropdowns, 1-click **Swap Panes** (`Alt+X`), **New Session in this Pane**, **Maximize to Single**, and **Close**.
* **Focused Pane Routing & Tab Indicators:** Tabs display `P1` (blue) and `P2` (purple) badges. Quick launch actions, typed command detection, and floating **Scroll to Bottom** buttons dynamically target the focused active pane.
* **Welcoming Pane 2 Ready State:** 1-click **Launch Shell** and **Launch AGY** buttons immediately spawn parallel sessions in secondary panes without hijacking Pane 1.
* **Inline Tab Renaming & Clean Exit Reset:** Double-click any tab title or click the edit icon to rename tabs on the fly. Automatically resets session badges (🤖 to 💻) and restores original titles when agent processes exit.
* **Comprehensive Terminal Hotkeys:** `Ctrl+Shift+T` (new terminal session), `Ctrl+Shift+W` (close focused session with single-session safety), `Ctrl+Shift+P` (focus active terminal), and `Ctrl+Shift+Left/Right` (cycle terminal sessions).
* **Real-Time Agent Auto-Detection:** Automatically identifies when agents (`agy`, `antigravity`, `opencode`, `claude`, `aider`, `gemini`, `goose`) are started via typed commands or output banners, and tags tabs with active agent badges (🤖 vs 💻).
* **⚡ Quick Launch Select:** Instant dropdown menu to launch pre-configured AI coding agents or execute shell utilities (`git status`, `git diff`, `clear`).

### 3. ⚡ Differential Review Canvas & Markdown Preview
* **File Changes & Working-Tree Diff Sync:** File change detection integrated via `notify-debouncer-mini` and `libgit2`. *(Note: The file changes system is debounced and currently does not always sync up in real-time across all environments; use the manual **Refresh** button in the header toolbar to immediately fetch the latest changes).*
* **Manual One-Click Refresh:** Dedicated **Refresh** button (`RefreshCw` / `Refresh Git status and diffs`) in the header toolbar to instantly resync git status, modified file lists, and diff views on demand.
* **Working-Tree & Untracked File Support:** Synthesizes in-memory Myers diffs via `libgit2` and disk buffers, ensuring both tracked, untracked, and newly created files render cleanly.
* **Intra-Line Word Diffs:** Sub-token and character-level diff highlighting for precision micro-review of agent code modifications.
* **Split & Unified Diff Views:** Toggle between Side-by-Side (Split) and Inline (Unified) diff visualizations with syntax highlighting and line numbers.
* **📝 Rich Markdown Render Preview:** 1-click toggle between Raw Diff / Code view and rendered Markdown HTML for all markdown files (`.md`, `.markdown`, `.mdown`, `.mkdn`, `.mdx`). Supports GitHub Flavored Markdown (GFM) headers, bold/italics, strikethrough, interactive task checklists (`- [x]`), syntax-highlighted code blocks, tables with column alignment, and XSS sanitization (`javascript:` / `data:` URI neutralization), plus colored diff additions and deletions.

### 4. 🎯 Multi-Line Drag & Shift+Click Context Steering
* **Mouse Drag & Shift+Click Selection:** Click & drag across line numbers or Shift+Click line ranges to highlight contiguous multi-line code blocks.
* **Floating Steering Toolbar:** Displays selected line count and range (e.g. `L12 - L25`), with 1-click **"Steer Selection"**, **"Copy Snippet"**, and **"Clear Selection"**.
* **Custom Prompt Templates:** Built-in and user-customizable prompt templates with variable replacement (`{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`, `{{project}}`, `{{branch}}`).
* **AI Agent Safety Gate:** Guards against accidental raw terminal code dumps when no AI agent is open, with 1-click launch shortcuts (*"Launch Antigravity & Steer"*, *"Launch OpenCode & Steer"*, *"Launch Claude & Steer"*).
* **🛡️ Stdin Bracketed Paste Mode:** Formats prompts using standard bracketed paste escape sequences (`\x1b[200~` ... `\x1b[201~`) to prevent multi-line newlines from prematurely executing or breaking interactive full-screen CLIs.

### 5. 🗂️ Desktop File Explorer (`FolderPickerModal`)
* **Dual List & Grid Views:** Built-in desktop-grade directory navigator with breadcrumb navigation and direct path editing.
* **Places Sidebar:** Fast access to Home (`~`), Current Workspace, Root (`/`), and Recent Repositories.
* **Git Repository Detection:** Live indicators highlighting Git repositories with one-click opening.
* **📁 Directory Creation ("New Folder"):** Create new directories directly in the browser with modal input, path validation, and directory traversal safeguards.
* **⚡ 1-Click Git Initialization ("Init Git"):** Initialize a Git repository on any plain folder with 1 click and optional automatic attachment to the workspace deck.

### 6. 🎨 Multi-Theme Harmony & Settings Modal
* **5 Cohesive Color Themes:** High-contrast **Black (GitHub Dark)**, clean **White (Light)**, **One Dark Pro**, **Dracula**, and **Nord Ice** palettes.
* **Borderless Canvas & Viewport Synchronization:** Zero-gutter edge-to-edge canvas with unified background colors across `.xterm`, `.xterm-viewport`, `.xterm-screen`, and container slots.
* **Built-in Settings Dialog (`Ctrl+,`):** Accessible settings panel with theme picker, full keyboard shortcuts reference guide, prompt template manager, and runtime diagnostics.

### 7. 🛡️ In-Process Git Staging & AI Release Gate
* **Granular Hunk Control:** Stage or unstage individual diff hunks or entire files directly in the review canvas.
* **Hallucination Discard:** Revert individual hunks or entire modified files with confirmation safety guards.
* **In-Process Commit Engine:** Native atomic commit panel powered by `git2-rs` with optional AI-assisted commit message generation.
* **⏳ Real-Time Push & Pull Loading Notification:** Persistent animated spinner toast (`Loader2 animate-spin`) during active `git push` and `git pull` operations, cleanly transitioning to success or error summaries.
* **Remote Branch Checkout Guard:** Prevents direct checkout of remote branches and guides users to create local tracking branches safely.

### 8. 🌐 Embedded Preview Browser, Smart Reverse Proxy & UI Component Steering (V3)
* **Embedded Webview Pane & Separate Native Window:** Live web application preview (`WebviewPane.svelte`) with dual modes: an embedded iframe canvas with responsive viewports (Full Desktop with proportional scale, Tablet 768px, Mobile 375px) or an external, pop-out native Tauri Webview window (`agentdeck-preview`) with full window management controls.
* **Smart Full Reverse Proxy Gateway:** Built-in transparent reverse proxy engine in the Rust backend on port 4020. Seamlessly forwards HTML, JavaScript modules, CSS, asset chunks, and APIs from local dev servers (Vite, Next.js, Webpack, localhost ports `5173`, `3000`, `8080`).
* **Dev Server Offline Graceful Fallback:** Automatically detects if the target development server is not yet running or offline, rendering an elegant, live-polling status screen with automatic reconnection.
* **Visual Element Crosshair Inspector:** Interactive crosshair tool injecting `AGENTDECK_INSPECTOR_JS` into previewed applications. Highlights hovered DOM elements with bounding boxes and extracts HTML snippets, CSS classes, tag names, computed selectors, and source mapping annotations (`data-component`, `data-source-file`, `data-source-line`).
* **In-Window Steer Modal & Direct Prompt Injection:** Inspect components directly inside the preview and trigger an in-window floating Steer Modal. Formats component metadata and human review instructions into structured prompts, injected atomically into the active agent's PTY stdin via bracketed paste (`\x1b[200~` ... `\x1b[201~`).
* **Auto-Detect Dev Servers:** Scans active terminal output streams using regex patterns to automatically discover running dev server endpoints.

### 9. 🔍 Intelligent Kernel Process Inspection & Agent State Machine (V3)
* **Kernel-Level PTY Process Inspection:** Direct Linux `/proc/<pid>/stat` and task hierarchy inspection (`inspect_foreground_process`) to accurately detect foreground processes, distinguishing active AI agents from shells or utilities (`nvim`, `htop`, `cargo`, `python`).
* **Configurable TOML Agent Detection Rules:** Modular detection rules defined in `agent-detection/` for **Google Antigravity (`antigravity.toml`)**, **Anthropic Claude Code (`claude.toml`)**, **OpenCode (`opencode.toml`)**, **Aider AI (`aider.toml`)**, **Google Gemini CLI (`gemini.toml`)**, **Cursor (`cursor.toml`)**, and **Codex (`codex.toml`)**.
* **Global Agent State Machine:** Tracks real-time agent lifecycle transitions (`idle` ➔ `running` ➔ `blocked` ➔ `completed`).
* **Auditory Attention Chimes & Visual Alerts:** Automatically triggers an alert sound (`playAlertSound`) and pulses attention badges across session tabs, sidebar tree, and status bar when an agent requires human permission or confirmation.
* **Dynamic Tab Title Renaming:** Intelligently renames terminal session tabs to the active agent or tool name (e.g. "Claude Code", "Antigravity (AGY)", "OpenCode", "Neovim") while strictly respecting user-set custom titles.

### 10. 🗂️ Collapsible Project Sessions Tree & Terminal Customization (V3)
* **Sidebar Project Sessions Tree:** Integrated project navigation tree displaying attached repositories with collapsible session lists, direct "Add Terminal" buttons per project, and real-time agent state indicators.
* **Terminal Settings Modal:** Accessible terminal configuration dialog allowing on-the-fly customization of font size, font family, line height, cursor style, and scrollback buffer limit.

### 11. 🪶 Ultra-Low Resource Footprint
* Idle RAM consumption **< 50MB** (single project) and **< 90MB** (3 parallel projects) with cold startup **< 400ms**—freeing up system resources for local agent inference and compilation.

---

## 🛠️ Technology Stack

| Layer | Component | Version / Library | Purpose |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | Tauri v2 | `tauri ^2.0` | Native OS bridge, secure IPC, low memory footprint |
| **Backend Core** | Rust | Edition 2021 | High-performance asynchronous systems runtime |
| **PTY Engine** | `portable-pty` | `portable-pty ^0.8` | Cross-platform virtual TTY master/slave handling & non-blocking I/O |
| **Git Operations**| `git2-rs` | `git2 ^0.19` (libgit2) | In-memory tree parsing, hunk diffing, staging & committing |
| **File Watcher** | `notify-debouncer-mini` | `notify-debouncer-mini ^0.4` | Kernel-level filesystem event debouncing across multiple attached repos |
| **Frontend UI** | Svelte 5 + Vite | Svelte 5 (Runes) | Fine-grained reactivity, zero-VDOM overhead |
| **Terminal** | `@xterm/xterm` | `xterm ^5.5` + WebGL + Unicode11 | Hardware-accelerated ANSI terminal rendering |
| **Styling** | Tailwind CSS | `tailwindcss ^3.4` | Clean, high-contrast dark layout |

---

## 🚀 Quick Start & Installation

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+) & `npm` / `pnpm`
* [Rust & Cargo](https://rustup.rs/) (v1.75+)
* Standard C build tools (`gcc` / `clang` / `pkg-config`)

### 1. Clone the repository
```bash
git clone https://github.com/agentdeck/agentdeck.git
cd agent_deck
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in Development Mode
You can run Kestrel either as a native Tauri desktop app or via the dual web harness:

```bash
# Option A: Run Native Tauri Desktop App
npm run tauri dev

# Option B: Run Standalone Backend Server + Frontend Dev
npm run server:dev  # In Terminal 1 (Rust server on http://127.0.0.1:4020)
npm run dev         # In Terminal 2 (Vite frontend on http://localhost:1420)
```

### 4. Build for Production
```bash
# Build desktop binary (macOS .dmg/app, Linux .deb/AppImage, Windows .msi/exe)
npm run tauri build
```

---

## 🕹️ Human-in-the-Loop Workflow

1. **Attach Projects:** Click the **`+`** button on the horizontal project bar or **Browse** to attach one or more local Git repositories into the deck.
2. **Launch CLI Agents in Parallel:** Click **⚡ Quick Launch** or type agent commands in project terminals:
   ```bash
   agy
   # or
   opencode
   # or
   claude
   # or
   aider --model gpt-4o
   ```
3. **Switch Between Projects & Refresh Diffs:** Click project pills on the horizontal bar or use `Ctrl+Alt+Left/Right` to inspect diffs across multiple services. If file changes made by background agents do not immediately appear in real-time, click the **Refresh** button (`⟳`) in the header toolbar to immediately reload the working tree and diff canvas.
4. **Drag & Steer:** Spot a bug or hallucination? **Click & drag across lines** (or Shift+Click), click **Steer Selection**, type your instruction, and press `Ctrl+Enter` / `Cmd+Enter`.
5. **Stage & Commit:** Verify good changes, discard hallucinations, and commit natively per project with libgit2.

---

## ⚠️ Known Limitations & Current Status

* **Real-Time File Changes Synchronization:** The automated filesystem watcher (`notify-debouncer-mini`) currently does not always sync up file modifications in real-time across all platforms and environments (such as under Linux inotify watch limits or rapid agent write bursts).
  * **Workaround:** Click the **Refresh** button (`⟳`) in the top header navigation bar (`Refresh Git status and diffs`) to instantly reload the working tree, modified file list, and diff canvas.
  * Low-latency real-time watcher optimizations and polling fallbacks are actively tracked for upcoming releases.

---

## 🗺️ Product Roadmap

* **[Version 1.0 (MVP)](docs/versions/version-1-mvp.md)** - ✅ Core multi-session harness, real-time live diffs, multi-line drag steering, file explorer, agent identification, hunk staging & commit release gate.
* **[Version 2.0 (Multi-Project & Multi-Agent Power)](docs/versions/version-2-multi-agent-power.md)** - ✅ Horizontal project navigation bar, parallel multi-project workspaces, intra-line word diffs, prompt template manager, AI commit message synthesis.
* **[Version 3.0 (Platform & Extensibility)](docs/versions/version-3-enterprise-ecosystem.md)** - 🚀 Embedded Preview Browser & UI Component Steering (Implemented), Kernel Process Inspection & Agent Detection (Implemented), Remote LAN/VPN terminal access (PWA + QR code), WASM plugin system, MCP server bridge.

---

## 📂 Project Structure

```
agent_deck/
├── agent-detection/         # Configurable agent detection rules (*.toml)
│   ├── antigravity.toml     # Google Antigravity (AGY) match rules
│   ├── claude.toml          # Anthropic Claude Code match rules
│   ├── codex.toml           # OpenAI Codex CLI match rules
│   ├── cursor.toml          # Cursor Agent match rules
│   ├── default.toml         # Generic fallback shell & agent rules
│   ├── gemini.toml          # Google Gemini CLI match rules
│   └── opencode.toml        # OpenCode CLI match rules
├── src-tauri/               # Tauri v2 Desktop Backend
│   ├── src/
│   │   ├── git/             # libgit2 in-process Git operations, Myers fallback diff engine
│   │   ├── pty/             # portable-pty virtual TTY supervisor & process inspection
│   │   ├── watcher/         # notify-debouncer-mini kernel filesystem watcher
│   │   ├── preview.rs       # Smart reverse proxy & dev server inspector injector
│   │   ├── commands.rs      # Tauri IPC command declarations
│   │   ├── lib.rs           # Tauri app runner & plugin initialization
│   │   └── main.rs          # Desktop executable entrypoint
│   ├── Cargo.toml           # Rust desktop crate dependencies (v3.0.0)
│   └── tauri.conf.json      # Tauri v2 window & capability configuration (v3.0.0)
├── server/                  # Pure Rust Standalone Server Bridge (REST + WS)
│   ├── src/main.rs          # Axum 0.7 server with PTY, Git, FS, Preview Proxy & Event endpoints
│   └── Cargo.toml           # Server dependencies (v3.0.0)
├── src/                     # Svelte 5 Frontend
│   ├── lib/
│   │   ├── components/      # UI components (Header, Sidebar, TerminalView, WebviewPane, FileList, DiffView, MarkdownPreview, SteerModal, CommitPanel, FolderPickerModal)
│   │   ├── stores/          # Svelte 5 Runes state store (appState.svelte.ts, theme.svelte.ts)
│   │   ├── types/           # TypeScript interfaces & data models
│   │   └── utils/           # IPC bridge (tauri.ts), agent detection (agentDetection.ts), webview steering (webviewSteer.ts)
│   ├── App.svelte           # Main workspace layout shell & resizable split pane
│   ├── app.css              # Global styles & Tailwind CSS directives
│   └── main.ts              # Frontend bootstrap
├── tests/                   # Automated unit & boundary test suites
├── docs/                    # Architectural specs, URD, and version roadmaps
└── package.json             # Frontend dependencies & scripts (v3.0.0)
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
