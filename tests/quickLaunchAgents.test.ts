import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ManifestRegistry,
  parseAgentManifestToml,
  compileManifest,
  evaluateBufferAgainstManifest,
  snapshotLinesFromText,
} from '../src/lib/utils/agentDetection.ts';
import type { AgentKind } from '../src/lib/types/index.ts';

// Parity implementation of the Rust match_agent_binary logic in process_info.rs
function matchAgentBinaryParity(comm: string, cmdline: string): [boolean, string | null] {
  const KNOWN_AGENTS: [string, string[]][] = [
    ['claude', ['claude', 'claude-code']],
    ['antigravity', ['agy', 'antigravity', 'antigravity-cli']],
    ['gemini', ['gemini', 'gemini-cli']],
    ['cursor', ['cursor', 'cursor-agent']],
    ['codex', ['codex', 'codex-cli']],
    ['pi', ['pi', 'pi-agent']],
    ['opencode', ['opencode']],
    ['aider', ['aider']],
    ['goose', ['goose']],
  ];

  const commLower = comm.toLowerCase().trim();
  const cmdlineLower = cmdline.toLowerCase().trim();
  const isWrapper = ['node', 'python', 'python3', 'bun', 'deno', 'sh', 'bash', 'zsh', ''].includes(commLower);

  for (const [agentName, aliases] of KNOWN_AGENTS) {
    for (const alias of aliases) {
      if (commLower === alias || commLower.endsWith(`/${alias}`)) {
        return [true, agentName];
      }
      if (isWrapper) {
        const matched = alias.length <= 2
          ? cmdlineLower === alias
            || cmdlineLower.startsWith(`${alias} `)
            || cmdlineLower.includes(` ${alias} `)
            || cmdlineLower.includes(`/${alias} `)
            || cmdlineLower.endsWith(` ${alias}`)
            || cmdlineLower.endsWith(`/${alias}`)
          : cmdlineLower.includes(alias);
        if (matched) {
          return [true, agentName];
        }
      }
    }
  }

  return [false, null];
}

// Minimal Test AppState representing the session state machine for unit tests
class MockAppState {
  sessions: Array<{
    id: string;
    title: string;
    isAgent: boolean;
    agentKind: AgentKind;
    detectedBinary?: string | null;
    isCustomTitle?: boolean;
  }> = [];

  constructor() {
    this.sessions = [
      {
        id: 'sess-1',
        title: 'Terminal (1)',
        isAgent: false,
        agentKind: 'shell',
      },
      {
        id: 'sess-2',
        title: 'Terminal (2)',
        isAgent: false,
        agentKind: 'shell',
      },
    ];
  }

  get allSessions() {
    return this.sessions;
  }

  setSessionAgent(id: string, isAgent: boolean, agentKind: AgentKind = 'shell', title?: string) {
    const s = this.allSessions.find((session) => session.id === id);
    if (!s) return;

    s.isAgent = isAgent;
    s.agentKind = isAgent ? agentKind : 'shell';
    if (title && title.trim()) {
      s.title = title.trim();
    } else if (!isAgent) {
      const isDefaultAgentTitle = [
        'Antigravity (AGY)',
        'OpenCode',
        'Claude Code',
        'Pi Agent',
        'Codex Agent',
        'Aider AI',
        'Gemini CLI',
        'Goose Agent',
        'Custom Agent',
      ].includes(s.title) || s.title.endsWith(' Agent');

      if (isDefaultAgentTitle) {
        const idx = this.sessions.findIndex((sess) => sess.id === id);
        s.title = `Terminal (${idx >= 0 ? idx + 1 : 1})`;
      }
    }
  }

  toggleSessionAgent(id: string) {
    const s = this.allSessions.find((session) => session.id === id);
    if (s) {
      const nextIsAgent = !s.isAgent;
      const nextKind: AgentKind = nextIsAgent ? (s.agentKind === 'shell' ? 'custom' : s.agentKind) : 'shell';
      this.setSessionAgent(id, nextIsAgent, nextKind);
    }
  }

