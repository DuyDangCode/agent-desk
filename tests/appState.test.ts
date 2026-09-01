import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock types for unit testing state logic
interface PtySession {
  id: string;
  title: string;
  cwd: string;
  active: boolean;
  isAgent: boolean;
  agentKind: string;
}

interface ProjectItem {
  id: string;
  path: string;
  name: string;
  info: any | null;
  files: any[];
  selectedFilePath: string | null;
  selectedIsStaged: boolean;
  fileFilter: 'all' | 'staged' | 'unstaged';
  fileExtensionFilter: string;
  searchQuery: string;
  sessions: PtySession[];
  activeSessionId: string;
  secondarySessionId?: string | null;
  focusedPane?: 'primary' | 'secondary';
  terminalLayout: 'single' | 'split-horizontal' | 'split-vertical';
  terminalSplitPercent?: number;
  isRefreshing: boolean;
  isLoading: boolean;
}

// Minimal reproduction of AppState core project and session management for rigorous boundary testing
class TestAppState {
  projects: ProjectItem[] = [];
  activeProjectId = '';
  defaultTerminalPath = '/home/user/default_dir';

  standaloneSessions: PtySession[] = [];
  standaloneActiveSessionId = '';
  standaloneSecondarySessionId: string | null = null;
  standaloneFocusedPane: 'primary' | 'secondary' = 'primary';
  standaloneTerminalLayout: 'single' | 'split-horizontal' | 'split-vertical' = 'single';
  standaloneSplitPercent = 50;

  ensureStandaloneSessions() {
    if (this.standaloneSessions.length === 0) {
      const initialId = 'session-standalone-1';
      this.standaloneSessions = [
        {
          id: initialId,
          title: 'Terminal (1)',
          cwd: this.defaultTerminalPath,
          active: true,
          isAgent: false,
          agentKind: 'shell',
        },
      ];
      this.standaloneActiveSessionId = initialId;
      this.standaloneSecondarySessionId = null;
      this.standaloneFocusedPane = 'primary';
      this.standaloneTerminalLayout = 'single';
    }
  }

  get isProjectAttached(): boolean {
    return this.projects.length > 0 && Boolean(this.activeProject);
  }

  get activeProject(): ProjectItem | undefined {
    if (this.projects.length === 0) return undefined;
    return this.projects.find((p) => p.id === this.activeProjectId) || this.projects[0];
  }

  get repoPath(): string {
    return this.activeProject?.path || this.defaultTerminalPath || '';
  }

  get repoInfo(): any | null {
    return this.activeProject?.info || null;
  }

  get files(): any[] {
    return this.activeProject?.files || [];
  }

  get sessions(): PtySession[] {
    if (this.activeProject) {
      return this.activeProject.sessions;
    }
    return this.standaloneSessions;
  }

  set sessions(val: PtySession[]) {
    if (this.activeProject) {
      this.activeProject.sessions = val;
    } else {
      this.standaloneSessions = val;
    }
  }

  get allSessions(): PtySession[] {
    const list: PtySession[] = [];
    for (const p of this.projects) {
      list.push(...p.sessions);
    }
    list.push(...this.standaloneSessions);
    return list;
  }

  findSessionCwd(sessionId: string): string | undefined {
    for (const p of this.projects) {
      const found = p.sessions.find((s) => s.id === sessionId);
      if (found) return found.cwd || p.path;
    }
    const standaloneFound = this.standaloneSessions.find((s) => s.id === sessionId);
    if (standaloneFound) return standaloneFound.cwd || this.defaultTerminalPath;
    return this.defaultTerminalPath || undefined;
  }

  get activeSessionId(): string {
    if (this.activeProject) {
      return this.activeProject.activeSessionId;
    }
    return this.standaloneActiveSessionId;
  }

  set activeSessionId(val: string) {
    if (this.activeProject) {
      this.activeProject.activeSessionId = val;
    } else {
      this.standaloneActiveSessionId = val;
    }
  }

