# AGENTDECK - PRODUCT ROADMAP & VERSION DIRECTORY

---

## 1. Roadmap Overview

The AgentDeck product lifecycle progresses through three distinct milestones designed to scale from a lean, rock-solid MVP into an extensible platform ecosystem:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               AGENTDECK RELEASE TIMELINE                               │
├──────────────────────────────┬─────────────────────────────┬───────────────────────────┤
│    VERSION 1.0 (MVP)         │      VERSION 2.0            │      VERSION 3.0          │
│    Core Review Harness       │  Multi-Agent & Advanced UI  │  Platform & Extensibility │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ • Embedded Native PTY        │ • Horizontal Project Bar    │ • Remote SSH / Docker PTY │
│ • Multi-Session PTY Deck     │ • Parallel Multi-Project Deck│ • Session Recording/Replay│
│ • Debounced Real-Time Diffs  │ • Intra-Line Token Diffs    │ • Plugin System (WASM)    │
│ • Multi-Line Drag Steering   │ • Custom Prompt Templates   │ • MCP Protocol & Hooks    │
│ • Desktop File Explorer      │ • AI Commit Message Synth   │ • Team Sharing & Patches  │
│ • Memory Footprint < 50MB    │ • Split Terminal Decks      │                           │
│                              │ • Markdown Render Preview   │                           │
│                              │ • File Explorer Dir/Git Ops │                           │
│                              │ • Memory Footprint < 90MB   │                           │
└──────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 2. Version Specifications Directory

| Document | Target Milestone | Status | Key Deliverable |
| :--- | :--- | :---: | :--- |
| **[version-1-mvp.md](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md)** | **Version 1.0.0 (MVP)** | ✅ Released | Core multi-session harness, real-time live diffs, multi-line drag steering, file explorer, agent detection, hunk staging/commit |
| **[version-2-multi-agent-power.md](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md)** | **Version 2.0.0** | ✅ Implemented & Verified | Horizontal project navigation bar, parallel multi-project workspaces, intra-line diffing, Markdown render preview, custom prompt templates, AI commit synthesis, split terminal grid, File Explorer dir/git operations |
| **[version-3-enterprise-ecosystem.md](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-3-enterprise-ecosystem.md)** | **Version 3.0.0** | 🔮 Future Vision | Remote SSH / Docker harnesses, time-travel session recording, WASM plugins, MCP sidecars |

---

## 3. Requirement Traceability Matrix (URD ➔ Versions)

Cross-referencing the requirements from [docs/user-requirement.md](file:///home/thanhduy/Projects/agent_deck/docs/user-requirement.md):

| URD Requirement ID | Requirement Name | Targeted Release | Status | Specification Link |
| :--- | :--- | :---: | :---: | :--- |
| **FR-PROJ-01..08** | Multi-Project Bar, Folder Attachment, Parallel Workspaces, Persistence & Hotkeys | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#31-module-1-multi-project-management--horizontal-navigation-bar-proj) |
| **FR-WS-01..04** | Workspace, File Explorer & Git Repository Management | **V1 (MVP)** | ✅ Delivered | [V1 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md#31-module-1-workspace--environment-ws) |
| **FR-WS-05..06** | File Explorer Directory Creation & 1-Click Git Initialization | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#35-module-5-release--commit-intelligence-smart-git) |
| **FR-TERM-01..06** | Multi-Session PTY, WebGL ANSI, Quick Launch, Agent Detection | **V1 (MVP)** | ✅ Delivered | [V1 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md#32-module-2-native-embedded-pty--terminal-cockpit-term) |
| **FR-TERM-07..08** | Split Terminal Panes (Single, Side-by-Side, Stacked), Pane Toolbars & Focus Routing | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#32-module-2-multi-session-terminal-deck-multi-term) |
| **FR-TERM-09..10** | Terminal Navigation Hotkeys (`Ctrl+Shift+T/W/P/Arrows`) & Agent Exit Clean Status Reset | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#32-module-2-multi-session-terminal-deck-multi-term) |
| **FR-DIFF-01..05** | Debounced Live Diffs, File List, Myers Untracked Diffs, Split & Unified | **V1 (MVP)** | ✅ Delivered | [V1 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md#33-module-3-real-time-differential--review-canvas-diff) |
| **FR-DIFF-06** | Intra-Line Word / Character Diffs | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#33-module-3-advanced-review--diff-canvas-adv-diff) |
| **FR-DIFF-07** | Rich Markdown Render Preview & Diff Engine (`.md`, `.markdown`, `.mdx`) | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#33-module-3-advanced-review--diff-canvas-adv-diff) |
| **FR-STR-01..05** | Multi-Line Drag Steer, Agent Safety Gate, Bracketed Paste Stdin Inject | **V1 (MVP)** | ✅ Delivered | [V1 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md#34-module-4-human-steering--context-injection-steer) |
| **FR-GIT-01..04** | Granular Hunk Staging, Hallucination Discard, libgit2 Commit Panel | **V1 (MVP)** | ✅ Delivered | [V1 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-1-mvp.md#35-module-5-staging-discard--commit-gate-git) |
| **FR-GIT-05** | AI-Assisted Commit Message Synthesis | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#35-module-5-release--commit-intelligence-smart-git) |
| **FR-GIT-06..07** | Real-Time Push/Pull Loading Notifications & Remote Branch Protection | **V2.0** | ✅ Delivered | [V2 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md#35-module-5-release--commit-intelligence-smart-git) |
| **Extended Extensibility** | Remote SSH, Docker Containers, WASM Plugins, MCP Bridge | **V3.0** | 🔮 Future | [V3 Spec](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-3-enterprise-ecosystem.md) |
