# PROJECT OVERVIEW: AGENTDECK
### *The Human-Centric Review Harness & Workspace for CLI Coding Agents*

---

## 1. Executive Summary

**AgentDeck** is an open-source, ultra-lightweight desktop platform engineered to serve as the **control bridge and review harness** for terminal-first AI coding agents (such as Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, and bespoke local LLM runners).

Rather than delegating software construction entirely to autonomous systems or forcing developers into clunky terminal outputs, **AgentDeck puts the human reviewer in the pilot seat**. Built with **Tauri v2** and **Rust**, it pairs an embedded multi-session pseudo-terminal (PTY) with an interactive, real-time Git differential review canvas and a **horizontal multi-project navigation deck**. Developers orchestrate agents across multiple repositories and folders in parallel while maintaining granular visual oversight, multi-line code inspection, and bi-directional prompt injection into ongoing CLI sessions.

---

## 2. Philosophy & Problem Statement

### The Paradigm Shift
AI coding agents are shifting developer roles from *writers of code* to *architects and reviewers of code*. However, the modern developer toolchain is fractured:

```
[ Traditional Pain Point ]
CLI Agent (Fast, headless, multi-file writes across microservices) 
       ≠
Human Reviewer (Needs visual spatial context, multi-project navigation, atomic verification)
```

### The Friction Points
1. **The Reviewer’s Blind Spot:** CLI agents modify dozens of files across multiple commits and repositories. Inspecting raw terminal summaries leaves the human reviewer detached from structural code implications.
2. **Multi-Repository Fragmentation:** Modern software projects frequently span multiple folders and repositories (e.g., frontend app, backend API, shared libraries). Constantly reopening folders or opening multiple bulky IDE windows burns memory and loses terminal session state.
3. **Clunky Feedback Channels:** To correct an agent's hallucination or logic error on lines 42–56 of a newly generated file, developers must manually type file names, lines, and problem descriptions back into the CLI.
4. **Bloated Tooling Tax:** Developers running local agents, tests, and language servers cannot afford Chromium/Electron tools hogging 1GB+ of system memory simply to display a diff view.

### The AgentDeck Mission
To act as the **primary harness** for any CLI coding agent: giving developers full multi-project visibility, real-time diff tracing, instant multi-line human steering, and seamless commit control in a sub-50MB native desktop application.

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AGENTDECK RUNTIME                                      │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│   HUMAN CONTROL CANVAS (Svelte 5 / UI)   │   NATIVE PLATFORM CORE (Rust / Tauri v2)    │
│                                          │                                             │
│  ┌────────────────────────────────────┐  │  ┌────────────────────────────────────────┐ │
│  │ Horizontal Project Navigation Bar  │  │  │ Multi-Repo Git Core (git2-rs)          │ │
│  │ • Project tabs (pills), branch,    │◄─┼──┤ • Multi-repository index & diff cache  │ │
│  │   dirty badges, agent indicators   │  │  │ • In-memory tree Myers fallback diffs  │ │
│  │ • Add Project (+), Detach project  │  │  │ • Granular staging & patch generation  │ │
│  └────────────────────────────────────┘  │  └────────────────────────────────────────┘ │
│                                          │                       ▲                     │
│  ┌────────────────────────────────────┐  │  ┌────────────────────┴───────────────────┐ │
│  │ Interactive Review & Staging View  │  │  │ Real-Time Watcher (notify-debouncer)   │ │
│  │ • Side-by-side & Unified Diffs     │◄─┼──┤ • Multi-path kernel event aggregation  │ │
│  │ • Multi-line drag selection        │  │  │ • Debounced diff refresh on disk writes │ │
│  │ • "Steer Agent" floating toolbar   │  │  └────────────────────────────────────────┘ │
│  └────────────────────────────────────┘  │                       ▲                     │
│                                          │  ┌────────────────────┴───────────────────┐ │
│  ┌────────────────────────────────────┐  │  │ PTY Harness Engine (portable-pty)      │ │
│  │ Terminal Cockpit (xterm.js)        │  │  │ • Project-scoped CWD supervision       │ │
│  │ • Multi-session tab supervisor     │  │  │ • Isolated async stdout read threads   │ │
│  │ • Unicode 11 & WebGL rendering     │◄─┼──┤ • Bracketed paste stdin injection      │ │
│  │ • Real-time agent detection (🤖)   │  │  └────────────────────┬───────────────────┘ │
│  └────────────────────────────────────┘  │                       │                     │
│                                          │  ┌────────────────────┴───────────────────┐ │
│  ┌────────────────────────────────────┐  │  │ Directory Listing Engine (fs/list-dirs)│ │
│  │ Desktop File Explorer              │◄─┼──┤ • Places sidebar & Git repo detection  │ │
│  │ • Places sidebar & Breadcrumbs     │  │  └────────────────────────────────────────┘ │
│  └────────────────────────────────────┘  │                                             │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
                                                                   │ Virtual TTY (I/O)
                                                                   ▼
                                                    ┌──────────────────────────────┐
                                                    │ CLI CODING AGENTS            │
                                                    │ Antigravity | OpenCode |     │
                                                    │ Claude Code | Aider | Custom │
                                                    └──────────────────────────────┘