  attachProject(path: string, switchTo = true): string {
    const normPath = path.trim().replace(/\/+$/, '');
    if (!normPath) return '';
    const existing = this.projects.find((p) => p.path.toLowerCase() === normPath.toLowerCase());
    if (existing) {
      if (switchTo) this.activeProjectId = existing.id;
      return existing.id;
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const folderName = normPath.split('/').filter(Boolean).pop() || 'Project';
    const initialSessionId = `session-${projectId}-1`;

    const newProj: ProjectItem = {
      id: projectId,
      path: normPath,
      name: folderName,
      info: { name: folderName, branch: 'main' },
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
      terminalSplitPercent: 50,
      isRefreshing: false,
      isLoading: false,
    };

    this.projects = [...this.projects, newProj];
    if (switchTo || this.projects.length === 1) {
      this.activeProjectId = projectId;
    }
    return projectId;
  }

  closeProject(projectId: string) {
    const projectIdx = this.projects.findIndex((p) => p.id === projectId);
    if (projectIdx === -1) return;

    this.projects = this.projects.filter((p) => p.id !== projectId);

    if (this.activeProjectId === projectId) {
      const nextProj = this.projects[Math.max(0, projectIdx - 1)] || this.projects[0];
      if (nextProj) {
        this.activeProjectId = nextProj.id;
      } else {
        this.activeProjectId = '';
        this.ensureStandaloneSessions();
      }
    }
  }

  closeAllProjects() {
    this.projects = [];
    this.activeProjectId = '';
    this.ensureStandaloneSessions();
  }

  addTerminalSession(title?: string): string {
    const count = this.sessions.length + 1;
    const prefix = this.activeProjectId || 'standalone';
    const newId = `session-${prefix}-${Date.now()}`;
    const cwd = this.activeProject?.path || this.defaultTerminalPath;
    const newSession: PtySession = {
      id: newId,
      title: title || `Terminal (${count})`,
      cwd,
      active: true,
      isAgent: false,
      agentKind: 'shell',
    };
    this.sessions = [...this.sessions.map((s) => ({ ...s, active: false })), newSession];
    this.activeSessionId = newId;
    return newId;
  }

  closeSession(id: string) {
    if (this.sessions.length <= 1) return;
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.activeSessionId === id) {
      this.activeSessionId = this.sessions[0]?.id || '';
    }
  }
}

describe('AppState Project & Default Terminal Path Lifecycle', () => {
  let state: TestAppState;

  beforeEach(() => {
    state = new TestAppState();
    state.ensureStandaloneSessions();
  });

  describe('Lower Boundary: 0 Projects Attached (First Time or All Removed)', () => {
    it('initializes with empty projects and no active project', () => {
      assert.equal(state.projects.length, 0);
      assert.equal(state.activeProjectId, '');
      assert.equal(state.activeProject, undefined);
      assert.equal(state.isProjectAttached, false);
    });

    it('falls back to default terminal path for repoPath', () => {
      assert.equal(state.repoPath, '/home/user/default_dir');
    });

    it('provides standalone terminal session with default terminal path as cwd', () => {
      assert.equal(state.sessions.length, 1);
      assert.equal(state.sessions[0].cwd, '/home/user/default_dir');
      assert.equal(state.activeSessionId, 'session-standalone-1');
      assert.equal(state.findSessionCwd(state.activeSessionId), '/home/user/default_dir');
    });

    it('allows adding new terminal sessions in standalone mode using default terminal path', () => {
      const newId = state.addTerminalSession('Custom Shell');
      assert.equal(state.sessions.length, 2);
      assert.equal(state.activeSessionId, newId);
      assert.equal(state.findSessionCwd(newId), '/home/user/default_dir');
    });

    it('allows closing added standalone terminal sessions', () => {
      const newId = state.addTerminalSession('Custom Shell');
      assert.equal(state.sessions.length, 2);
      state.closeSession(newId);
      assert.equal(state.sessions.length, 1);
      assert.equal(state.activeSessionId, 'session-standalone-1');
    });

    it('prevents closing the only remaining terminal session in standalone mode', () => {
      assert.equal(state.sessions.length, 1);
      state.closeSession(state.sessions[0].id);
      assert.equal(state.sessions.length, 1);
    });
  });

  describe('In-Bound: Single Project Attached', () => {
    let projId: string;

    beforeEach(() => {
      projId = state.attachProject('/home/user/my_app');
    });

    it('successfully attaches a project and sets active project', () => {
      assert.equal(state.projects.length, 1);
      assert.equal(state.activeProjectId, projId);
      assert.ok(state.activeProject);
      assert.equal(state.activeProject?.name, 'my_app');
      assert.equal(state.isProjectAttached, true);
      assert.equal(state.repoPath, '/home/user/my_app');
    });

    it('switches terminal sessions to the project workspace path', () => {
      assert.equal(state.sessions.length, 1);
      assert.equal(state.sessions[0].cwd, '/home/user/my_app');
      assert.equal(state.findSessionCwd(state.activeSessionId), '/home/user/my_app');
    });

    it('allows detaching the single project returning state cleanly to 0 projects', () => {
      state.closeProject(projId);
      assert.equal(state.projects.length, 0);
      assert.equal(state.activeProjectId, '');
      assert.equal(state.activeProject, undefined);
      assert.equal(state.isProjectAttached, false);
      assert.equal(state.repoPath, '/home/user/default_dir');
      assert.equal(state.sessions.length, 1);
      assert.equal(state.sessions[0].cwd, '/home/user/default_dir');
    });
  });

  describe('Upper Boundary: Multiple Projects Attached', () => {
    let proj1: string;
    let proj2: string;
    let proj3: string;

    beforeEach(() => {
      proj1 = state.attachProject('/home/user/project_a');
      proj2 = state.attachProject('/home/user/project_b');
      proj3 = state.attachProject('/home/user/project_c');
    });

    it('tracks all 3 projects and sets the active project', () => {
      assert.equal(state.projects.length, 3);
      assert.equal(state.activeProjectId, proj3);
      assert.equal(state.activeProject?.name, 'project_c');
    });

    it('findSessionCwd resolves cwd for sessions across any attached project', () => {
      const p1Session = state.projects[0].sessions[0];
      const p2Session = state.projects[1].sessions[0];
      assert.equal(state.findSessionCwd(p1Session.id), '/home/user/project_a');
      assert.equal(state.findSessionCwd(p2Session.id), '/home/user/project_b');
    });

    it('closing active project switches to adjacent project', () => {
      state.closeProject(proj3);
      assert.equal(state.projects.length, 2);
      assert.equal(state.activeProjectId, proj2);
      assert.equal(state.activeProject?.name, 'project_b');
    });

    it('closeAllProjects detaches all 3 projects at once and restores standalone session', () => {
      state.closeAllProjects();
      assert.equal(state.projects.length, 0);
      assert.equal(state.activeProjectId, '');
      assert.equal(state.activeProject, undefined);
      assert.equal(state.isProjectAttached, false);
      assert.equal(state.sessions.length, 1);
      assert.equal(state.sessions[0].cwd, '/home/user/default_dir');
    });
  });
});

