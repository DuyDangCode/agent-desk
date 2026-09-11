import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationManager, stripAnsi, detectInteractivePrompt, type ResolvedSessionTarget } from '../src/lib/utils/notifications.ts';
import type { AgentEvent, ProjectItem, PtySession } from '../src/lib/types/index.ts';

describe('Agent Events & Notification System Boundary Tests', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager();
  });

  describe('Deduplication Window (isDuplicate)', () => {
    it('Lower Bound: first occurrence of an event is never considered a duplicate', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-100',
        cwd: '/home/user/project',
        message: 'Awaiting your answer',
        timestamp: Date.now(),
      };

      assert.equal(manager.isDuplicate(event), false);
    });

    it('In-Bound: identical event within deduplication window is deduplicated', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-100',
        cwd: '/home/user/project',
        message: 'Awaiting your answer',
        timestamp: Date.now(),
      };

      // First call records it
      assert.equal(manager.isDuplicate(event, 5000), false);

      // Immediate second call should be caught as duplicate
      assert.equal(manager.isDuplicate(event, 5000), true);

      // Third call within window should still be caught
      assert.equal(manager.isDuplicate(event, 5000), true);
    });

    it('In-Bound: different event types for same session are not duplicates', () => {
      const inputEvent: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-100',
        timestamp: Date.now(),
      };

      const permEvent: AgentEvent = {
        agent: 'claude',
        type: 'permission_required',
        sessionId: 'sess-100',
        timestamp: Date.now(),
      };

      assert.equal(manager.isDuplicate(inputEvent, 5000), false);
      assert.equal(manager.isDuplicate(permEvent, 5000), false);
    });

    it('In-Bound: events from different sessions or agents are not duplicates', () => {
      const event1: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-101',
        timestamp: Date.now(),
      };

      const event2: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-102',
        timestamp: Date.now(),
      };

      const event3: AgentEvent = {
        agent: 'opencode',
        type: 'input_required',
        sessionId: 'sess-101',
        timestamp: Date.now(),
      };

      const eventWorking: AgentEvent = {
        agent: 'opencode',
        type: 'working',
        sessionId: 'sess-101',
        timestamp: Date.now(),
      };

      assert.equal(manager.isDuplicate(event1, 5000), false);
      assert.equal(manager.isDuplicate(event2, 5000), false);
      assert.equal(manager.isDuplicate(event3, 5000), false);
      assert.equal(manager.isDuplicate(eventWorking, 5000), false);
    });

    it('Upper Bound: event passes after windowMs expires', async () => {
      const shortWindowMs = 20;
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-fast',
        timestamp: Date.now(),
      };

      assert.equal(manager.isDuplicate(event, shortWindowMs), false);
      assert.equal(manager.isDuplicate(event, shortWindowMs), true);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 35));

      assert.equal(manager.isDuplicate(event, shortWindowMs), false);
    });
  });

  describe('Session Target Resolution (resolveSessionTarget)', () => {
    const mockProjects: ProjectItem[] = [
      {
        id: 'proj-1',
        path: '/home/user/backend',
        name: 'Backend API',
        info: null,
        files: [],
        selectedFilePath: null,
        selectedIsStaged: false,
        fileFilter: 'all',
        fileExtensionFilter: '',
        searchQuery: '',
        sessions: [
          {
            id: 'sess-backend-1',
            title: 'Bash',
            cwd: '/home/user/backend',
            active: true,
            isAgent: false,
            agentKind: '',
          },
          {
            id: 'sess-backend-agent',
            title: 'Claude Agent',
            cwd: '/home/user/backend',
            active: false,
            isAgent: true,
            agentKind: 'claude',
          },
        ],
        activeSessionId: 'sess-backend-1',
        terminalLayout: 'single',
        isRefreshing: false,
        isLoading: false,
      },
      {
        id: 'proj-2',
        path: '/home/user/frontend',
        name: 'Frontend UI',
        info: null,
        files: [],
        selectedFilePath: null,
        selectedIsStaged: false,
        fileFilter: 'all',
        fileExtensionFilter: '',
        searchQuery: '',
        sessions: [
          {
            id: 'sess-frontend-1',
            title: 'Claude',
            cwd: '/home/user/frontend',
            active: true,
            isAgent: true,
            agentKind: 'claude',
          },
        ],
        activeSessionId: 'sess-frontend-1',
        terminalLayout: 'single',
        isRefreshing: false,
        isLoading: false,
      },
    ];

    const mockStandalone: PtySession[] = [
      {
        id: 'sess-standalone-1',
        title: 'Standalone Shell',
        cwd: '/home/user',
        active: true,
        isAgent: false,
        agentKind: '',
      },
    ];

    it('Lower Bound: empty projects and empty session list falls back to defaults', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, [], [], undefined, 'fallback-id');
      assert.equal(result.sessionId, 'fallback-id');
      assert.equal(result.sessionTitle, 'Terminal');
      assert.equal(result.projectId, undefined);
    });

    it('In-Bound: exact sessionId match inside a project returns full project & session details', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'permission_required',
        sessionId: 'sess-backend-agent',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, mockProjects, mockStandalone);
      assert.equal(result.projectId, 'proj-1');
      assert.equal(result.projectName, 'Backend API');
      assert.equal(result.sessionId, 'sess-backend-agent');
      assert.equal(result.sessionTitle, 'Claude Agent');
    });

    it('In-Bound: exact sessionId match in standalone sessions returns standalone session', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        sessionId: 'sess-standalone-1',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, mockProjects, mockStandalone);
      assert.equal(result.projectId, undefined);
      assert.equal(result.sessionId, 'sess-standalone-1');
      assert.equal(result.sessionTitle, 'Standalone Shell');
    });

    it('In-Bound: cwd heuristic matches project directory and locates agent session', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        cwd: '/home/user/backend',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, mockProjects, mockStandalone);
      assert.equal(result.projectId, 'proj-1');
      assert.equal(result.sessionId, 'sess-backend-agent'); // Found matching agent
    });

    it('Upper Bound: cwd with nested subfolder and trailing slash matches parent project', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        cwd: '/home/user/frontend/src/components///',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, mockProjects, mockStandalone);
      assert.equal(result.projectId, 'proj-2');
      assert.equal(result.projectName, 'Frontend UI');
      assert.equal(result.sessionId, 'sess-frontend-1');
    });

    it('Fallback: unknown cwd falls back to active project active session', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        cwd: '/tmp/unrelated-folder',
        timestamp: Date.now(),
      };

      const result = manager.resolveSessionTarget(event, mockProjects, mockStandalone, 'proj-2');
      assert.equal(result.projectId, 'proj-2');
      assert.equal(result.projectName, 'Frontend UI');
      assert.equal(result.sessionId, 'sess-frontend-1');
    });
  });

  describe('Notification Text Formatting (formatTitle & formatBody)', () => {
    const target: ResolvedSessionTarget = {
      projectId: 'proj-1',
      projectName: 'agent-deck',
      sessionId: 'sess-1',
      sessionTitle: 'Claude',
    };

    it('Lower Bound: basic input_required event without message', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event, target);
      const body = manager.formatBody(event, target);

      assert.equal(title, 'Claude');
      assert.equal(body, '[agent-deck] Input required');
    });

    it('In-Bound: permission_required event formatting', () => {
      const event: AgentEvent = {
        agent: 'claude',
        type: 'permission_required',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event, target);
      const body = manager.formatBody(event, target);

      assert.equal(title, 'Claude');
      assert.equal(body, '[agent-deck] Input required');
    });

    it('Upper Bound: event with complex custom message preserves simplified content', () => {
      const event: AgentEvent = {
        agent: 'opencode',
        type: 'input_required',
        message: 'Tool call "Bash" requires approval: rm -rf ./tmp',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event, target);
      const body = manager.formatBody(event, target);

      assert.equal(title, 'Opencode');
      assert.equal(body, '[agent-deck] Input required');
    });

    it('In-Bound: OpenCode working event title and body formatting', () => {
      const event: AgentEvent = {
        agent: 'opencode',
        type: 'working',
        message: 'OpenCode is working',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event, target);
      const body = manager.formatBody(event, target);

      assert.equal(title, 'Opencode');
      assert.equal(body, '[agent-deck] Input required');
    });

    it('Target without project name omits project tag prefix', () => {
      const standaloneTarget: ResolvedSessionTarget = {
        sessionId: 'sess-standalone',
        sessionTitle: 'Terminal',
      };

      const event: AgentEvent = {
        agent: 'claude',
        type: 'input_required',
        message: 'Please answer question #2',
        timestamp: Date.now(),
      };

      const body = manager.formatBody(event, standaloneTarget);
      assert.equal(body, 'Input required');
    });

    it('In-Bound: Antigravity agent input formatting', () => {
      const event: AgentEvent = {
        agent: 'antigravity',
        type: 'input_required',
        message: 'Antigravity is asking a question',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event, target);
      const body = manager.formatBody(event, target);

      assert.equal(title, 'Antigravity');
      assert.equal(body, '[agent-deck] Input required');
    });

    it('Boundary: empty or missing agent defaults cleanly to Agent', () => {
      const event: AgentEvent = {
        agent: '',
        type: 'input_required',
        timestamp: Date.now(),
      };

      const title = manager.formatTitle(event);
      const body = manager.formatBody(event);

      assert.equal(title, 'Agent');
      assert.equal(body, 'Input required');
    });
  });

  describe('ANSI Escaping & Normalization (stripAnsi)', () => {
    it('Lower Bound: handles empty, null, or very short strings gracefully', () => {
      assert.equal(stripAnsi(''), '');
      assert.equal(stripAnsi('   '), '   ');
    });

    it('In-Bound: strips CSI color codes, cursor sequences, and 2-byte escapes', () => {
      const raw = '\x1b[32m✔\x1b[39m \x1b[1mReady\x1b[22m \x1b[?25h\x1b(Bdone';
      assert.equal(stripAnsi(raw), '✔ Ready done');
    });

    it('In-Bound: strips OSC window title sequences and normalizes carriage returns', () => {
      const raw = '\x1b]0;Claude Code\x07Hello\r\nWorld\r';
      assert.equal(stripAnsi(raw), 'Hello\nWorld\n');
    });

    it('Upper Bound: handles large chunk of mixed ANSI control sequences', () => {
      const raw = '\x1b[2K\x1b[1G\x1b[38;2;255;100;50mPrompt\x1b[0m\x1b[?25l: Test\x1b[?25h';
      assert.equal(stripAnsi(raw), 'Prompt: Test');
    });
  });

  describe('Interactive Prompt Detection Boundary Tests (detectInteractivePrompt)', () => {
    it('Lower Bound: empty or short non-prompt text returns null', () => {
      assert.equal(detectInteractivePrompt(''), null);
      assert.equal(detectInteractivePrompt('hi'), null);
      assert.equal(detectInteractivePrompt('total 32 drwxr-xr-x 4 user user 4096 Sep 8 14:00 src'), null);
      assert.equal(detectInteractivePrompt('git status: On branch main, nothing to commit'), null);
      assert.equal(detectInteractivePrompt('user@machine:~/Projects/agent_deck$ '), null);
    });

    it('In-Bound: detects "select option" (exact user phrasing)', () => {
      const promptText = 'Please select option to proceed:';
      const result = detectInteractivePrompt(promptText);
      assert.ok(result);
      assert.equal(result?.type, 'input_required');
      assert.equal(result?.matchedPattern, 'select_option');
    });

    it('In-Bound: detects "select an option" and "choose an option"', () => {
      const p1 = detectInteractivePrompt('Select an option:');
      assert.ok(p1);
      assert.equal(p1?.type, 'input_required');

      const p2 = detectInteractivePrompt('Choose an option from the list below');
      assert.ok(p2);
      assert.equal(p2?.type, 'input_required');

      const p3 = detectInteractivePrompt('Pick an option:');
      assert.ok(p3);
      assert.equal(p3?.type, 'input_required');
    });

    it('In-Bound: detects ANSI-escaped Inquirer / Clack terminal prompts', () => {
      const rawPrompt = '\x1b[?25l\x1b[36m? Select an option:\x1b[39m\n\x1b[32m❯ 1) Run unit tests\x1b[39m\n  2) Run build\x1b[?25h';
      const result = detectInteractivePrompt(rawPrompt);
      assert.ok(result);
      assert.equal(result?.type, 'input_required');
    });

    it('In-Bound: detects arrow navigation and enter confirmation cues', () => {
      const rawPrompt = 'Navigate with arrows (Use arrow keys) and Press Enter to confirm';
      const result = detectInteractivePrompt(rawPrompt);
      assert.ok(result);
      assert.equal(result?.type, 'input_required');
      assert.equal(result?.matchedPattern, 'arrow_nav');
    });

    it('In-Bound: detects tool permission and command confirmation prompts [y/n]', () => {
      const p1 = detectInteractivePrompt('Do you want to run "cargo test"? [y/n]');
      assert.ok(p1);
      assert.equal(p1?.type, 'permission_required');

      const p2 = detectInteractivePrompt('Allow tool execution "WriteFile"? (y/n)');
      assert.ok(p2);
      assert.equal(p2?.type, 'permission_required');

      const p3 = detectInteractivePrompt('Confirm changes before proceeding? [yes/no]');
      assert.ok(p3);
      assert.equal(p3?.type, 'permission_required');
    });

    it('In-Bound: detects generic waiting for input / enter response', () => {
      const p1 = detectInteractivePrompt('Waiting for your input:');
      assert.ok(p1);
      assert.equal(p1?.type, 'input_required');

      const p2 = detectInteractivePrompt('Enter your choice:');
      assert.ok(p2);
      assert.equal(p2?.type, 'input_required');
    });

    it('Upper Bound: detects prompt at the end of a long terminal buffer with preceding output', () => {
      const longOutput = `
        Compiling agent_deck v2.0.0
        Finished release [optimized] target(s) in 12.34s
        Starting review agent...
        Analyzing changed files: src/App.svelte, src/lib/stores/appState.svelte.ts
        Done analyzing.
        \x1b[33mSelect option:\x1b[0m
        ❯ 1) Apply recommended refactor
          2) Discard changes
      `;
      const result = detectInteractivePrompt(longOutput);
      assert.ok(result);
      assert.equal(result?.type, 'input_required');
      assert.equal(result?.matchedPattern, 'select_option');
    });
  });
});
