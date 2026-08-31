import type { 
  RepoInfo, 
  FileDiff, 
  SteerContext, 
  PtySession, 
  DirectoryListing,
  AgentKind,
  ProjectItem,
  TerminalLayout,
  PromptTemplate,
  BranchInfo,
  StashInfo
} from '$lib/types';
import {
  openRepository,
  unwatchRepository,
  getRepositoryDiffs,
  stageFile as apiStageFile,
  unstageFile as apiUnstageFile,
  stageAll as apiStageAll,
  unstageAll as apiUnstageAll,
  stageHunk as apiStageHunk,
  unstageHunk as apiUnstageHunk,
  discardHunk as apiDiscardHunk,
  discardFile as apiDiscardFile,
  commitStaged as apiCommitStaged,
  commitAmend as apiCommitAmend,
  listBranches as apiListBranches,
  checkoutBranch as apiCheckoutBranch,
  createBranch as apiCreateBranch,
  stashSave as apiStashSave,
  stashPop as apiStashPop,
  listStashes as apiListStashes,
  writePty,
  killPty,
  getDefaultWorkingDir,
  listDirectoryFolders,
  listenEvent
} from '$lib/utils/tauri';

const DIFF_VIEW_MODE_KEY = 'agentdeck_diff_view_mode';
const DIFF_WRAP_LINES_KEY = 'agentdeck_diff_wrap_lines';
const SHOW_TERMINAL_KEY = 'agentdeck_show_terminal';
const SHOW_REVIEW_KEY = 'agentdeck_show_review';
const LAYOUT_MODE_KEY = 'agentdeck_layout_mode';
const PROJECTS_STORAGE_KEY = 'agentdeck_v2_projects';
const ACTIVE_PROJECT_KEY = 'agentdeck_v2_active_project_id';
const TEMPLATES_STORAGE_KEY = 'agentdeck_v2_templates';
const LLM_SETTINGS_KEY = 'agentdeck_v2_llm_settings';
const TERMINAL_SPLIT_KEY = 'agentdeck_terminal_split';

function getInitialTerminalSplit(): number {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(TERMINAL_SPLIT_KEY);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) return parsed;
      }
    } catch {}
  }
  return 50;
}

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default-explain-code',
    title: 'Explain Code & Removal Impact',
    description: 'Explain function role, why it was coded this way, and what breaks if removed',
    template: `[Code Review Explanation Request]
File: {{file}} ({{lines}})
Project: {{project}}

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Please thoroughly explain the selected code above:
1. **Purpose & Role**: What does this function / block do and what role does it play in the codebase?
2. **Design Rationale**: Why is it coded like this? What specific problem, edge case, or constraint is it addressing?
3. **Removal Impact & Consequence**: If we remove or delete this code, what will break or what behavior will change?
4. **Summary & Recommendation**: Is this implementation necessary, or is there any cleaner alternative? {{instructions}}`,
    isBuiltin: true,
  },
  {
    id: 'default-refactor',
    title: 'Refactor & Clean',
    description: 'Simplify structure, eliminate code duplication, and improve maintainability',
    template: `[Code Review Feedback]
File: {{file}} ({{lines}})
Project: {{project}}

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Please refactor the code snippet above to simplify logic, remove redundancy, and enhance code clarity while maintaining identical external behavior. {{instructions}}`,
    isBuiltin: true,
  },
  {
    id: 'default-unit-test',
    title: 'Add Comprehensive Unit Tests',
    description: 'Generate unit tests covering edge cases, assertions, and mock boundaries',
    template: `[Code Review Feedback]
File: {{file}} ({{lines}})

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Write comprehensive unit tests for the selected code above. Cover edge cases, error states, and normal execution paths. Ensure clean assertions and mocks where appropriate. {{instructions}}`,
    isBuiltin: true,
  },
  {
    id: 'default-fix-bug',
    title: 'Fix Bug & Add Validation',
    description: 'Resolve logic flaws, null dereferences, or incorrect edge case handling',
    template: `[Code Review Feedback]
File: {{file}} ({{lines}})

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Diagnose and fix the defect in this code. Add defensive checks and runtime validation to prevent regressions. {{instructions}}`,
    isBuiltin: true,
  },
  {
    id: 'default-optimize',
    title: 'Optimize Memory & Speed',
    description: 'Identify bottlenecks, reduce allocations, and optimize algorithmic complexity',
    template: `[Code Review Feedback]
File: {{file}} ({{lines}})

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Analyze this code for performance and memory optimization. Minimize unneeded allocations, reduce complexity, and improve throughput without sacrificing clarity. {{instructions}}`,
    isBuiltin: true,
  },
  {
    id: 'default-security',
    title: 'Security Hardening',
    description: 'Sanitize inputs, secure access points, and eliminate vulnerabilities',
    template: `[Code Review Feedback]
File: {{file}} ({{lines}})

Snippet:
\`\`\`
{{code}}
\`\`\`

Instructions: Review and harden this code against security risks, input injection, race conditions, or unhandled errors. Apply standard defense-in-depth patterns. {{instructions}}`,
    isBuiltin: true,
  },
];

function getInitialDiffViewMode(): 'split' | 'unified' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(DIFF_VIEW_MODE_KEY);
      if (saved === 'split' || saved === 'unified') return saved;
    } catch {}
  }
  return 'unified';
}

function getInitialDiffWrapLines(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(DIFF_WRAP_LINES_KEY);
      if (saved !== null) return saved === 'true';
    } catch {}
  }
  return true;
}

function getInitialShowTerminal(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(SHOW_TERMINAL_KEY);
      if (saved !== null) return saved === 'true';
    } catch {}
  }
  return true;
}

function getInitialShowReview(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(SHOW_REVIEW_KEY);
      if (saved !== null) return saved === 'true';
    } catch {}
  }
  return true;
}

function getInitialLayoutMode(): 'split' | 'single' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LAYOUT_MODE_KEY);
      if (saved === 'split' || saved === 'single') return saved;
    } catch {}
  }
  return 'split';
}

function loadStoredTemplates(): PromptTemplate[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((t: PromptTemplate) => t.id));
          const missingBuiltins = BUILTIN_TEMPLATES.filter((bt) => !existingIds.has(bt.id));
          return [...parsed, ...missingBuiltins];
        }
      }
    } catch {}
  }
  return BUILTIN_TEMPLATES;
}

export interface LlmSettings {
  provider: 'rule-based' | 'openai' | 'ollama' | 'anthropic' | 'custom';
  endpoint: string;
  apiKey: string;
  model: string;
}

