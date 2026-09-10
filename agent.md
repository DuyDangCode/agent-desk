# 🤖 AGENT.MD — OPERATIONAL DIRECTIVE & ROADMAP GUIDE
### *For AI Agents & Developers Building and Extending Kestrel*
*(Formerly AgentDeck)*

See [AGENT.md](file:///home/thanhduy/Projects/agent_deck/AGENT.md) for the complete operational directives, system invariants, coding standards, and roadmap implementation directives.

---

## Documentation & Architecture Sync Protocol

Every AI Agent and developer contributing code or refactoring Kestrel **MUST** strictly adhere to this synchronization protocol to maintain absolute architectural coherence across the repository.

### 1. The "Doc-Code Parity" Invariant
Whenever modifying code, adding features, or altering system architecture, the Agent is strictly required to execute the following 3-step sync:

1. **Mark WBS Task Completion:**
   * Open the target milestone specification file (e.g. [`docs/versions/version-2-multi-agent-power.md`](file:///home/thanhduy/Projects/agent_deck/docs/versions/version-2-multi-agent-power.md)) and update the task checklist item from `- [ ]` to `- [x]`.
2. **Log in `CHANGELOG.md`:**
   * Add a concise "What & Why" entry under the `[Unreleased]` section of [`CHANGELOG.md`](file:///home/thanhduy/Projects/agent_deck/CHANGELOG.md), grouping by functional module.
   * Categorize strictly using Keep a Changelog categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
3. **Sync Technical Architecture Blueprint:**
   * If the change introduces new data models, Rust crates, IPC channels, state stores, or modifications to data flow, update [`docs/ARCHITECTURE.md`](file:///home/thanhduy/Projects/agent_deck/docs/ARCHITECTURE.md) (including Mermaid flowcharts and the Architectural Evolution Matrix).

### 2. Official Version Release & Graduation Workflow
When graduating a milestone from `[Unreleased]` to an official release:

1. **Verify Definition of Done (DoD):** Ensure all criteria listed in the version's DoD checklist are verified and passing cleanly.
2. **Version Bumping:** Update version strings across `package.json`, `src-tauri/Cargo.toml`, `server/Cargo.toml`, and `src-tauri/tauri.conf.json`.
3. **Changelog Cutover:**
   * Rename `## [Unreleased]` section to `## [X.Y.Z] - YYYY-MM-DD`.
   * Create a fresh, empty `## [Unreleased]` section at the top.
   * Update bottom comparison links.
4. **Git Tagging:**
   * Commit with message: `chore(release): bump version to vX.Y.Z`
   * Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`