describe('Branch Management & Remote Branch Boundary Filtering', () => {
  interface BranchInfo {
    name: string;
    is_current: boolean;
    is_remote: boolean;
    commit_short?: string | null;
  }

  function filterBranches(branches: BranchInfo[], hideRemoteBranches: boolean, searchQuery: string): BranchInfo[] {
    let list = branches;
    if (hideRemoteBranches) {
      list = list.filter((b) => !b.is_remote);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q));
  }

  function attemptCheckout(branches: BranchInfo[], branchName: string): { ok: boolean; error?: string } {
    const targetBranch = branches.find((b) => b.name === branchName);
    if (!targetBranch) {
      return { ok: false, error: `Local branch not found: "${branchName}"` };
    }
    if (targetBranch.is_remote) {
      return { ok: false, error: `Cannot checkout remote branch "${branchName}". Please create a local branch instead.` };
    }
    return { ok: true };
  }

  const sampleBranches: BranchInfo[] = [
    { name: 'main', is_current: true, is_remote: false, commit_short: 'a1b2c3d' },
    { name: 'feature/agent-deck', is_current: false, is_remote: false, commit_short: 'e4f5g6h' },
    { name: 'origin/main', is_current: false, is_remote: true, commit_short: 'a1b2c3d' },
    { name: 'origin/feature/remote-only', is_current: false, is_remote: true, commit_short: 'i7j8k9l' },
    { name: 'upstream/master', is_current: false, is_remote: true, commit_short: 'm0n1o2p' },
  ];

  describe('Lower Boundary: Empty Branch List', () => {
    it('returns empty array when no branches exist', () => {
      const result = filterBranches([], true, '');
      assert.equal(result.length, 0);
    });

    it('rejects checkout when branch does not exist', () => {
      const res = attemptCheckout([], 'nonexistent');
      assert.equal(res.ok, false);
      assert.match(res.error || '', /not found/);
    });
  });

  describe('In-Bound: Mixed Local & Remote Branches Filtering', () => {
    it('hides all remote branches by default (hideRemoteBranches = true)', () => {
      const result = filterBranches(sampleBranches, true, '');
      assert.equal(result.length, 2);
      assert.ok(result.every((b) => !b.is_remote));
      assert.deepEqual(result.map((b) => b.name), ['main', 'feature/agent-deck']);
    });

    it('shows all branches including remote branches when hideRemoteBranches = false', () => {
      const result = filterBranches(sampleBranches, false, '');
      assert.equal(result.length, 5);
      const remotes = result.filter((b) => b.is_remote);
      assert.equal(remotes.length, 3);
    });

    it('filters branches with search query when hideRemoteBranches = true', () => {
      const result = filterBranches(sampleBranches, true, 'agent');
      assert.equal(result.length, 1);
      assert.equal(result[0].name, 'feature/agent-deck');
    });

    it('search query matching only remote branches returns empty if hideRemoteBranches = true', () => {
      const result = filterBranches(sampleBranches, true, 'upstream');
      assert.equal(result.length, 0);
    });

    it('search query matching remote branches returns results if hideRemoteBranches = false', () => {
      const result = filterBranches(sampleBranches, false, 'upstream');
      assert.equal(result.length, 1);
      assert.equal(result[0].name, 'upstream/master');
      assert.equal(result[0].is_remote, true);
    });
  });

  describe('Upper Boundary: Checkout Remote Branch Prevention', () => {
    it('allows checking out a local branch', () => {
      const res = attemptCheckout(sampleBranches, 'feature/agent-deck');
      assert.equal(res.ok, true);
    });

    it('disallows checking out a remote branch and provides clear error', () => {
      const res = attemptCheckout(sampleBranches, 'origin/feature/remote-only');
      assert.equal(res.ok, false);
      assert.equal(
        res.error,
        'Cannot checkout remote branch "origin/feature/remote-only". Please create a local branch instead.'
      );
    });

    it('disallows checking out upstream remote branch', () => {
      const res = attemptCheckout(sampleBranches, 'upstream/master');
      assert.equal(res.ok, false);
      assert.match(res.error || '', /Cannot checkout remote branch "upstream\/master"/);
    });
  });
});

