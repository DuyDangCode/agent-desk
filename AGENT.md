# 🤖 AGENT.MD — OPERATIONAL DIRECTIVE & ROADMAP GUIDE
### *For AI Agents & Developers Building and Extending AgentDeck*

---

## 1. Core Purpose & Architectural Invariants

**AgentDeck** is the human-in-the-loop control harness for terminal-first AI coding agents (Google Antigravity, OpenCode, Claude Code, Aider, Gemini CLI, Goose Agent, Codex, and local runners). When writing code or refactoring AgentDeck, you **MUST** uphold these system invariants at all times:

1. **Strict Roadmap Progression:** Always implement features according to their designated milestone in [`docs/versions/roadmap.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/roadmap.md). Never mix future roadmap items into earlier milestone tasks without explicit requirement alignment.
2. **Zero-Latency Terminal Isolation:** The terminal cockpit I/O and PTY streaming must **never** be blocked or delayed by Git diff computations, filesystem events, or UI rendering frames.
3. **Ultra-Low Memory Footprint:**
   * **Version 1.0 (MVP):** Idle RAM `< 50MB`. Cold startup `< 400ms`.
   * **Version 2.0:** Idle RAM `< 90MB` with 3 active attached projects and active PTY sessions.
4. **Native In-Process Git (`git2` / libgit2):** Never spawn `git` CLI child processes for diffing, staging, or commits. All Git operations must execute in-process via `git2-rs` with buffered Myers diff fallback for uncommitted disk files.
5. **Parallel Multi-Project Isolation:** Project state (file diffs, Git branches, working directories `cwd`, and PTY terminals) must remain cleanly segregated per project, allowing multiple projects to run concurrently without state leaks.
6. **Dual Runtime Parity:** The frontend (`src/`) must function identically whether running inside the **Tauri v2** native desktop shell or connected via the standalone **Rust Backend Server** (`server/`).
7. **Robust Stdin Protocol (Bracketed Paste):** Context steering injections MUST be wrapped in Bracketed Paste Mode (`\x1b[200~` ... `\x1b[201~`) to prevent premature newline execution in interactive full-screen CLIs.
8. **Unicode 11 Character Alignment:** GPU terminal canvases must load `@xterm/addon-unicode11` and enforce UTF-8 locale environment variables (`LANG=en_US.UTF-8`, `LC_ALL=en_US.UTF-8`) across all spawned PTY instances.

---

## 2. Roadmap Execution Phases

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               AGENTDECK RELEASE TIMELINE                               │
├──────────────────────────────┬─────────────────────────────┬───────────────────────────┤
│    VERSION 1.0 (MVP)         │      VERSION 2.0            │      VERSION 3.0          │
│    Core Review Harness       │  Multi-Project & Multi-Agent│  Platform & Extensibility │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ • Embedded Native PTY        │ • Horizontal Project Bar    │ • Remote SSH / Docker PTY │
│ • Multi-Session PTY Deck     │ • Parallel Multi-Project Deck│ • Session Recording/Replay│
│ • Real-Time Live Diffs       │ • Intra-Line Token Diffs    │ • Plugin System (WASM)    │
│ • Multi-Line Drag Steering   │ • Custom Prompt Templates   │ • MCP Protocol & Hooks    │
│ • File Explorer with Places  │ • AI Commit Message Synth   │ • Team Sharing & Patches  │
│ • Memory Footprint < 50MB    │ • Split Terminal Decks      │                           │
│                              │ • Memory Footprint < 90MB   │                           │
└──────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

### Phase 1: Version 1.0.0 (MVP) — Baseline Control Harness *(Status: Implemented & Verified)*
* Spec: [`docs/versions/version-1-mvp.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md)
* Multi-session PTY supervisor (`portable-pty`) with `@xterm/xterm` WebGL acceleration, Unicode 11 emoji/box-drawing support, and inline tab renaming.
* Real-time agent detection (automatic recognition of Antigravity, OpenCode, Claude Code, Aider, etc.).
* Live diff canvas with debounced kernel file-watching (`notify-debouncer-mini`, 200ms window) and in-memory Myers diff fallback for unstaged/untracked files.
* Desktop File Explorer modal (`FolderPickerModal.svelte`) with Places sidebar, breadcrumbs, and live Git repository detection.
* Theme engine (`theme.svelte.ts`) supporting Black (Dark), White (Light), and System OS sync, with interactive Settings dialog (`SettingsModal.svelte` / `Ctrl+,`).
* Multi-line drag & Shift+Click code selection in review canvas with floating action bar.
* Bi-directional context steering with target agent selection, no-agent safety gating, and bracketed paste stdin streaming.
* Granular hunk staging/unstaging, hallucination discard, and native `libgit2` commit panel.

### Phase 2: Version 2.0.0 — Multi-Project & Multi-Agent Intelligence *(Target)*
* Spec: [`docs/versions/version-2-multi-agent-power.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md)
* **Horizontal Project Navigation Bar (`ProjectBar.svelte`):** Attach multiple project folders, navigate across projects via sleek top pills, view active branch and dirty status per project, and attach new projects with 1 click.
* **Parallel Workspace State Isolation:** Dedicated repository metadata, diff tree, and PTY terminal instances per project with project root `cwd`.
* **State Persistence:** Local storage persistence for attached project lists and active project focus across application restarts.
* Intra-line word/character diff calculation via `similar` crate in Rust.
* Reusable prompt templates (`{{file}}`, `{{lines}}`, `{{code}}`, `{{instructions}}`).
* Optional local LLM / API integration for automated conventional commit message synthesis.
* Multi-pane split terminal layout (side-by-side terminal decks).

### Phase 3: Version 3.0.0 — Platform & Extensibility *(Future)*
* Spec: [`docs/versions/version-3-enterprise-ecosystem.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-3-enterprise-ecosystem.md)
* Remote SSH and Docker container PTY harnesses.
* Time-travel session recording and replay with interactive scrubbing.
* Extensible WASM plugin runtime and Model Context Protocol (MCP) server hooks.

---

## 3. Technology Stack & Directory Conventions

```
agent_deck/
├── src-tauri/               # Tauri v2 Desktop Backend
│   ├── src/
│   │   ├── git/mod.rs       # libgit2 tree parsing, Myers fallback hunk diffs, staging & commits
│   │   ├── pty/mod.rs       # portable-pty virtual TTY master/slave supervisor & UTF-8 locales
│   │   ├── watcher/mod.rs   # notify-debouncer-mini filesystem watcher
│   │   ├── commands.rs      # Tauri IPC command wrappers (folder picker, PTY, Git)
│   │   ├── lib.rs           # Tauri app runner & plugin setup
│   │   └── main.rs          # Desktop executable entrypoint
│   ├── Cargo.toml           # Rust desktop crate dependencies
│   └── tauri.conf.json      # Tauri v2 configuration & window settings
├── server/                  # Pure Rust Standalone Server Bridge (REST + WS)
│   ├── src/main.rs          # Axum 0.7 server with PTY, Git & FS endpoints
│   └── Cargo.toml           # Server dependencies
├── src/                     # Svelte 5 Frontend
│   ├── lib/
│   │   ├── components/      # UI components (Header, ProjectBar, TerminalView, FileList, DiffView, SteerModal, CommitPanel, FolderPickerModal)
│   │   ├── stores/          # Svelte 5 Runes state store (appState.svelte.ts)
│   │   ├── types/           # TypeScript interfaces & data models (ProjectItem, RepoInfo, PtySession, AgentKind, SteerContext, etc.)
│   │   └── utils/           # Tauri & Server IPC bridge (tauri.ts)
│   ├── App.svelte           # Main workspace layout shell & resizable split pane
│   ├── app.css              # Global styles & Tailwind CSS directives
│   └── main.ts              # Frontend bootstrap
├── docs/                    # Architectural specs, URD, and version roadmaps
└── package.json             # Frontend dependencies & scripts
```

---

## 4. Coding & Implementation Guidelines

### 4.1. Rust Backend Standards
* **Concurrency & Safety:** Use `parking_lot::Mutex` or `tokio::sync::Mutex` appropriately. Never hold a synchronous lock across an `.await` point.
* **Error Handling:** Return structured `Result<T, String>` for all IPC commands so that the frontend can display descriptive toasts.
* **Non-Blocking PTY Reading:** PTY master reader loops must run on dedicated worker threads streaming chunks asynchronously to Tauri events or WebSocket channels.
* **Git Index Integrity:** Always call `index.write()` after modifying index entries and release locks cleanly.
* **Locale Configuration:** Ensure `LANG=en_US.UTF-8` and `LC_ALL=en_US.UTF-8` are exported to spawned child shells.

### 4.2. Svelte 5 & Frontend Standards
* **Runes Only:** Exclusively use Svelte 5 runes (`$state`, `$derived`, `$effect`). Avoid legacy Svelte 3/4 reactive declarations (`$:`) and legacy store subscriptions (`$store`).
* **Clean Components:** Keep components modular and single-responsibility:
  * `ProjectBar.svelte` -> horizontal project navigation bar, project pills, branch indicator, dirty badge, add/detach project.
  * `TerminalView.svelte` -> xterm.js multi-session lifecycle, Unicode 11 addon, and PTY I/O.
  * `FileList.svelte` -> modified file list and filtering.
  * `DiffView.svelte` -> diff hunk visualization, multi-line drag selection, and line actions.
  * `SteerModal.svelte` -> prompt packet formatting, agent selection, and bracketed paste injection.
  * `CommitPanel.svelte` -> staging summary and commit release gate.
  * `FolderPickerModal.svelte` -> desktop-grade directory explorer with Places.
* **IPC Abstraction:** All backend communications must go through [`src/lib/utils/tauri.ts`](file:///home/thanhduy/Projects/agent_deck/src/lib/utils/tauri.ts), ensuring dual compatibility with both Tauri IPC and the local HTTP/WS server.

---

## 5. Verification & Quality Checklist

Before completing any task or releasing a milestone:

1. **Frontend Compilation:**
   ```bash
   npx svelte-check --threshold error && npm run build
   ```
   Must compile cleanly with zero errors.

2. **Rust Backend Compilation:**
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   cargo check --manifest-path server/Cargo.toml
   ```
   Must compile with zero errors.

3. **Runtime Verification:**
   * Multi-project bar renders attached projects and switches active project without UI delay or terminal disconnection.
   * Multi-session PTY spawns in the respective project `cwd` and accepts user input / terminal shortcuts without lag.
   * File modifications written in the terminal reflect in the diff canvas within 200ms.
   * Multi-line drag selection highlights lines and opens Steer modal with correct line numbers.
   * "Click-to-Steer" opens the modal, formats the context packet, and streams into PTY stdin using Bracketed Paste (`\x1b[200~` ... `\x1b[201~`).
   * Hunks stage/unstage cleanly and commits write to the local Git repository via libgit2.

---

## 6. Documentation & Architecture Sync Protocol

Every AI Agent and developer contributing code or refactoring AgentDeck **MUST** strictly adhere to this synchronization protocol to maintain absolute architectural coherence across the repository.

### 6.1. The "Doc-Code Parity" Invariant
Whenever modifying code, adding features, or altering system architecture, the Agent is strictly required to execute the following 3-step sync:

1. **Mark WBS Task Completion:**
   * Open the target milestone specification file (e.g. [`docs/versions/version-2-multi-agent-power.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md)) and update the task checklist item from `- [ ]` to `- [x]`.
2. **Log in `CHANGELOG.md`:**
   * Add a concise "What & Why" entry under the `[Unreleased]` section of [`CHANGELOG.md`](file:///home/thanhduy/Projects/agent_deck/CHANGELOG.md), grouping by functional module.
   * Categorize strictly using Keep a Changelog categories:
     * `Added`: for new features, components, endpoints, or IPC commands.
     * `Changed`: for modifications to existing functionality or refactored logic.
     * `Deprecated`: for features slated for removal in future versions.
     * `Removed`: for features excised from the codebase.
     * `Fixed`: for bug and error fixes.
     * `Security`: for vulnerability remediations and sandboxing hardening.
3. **Sync Technical Architecture Blueprint:**
   * If the change introduces new data models, Rust crates, IPC channels, state stores, or modifications to data flow, update [`docs/ARCHITECTURE.md`](file:///home/thanhduy/Projects/agent_deck/docs/ARCHITECTURE.md) (including Mermaid flowcharts and the Architectural Evolution Matrix).

### 6.2. Official Version Release & Graduation Workflow
When graduating a milestone from `[Unreleased]` to an official release:

1. **Verify Definition of Done (DoD):** Ensure all criteria listed in the version's DoD checklist are verified and passing cleanly.
2. **Version Bumping:** Update version strings across:
   * `package.json` (`version`)
   * `src-tauri/Cargo.toml` (`[package] version`)
   * `server/Cargo.toml` (`[package] version`)
   * `src-tauri/tauri.conf.json` (`version`)
3. **Changelog Cutover:**
   * Rename `## [Unreleased]` section to `## [X.Y.Z] - YYYY-MM-DD`.
   * Create a fresh, empty `## [Unreleased]` section at the top.
   * Update bottom comparison links (`[Unreleased]: ...`, `[X.Y.Z]: ...`).
4. **Git Tagging:**
   * Commit with message: `chore(release): bump version to vX.Y.Z`
   * Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`