function loadStoredLlmSettings(): LlmSettings {
  const defaultSettings: LlmSettings = {
    provider: 'rule-based',
    endpoint: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3:latest',
  };
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LLM_SETTINGS_KEY);
      if (raw) {
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch {}
  }
  return defaultSettings;
}

class AppState {
  // 1. Multi-Project Deck State
  projects = $state<ProjectItem[]>([]);
  activeProjectId = $state<string>('');

  // Global layout & UI preferences
  diffViewMode = $state<'split' | 'unified'>(getInitialDiffViewMode());
  wrapLines = $state<boolean>(getInitialDiffWrapLines());
  layoutMode = $state<'split' | 'single'>(getInitialLayoutMode());
  activeSingleTab = $state<'terminal' | 'review'>('terminal');
  showTerminal = $state<boolean>(getInitialShowTerminal());
  showReview = $state<boolean>(getInitialShowReview());

  // Folder Picker Modal
  folderPickerOpen = $state<boolean>(false);
  directoryListing = $state<DirectoryListing | null>(null);
  isLoadingDirs = $state<boolean>(false);

  // Steer Context & Templates
  steerModalOpen = $state<boolean>(false);
  steerContext = $state<SteerContext | null>(null);
  steerFeedback = $state<string>('');
  steerTargetSessionId = $state<string | null>(null);
  templates = $state<PromptTemplate[]>(loadStoredTemplates());
  activeTemplateId = $state<string>('default-refactor');

  // Git Branches & Stashes Modal
  branchModalOpen = $state<boolean>(false);
  branches = $state<BranchInfo[]>([]);
  stashes = $state<StashInfo[]>([]);
  isLoadingBranches = $state<boolean>(false);

  // Commit Panel & AI Generation
  commitPanelOpen = $state<boolean>(false);
  commitMessage = $state<string>('');
  isCommitting = $state<boolean>(false);
  isGeneratingCommit = $state<boolean>(false);
  isAmendMode = $state<boolean>(false);

  // Discard Confirmation Modal
  discardModalOpen = $state<boolean>(false);
  discardTarget = $state<{ path: string; hunkIndex?: number; isHunk: boolean } | null>(null);

  // Settings Modal & LLM Settings
  settingsModalOpen = $state<boolean>(false);
  settingsModalTab = $state<'appearance' | 'templates' | 'llm' | 'shortcuts' | 'about'>('appearance');
  llmSettings = $state<LlmSettings>(loadStoredLlmSettings());

  openSettings(tab: 'appearance' | 'templates' | 'llm' | 'shortcuts' | 'about' = 'appearance') {
    this.settingsModalTab = tab;
    this.settingsModalOpen = true;
  }

  closeSettings() {
    this.settingsModalOpen = false;
  }

  // Standalone Prompt Template Dialog Modal
  templateModalOpen = $state<boolean>(false);
  editingTemplateId = $state<string | null>(null);
  templateFormTitle = $state<string>('');
  templateFormDesc = $state<string>('');
  templateFormBody = $state<string>('');

  openNewTemplateModal() {
    this.editingTemplateId = null;
    this.templateFormTitle = '';
    this.templateFormDesc = '';
    this.templateFormBody = `[Code Review Feedback]\nFile: {{file}} ({{lines}})\nProject: {{project}}\n\nSnippet:\n\`\`\`\n{{code}}\n\`\`\`\n\nInstructions: {{instructions}}`;
    this.templateModalOpen = true;
    this.showToast('✨ Opened Prompt Template Builder', 'info');
  }

  openEditTemplateModal(tmpl: PromptTemplate) {
    this.editingTemplateId = tmpl.id;
    this.templateFormTitle = tmpl.title;
    this.templateFormDesc = tmpl.description || '';
    this.templateFormBody = tmpl.template;
    this.templateModalOpen = true;
  }

  closeTemplateModal() {
    this.templateModalOpen = false;
    this.editingTemplateId = null;
  }

  saveTemplateFromModal() {
    if (!this.templateFormTitle.trim()) {
      this.showToast('Please enter a template title', 'error');
      return false;
    }
    if (!this.templateFormBody.trim()) {
      this.showToast('Please enter template prompt markdown', 'error');
      return false;
    }
    if (this.editingTemplateId) {
      this.updateTemplate(this.editingTemplateId, this.templateFormTitle, this.templateFormDesc, this.templateFormBody);
    } else {
      this.addTemplate(this.templateFormTitle, this.templateFormDesc, this.templateFormBody);
    }
    this.closeTemplateModal();
    return true;
  }

  // Toast notifications
  toastMessage = $state<string | null>(null);
  toastType = $state<'success' | 'info' | 'error'>('info');
  private toastTimer: any = null;

  constructor() {}

  // -------------------------------------------------------------
  // Getters for Active Project (Seamless backward-compatible access)
  // -------------------------------------------------------------
  get activeProject(): ProjectItem | undefined {
    return this.projects.find((p) => p.id === this.activeProjectId) || this.projects[0];
  }

  get repoPath(): string {
    return this.activeProject?.path || '';
  }

  get repoInfo(): RepoInfo | null {
    return this.activeProject?.info || null;
  }

  get files(): FileDiff[] {
    return this.activeProject?.files || [];
  }

  get selectedFilePath(): string | null {
    return this.activeProject?.selectedFilePath ?? null;
  }

  set selectedFilePath(val: string | null) {
    if (this.activeProject) this.activeProject.selectedFilePath = val;
  }

  get selectedIsStaged(): boolean {
    return this.activeProject?.selectedIsStaged ?? false;
  }

  set selectedIsStaged(val: boolean) {
    if (this.activeProject) this.activeProject.selectedIsStaged = val;
  }

  get fileFilter(): 'all' | 'staged' | 'unstaged' {
    return this.activeProject?.fileFilter || 'all';
  }

  set fileFilter(val: 'all' | 'staged' | 'unstaged') {
    if (this.activeProject) this.activeProject.fileFilter = val;
  }

  get fileExtensionFilter(): string {
    return this.activeProject?.fileExtensionFilter || 'all';
  }

  set fileExtensionFilter(val: string) {
    if (this.activeProject) this.activeProject.fileExtensionFilter = val;
  }

  get searchQuery(): string {
    return this.activeProject?.searchQuery || '';
  }

  set searchQuery(val: string) {
    if (this.activeProject) this.activeProject.searchQuery = val;
  }

