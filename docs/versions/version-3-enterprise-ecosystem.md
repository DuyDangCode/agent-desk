# KESTREL - VERSION 3.0 SPECIFICATION & TASK LIST
### *Platform Extensibility, Remote Workspaces & Ecosystem Harness*
*(Formerly AgentDeck)*

---

## 1. Executive Summary & V3 Objective

**Version 3.0** expands Kestrel from a local desktop harness into an extensible, developer-centric **Platform & Ecosystem**.

V3 addresses complex real-world workflows:
1. **Embedded Preview Browser, Smart Reverse Proxy & UI Component Steering:** Live web application preview with responsive viewports, full transparent reverse proxy gateway on port 4020, separate native Tauri Webview window, dev server auto-detection, DOM element crosshair inspection, and in-window floating UI component steering back into the agent session.
2. **Intelligent Kernel Process Inspection & Agent Detection Engine:** Kernel-level `/proc/<pid>/stat` inspection and process tree traversal, modular TOML detection rules for known AI agents, global state machine with audio attention chimes, and dynamic session tab title updates.
3. **Collapsible Project Sessions Tree & Terminal Customization:** Hierarchical project tree in sidebar, per-project session controls, attention pulses, and terminal settings modal.
4. **Remote Access via LAN/VPN (Planned):** Access the desktop application's internal server from a phone or tablet on the same network to interact with the currently running PTY session via WebSocket streaming.
5. **Plugin & Hook Ecosystem (Planned):** Allow developers and teams to attach linters, test harnesses, and custom plugins via a sandboxed engine.
6. **MCP Server Bridge (Planned):** Expose Kestrel diff state as native MCP tools to connect with external agent architectures.

---

## 2. V3 Technology Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           KESTREL PLATFORM (V3.0)                             │
├───────────────────────────────┬───────────────────────────────────────────────┤
│   FRONTEND ECOSYSTEM (PWA)    │   EXTENSIBLE RUST BACKEND CORE                │
│                               │                                               │
│ • Svelte 5 Webview & PWA      │ • Axum HTTP/WS Server (Port 4020)             │
│ • @xterm/xterm Web Terminal   │ • Smart Dev Server Reverse Proxy Engine       │
│ • Native Separate Preview Win │ • Direct WebSocket PTY Streaming              │
│ • DOM Crosshair Inspector     │ • Linux Kernel /proc Process Inspector        │
│ • In-Window Component Steer   │ • Modular TOML Agent Detection Engine         │
│ • Project Sessions Tree       │ • Native WASM/Extism Plugin Engine (Planned)  │
│ • Plugin Marketplace (Planned)│ • MCP Server Bridge & Hook Runner (Planned)   │
└───────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 3. V3 Functional Requirements Breakdown

### 3.1 Module 1: Embedded Preview Browser & UI Component Steering (`PREVIEW-BROWSER`) *(Implemented & Verified)*
* **[V3-REQ-PREV-01] Embedded Webview Pane (`WebviewPane.svelte`):** Integrated web preview pane accessible via workspace header tabs with responsive viewports (Full Desktop with proportional scaling, Tablet 768px, Mobile 375px) and URL bar navigation.
* **[V3-REQ-PREV-02] Smart Full Reverse Proxy Gateway (`src-tauri/src/preview.rs` & `server/src/main.rs`):** High-performance reverse proxy running on port 4020. Proxies HTML, JavaScript modules, CSS, chunks, and API requests to target local dev servers. Injects `AGENTDECK_INSPECTOR_JS` into HTML responses automatically.
* **[V3-REQ-PREV-03] Separate Native Webview Window:** Pop-out dedicated native Tauri Webview window (`agentdeck-preview`) with full window controls (`open_native_preview_window`, `close_native_preview_window`, `focus_native_preview_window`, `reload_native_preview_window`).
* **[V3-REQ-PREV-04] Dev Server Offline Graceful Fallback:** Automatically detects unreachable dev servers, serving a live-polling status screen with automatic reconnection.
* **[V3-REQ-PREV-05] Dev Server Auto-Detection:** Scans active terminal output streams to auto-detect running local development servers (Vite, Next.js, Webpack, localhost ports `5173`, `3000`, `8080`).
* **[V3-REQ-PREV-06] Interactive Element Crosshair Inspector:** Injects lightweight inspection harness highlighting hovered elements with bounding boxes and extracting HTML snippets, tag names, CSS classes, selectors, and source mapping annotations (`data-component`, `data-source-file`, `data-source-line`).
* **[V3-REQ-PREV-07] In-Window Steer Modal & Direct Prompt Injection (`webviewSteer.ts`):** Floating steer modal directly inside the preview page emitting to `/api/component-steer` and `/api/component-picked`. Converts element inspection context and human feedback into structured prompts injected directly into the selected agent's stdin via bracketed paste (`\x1b[200~` ... `\x1b[201~`).