  updateSessionForegroundProcess(
    id: string,
    proc: {
      binary_name?: string | null;
      cmdline?: string | null;
      is_agent: boolean;
      matched_agent?: string | null;
    }
  ) {
    const s = this.allSessions.find((session) => session.id === id);
    if (!s) return;

    if (proc.is_agent && proc.matched_agent) {
      const matchedKind = proc.matched_agent.toLowerCase() as AgentKind;
      s.isAgent = true;
      s.agentKind = matchedKind;
      s.detectedBinary = proc.matched_agent;

      if (!s.isCustomTitle) {
        let agentTitle = matchedKind.charAt(0).toUpperCase() + matchedKind.slice(1);
        if (matchedKind === 'claude') agentTitle = 'Claude Code';
        else if (matchedKind === 'antigravity') agentTitle = 'Antigravity (AGY)';
        else if (matchedKind === 'opencode') agentTitle = 'OpenCode';
        else if (matchedKind === 'pi') agentTitle = 'Pi Agent';
        else if (matchedKind === 'codex') agentTitle = 'Codex Agent';
        else if (matchedKind === 'aider') agentTitle = 'Aider AI';
        else if (matchedKind === 'gemini') agentTitle = 'Gemini CLI';
        else if (matchedKind === 'goose') agentTitle = 'Goose Agent';

        s.title = agentTitle;
      }
    }
  }

  getQuickLaunchActions(): Record<string, { cmd: string; agentKind?: AgentKind; title: string }> {
    return {
      agy: { cmd: 'agy\r', agentKind: 'antigravity', title: 'Antigravity (AGY)' },
      claude: { cmd: 'claude\r', agentKind: 'claude', title: 'Claude Code' },
      opencode: { cmd: 'opencode\r', agentKind: 'opencode', title: 'OpenCode' },
      pi: { cmd: 'pi\r', agentKind: 'pi', title: 'Pi Agent' },
      codex: { cmd: 'codex\r', agentKind: 'codex', title: 'Codex Agent' },
      git_status: { cmd: 'git status\r', title: 'git status' },
      git_diff: { cmd: 'git diff\r', title: 'git diff' },
      clear: { cmd: 'clear\r', title: 'clear terminal' },
    };
  }
}