  get sessions(): PtySession[] {
    return this.activeProject?.sessions || [];
  }

  set sessions(val: PtySession[]) {
    if (this.activeProject) this.activeProject.sessions = val;
  }

  get allSessions(): PtySession[] {
    const list: PtySession[] = [];
    for (const p of this.projects) {
      list.push(...p.sessions);
    }
    return list;
  }

  findSessionCwd(sessionId: string): string | undefined {
    for (const p of this.projects) {
      const found = p.sessions.find((s) => s.id === sessionId);
      if (found) return found.cwd || p.path;
    }
    return undefined;
  }

  get activeSessionId(): string {
    return this.activeProject?.activeSessionId || '';
  }

  set activeSessionId(val: string) {
    if (this.activeProject) this.activeProject.activeSessionId = val;
  }

  get secondarySessionId(): string | null {
    return this.activeProject?.secondarySessionId || null;
  }

  set secondarySessionId(val: string | null) {
    if (this.activeProject) this.activeProject.secondarySessionId = val;
  }

  get focusedPane(): 'primary' | 'secondary' {
    return this.activeProject?.focusedPane || 'primary';
  }

  set focusedPane(val: 'primary' | 'secondary') {
    if (this.activeProject) this.activeProject.focusedPane = val;
  }

  get terminalSplitPercent(): number {
    return this.activeProject?.terminalSplitPercent ?? 50;
  }

