# ⚡ AgentDeck

### *The Human-Centric Review Harness & Workspace for CLI Coding Agents*

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-blue.svg?logo=tauri)](https://tauri.app/)
[![Rust Core](https://img.shields.io/badge/Rust-2021-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5%20Runes-ff3e00.svg?logo=svelte)](https://svelte.dev/)
[![Memory Footprint](https://img.shields.io/badge/RAM-%3C%2050MB-emerald.svg)](https://github.com/agentdeck/agentdeck)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 What is AgentDeck?

**AgentDeck** is an open-source, ultra-lightweight desktop workspace engineered to serve as the **control bridge and review harness** for terminal-first AI coding agents (such as Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, and bespoke local LLM runners).

Rather than delegating software construction entirely to autonomous systems or struggling with detached terminal diffs, **AgentDeck puts the human reviewer in the pilot seat**. Built with **Tauri v2**, **Rust**, and **Svelte 5**, it pairs a multi-project horizontal navigation deck with a multi-session embedded native pseudo-terminal (PTY) and an interactive, real-time Git differential review canvas.

```
┌─────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────────┐
│  Multi-Project Deck     │  ──►  │ Real-Time Live Diff      │  ──►  │   Multi-Line "Steer"     │
│ (Horizontal Project Bar │       │ (Debounced kernel watch; │       │ (Bracketed paste prompt  │
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
* **Workspace Persistence:** Automatically saves all attached projects and active project focus to local storage, restoring your workspace upon restart.

### 2. 🚀 Multi-Session Embedded PTY Cockpit & Split Deck
* **Hardware-Accelerated ANSI Terminal:** GPU-rendered terminal via `@xterm/xterm`, WebGL addon, and `@xterm/addon-unicode11` for crisp box-drawing and emoji character widths.
* **Dynamic Split-Terminal Panes:** Toggle seamlessly between Single (`Alt+S`), Side-by-Side Horizontal (`Alt+H`), and Stacked Vertical (`Alt+V`) split layouts with a smooth, draggable resizer divider.
* **Integrated Pane Toolbars:** Dedicated header controls for Pane 1 and Pane 2 featuring instant session switcher dropdowns, 1-click **Swap Panes** (`Alt+X`), **New Session in this Pane**, **Maximize to Single**, and **Close**.
* **Focused Pane Routing & Tab Indicators:** Tabs display `P1` (blue) and `P2` (purple) badges. Quick launch actions, typed command detection, and floating **Scroll to Bottom** buttons dynamically target the focused active pane.
* **Welcoming Pane 2 Ready State:** 1-click **Launch Shell** and **Launch AGY** buttons immediately spawn parallel sessions in secondary panes without hijacking Pane 1.
* **Inline Tab Renaming:** Double-click any tab title or click the edit icon to rename tabs on the fly (e.g., `Antigravity Agent`, `Dev Server`, `Tests`).
* **Real-Time Agent Auto-Detection:** Automatically identifies when agents (`agy`, `antigravity`, `opencode`, `claude`, `aider`, `gemini`, `goose`) are started via typed commands or output banners, and tags tabs with active agent badges (🤖 vs 💻).
* **⚡ Quick Launch Select:** Instant dropdown menu to launch pre-configured AI coding agents or execute shell utilities (`git status`, `git diff`, `clear`).

### 3. ⚡ Kernel-Level Real-Time Review Canvas
* **Instant In-Flight Diff Sync:** Automatic file modification detection via `notify-debouncer-mini` with instant live diff refresh (< 200ms) on agent writes.
* **Working-Tree & Untracked File Support:** Synthesizes in-memory Myers diffs via `libgit2` and disk buffers, ensuring both tracked, untracked, and newly created files render immediately.
* **Intra-Line Word Diffs:** Sub-token and character-level diff highlighting for precision micro-review of agent code modifications.
* **Split & Unified Diff Views:** Toggle between Side-by-Side (Split) and Inline (Unified) diff visualizations with syntax highlighting and line numbers.

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

### 6. 🎨 Multi-Theme Harmony & Settings Modal
* **5 Cohesive Color Themes:** High-contrast **Black (GitHub Dark)**, clean **White (Light)**, **One Dark Pro**, **Dracula**, and **Nord Ice** palettes.
* **Borderless Canvas & Viewport Synchronization:** Zero-gutter edge-to-edge canvas with unified background colors across `.xterm`, `.xterm-viewport`, `.xterm-screen`, and container slots.
* **Built-in Settings Dialog (`Ctrl+,`):** Accessible settings panel with theme picker, full keyboard shortcuts reference guide, prompt template manager, and runtime diagnostics.

### 7. 🛡️ In-Process Git Staging & AI Release Gate
* **Granular Hunk Control:** Stage or unstage individual diff hunks or entire files directly in the review canvas.
* **Hallucination Discard:** Revert individual hunks or entire modified files with confirmation safety guards.
* **In-Process Commit Engine:** Native atomic commit panel powered by `git2-rs` with optional AI-assisted commit message generation.

### 8. 🪶 Ultra-Low Resource Footprint
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
You can run AgentDeck either as a native Tauri desktop app or via the dual web harness:

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
3. **Switch Between Projects:** Click project pills on the horizontal bar or use `Ctrl+Alt+Left/Right` to monitor live in-flight diffs across multiple services in parallel.
4. **Drag & Steer:** Spot a bug or hallucination? **Click & drag across lines** (or Shift+Click), click **Steer Selection**, type your instruction, and press `Ctrl+Enter` / `Cmd+Enter`.
5. **Stage & Commit:** Verify good changes, discard hallucinations, and commit natively per project with libgit2.

---

## 🗺️ Product Roadmap

* **[Version 1.0 (MVP)](docs/versions/version-1-mvp.md)** - ✅ Core multi-session harness, real-time live diffs, multi-line drag steering, file explorer, agent identification, hunk staging & commit release gate.
* **[Version 2.0 (Multi-Project & Multi-Agent Power)](docs/versions/version-2-multi-agent-power.md)** - 📋 Horizontal project navigation bar, parallel multi-project workspaces, intra-line word diffs, prompt template manager, AI commit message synthesis.
* **[Version 3.0 (Enterprise Ecosystem)](docs/versions/version-3-enterprise-ecosystem.md)** - 🔮 Remote SSH / Docker harnesses, time-travel session recording, WASM plugin system, MCP sidecars.

---

## 📂 Project Structure

```
agent_deck/
├── src-tauri/               # Tauri v2 Desktop Backend
│   ├── src/
│   │   ├── git/             # libgit2 in-process Git operations, Myers fallback diff engine
│   │   ├── pty/             # portable-pty virtual TTY master/slave supervisor & UTF-8 locales
│   │   ├── watcher/         # notify-debouncer-mini kernel filesystem watcher
│   │   ├── commands.rs      # Tauri IPC command declarations
│   │   ├── lib.rs           # Tauri app runner & plugin initialization
│   │   └── main.rs          # Desktop executable entrypoint
│   ├── Cargo.toml           # Rust desktop crate dependencies
│   └── tauri.conf.json      # Tauri v2 window & capability configuration
├── server/                  # Pure Rust Standalone Server Bridge (REST + WS)
│   ├── src/main.rs          # Axum 0.7 server with PTY, Git & FS endpoints
│   └── Cargo.toml           # Server dependencies
├── src/                     # Svelte 5 Frontend
│   ├── lib/
│   │   ├── components/      # UI components (Header, ProjectBar, TerminalView, FileList, DiffView, SteerModal, CommitPanel, FolderPickerModal)
│   │   ├── stores/          # Svelte 5 Runes state store (appState.svelte.ts)
│   │   ├── types/           # TypeScript interfaces & data models
│   │   └── utils/           # Tauri & Server IPC bridge (tauri.ts)
│   ├── App.svelte           # Main workspace layout shell & resizable split pane
│   ├── app.css              # Global styles & Tailwind CSS directives
│   └── main.ts              # Frontend bootstrap
├── docs/                    # Architectural specs, URD, and version roadmaps
└── package.json             # Frontend dependencies & scripts
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
