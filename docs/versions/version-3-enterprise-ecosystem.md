# AGENTDECK - VERSION 3.0 SPECIFICATION & TASK LIST
### *Platform Extensibility, Remote Workspaces & Ecosystem Harness*

---

## 1. Executive Summary & V3 Objective

**Version 3.0** expands AgentDeck from a standalone local desktop harness into an extensible, enterprise-grade **Developer Platform & Ecosystem**.

V3 addresses complex real-world workflows:
1. **Remote Access via LAN/VPN:** Access the desktop application's internal server from a phone or tablet on the same network to interact with the currently running PTY session via WebSocket streaming.
2. **Embedded Preview Browser & UI Component Steering:** Live web application preview with responsive viewports, dev server auto-detection, DOM element crosshair inspection, and direct UI component steering back into the agent session.
3. **Plugin & Hook Ecosystem:** Allow developers and teams to attach linters, test harnesses, and custom plugins via a sandboxed engine.
4. **MCP Server Bridge:** Expose AgentDeck diff state as native MCP tools to connect with external agent architectures.

---

## 2. V3 Technology Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          AGENTDECK PLATFORM (V3.0)                            │
├───────────────────────────────┬───────────────────────────────────────────────┤
│   FRONTEND ECOSYSTEM (PWA)    │   EXTENSIBLE RUST BACKEND CORE                │
│                               │                                               │
│ • Svelte PWA Web Application  │ • Axum HTTP/WS Server (Port 4020)             │
│ • @xterm/xterm Web Terminal   │ • Direct WebSocket PTY Streaming              │
│ • Webview Preview & Inspector │ • QR Code LAN Access Generator                │
│ • Plugin Marketplace / Loader │ • Native WASM/Extism Plugin Engine            │
│ • Direct Component Steering   │ • MCP Server Bridge & Hook Runner             │
└───────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 3. V3 Functional Requirements Breakdown

### 3.1 Module 1: Embedded Preview Browser & UI Component Steering (`PREVIEW-BROWSER`) *(Implemented)*
* **[V3-REQ-PREV-01] Embedded Webview Pane (`WebviewPane.svelte`):** Integrated web preview pane accessible via workspace header tabs with responsive viewports (Full Desktop, Tablet, Mobile) and URL bar navigation.
* **[V3-REQ-PREV-02] Dev Server Auto-Detection:** Scans active terminal output streams to auto-detect running local development servers (Vite, Next.js, Webpack, localhost ports like `5173`, `3000`, `8080`).
* **[V3-REQ-PREV-03] Interactive Element Crosshair Inspector:** Injects lightweight inspection harness into the preview iframe, highlighting hovered elements and extracting HTML snippets, tag names, CSS classes, selectors, and source mapping annotations.
* **[V3-REQ-PREV-04] Direct UI Component Steering (`webviewSteer.ts`):** Converts element inspection context and human feedback into structured prompts injected directly into the selected agent's stdin.

### 3.2 Module 2: Remote Access via LAN/VPN (`REMOTE-LAN`)
* **[V3-REQ-LAN-01] PWA Frontend Packaging:** Package the Svelte frontend as a Progressive Web App (PWA) accessible over standard web browsers.
* **[V3-REQ-LAN-02] Local Network Axum Server:** Host an internal HTTP/WebSocket server via Rust/Axum on port 4020.
* **[V3-REQ-LAN-03] Direct WebSocket PTY Streaming:** Stream the currently running local PTY session to the PWA frontend using `@xterm/xterm` over WebSocket (no SSH tunneling or Docker containers).
* **[V3-REQ-LAN-04] QR Code Access Generation:** Generate and display a QR code within the desktop app to quickly launch the workspace URL on mobile or tablet devices on the same Wi-Fi/VPN.

### 3.3 Module 3: Plugins & Diagnostic Hooks (`EXTENSIBILITY`)
* **[V3-REQ-EXT-01] WASM / Extism Plugin Runtime:** Sandboxed plugin engine for secure extension execution.
* **[V3-REQ-EXT-02] Pre-Steer & Post-Edit Hooks:** Automated linter and test runners feeding diagnostic errors directly into the steering prompts.

### 3.4 Module 4: MCP Server Bridge (`MCP-BRIDGE`)
* **[V3-REQ-MCP-01] Model Context Protocol Server:** Expose AgentDeck active diff state and review context directly as MCP tools for external integration.

---

## 4. V3 Work Breakdown Structure (WBS) & Task Checklist

### Phase 1: Embedded Preview Browser & UI Component Steering (Svelte 5 & Utils) *(Status: Implemented & Verified)*
- [x] **Task 1.1: Embedded Webview Canvas (`WebviewPane.svelte`)**
  - Responsive viewport switching (Desktop, Tablet, Mobile), address bar with normalization, external link opening, and reload trigger.
- [x] **Task 1.2: Dev Server URL Auto-Detection (`webviewSteer.ts`)**
  - Regex pattern matching across terminal output for Vite, Next.js, and localhost ports.
- [x] **Task 1.3: Interactive Element Crosshair Inspector**
  - Injected script with hover highlight bounds, selector computation, and component metadata extraction.
- [x] **Task 1.4: Direct Component Steering Injection**
  - Structured prompt formatting with bracketed paste terminal streaming.

---

### Phase 2: Remote Access via LAN/VPN
- [ ] **Task 2.1: Axum Web & WebSocket Server**
  - Serve PWA assets and establish WebSocket endpoints for PTY streams on Port 4020.
- [ ] **Task 2.2: PWA Frontend Optimization**
  - Configure the Svelte UI as a PWA, ensuring mobile/tablet responsive layouts for the xterm.js terminal interface.
- [ ] **Task 2.3: LAN IP & QR Code Generator**
  - Create a UI element to broadcast the local IP address and a scannable QR code for easy device pairing.

---

### Phase 3: Plugin System & Hook Runner
- [ ] **Task 3.1: WASM / Extism Plugin Host**
  - Embed lightweight WebAssembly runtime for sandboxed plugins.
- [ ] **Task 3.2: Automated Hook Runner**
  - Implement pre-steer and post-write triggers for linters and test suites.

---

### Phase 4: MCP Server Bridge
- [ ] **Task 4.1: MCP Protocol Integration**
  - Build MCP server adapter exposing AgentDeck's internal diff state and file tracking as native MCP tools.

---

## 5. Definition of Done (DoD) for Version 3.0

1. **Preview Browser & UI Component Steering:** Live web application preview with interactive DOM element inspection and direct context steering into agent sessions is fully functional.
2. **Remote LAN Access:** A user can scan a QR code from the desktop app using their phone/tablet on the same network to instantly view and interact with the active PTY session via a PWA and WebSockets.
3. **Plugin Safety:** WASM plugins execute safely in an isolated Extism memory space without compromising host security or performance.
4. **Hook Automation:** Diagnostic tools (linters/test runners) automatically feed execution output back into the "Steer Agent" workflow.
5. **MCP Bridge Integration:** External AI agents can read AgentDeck diff states directly via the standard Model Context Protocol.