  set terminalSplitPercent(val: number) {
    const clamped = Math.min(Math.max(val, 20), 80);
    if (this.activeProject) this.activeProject.terminalSplitPercent = clamped;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TERMINAL_SPLIT_KEY, String(clamped));
      } catch {}
    }
  }

  get terminalLayout(): TerminalLayout {
    return this.activeProject?.terminalLayout || 'single';
  }

  set terminalLayout(val: TerminalLayout) {
    if (this.activeProject) this.activeProject.terminalLayout = val;
  }

  get focusedSessionId(): string {
    if (this.terminalLayout !== 'single' && this.focusedPane === 'secondary' && this.secondarySessionId) {
      return this.secondarySessionId;
    }
    return this.activeSessionId;
  }

  get activeSession(): PtySession | undefined {
    return this.sessions.find((s) => s.id === this.activeSessionId);
  }

  get secondarySession(): PtySession | undefined {
    return this.sessions.find((s) => s.id === this.secondarySessionId);
  }

  get focusedSession(): PtySession | undefined {
    return this.sessions.find((s) => s.id === this.focusedSessionId);
  }

  get isLoading(): boolean {
    return this.activeProject?.isLoading ?? false;
  }

  set isLoading(val: boolean) {
    if (this.activeProject) this.activeProject.isLoading = val;
  }

  get isRefreshing(): boolean {
    return this.activeProject?.isRefreshing ?? false;
  }

  set isRefreshing(val: boolean) {
    if (this.activeProject) this.activeProject.isRefreshing = val;
  }

  get selectedFileDiff(): FileDiff | undefined {
    return this.files.find(
      (f) => f.path === this.selectedFilePath && f.is_staged === this.selectedIsStaged
    );
  }

  get agentSessions(): PtySession[] {
    return this.sessions.filter((s) => s.isAgent);
  }

  get availableExtensions(): string[] {
    const extSet = new Set<string>();
    for (const f of this.files) {
      const match = f.path.match(/(\.[a-zA-Z0-9_\-]+)$/);
      if (match) {
        extSet.add(match[1].toLowerCase());
      }
    }
    return Array.from(extSet).sort();
  }

  // -------------------------------------------------------------
  // Toast Notifications
  // -------------------------------------------------------------
  showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  // -------------------------------------------------------------
  // Workspace & Multi-Project Initialization
  // -------------------------------------------------------------
  async initWorkspace() {
    // 1. Try restoring attached projects from localStorage
    let restoredPaths: string[] = [];
    let savedActiveId: string | null = null;

    if (typeof window !== 'undefined') {
      try {
        const rawProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (rawProjects) {
          const parsed = JSON.parse(rawProjects);
          if (Array.isArray(parsed) && parsed.length > 0) {
            restoredPaths = parsed.map((p: any) => (typeof p === 'string' ? p : p.path)).filter(Boolean);
          }
        }
        savedActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      } catch (e) {
        console.warn('Failed to parse stored projects:', e);
      }
    }

    if (restoredPaths.length > 0) {
      for (const path of restoredPaths) {
        await this.attachProject(path, false);
      }
      if (savedActiveId && this.projects.some((p) => p.id === savedActiveId)) {
        this.activeProjectId = savedActiveId;
      }
    } else {
      // Auto-load default directory
      try {
        const defaultDir = await getDefaultWorkingDir();
        if (defaultDir) {
          await this.attachProject(defaultDir, true);
        }
      } catch (e: any) {
        console.warn('Workspace auto-init default dir error:', e?.message || e);
      }
    }

    // 2. Global listener for multi-path filesystem watcher events
    listenEvent<{ repo_path: string; changed_paths: string[] }>('repo-changed', (payload) => {
      if (payload?.repo_path) {
        this.handleRepoChangedEvent(payload.repo_path);
      }
    });
  }

  private handleRepoChangedEvent(repoPath: string) {
    const targetProject = this.projects.find(
      (p) => p.path.toLowerCase() === repoPath.toLowerCase()
    );
    if (targetProject) {
      this.refreshProjectDiffs(targetProject.id, true);
    }
  }

  // -------------------------------------------------------------
  // Multi-Project Deck Management (Module 1)
  // -------------------------------------------------------------
  async attachProject(path: string, switchTo = true): Promise<string> {
    const normPath = path.trim().replace(/\/+$/, '');
    // Check if project is already attached
    const existing = this.projects.find(
      (p) => p.path.toLowerCase() === normPath.toLowerCase()
    );
    if (existing) {
      if (switchTo) {
        this.switchProject(existing.id);
      }
      return existing.id;
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const folderName = normPath.split('/').filter(Boolean).pop() || 'Project';

    const initialSessionId = `session-${projectId}-1`;
    const newProject: ProjectItem = {
      id: projectId,
      path: normPath,
      name: folderName,
      info: null,
      files: [],
      selectedFilePath: null,
      selectedIsStaged: false,
      fileFilter: 'all',
      fileExtensionFilter: 'all',
      searchQuery: '',
      sessions: [
        {
          id: initialSessionId,
          title: 'Terminal (1)',
          cwd: normPath,
          active: true,
          isAgent: false,
          agentKind: 'shell',
        },
      ],
      activeSessionId: initialSessionId,
      secondarySessionId: null,
      focusedPane: 'primary',
      terminalLayout: 'single',
      terminalSplitPercent: getInitialTerminalSplit(),
      isRefreshing: false,
      isLoading: true,
    };

    this.projects = [...this.projects, newProject];
    if (switchTo || this.projects.length === 1) {
      this.activeProjectId = projectId;
    }

    this.saveProjects();

    try {
      const info = await openRepository(normPath);
      newProject.name = info.name || folderName;
      newProject.info = info;
      await this.refreshProjectDiffs(projectId, false);
      if (switchTo) {
        this.showToast(`Attached workspace: ${info.name}`, 'success');
      }
    } catch (e: any) {
      console.warn(`Could not open git repo for "${normPath}":`, e);
      newProject.isLoading = false;
      this.showToast(`Attached folder "${folderName}" (Non-git or initial repo)`, 'info');
    }

    this.folderPickerOpen = false;
    return projectId;
  }

  async loadRepository(path: string): Promise<string> {
    return this.attachProject(path, true);
  }

  switchProject(projectId: string) {
    const target = this.projects.find((p) => p.id === projectId);
    if (target) {
      this.activeProjectId = projectId;
      this.saveProjects();
      this.refreshProjectDiffs(projectId, true);
      this.notifyResize();
    }
  }

  async closeProject(projectId: string) {
    const projectIdx = this.projects.findIndex((p) => p.id === projectId);
    if (projectIdx === -1) return;

    const project = this.projects[projectIdx];
    
    // Kill PTY sessions for closed project
    for (const session of project.sessions) {
      killPty(session.id).catch(() => {});
    }

    // Unwatch path if no other project is using it
    const remainingWithSamePath = this.projects.filter(
      (p) => p.id !== projectId && p.path.toLowerCase() === project.path.toLowerCase()
    );
    if (remainingWithSamePath.length === 0) {
      unwatchRepository(project.path).catch(() => {});
    }

    this.projects = this.projects.filter((p) => p.id !== projectId);

    if (this.activeProjectId === projectId) {
      const nextProj = this.projects[Math.max(0, projectIdx - 1)] || this.projects[0];
      if (nextProj) {
        this.activeProjectId = nextProj.id;
      } else {
        this.activeProjectId = '';
      }
    }

    this.saveProjects();
    this.showToast(`Detached project: ${project.name}`, 'info');
  }

  cycleProject(direction: 1 | -1 = 1) {
    if (this.projects.length <= 1) return;
    const currentIdx = this.projects.findIndex((p) => p.id === this.activeProjectId);
    const nextIdx = (currentIdx + direction + this.projects.length) % this.projects.length;
    this.switchProject(this.projects[nextIdx].id);
  }

  selectProjectByIndex(index: number) {
    if (index >= 0 && index < this.projects.length) {
      this.switchProject(this.projects[index].id);
    }
  }

  private saveProjects() {
    if (typeof window !== 'undefined') {
      try {
        const payload = this.projects.map((p) => ({
          id: p.id,
          path: p.path,
          name: p.name,
        }));
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(payload));
        localStorage.setItem(ACTIVE_PROJECT_KEY, this.activeProjectId);
      } catch (e) {
        console.warn('Failed to save projects to localStorage:', e);
      }
    }
  }

  // -------------------------------------------------------------
  // Diff Refreshing Scoped by Project
  // -------------------------------------------------------------
  async refreshDiffs(background = false) {
    if (this.activeProjectId) {
      await this.refreshProjectDiffs(this.activeProjectId, background);
    }
  }

  async refreshProjectDiffs(projectId: string, background = false) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project || !project.path) return;

    try {
      if (background) {
        project.isRefreshing = true;
      } else {
        project.isLoading = true;
      }

      const diffData = await getRepositoryDiffs(project.path);
      project.info = diffData.info;
      project.files = diffData.files;

      if (project.files.length > 0) {
        const stillExists = project.files.some(
          (f) => f.path === project.selectedFilePath && f.is_staged === project.selectedIsStaged
        );
        if (!stillExists || !project.selectedFilePath) {
          project.selectedFilePath = project.files[0].path;
          project.selectedIsStaged = project.files[0].is_staged;
        }
      } else {
        project.selectedFilePath = null;
      }
    } catch (e: any) {
      console.warn(`Failed to refresh diffs for ${project.path}:`, e);
    } finally {
      project.isLoading = false;
      project.isRefreshing = false;
    }
  }

  // -------------------------------------------------------------
  // Git Actions (Staging / Discard / Commits)
  // -------------------------------------------------------------
  async stageFile(relativePath: string) {
    if (!this.repoPath) return;
    try {
      await apiStageFile(this.repoPath, relativePath);
      await this.refreshDiffs(true);
      this.showToast(`Staged ${relativePath}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to stage file: ${e?.message || e}`, 'error');
    }
  }

  async unstageFile(relativePath: string) {
    if (!this.repoPath) return;
    try {
      await apiUnstageFile(this.repoPath, relativePath);
      await this.refreshDiffs(true);
      this.showToast(`Unstaged ${relativePath}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to unstage file: ${e?.message || e}`, 'error');
    }
  }

  async stageAll() {
    if (!this.repoPath) return;
    try {
      await apiStageAll(this.repoPath);
      await this.refreshDiffs(true);
      this.showToast('Staged all modified files', 'success');
    } catch (e: any) {
      this.showToast(`Failed to stage all: ${e?.message || e}`, 'error');
    }
  }

  async unstageAll() {
    if (!this.repoPath) return;
    try {
      await apiUnstageAll(this.repoPath);
      await this.refreshDiffs(true);
      this.showToast('Unstaged all files', 'success');
    } catch (e: any) {
      this.showToast(`Failed to unstage all: ${e?.message || e}`, 'error');
    }
  }

  async stageHunk(relativePath: string, hunkIndex: number) {
    if (!this.repoPath) return;
    try {
      await apiStageHunk(this.repoPath, relativePath, hunkIndex);
      await this.refreshDiffs(true);
      this.showToast(`Staged hunk #${hunkIndex + 1}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to stage hunk: ${e?.message || e}`, 'error');
    }
  }

  async unstageHunk(relativePath: string, hunkIndex: number) {
    if (!this.repoPath) return;
    try {
      await apiUnstageHunk(this.repoPath, relativePath, hunkIndex);
      await this.refreshDiffs(true);
      this.showToast(`Unstaged hunk #${hunkIndex + 1}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to unstage hunk: ${e?.message || e}`, 'error');
    }
  }

  confirmDiscardFile(path: string) {
    this.discardTarget = { path, isHunk: false };
    this.discardModalOpen = true;
  }

  confirmDiscardHunk(path: string, hunkIndex: number) {
    this.discardTarget = { path, hunkIndex, isHunk: true };
    this.discardModalOpen = true;
  }

  async executeDiscard() {
    if (!this.discardTarget || !this.repoPath) return;
    try {
      if (this.discardTarget.isHunk && this.discardTarget.hunkIndex !== undefined) {
        await apiDiscardHunk(this.repoPath, this.discardTarget.path, this.discardTarget.hunkIndex);
        this.showToast(`Discarded hunk #${this.discardTarget.hunkIndex + 1}`, 'success');
      } else {
        await apiDiscardFile(this.repoPath, this.discardTarget.path);
        this.showToast(`Discarded modifications in ${this.discardTarget.path}`, 'success');
      }
      this.discardModalOpen = false;
      this.discardTarget = null;
      await this.refreshDiffs(true);
    } catch (e: any) {
      this.showToast(`Discard failed: ${e?.message || e}`, 'error');
    }
  }

  async commitChanges() {
    if (!this.commitMessage.trim() || !this.repoPath) return;
    try {
      this.isCommitting = true;
      let res;
      if (this.isAmendMode) {
        res = await apiCommitAmend(this.repoPath, this.commitMessage);
        this.showToast(`Amended commit [${res.commit_short}]: ${res.message}`, 'success');
      } else {
        res = await apiCommitStaged(this.repoPath, this.commitMessage);
        this.showToast(`Committed [${res.commit_short}]: ${res.message}`, 'success');
      }
      this.commitMessage = '';
      this.commitPanelOpen = false;
      this.isAmendMode = false;
      await this.refreshDiffs(true);
    } catch (e: any) {
      this.showToast(`Commit failed: ${e?.message || e}`, 'error');
    } finally {
      this.isCommitting = false;
    }
  }

  // -------------------------------------------------------------
  // AI Commit Synthesis Engine (Module 5)
  // -------------------------------------------------------------
  async generateCommitMessageAI() {
    const staged = this.files.filter((f) => f.is_staged);
    if (staged.length === 0) {
      this.showToast('No staged files to generate commit message from', 'error');
      return;
    }

    try {
      this.isGeneratingCommit = true;

      // Extract high-level summary from staged files and hunks
      const fileSummaries = staged.map((f) => {
        const fileType = f.path.split('.').pop() || '';
        const hunkHeaders = f.hunks.map((h) => h.header).slice(0, 3);
        return {
          path: f.path,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          fileType,
          hunkHeaders,
        };
      });

      // Semantic rule-based synthesis with conventional commit tags
      const hasTests = fileSummaries.some((f) => f.path.includes('test') || f.path.includes('spec'));
      const hasDocs = fileSummaries.some((f) => f.path.endsWith('.md') || f.path.includes('doc'));
      const hasStyle = fileSummaries.some((f) => f.path.endsWith('.css') || f.path.endsWith('.scss'));
      const isRefactorOnly = fileSummaries.every((f) => f.status === 'modified' && f.deletions > 0 && f.additions > 0);
      const isNewFeature = fileSummaries.some((f) => f.status === 'added' || f.additions > 30);

      let prefix = 'feat';
      if (hasTests && fileSummaries.length === 1) prefix = 'test';
      else if (hasDocs && fileSummaries.length === 1) prefix = 'docs';
      else if (hasStyle && fileSummaries.length === 1) prefix = 'style';
      else if (isRefactorOnly) prefix = 'refactor';
      else if (!isNewFeature && fileSummaries.some((f) => f.status === 'modified')) prefix = 'fix';

      // Scope detection from top directory or file name
      let scope = '';
      const firstFile = fileSummaries[0].path;
      const parts = firstFile.split('/');
      if (parts.length > 1) {
        scope = `(${parts[0]})`;
      }

      // Action summary
      const filesCount = fileSummaries.length;
      let summaryText = '';
      if (filesCount === 1) {
        const baseName = parts[parts.length - 1];
        summaryText = `${prefix}${scope}: update ${baseName}`;
      } else {
        summaryText = `${prefix}${scope}: update ${filesCount} files across ${parts[0] || 'workspace'}`;
      }

      // If user configured custom LLM endpoint, try synthesis via LLM bridge
      if (this.llmSettings.provider !== 'rule-based' && this.llmSettings.endpoint) {
        try {
          const diffSummaryText = staged.map((f) => `${f.status.toUpperCase()}: ${f.path} (+${f.additions}, -${f.deletions})`).join('\n');
          const response = await fetch(`${this.llmSettings.endpoint.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.llmSettings.apiKey ? { Authorization: `Bearer ${this.llmSettings.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: this.llmSettings.model || 'llama3',
              messages: [
                {
                  role: 'system',
                  content: 'You are a Git commit generator. Reply ONLY with a single conventional commit message (1 line summary). Do not wrap in quotes or explanations.',
                },
                {
                  role: 'user',
                  content: `Generate a conventional commit message for these staged Git changes:\n${diffSummaryText}`,
                },
              ],
              temperature: 0.2,
              max_tokens: 60,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const generated = data?.choices?.[0]?.message?.content?.trim();
            if (generated) {
              summaryText = generated.replace(/^["']|["']$/g, '');
            }
          }
        } catch (llmErr) {
          console.warn('Custom LLM commit synthesis fallback to rule-based:', llmErr);
        }
      }

      this.commitMessage = summaryText;
      this.showToast('✨ Synthesized commit message', 'success');
    } catch (e: any) {
      this.showToast(`Failed to generate commit message: ${e?.message || e}`, 'error');
    } finally {
      this.isGeneratingCommit = false;
    }
  }

  // -------------------------------------------------------------
  // Git Branches & Stash (Module 5)
  // -------------------------------------------------------------
  async openBranchModal() {
    this.branchModalOpen = true;
    await this.loadBranches();
    await this.loadStashes();
  }

  async loadBranches() {
    if (!this.repoPath) return;
    try {
      this.isLoadingBranches = true;
      this.branches = await apiListBranches(this.repoPath);
    } catch (e: any) {
      console.warn('Failed to list branches:', e);
    } finally {
      this.isLoadingBranches = false;
    }
  }

  async checkoutBranch(branchName: string) {
    if (!this.repoPath) return;
    try {
      await apiCheckoutBranch(this.repoPath, branchName);
      await this.refreshDiffs(true);
      await this.loadBranches();
      this.showToast(`Switched to branch: ${branchName}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to switch branch: ${e?.message || e}`, 'error');
    }
  }

  async createBranch(branchName: string) {
    if (!this.repoPath || !branchName.trim()) return;
    try {
      await apiCreateBranch(this.repoPath, branchName.trim());
      await this.refreshDiffs(true);
      await this.loadBranches();
      this.showToast(`Created & checked out branch: ${branchName}`, 'success');
    } catch (e: any) {
      this.showToast(`Failed to create branch: ${e?.message || e}`, 'error');
    }
  }

  async loadStashes() {
    if (!this.repoPath) return;
    try {
      this.stashes = await apiListStashes(this.repoPath);
    } catch (e: any) {
      console.warn('Failed to list stashes:', e);
    }
  }

  async stashSave(message?: string) {
    if (!this.repoPath) return;
    try {
      await apiStashSave(this.repoPath, message);
      await this.refreshDiffs(true);
      await this.loadStashes();
      this.showToast('Stashed changes', 'success');
    } catch (e: any) {
      this.showToast(`Stash failed: ${e?.message || e}`, 'error');
    }
  }

  async stashPop() {
    if (!this.repoPath) return;
    try {
      await apiStashPop(this.repoPath);
      await this.refreshDiffs(true);
      await this.loadStashes();
      this.showToast('Popped latest stash', 'success');
    } catch (e: any) {
      this.showToast(`Stash pop failed: ${e?.message || e}`, 'error');
    }
  }

  // -------------------------------------------------------------
  // Steer Context & Prompt Templates (Module 4)
  // -------------------------------------------------------------
  openSteerOnLine(filePath: string, lineNo: number, lineContent: string, isStaged: boolean) {
    this.openSteerOnLines(filePath, lineNo, lineNo, lineContent, isStaged);
  }

  openSteerOnLines(
    filePath: string,
    startLine: number,
    endLine: number,
    snippet: string,
    isStaged: boolean
  ) {
    this.steerContext = {
      filePath,
      startLine,
      endLine,
      snippet,
      isStaged,
    };
    this.steerFeedback = '';

    const active = this.sessions.find((s) => s.id === this.activeSessionId);
    if (active?.isAgent) {
      this.steerTargetSessionId = active.id;
    } else {
      const firstAgent = this.agentSessions[0];
      this.steerTargetSessionId = firstAgent ? firstAgent.id : this.activeSessionId;
    }

    this.steerModalOpen = true;
  }

  openSteerOnHunk(filePath: string, hunk: any, isStaged: boolean) {
    const snippet = hunk.lines
      .map((l: any) => `${l.line_type === 'add' ? '+' : l.line_type === 'delete' ? '-' : ' '} ${l.content}`)
      .join('\n');

    this.openSteerOnLines(
      filePath,
      hunk.new_start || hunk.old_start || 1,
      (hunk.new_start || hunk.old_start || 1) + (hunk.new_lines || hunk.old_lines || 1) - 1,
      snippet,
      isStaged
    );
  }

  applyTemplate(templateId: string) {
    this.activeTemplateId = templateId;
    const template = this.templates.find((t) => t.id === templateId);
    if (template) {
      this.showToast(`Applied template: ${template.title}`, 'info');
    }
  }

  getSynthesizedPrompt(templateId?: string): string {
    if (!this.steerContext) return '';
    const tmplId = templateId || this.activeTemplateId;
    const template = this.templates.find((t) => t.id === tmplId) || this.templates[0] || BUILTIN_TEMPLATES[0];

    const lineLabel =
      this.steerContext.startLine === this.steerContext.endLine
        ? `Line ${this.steerContext.startLine}`
        : `Lines ${this.steerContext.startLine}-${this.steerContext.endLine}`;

    const branch = this.repoInfo?.branch || 'HEAD';
    const project = this.activeProject?.name || 'Workspace';

    return template.template
      .replace(/\{\{file\}\}/g, this.steerContext.filePath)
      .replace(/\{\{lines\}\}/g, lineLabel)
      .replace(/\{\{code\}\}/g, this.steerContext.snippet)
      .replace(/\{\{branch\}\}/g, branch)
      .replace(/\{\{project\}\}/g, project)
      .replace(/\{\{instructions\}\}/g, this.steerFeedback.trim());
  }

  async injectSteerFeedback(targetId?: string) {
    if (!this.steerContext) return;
    const destSessionId = targetId || this.steerTargetSessionId || this.activeSessionId;
    if (!destSessionId) {
      this.showToast('No terminal session selected to send feedback', 'error');
      return;
    }

    const promptPacket = this.getSynthesizedPrompt();
    const payload = `\x1b[200~${promptPacket}\x1b[201~\r`;

    try {
      this.toggleTerminal(true);
      await writePty(destSessionId, payload);
      this.setActiveSession(destSessionId);
      this.steerModalOpen = false;
      this.steerFeedback = '';
      this.showToast('🎯 Feedback injected directly into agent terminal!', 'success');
    } catch (e: any) {
      this.showToast(`Failed to inject feedback: ${e?.message || e}`, 'error');
    }
  }

  // -------------------------------------------------------------
  // Template CRUD Management (Module 4)
  // -------------------------------------------------------------
  saveTemplates() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(this.templates));
      } catch (e) {
        console.warn('Failed to save templates:', e);
      }
    }
  }

  addTemplate(title: string, description: string, template: string) {
    const id = `tmpl_${Date.now()}`;
    const newTmpl: PromptTemplate = {
      id,
      title: title.trim(),
      description: description.trim(),
      template: template.trim(),
      isBuiltin: false,
    };
    this.templates = [...this.templates, newTmpl];
    this.activeTemplateId = id;
    this.saveTemplates();
    this.showToast(`Created template: ${title}`, 'success');
  }

  updateTemplate(id: string, title: string, description: string, template: string) {
    const target = this.templates.find((t) => t.id === id);
    if (target) {
      target.title = title.trim();
      target.description = description.trim();
      target.template = template.trim();
      this.templates = [...this.templates];
      this.saveTemplates();
      this.showToast(`Updated template: ${title}`, 'success');
    }
  }

  deleteTemplate(id: string) {
    this.templates = this.templates.filter((t) => t.id !== id);
    if (this.activeTemplateId === id) {
      this.activeTemplateId = this.templates[0]?.id || 'default-refactor';
    }
    this.saveTemplates();
    this.showToast('Deleted template', 'info');
  }

  resetTemplatesToDefault() {
    this.templates = [...BUILTIN_TEMPLATES];
    this.activeTemplateId = 'default-refactor';
    this.saveTemplates();
    this.showToast('Reset templates to defaults', 'success');
  }

  // -------------------------------------------------------------
  // Multi-Session Terminal Deck & Split Grid (Module 2)
  // -------------------------------------------------------------
  setFocusedPane(pane: 'primary' | 'secondary') {
    this.focusedPane = pane;
    if (pane === 'secondary' && !this.secondarySessionId && this.sessions.length > 1) {
      const second = this.sessions.find((s) => s.id !== this.activeSessionId);
      if (second) this.secondarySessionId = second.id;
    }
  }

  setTerminalSplitPercent(percent: number) {
    this.terminalSplitPercent = percent;
    this.notifyResize();
  }

  setTerminalLayout(layout: TerminalLayout) {
    this.terminalLayout = layout;
    if (layout !== 'single') {
      // If there is only 1 session, automatically spawn a second terminal session for Pane 2
      if (this.sessions.length <= 1) {
        const secondId = this.addTerminalSession('Terminal (2)', false, 'shell', 'secondary');
        this.secondarySessionId = secondId;
      } else if (!this.secondarySessionId || this.secondarySessionId === this.activeSessionId) {
        const second = this.sessions.find((s) => s.id !== this.activeSessionId);
        if (second) {
          this.secondarySessionId = second.id;
        } else {
          const secondId = this.addTerminalSession(`Terminal (${this.sessions.length + 1})`, false, 'shell', 'secondary');
          this.secondarySessionId = secondId;
        }
      }
    } else {
      this.focusedPane = 'primary';
    }
    this.notifyResize();
    const layoutLabel = layout === 'single' ? 'Single Panel' : layout === 'split-horizontal' ? 'Split Horizontal' : 'Split Vertical';
    this.showToast(`Terminal Layout: ${layoutLabel}`, 'info');
  }

  addTerminalSession(
    title?: string, 
    isAgent = false, 
    agentKind: AgentKind = 'shell',
    targetPane: 'primary' | 'secondary' | 'auto' = 'auto'
  ): string {
    const count = this.sessions.length + 1;
    const newId = `session-${this.activeProjectId || 'global'}-${Date.now()}`;
    const newSession: PtySession = {
      id: newId,
      title: title || (isAgent ? `${agentKind.toUpperCase()} Agent` : `Terminal (${count})`),
      cwd: this.repoPath,
      active: true,
      isAgent,
      agentKind,
    };
    this.sessions = [...this.sessions.map((s) => ({ ...s, active: false })), newSession];

    // Determine which pane gets the new session
    let assignToSecondary = false;
    if (targetPane === 'secondary') {
      assignToSecondary = true;
    } else if (targetPane === 'auto') {
      if (this.terminalLayout !== 'single') {
        if (this.focusedPane === 'secondary' || !this.secondarySessionId || this.secondarySessionId === this.activeSessionId) {
          assignToSecondary = true;
        }
      }
    }

    if (assignToSecondary) {
      this.secondarySessionId = newId;
      this.focusedPane = 'secondary';
    } else {
      this.activeSessionId = newId;
      this.focusedPane = 'primary';
    }

    this.notifyResize();
    return newId;
  }

  async launchAgentSession(
    kind: AgentKind, 
    customCmd?: string,
    targetPane: 'primary' | 'secondary' | 'auto' = 'auto'
  ) {
    const cmdMap: Record<string, { cmd: string; title: string }> = {
      antigravity: { cmd: 'agy\r', title: 'Antigravity (AGY)' },
      opencode: { cmd: 'opencode\r', title: 'OpenCode' },
      claude: { cmd: 'claude\r', title: 'Claude Code' },
      aider: { cmd: 'aider\r', title: 'Aider AI' },
      gemini: { cmd: 'gemini\r', title: 'Gemini CLI' },
      goose: { cmd: 'goose\r', title: 'Goose Agent' },
      custom: { cmd: customCmd ? `${customCmd}\r` : 'claude\r', title: customCmd || 'Custom Agent' },
    };

    const target = cmdMap[kind] || { cmd: `${kind}\r`, title: `${kind} Agent` };
    const newId = this.addTerminalSession(target.title, true, kind, targetPane);

    setTimeout(() => {
      writePty(newId, target.cmd).catch((err) => console.error('Agent launch write error:', err));
    }, 450);

    return newId;
  }

  async launchAgentAndSteer(
    kind: AgentKind,
    targetPane: 'primary' | 'secondary' | 'auto' = 'auto'
  ) {
    const newId = await this.launchAgentSession(kind, undefined, targetPane);
    this.steerTargetSessionId = newId;
    this.showToast(`Launching ${kind} agent... injecting feedback in 2s`, 'info');

    setTimeout(() => {
      if (this.steerContext) {
        this.injectSteerFeedback(newId);
      }
    }, 2200);
  }

  swapTerminalPanes() {
    if (this.terminalLayout === 'single' || !this.secondarySessionId || !this.activeSessionId) {
      return;
    }
    const temp = this.activeSessionId;
    this.activeSessionId = this.secondarySessionId;
    this.secondarySessionId = temp;
    this.focusedPane = this.focusedPane === 'primary' ? 'secondary' : 'primary';
    this.notifyResize();
    this.showToast('Swapped Terminal Panes', 'info');
  }

  setPrimarySession(id: string) {
    if (id === this.secondarySessionId) {
      this.swapTerminalPanes();
      return;
    }
    this.activeSessionId = id;
    this.focusedPane = 'primary';
    this.notifyResize();
  }

  setSecondarySession(id: string | null) {
    if (id && id === this.activeSessionId) {
      this.swapTerminalPanes();
      return;
    }
    this.secondarySessionId = id;
    if (id) {
      this.focusedPane = 'secondary';
    }
    this.notifyResize();
  }

  toggleSessionAgent(id: string) {
    const s = this.sessions.find((session) => session.id === id);
    if (s) {
      s.isAgent = !s.isAgent;
      if (s.isAgent && s.agentKind === 'shell') {
        s.agentKind = 'custom';
      }
      this.showToast(
        s.isAgent ? `Marked "${s.title}" as AI Agent Session` : `Marked "${s.title}" as Standard Shell`,
        'info'
      );
    }
  }

  renameSession(id: string, newTitle: string) {
    const target = this.sessions.find((s) => s.id === id);
    if (target && newTitle.trim()) {
      target.title = newTitle.trim();
    }
  }

  setActiveSession(id: string) {
    if (this.terminalLayout === 'single') {
      this.activeSessionId = id;
      this.focusedPane = 'primary';
      this.sessions = this.sessions.map((s) => ({ ...s, active: s.id === id }));
      return;
    }

    // In Split mode:
    if (id === this.activeSessionId) {
      this.focusedPane = 'primary';
    } else if (id === this.secondarySessionId) {
      this.focusedPane = 'secondary';
    } else {
      // Inactive tab clicked -> open in currently focused pane
      if (this.focusedPane === 'secondary') {
        this.secondarySessionId = id;
      } else {
        this.activeSessionId = id;
      }
    }
    this.sessions = this.sessions.map((s) => ({
      ...s,
      active: s.id === this.activeSessionId || s.id === this.secondarySessionId,
    }));
    this.notifyResize();
  }

  closeSession(id: string) {
    if (this.sessions.length <= 1) return;
    killPty(id).catch(() => {});
    const idx = this.sessions.findIndex((s) => s.id === id);
    this.sessions = this.sessions.filter((s) => s.id !== id);

    if (this.activeSessionId === id) {
      const nextSession = this.sessions.find((s) => s.id !== this.secondarySessionId) || this.sessions[0];
      if (nextSession) {
        this.activeSessionId = nextSession.id;
      }
      if (this.secondarySessionId === this.activeSessionId) {
        this.secondarySessionId = null;
        this.terminalLayout = 'single';
        this.focusedPane = 'primary';
      }
    }

    if (this.secondarySessionId === id) {
      const nextSession = this.sessions.find((s) => s.id !== this.activeSessionId);
      if (nextSession) {
        this.secondarySessionId = nextSession.id;
      } else {
        this.secondarySessionId = null;
        this.terminalLayout = 'single';
        this.focusedPane = 'primary';
      }
    }
    this.notifyResize();
  }

  // -------------------------------------------------------------
  // Folder Picker Navigation
  // -------------------------------------------------------------
  async openFolderPicker(initialPath?: string) {
    this.folderPickerOpen = true;
    await this.browseDirectory(initialPath || this.repoPath || '');
  }

  async browseDirectory(targetPath: string) {
    try {
      this.isLoadingDirs = true;
      const listing = await listDirectoryFolders(targetPath);
      this.directoryListing = listing;
    } catch (e: any) {
      this.showToast(`Failed to list folders: ${e?.message || e}`, 'error');
    } finally {
      this.isLoadingDirs = false;
    }
  }

  // -------------------------------------------------------------
  // Layout Modes & Panels
  // -------------------------------------------------------------
  setDiffViewMode(mode: 'split' | 'unified') {
    this.diffViewMode = mode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DIFF_VIEW_MODE_KEY, mode);
      } catch {}
    }
  }

  toggleWrapLines() {
    this.setWrapLines(!this.wrapLines);
  }

  setWrapLines(wrap: boolean) {
    this.wrapLines = wrap;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DIFF_WRAP_LINES_KEY, String(wrap));
      } catch {}
    }
  }

  toggleLayoutMode() {
    this.setLayoutMode(this.layoutMode === 'split' ? 'single' : 'split');
  }

  setLayoutMode(mode: 'split' | 'single') {
    this.layoutMode = mode;
    if (mode === 'single') {
      if (this.showTerminal && this.showReview) {
        if (this.activeSingleTab === 'review') {
          this.showReview = true;
          this.showTerminal = false;
        } else {
          this.showTerminal = true;
          this.showReview = false;
        }
      }
    } else {
      this.showTerminal = true;
      this.showReview = true;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAYOUT_MODE_KEY, mode);
      } catch {}
    }
    this.savePanelVisibility();
    this.notifyResize();
    this.showToast(`Layout mode: ${mode === 'split' ? 'Multi-Panel Split' : 'Single Panel (Tabs)'}`, 'info');
  }

  toggleTerminal(forceState?: boolean) {
    if (this.layoutMode === 'single') {
      if (forceState === true) {
        this.showTerminal = true;
        this.showReview = false;
        this.activeSingleTab = 'terminal';
      } else if (forceState === false) {
        this.showTerminal = false;
      } else {
        if (this.showTerminal) {
          this.showTerminal = false;
        } else {
          this.showTerminal = true;
          this.showReview = false;
          this.activeSingleTab = 'terminal';
        }
      }
    } else {
      this.showTerminal = forceState !== undefined ? forceState : !this.showTerminal;
      if (this.showTerminal) {
        this.activeSingleTab = 'terminal';
      }
    }
    this.savePanelVisibility();
    this.notifyResize();
  }

  toggleReview(forceState?: boolean) {
    if (this.layoutMode === 'single') {
      if (forceState === true) {
        this.showReview = true;
        this.showTerminal = false;
        this.activeSingleTab = 'review';
      } else if (forceState === false) {
        this.showReview = false;
      } else {
        if (this.showReview) {
          this.showReview = false;
        } else {
          this.showReview = true;
          this.showTerminal = false;
          this.activeSingleTab = 'review';
        }
      }
    } else {
      this.showReview = forceState !== undefined ? forceState : !this.showReview;
      if (this.showReview) {
        this.activeSingleTab = 'review';
      }
    }
    this.savePanelVisibility();
    this.notifyResize();
  }

  openAllPanels() {
    this.showTerminal = true;
    this.showReview = true;
    this.layoutMode = 'split';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAYOUT_MODE_KEY, 'split');
      } catch {}
    }
    this.savePanelVisibility();
    this.notifyResize();
  }

  closeAllPanels() {
    this.showTerminal = false;
    this.showReview = false;
    this.savePanelVisibility();
    this.notifyResize();
  }

  private savePanelVisibility() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SHOW_TERMINAL_KEY, String(this.showTerminal));
        localStorage.setItem(SHOW_REVIEW_KEY, String(this.showReview));
      } catch {}
    }
  }

  saveLlmSettings(settings: LlmSettings) {
    this.llmSettings = settings;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(settings));
        this.showToast('Saved LLM configuration', 'success');
      } catch (e) {
        console.warn('Failed to save LLM settings:', e);
      }
    }
  }

  notifyResize() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    }
  }
}

export const appState = new AppState();