```

---

## 4. Core Features & Capabilities

### 4.1. Multi-Project Management & Horizontal Navigation Bar
* **Parallel Multi-Folder Attachment:** Attach multiple repositories or project folders simultaneously.
* **Top Horizontal Project Bar:** Visual tab bar displaying all attached projects as distinct pills with project folder icons, active Git branch badges, real-time dirty file counters, and active agent status indicators.
* **Instant Project Switching:** Switch between open projects via mouse click or hotkeys (`Ctrl+Alt+Left/Right`, `Ctrl+1..9`) with zero reloading latency.
* **Isolated Project Workspaces:** Each attached project retains its own independent state:
  * Scoped terminal/PTY sessions running in that project's working directory (`cwd`).
  * Dedicated file modification list and diff canvas state.
  * Active Git branch, commit status, and staging index.
* **Persistence:** Attached projects and active project selection persist across application restarts in local storage.

### 4.2. The Agent Harness (Multi-Session PTY)
* **Universal Compatibility:** Communicates via operating-system pseudo-terminals (`portable-pty`). Zero customized agent adapters needed—works with Antigravity (AGY), OpenCode, Claude Code, Aider, Gemini CLI, Goose, or raw Bash/Zsh scripts out of the box.
* **Full Terminal Capabilities:** Full support for curses interfaces, colors, progress bars, interactive keyboard inputs, and terminal navigation.
* **Multi-Session Deck:** Run and monitor multiple agents or shell commands simultaneously across segregated tabs with inline tab renaming and real-time agent identification.
* **Unicode 11 Support:** Crystal-clear rendering of emoji badges, box-drawing characters (`╭`, `│`, `✔`), and glyphs without line misalignment.

### 4.3. Real-Time Human Review Canvas
* **Live In-Flight Diffs:** As the coding agent writes code onto the disk, the native debounced file-system watcher refreshes the diff viewer automatically without blocking the UI thread.
* **Myers Diff Synthesis:** Generates accurate in-memory diffs against Git HEAD/Index for newly created, unstaged, and untracked files.
* **Side-by-Side Verification:** Clear, color-coded visual representations of modifications, deletions, and structural syntax updates.
* **Hunk-Level Control:** Accept, reject, or stage individual hunks or specific lines before the agent moves on to subsequent tasks.

### 4.4. Multi-Line Context Steering Loop
* **Multi-Line Drag & Shift+Click Selection:** Highlight entire blocks of code by dragging across diff lines or holding Shift.
* **Synthesized Context Packets:** The app automatically packages file paths, highlighted line numbers, surrounding context, and developer notes into a structured command:
  ```text
  [Human Review Feedback] File: src/auth.ts (Lines 42-48)
  Snippet:
  + const token = req.headers.authorization;
  + verifyToken(token);
  Feedback / Instruction: Validate parameters before signature verification.
  ```
* **🛡️ Stdin Bracketed Paste Mode:** Streams the prompt directly into the agent’s running terminal session wrapped in bracketed paste escape sequences (`\x1b[200~` ... `\x1b[201~`) with an automated carriage return (`\r`), preventing premature newline execution and preserving interactive CLI layouts.

### 4.5. Integrated Release & Commit Gate
* **Human-Gated Approval:** Ensure autonomous agent output is verified by a human before hitting version control.
* **Hunk Staging & Git Operations:** Stage selected blocks, discard unwanted agent hallucinations, and execute commits natively via `libgit2`.

---

## 5. Technology Stack Specifications

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Runtime Desktop Shell** | **Tauri v2 (Rust)** | Memory footprint `< 50MB`, cold startup `< 400ms`, system security boundaries. |
| **Terminal / PTY Engine** | **`portable-pty`** | Extracted from WezTerm; industry-grade terminal management across POSIX and Windows ConPTY. |
| **Git Operations** | **`git2` (libgit2)** | Ultra-fast in-process Git operations; eliminates the overhead and latency of spawning CLI `git` subprocesses. |
| **File Watcher** | **`notify-debouncer-mini`** | Low-overhead native kernel bindings (`kqueue`, `inotify`, `ReadDirectoryChangesW`) with multi-path write-burst debouncing. |
| **Frontend Framework** | **Svelte 5** | Compiler-based reactivity with zero Virtual DOM overhead, ideal for rapid diff re-renders and multi-project state switching. |
| **Terminal Canvas** | **`@xterm/xterm` + WebGL + Unicode11** | Standard-grade terminal rendering with GPU acceleration and emoji/box-drawing alignment. |
| **Styling** | **Tailwind CSS** | Clean, minimal, low-runtime CSS layer for responsive workspace layouts. |

---

## 6. Target Human-in-the-Loop Workflow

```
1. Attach Projects to Deck
   Developer opens AgentDeck and attaches multiple repositories (e.g. `frontend` and `backend-api`)
   via the horizontal project bar or File Explorer.
   Native watchers and Git indexers initialize for each project.

2. Deploy Parallel CLI Agents
   In Project 1 (`frontend`), developer launches Antigravity: $ agy
   In Project 2 (`backend-api`), developer clicks tab and launches Claude: $ claude
   Both agents run concurrently in isolated PTY processes.

3. Observe Live In-Flight Diffs
   As the agents write code to their respective project files, the horizontal project pills
   update dirty file badges in real time. Switching project tabs displays live diffs instantly.

4. Intercept & Steer
   Developer spots an issue in Project 1 on lines 42–48.
   Developer drags across Lines 42–48 -> "Steer Selection" -> Types "Use a Redis cache here instead".
   AgentDeck pushes the structured bracketed paste prompt into Project 1's agent terminal.

5. Final Verification & Commit
   Agent refactors code based on feedback.
   Developer stages confirmed changes (hunk by hunk) and triggers Commit & Push natively per project.
```
