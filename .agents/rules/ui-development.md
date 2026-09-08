# 🎨 UI Development & Simplicity Directives

This project enforces strict UI simplicity, visual hierarchy, responsiveness, and Svelte 5 runes standards across all frontend components. For the complete reference, patterns, and component catalog, see [`.agents/skills/ui-development/SKILL.md`](file:///home/thanhduy/Projects/agent_deck/.agents/skills/ui-development/SKILL.md).

---

## 1. Core Directives & Simplicity Invariants

1. **Prefer Simplicity Over Visual Complexity:** Always question unnecessary elements:
   - *Is this element necessary?*
   - *Can this information be grouped with related information?*
   - *Can this action be moved into a secondary menu (`MoreHorizontal`)?*
   - *Can the number of visible controls be reduced?*
   - *Does this element compete with the primary content?*
   - *Is there already another UI element performing the same function?*
2. **Clear Navigation Hierarchy (Max 3 Levels):**
   - Level 1: Primary Navigation (`Sidebar.svelte` - projects & workspaces)
   - Level 2: Workspace / Session Navigation (Tabs in `TerminalView.svelte` / Header view switcher)
   - Level 3: Main Content Canvas (`TerminalView.svelte` / `DiffView.svelte`)
   - *Never duplicate navigation systems across bars.*
3. **Prioritize Main Content:** Embedded PTY terminal cockpit and Git diff canvas must dominate visual focus and screen space. Supporting toolbars and metadata must remain lightweight.
4. **Progressive Disclosure:** Keep high-frequency, critical actions visible; move secondary/infrequent actions into dropdowns (`MoreHorizontal` popover in Header), context menus, or modals.
5. **No Technical Metadata Overload:** Hide internal IDs, long paths, or verbose status codes by default. Use basenames and clean tooltips.
6. **Preserve Existing Functionality:** Never remove user capabilities without explicit confirmation. Reorganize or hide into secondary menus instead of deleting. Always preserve keyboard shortcuts (`Ctrl+B`, `Ctrl+`, `Alt+H`, `Alt+V`, `Alt+S`, `Alt+Z`, `Ctrl+Shift+T`, etc.).

---

## 2. Standard Shell Layout & Responsive Directives

```
┌────────────────────────────────────────────────────────┐
│ 1. Header (h-11, compact, active project, view switch) │
├───────────────┬────────────────────────────────────────┤
│ 2. Sidebar    │ 3. Main Workspace Canvas (flex-1)      │
│ (Collapsible: │    - Terminal Cockpit / Diff Review    │
│  w-60 / w-12  │ 4. Workspace Tabs (h-9, session tabs)  │
│  or Drawer)   │                                        │
├───────────────┴────────────────────────────────────────┤
│ 5. Minimal Status Bar (h-6, 24px, branch, sync status) │
└────────────────────────────────────────────────────────┘
```

- **Desktop (`>= 1024px`):** Expanded sidebar (`w-60`), split panes side-by-side, full labels.
- **Tablet (`768px - 1023px`):** Icon rail sidebar (`w-12`), compact tabs, preserved workspace.
- **Mobile (`< 768px`):** Hidden sidebar (`w-0`), slide-out drawer (`mobileSidebarOpen`), single view mode, zero horizontal overflow (`w-screen overflow-hidden min-w-0`).

---

## 3. Frontend Implementation Standards

- **Svelte 5 Runes Only:** Use `$state()`, `$derived()`, and `$effect()`. Never use legacy Svelte 3/4 `$: ` or `$store` subscriptions.
- **State Separation:** Business logic, IPC calls (`tauri.ts`), and global mutations belong in `appState.svelte.ts`. Components only trigger actions and bind to state.
- **Design Tokens:** Strictly use `deck-*` color classes (`bg-deck-bg`, `bg-deck-surface`, `bg-deck-card`, `border-deck-border`, `text-deck-muted`, `text-deck-bright`, `text-deck-accent`, `bg-emerald-600`, `bg-rose-600`, `bg-amber-600`).
- **Flexible Sizing:** Use `min-w-0` on flex items with truncating text. Never hardcode fixed pixel widths on layout panels.

---

## 4. UI Review Checklist (Verification Gate)

Before completing any UI task, verify:
- [ ] Is the primary user task visually obvious?
- [ ] Is the main content (terminal/diff) the visual focus?
- [ ] Are redundant navigation bars and duplicate actions eliminated?
- [ ] Are secondary actions placed into menus or modals?
- [ ] Is the layout responsive across desktop, tablet, and mobile?
- [ ] Is there zero horizontal overflow (`min-w-0`, `truncate`)?
- [ ] Are Svelte 5 runes and Tailwind `deck-*` tokens used consistently?
- [ ] Are all keyboard shortcuts and existing capabilities preserved?
- [ ] Is the result simpler, cleaner, and calmer than before?