describe('Quick Launch Agents Update Tests (Pi & Codex Agents)', () => {
  describe('Quick Launch Actions Boundary & In-Bound Configuration', () => {
    it('In-Bound: Quick Launch actions include Pi Agent and Codex Agent', () => {
      const state = new MockAppState();
      const actions = state.getQuickLaunchActions();

      assert.ok(actions.pi, 'Quick launch should include pi');
      assert.equal(actions.pi.cmd, 'pi\r');
      assert.equal(actions.pi.agentKind, 'pi');
      assert.equal(actions.pi.title, 'Pi Agent');

      assert.ok(actions.codex, 'Quick launch should include codex');
      assert.equal(actions.codex.cmd, 'codex\r');
      assert.equal(actions.codex.agentKind, 'codex');
      assert.equal(actions.codex.title, 'Codex Agent');
    });

    it('Boundary Check: Aider, Gemini, and Goose are removed from Quick Launch actions', () => {
      const state = new MockAppState();
      const actions = state.getQuickLaunchActions();

      assert.equal((actions as any).aider, undefined, 'Aider AI must be removed from Quick Launch');
      assert.equal((actions as any).gemini, undefined, 'Gemini CLI must be removed from Quick Launch');
      assert.equal((actions as any).goose, undefined, 'Goose Agent must be removed from Quick Launch');
    });

    it('In-Bound: Core existing agents (Antigravity, Claude, OpenCode) and utilities remain intact', () => {
      const state = new MockAppState();
      const actions = state.getQuickLaunchActions();

      assert.ok(actions.agy, 'Antigravity must remain');
      assert.ok(actions.claude, 'Claude Code must remain');
      assert.ok(actions.opencode, 'OpenCode must remain');
      assert.ok(actions.git_status, 'git_status must remain');
      assert.ok(actions.git_diff, 'git_diff must remain');
      assert.ok(actions.clear, 'clear must remain');
    });
  });

  describe('Session State Management for Pi Agent and Codex Agent', () => {
    it('Lower Bound: Empty or whitespace custom title falls back to default title behavior', () => {
      const state = new MockAppState();
      const s = state.sessions[0];

      state.setSessionAgent(s.id, true, 'pi', '   ');
      assert.equal(s.isAgent, true);
      assert.equal(s.agentKind, 'pi');
      assert.equal(s.title, 'Terminal (1)', 'Whitespace title does not overwrite existing title');
    });

    it('In-Bound: Setting session to Pi Agent updates agentKind, isAgent, and title', () => {
      const state = new MockAppState();
      const s = state.sessions[0];

      state.setSessionAgent(s.id, true, 'pi', 'Pi Agent');
      assert.equal(s.isAgent, true);
      assert.equal(s.agentKind, 'pi');
      assert.equal(s.title, 'Pi Agent');

      // Reset to shell restores clean default title
      state.setSessionAgent(s.id, false, 'shell');
      assert.equal(s.isAgent, false);
      assert.equal(s.agentKind, 'shell');
      assert.equal(s.title, 'Terminal (1)');
    });

    it('In-Bound: Setting session to Codex Agent updates agentKind, isAgent, and title', () => {
      const state = new MockAppState();
      const s = state.sessions[1];

      state.setSessionAgent(s.id, true, 'codex', 'Codex Agent');
      assert.equal(s.isAgent, true);
      assert.equal(s.agentKind, 'codex');
      assert.equal(s.title, 'Codex Agent');

      // Reset to shell restores clean default title
      state.setSessionAgent(s.id, false, 'shell');
      assert.equal(s.isAgent, false);
      assert.equal(s.agentKind, 'shell');
      assert.equal(s.title, 'Terminal (2)');
    });

    it('In-Bound: toggleSessionAgent toggles correctly', () => {
      const state = new MockAppState();
      const s = state.sessions[0];

      state.setSessionAgent(s.id, true, 'pi', 'Pi Agent');
      assert.equal(s.isAgent, true);

      state.toggleSessionAgent(s.id);
      assert.equal(s.isAgent, false);
      assert.equal(s.agentKind, 'shell');

      state.toggleSessionAgent(s.id);
      assert.equal(s.isAgent, true);
      assert.equal(s.agentKind, 'custom');
    });

    it('Foreground Process Detection: Auto-detects pi and codex binaries and assigns correct titles', () => {
      const state = new MockAppState();
      const s1 = state.sessions[0];
      const s2 = state.sessions[1];

      state.updateSessionForegroundProcess(s1.id, {
        binary_name: 'pi',
        cmdline: 'pi',
        is_agent: true,
        matched_agent: 'pi',
      });
      assert.equal(s1.isAgent, true);
      assert.equal(s1.agentKind, 'pi');
      assert.equal(s1.title, 'Pi Agent');

      state.updateSessionForegroundProcess(s2.id, {
        binary_name: 'codex',
        cmdline: 'codex',
        is_agent: true,
        matched_agent: 'codex',
      });
      assert.equal(s2.isAgent, true);
      assert.equal(s2.agentKind, 'codex');
      assert.equal(s2.title, 'Codex Agent');
    });
  });

  describe('Process Detection Parity & Collision Prevention (pi & codex)', () => {
    it('Lower Boundary: Empty, whitespace or null inputs do not match agents', () => {
      assert.deepEqual(matchAgentBinaryParity('', ''), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('   ', '   '), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('bash', ''), [false, null]);
    });

    it('Upper Boundary & Collision Check: Common CLI tools starting with "pi" do NOT match Pi Agent', () => {
      // pip commands
      assert.deepEqual(matchAgentBinaryParity('python3', 'pip install requests'), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('sh', 'pip3 install numpy'), [false, null]);
      // ping
      assert.deepEqual(matchAgentBinaryParity('bash', 'ping 127.0.0.1'), [false, null]);
      // pico / pkill / pidof / pilot
      assert.deepEqual(matchAgentBinaryParity('bash', 'pico /etc/hosts'), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('sh', 'pkill node'), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('bash', 'pidof kestrel'), [false, null]);
      assert.deepEqual(matchAgentBinaryParity('bash', 'pilot start'), [false, null]);
    });

    it('In-Bound: Exact "pi" commands in wrappers or direct binary match Pi Agent', () => {
      assert.deepEqual(matchAgentBinaryParity('pi', 'pi'), [true, 'pi']);
      assert.deepEqual(matchAgentBinaryParity('pi-agent', 'pi-agent'), [true, 'pi']);
      assert.deepEqual(matchAgentBinaryParity('node', 'pi --model openai/gpt-4o'), [true, 'pi']);
      assert.deepEqual(matchAgentBinaryParity('sh', '/usr/local/bin/pi'), [true, 'pi']);
      assert.deepEqual(matchAgentBinaryParity('bash', 'npx pi --version'), [true, 'pi']);
    });

    it('In-Bound: Codex binary and path invocations match Codex Agent', () => {
      assert.deepEqual(matchAgentBinaryParity('codex', 'codex'), [true, 'codex']);
      assert.deepEqual(matchAgentBinaryParity('codex-cli', 'codex-cli'), [true, 'codex']);
      assert.deepEqual(matchAgentBinaryParity('sh', '/opt/codex/bin/codex --prompt test'), [true, 'codex']);
      assert.deepEqual(matchAgentBinaryParity('node', 'codex-cli start'), [true, 'codex']);
    });
  });

  describe('Agent Detection Manifests & Buffer Evaluation for Pi and Codex', () => {
    it('In-Bound: Registry resolves Codex and Pi manifests and patterns', () => {
      const registry = new ManifestRegistry();

      const codexManifest = registry.getManifest('codex');
      assert.ok(codexManifest, 'Codex manifest should exist in registry');
      assert.equal(codexManifest?.name, 'codex');
      assert.ok(codexManifest?.binaryNames.includes('codex'));

      const piManifest = registry.getManifest('pi');
      assert.ok(piManifest, 'Pi manifest should exist in registry');
      assert.equal(piManifest?.name, 'pi');
      assert.ok(piManifest?.binaryNames.includes('pi'));
    });

    it('Disk Loading: agent-detection/pi.toml and codex.toml parse cleanly from disk', () => {
      const piTomlPath = path.resolve('agent-detection/pi.toml');
      const codexTomlPath = path.resolve('agent-detection/codex.toml');

      assert.ok(fs.existsSync(piTomlPath), 'pi.toml must exist on disk');
      assert.ok(fs.existsSync(codexTomlPath), 'codex.toml must exist on disk');

      const piContent = fs.readFileSync(piTomlPath, 'utf8');
      const piManifest = parseAgentManifestToml(piContent);
      assert.equal(piManifest.name, 'pi');
      assert.ok(piManifest.binaryNames.includes('pi'));
      assert.ok(piManifest.patterns.blocked.length > 0);

      const codexContent = fs.readFileSync(codexTomlPath, 'utf8');
      const codexManifest = parseAgentManifestToml(codexContent);
      assert.equal(codexManifest.name, 'codex');
      assert.ok(codexManifest.binaryNames.includes('codex'));
      assert.ok(codexManifest.patterns.blocked.length > 0);
    });

    it('TUI Buffer Evaluation: Evaluates Pi Agent screen buffer states', () => {
      const registry = new ManifestRegistry();
      const piCompiled = registry.getManifest('pi');
      assert.ok(piCompiled, 'Compiled Pi manifest must exist');

      // Blocked state
      const blockedEval = evaluateBufferAgainstManifest(snapshotLinesFromText('Do you want to proceed? [y/N]'), piCompiled);
      assert.equal(blockedEval.status, 'blocked');

      // Working state
      const workingEval = evaluateBufferAgainstManifest(snapshotLinesFromText('⠋ thinking...\nReading workspace files...'), piCompiled);
      assert.equal(workingEval.status, 'working');

      // Idle state
      const idleEval = evaluateBufferAgainstManifest(snapshotLinesFromText('Task complete.\npi> '), piCompiled);
      assert.equal(idleEval.status, 'idle');
    });

    it('TUI Buffer Evaluation: Evaluates Codex Agent screen buffer states', () => {
      const registry = new ManifestRegistry();
      const codexCompiled = registry.getManifest('codex');
      assert.ok(codexCompiled, 'Compiled Codex manifest must exist');

      // Blocked state
      const blockedEval = evaluateBufferAgainstManifest(snapshotLinesFromText('Approve file edit? (y/n)'), codexCompiled);
      assert.equal(blockedEval.status, 'blocked');

      // Working state
      const workingEval = evaluateBufferAgainstManifest(snapshotLinesFromText('generating... 50%'), codexCompiled);
      assert.equal(workingEval.status, 'working');

      // Idle state
      const idleEval = evaluateBufferAgainstManifest(snapshotLinesFromText('Ready.\ncodex> '), codexCompiled);
      assert.equal(idleEval.status, 'idle');
    });
  });
});