### 3.2 Module 2: Kernel Process Inspection & Intelligent Agent Detection (`AGENT-DETECTION`) *(Implemented & Verified)*
* **[V3-REQ-DET-01] Linux Kernel Process Inspection (`pty/mod.rs` & `server/src/main.rs`):** Reads `/proc/<pid>/stat`, terminal process group (`tpgid`), and child processes (`/proc/<pid>/task/<pid>/children`) to reliably inspect the foreground process.
* **[V3-REQ-DET-02] Modular TOML Agent Detection Rules (`agent-detection/`):** Configurable detection rules for Google Antigravity, Anthropic Claude Code, OpenCode, Aider AI, Google Gemini CLI, Cursor, and Codex.
* **[V3-REQ-DET-03] Global Agent State Machine (`agentDetection.ts`):** Reactive state machine tracking transitions: `idle` ➔ `running` ➔ `blocked` ➔ `completed`.
* **[V3-REQ-DET-04] Auditory Attention Alerts & Status Pulses:** Plays audio chime alert (`playAlertSound`) and pulses attention badges when an agent requires approval or user input.
* **[V3-REQ-DET-05] Dynamic Tab Title Renaming:** Intelligently updates session tab titles to the detected agent or CLI tool while strictly preserving user-set custom titles.

### 3.3 Module 3: Remote Access via LAN/VPN (`REMOTE-LAN`) *(Planned)*
* **[V3-REQ-LAN-01] PWA Frontend Packaging:** Package the Svelte frontend as a Progressive Web App (PWA) accessible over standard web browsers.
* **[V3-REQ-LAN-02] Local Network Axum Server:** Host an internal HTTP/WebSocket server via Rust/Axum on port 4020.
* **[V3-REQ-LAN-03] Direct WebSocket PTY Streaming:** Stream the currently running local PTY session to the PWA frontend using `@xterm/xterm` over WebSocket (no SSH tunneling or Docker containers).
* **[V3-REQ-LAN-04] QR Code Access Generation:** Generate and display a QR code within the desktop app to quickly launch the workspace URL on mobile or tablet devices on the same Wi-Fi/VPN.

### 3.4 Module 4: Plugins & Diagnostic Hooks (`EXTENSIBILITY`) *(Planned)*
* **[V3-REQ-EXT-01] WASM / Extism Plugin Runtime:** Sandboxed plugin engine for secure extension execution.
* **[V3-REQ-EXT-02] Pre-Steer & Post-Edit Hooks:** Automated linter and test runners feeding diagnostic errors directly into the steering prompts.

### 3.5 Module 5: MCP Server Bridge (`MCP-BRIDGE`) *(Planned)*
* **[V3-REQ-MCP-01] Model Context Protocol Server:** Expose Kestrel active diff state and review context directly as MCP tools for external integration.

---

## 4. V3 Work Breakdown Structure (WBS) & Task Checklist

### Phase 1: Embedded Preview Browser, Smart Reverse Proxy & UI Component Steering *(Status: Implemented & Verified)*
- [x] **Task 1.1: Embedded Webview Canvas (`WebviewPane.svelte`)**
  - Responsive viewport switching (Desktop, Tablet, Mobile), address bar with normalization, external link opening, and reload trigger.
- [x] **Task 1.2: Dev Server URL Auto-Detection (`webviewSteer.ts`)**
  - Regex pattern matching across terminal output for Vite, Next.js, and localhost ports.
- [x] **Task 1.3: Interactive Element Crosshair Inspector**
  - Injected script with hover highlight bounds, selector computation, and component metadata extraction.
- [x] **Task 1.4: Direct Component Steering Injection**
  - Structured prompt formatting with bracketed paste terminal streaming.
- [x] **Task 1.5: Smart Reverse Proxy Gateway (`preview.rs` & `server/src/main.rs`)**
  - Transparent port-forwarding proxy on port 4020 for HTML, scripts, CSS, assets, and APIs.
