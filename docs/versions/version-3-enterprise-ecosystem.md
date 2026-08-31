# AGENTDECK - VERSION 3.0 SPECIFICATION & TASK LIST
### *Platform Extensibility, Remote Workspaces & Ecosystem Harness*

---

## 1. Executive Summary & V3 Objective

**Version 3.0** expands AgentDeck from a standalone local desktop harness into an extensible, enterprise-grade **Developer Platform & Ecosystem**.

V3 addresses complex real-world workflows:
1. **Remote & Containerized Agents:** Run coding agents inside remote cloud instances (via SSH), Docker containers, or Dev Containers while keeping full visual diff and steering capabilities locally.
2. **Session Recording & Audit Timeline:** Replay agent thought processes, command outputs, and code transitions over time.
3. **Plugin & Hook Ecosystem:** Allow developers and teams to attach linters, test harnesses, and custom MCP/Sidecar tools to the steering loop.
4. **Team Collaboration:** Share steering recipes, review notes, and atomic patch bundles with teammates.

---

## 2. V3 Technology Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          AGENTDECK PLATFORM (V3.0)                            │
├───────────────────────────────┬───────────────────────────────────────────────┤
│   FRONTEND ECOSYSTEM (Svelte) │   EXTENSIBLE RUST BACKEND CORE                │
│                               │                                               │
│ • Remote Connection Manager   │ • Remote PTY Protocol (SSH2 / Docker Exec)    │
│ • Session Timeline & Replay   │ • Binary Session Logger (Asciinema / Raw)     │
│ • Plugin Marketplace / Loader │ • Native WASM / Lua Plugin Engine             │
│ • Collaborative Review Board  │ • MCP Sidecar Bridge & Linter Hook Runner     │
└───────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 3. V3 Functional Requirements Breakdown

### 3.1 Module 1: Remote & Containerized Agent Harness (`REMOTE-PTY`)
* **[V3-REQ-REM-01] SSH PTY Bridge:** Connect to remote servers via SSH, tunneling remote PTY streams directly into the local terminal cockpit.
* **[V3-REQ-REM-02] Docker & Dev Container Support:** 1-click spawn of agent sessions inside local or remote Docker containers with auto-mounted volume diff tracking.
* **[V3-REQ-REM-03] Remote Git Sync:** Mirror remote filesystem changes to local review canvas with low-latency binary diff streaming.

### 3.2 Module 2: Session Recording & Audit Timeline (`SESSION-LOGS`)
* **[V3-REQ-LOG-01] Flight Recorder (Asciinema Compatible):** Record entire agent CLI runs including stdout, stdin injections, timestamps, and exit codes.
* **[V3-REQ-LOG-02] Interactive Diff Timeline:** Scrub backwards and forwards in time to see the exact state of files at any point during an agent's run.
* **[V3-REQ-LOG-03] Audit Export & Sharing:** Export session logs and diff summaries as HTML/Markdown reports for PRs and compliance review.

### 3.3 Module 3: Plugins, Hooks & Sidecars (`EXTENSIBILITY`)
* **[V3-REQ-EXT-01] Pre-Steer & Post-Edit Hooks:** Run automated checks (e.g., `eslint`, `cargo check`, `pytest`) immediately after an agent edits files, automatically feeding errors into the steering prompt.
* **[V3-REQ-EXT-02] Native Plugin Engine (WASM / Extism):** Community developers can build UI widgets, custom diff parsers, and custom prompt synthesizers.
* **[V3-REQ-EXT-03] Model Context Protocol (MCP) Bridge:** Native MCP client support to let agents query the AgentDeck review state directly as an MCP tool.

### 3.4 Module 4: Collaboration & Team Workspaces (`TEAM`)
* **[V3-REQ-TEAM-01] Shared Steering Playbooks:** Export and import team-wide prompt templates and agent configuration presets.
* **[V3-REQ-TEAM-02] Patch Bundle Export:** Export unstaged or staged diffs as standard `.patch` files or GitHub Gists for instant peer review.

---

## 4. V3 Work Breakdown Structure (WBS) & Task Checklist

### Phase 1: Remote & Container PTY Engine (Rust)
- [ ] **Task 1.1: SSH2 PTY Protocol Implementation**
  - Implement `russh` / `ssh2` backend supporting key-based authentication, interactive terminal allocation, and SSH port forwarding.
- [ ] **Task 1.2: Docker Container Harness**
  - Implement Docker API client (`bollard`) to attach to running containers (`docker exec -it`) and track mounted filesystems.
- [ ] **Task 1.3: Remote Workspace Synchronization**
  - Efficient incremental file synchronization for remote repositories.

---

### Phase 2: Session Recording & Time-Travel Diff Engine
- [ ] **Task 2.1: Flight Recorder Engine**
  - Implement zero-overhead append-only log format recording terminal bytes with microsecond timestamps.
- [ ] **Task 2.2: Time-Travel Scrub Bar (`TimeTravel.svelte`)**
  - Visual timeline slider allowing developers to jump back to any previous generation step.
- [ ] **Task 2.3: Session Exporter**
  - Generate standalone interactive HTML review reports.

---

### Phase 3: Plugin System & Hook Runner
- [ ] **Task 3.1: WASM / Extism Plugin Host**
  - Embed lightweight WebAssembly runtime for sandboxed plugins.
- [ ] **Task 3.2: Automated Hook Runner**
  - Implement pre-steer and post-write triggers for linters and test suites.
- [ ] **Task 3.3: MCP Protocol Integration**
  - Expose AgentDeck active diff state as an MCP server/tool for connected agents.

---

### Phase 4: Enterprise UI & Collaboration
- [ ] **Task 4.1: Remote Connection Manager (`RemoteManager.svelte`)**
  - UI for saving SSH profiles, Docker containers, and cloud environments.
- [ ] **Task 4.2: Team Playbook Sharing**
  - Import/export workspace configs and steer presets via JSON/YAML.
- [ ] **Task 4.3: Patch & Gist Sharing**
  - Generate and export standard patch files directly from the UI.

---

## 5. Definition of Done (DoD) for Version 3.0

1. **Remote Orchestration:** Seamlessly steer an agent running on a remote EC2/Docker host with responsive terminal and live diff sync.
2. **Session Playback:** Complete agent sessions can be played back accurately with synced terminal output and code diff progression.
3. **Plugin Safety:** WASM plugins execute safely in isolated memory space without compromising host security or performance.
4. **Hook Automation:** Linters automatically feed diagnostic output into the "Steer Agent" dialogue upon code generation errors.