- [x] **Task 1.6: Separate Pop-Out Native Webview Window (`commands.rs`)**
  - External window lifecycle management (`agentdeck-preview`) with focus, reload, and inspect syncing.
- [x] **Task 1.7: In-Window Floating Steer Popup Modal**
  - Interactive popup modal inside preview page forwarding to `/api/component-steer`.
- [x] **Task 1.8: Dev Server Offline Live-Polling Fallback Screen**
  - Helpful offline page with auto-retry countdown and dev server connection status.

---

### Phase 2: Kernel-Level Process Inspection & Intelligent Agent Detection *(Status: Implemented & Verified)*
- [x] **Task 2.1: Linux Kernel PTY Process Inspector (`pty/mod.rs`)**
  - Inspection via `/proc/<pid>/stat`, terminal process group (`tpgid`), and child process traversal.
- [x] **Task 2.2: Modular TOML Rule Definitions (`agent-detection/*.toml`)**
  - TOML rule sets for Antigravity, Claude Code, Gemini, Cursor, Codex, OpenCode, Aider.
- [x] **Task 2.3: Global Agent State Machine (`agentDetection.ts`)**
  - Lifecycle state tracking (`idle`, `running`, `blocked`, `completed`).
- [x] **Task 2.4: Auditory Attention Chime Alerts (`playAlertSound`)**
  - Non-intrusive sound alert on agent blocked/permission requests.
- [x] **Task 2.5: Dynamic Tab Title Renaming**
  - Automatic session naming based on foreground binary while honoring user custom titles.

---

### Phase 3: Collapsible Project Sessions Tree & Terminal Customization *(Status: Implemented & Verified)*
- [x] **Task 3.1: Collapsible Project Sessions Tree (`Sidebar.svelte`)**
  - Hierarchical project tree with session lists, per-project session creation, and agent badges.
- [x] **Task 3.2: Terminal Settings Modal (`TerminalView.svelte`)**
  - Font size, font family, line height, cursor style, and scrollback configuration.
- [x] **Task 3.3: Responsive Markdown Table Wrappers**
  - Clean horizontal scroll wrapper preventing table overflows in review canvas.

---

### Phase 4: Remote Access via LAN/VPN *(Planned)*
- [ ] **Task 4.1: Axum Web & WebSocket Server**
  - Serve PWA assets and establish WebSocket endpoints for PTY streams on Port 4020.
- [ ] **Task 4.2: PWA Frontend Optimization**
  - Configure the Svelte UI as a PWA, ensuring mobile/tablet responsive layouts for the xterm.js terminal interface.
- [ ] **Task 4.3: LAN IP & QR Code Generator**
  - Create a UI element to broadcast the local IP address and a scannable QR code for easy device pairing.

---

### Phase 5: Plugin System & Hook Runner *(Planned)*
- [ ] **Task 5.1: WASM / Extism Plugin Host**
  - Embed lightweight WebAssembly runtime for sandboxed plugins.
- [ ] **Task 5.2: Automated Hook Runner**
  - Implement pre-steer and post-write triggers for linters and test suites.

---

### Phase 6: MCP Server Bridge *(Planned)*
- [ ] **Task 6.1: MCP Protocol Integration**
  - Build MCP server adapter exposing Kestrel's internal diff state and file tracking as native MCP tools.

---

## 5. Definition of Done (DoD) for Version 3.0

1. **Preview Browser, Smart Reverse Proxy & UI Component Steering:** Live web application preview with transparent reverse proxy, separate pop-out native window, interactive DOM element inspection, in-window steer modal, and direct context steering into agent sessions is fully functional.
2. **Kernel Process Inspection & Agent Detection:** Kernel-level `/proc` inspection accurately identifies foreground agent binaries and system tools, drives the global state machine, plays attention chimes, and updates session titles dynamically.
3. **Collapsible Project Sessions Tree:** Sidebar cleanly organizes repositories and sessions with inline controls and real-time agent status indicators.
4. **Remote LAN Access (Planned):** A user can scan a QR code from the desktop app using their phone/tablet on the same network to instantly view and interact with the active PTY session via a PWA and WebSockets.
5. **Plugin Safety (Planned):** WASM plugins execute safely in an isolated Extism memory space without compromising host security or performance.
6. **Hook Automation (Planned):** Diagnostic tools (linters/test runners) automatically feed execution output back into the "Steer Agent" workflow.
7. **MCP Bridge Integration (Planned):** External AI agents can read Kestrel diff states directly via the standard Model Context Protocol.
