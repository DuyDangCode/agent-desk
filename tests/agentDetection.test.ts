import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseAgentManifestToml,
  compileManifest,
  evaluateBufferAgainstManifest,
  AgentStateMachine,
  ManifestRegistry,
  snapshotLinesFromText,
  compilePattern,
  type AgentManifest,
  type AgentStatus,
  type EvaluationResult
} from '../src/lib/utils/agentDetection.ts';

describe('Agent Detection Engine: Screen Buffer & Pattern Matching Tests', () => {
  let registry: ManifestRegistry;

  beforeEach(() => {
    registry = new ManifestRegistry();
  });

  describe('TOML Manifest Parser & Pattern Compiler', () => {
    it('Lower Bound: empty or minimal TOML content produces valid empty manifest', () => {
      const manifest = parseAgentManifestToml('');
      assert.equal(manifest.name, 'unknown');
      assert.deepEqual(manifest.binaryNames, []);
      assert.deepEqual(manifest.patterns.blocked, []);
      assert.deepEqual(manifest.patterns.idle, []);
      assert.deepEqual(manifest.patterns.working, []);
    });

    it('In-Bound: parses disk manifests (claude.toml, antigravity.toml, default.toml)', () => {
      const claudeToml = fs.readFileSync(path.resolve('agent-detection/claude.toml'), 'utf-8');
      const manifest = parseAgentManifestToml(claudeToml);
      assert.equal(manifest.name, 'claude-code');
      assert.ok(manifest.binaryNames.includes('claude'));
      assert.ok(manifest.patterns.blocked.length > 0);
      assert.ok(manifest.patterns.idle.length > 0);
      assert.ok(manifest.patterns.working.length > 0);

      const agyToml = fs.readFileSync(path.resolve('agent-detection/antigravity.toml'), 'utf-8');
      const agyManifest = parseAgentManifestToml(agyToml);
      assert.equal(agyManifest.name, 'antigravity');
      assert.ok(agyManifest.binaryNames.includes('agy'));
    });

    it('In-Bound: compilePattern correctly converts PCRE (?i) flag to JavaScript RegExp', () => {
      const rx1 = compilePattern('(?i)approve\\s+(command|execution)');
      assert.ok(rx1.flags.includes('i'), 'RegExp must have ignoreCase flag');
      assert.ok(rx1.flags.includes('m'), 'RegExp must have multiline flag');
      assert.ok(rx1.test('APPROVE command'));
      assert.ok(rx1.test('Approve execution'));
      assert.ok(!rx1.test('random string'));

      // Pattern with inline (?i) somewhere in string
      const rx2 = compilePattern('(?i)\\[y/N\\]');
      assert.ok(rx2.test('[y/N]'));
      assert.ok(rx2.test('[Y/n]'));
    });

    it('Upper Bound: handles complex TOML with multi-line arrays, comments, and extra spaces', () => {
      const customToml = `
        # Header comment
        [agent]
        name = "custom-agent"
        binary_names = [
          "custom1",
          "custom2", # inline comment
        ]

        [patterns]
        # Section comment
        blocked = [
          "(?i)do you want to proceed\\\\?",
          "(?i)confirm\\\\s+action"
        ]
        idle = [
          "^custom>\\\\s*$"
        ]
        working = [
          "\\\\[[⠋⠙⠹⠸]\\\\]",
          "(?i)processing\\\\.\\\\.\\\\."
        ]
      `;
      const parsed = parseAgentManifestToml(customToml);
      assert.equal(parsed.name, 'custom-agent');
      assert.deepEqual(parsed.binaryNames, ['custom1', 'custom2']);
      assert.equal(parsed.patterns.blocked.length, 2);
      assert.equal(parsed.patterns.idle.length, 1);
      assert.equal(parsed.patterns.working.length, 2);

      const compiled = compileManifest(parsed);
      assert.equal(compiled.blocked.length, 2);
      assert.equal(compiled.idle.length, 1);
      assert.equal(compiled.working.length, 2);
    });
  });

  describe('Manifest Registry & Binary Matching', () => {
    it('Lower Bound: unknown process returns default manifest or null', () => {
      const def = registry.getManifestForBinary('unknown_binary_xyz');
      assert.equal(def.name, 'default');
    });

    it('In-Bound: matches binary names to their respective agent manifests', () => {
      assert.equal(registry.getManifestForBinary('claude').name, 'claude-code');
      assert.equal(registry.getManifestForBinary('agy').name, 'antigravity');
      assert.equal(registry.getManifestForBinary('antigravity').name, 'antigravity');
      assert.equal(registry.getManifestForBinary('gemini').name, 'gemini');
      assert.equal(registry.getManifestForBinary('cursor').name, 'cursor');
      assert.equal(registry.getManifestForBinary('codex').name, 'codex');
      assert.equal(registry.getManifestForBinary('opencode').name, 'opencode');
      assert.equal(registry.getManifestForBinary('aider').name, 'aider');
    });

    it('Upper Bound: matches binary path with directory prefix (e.g. /usr/local/bin/claude)', () => {
      const match = registry.getManifestForBinary('/home/user/.nvm/versions/node/v20/bin/claude');
      assert.equal(match.name, 'claude-code');
    });
  });

  describe('Buffer Snapshotting & ANSI Normalization', () => {
    it('Lower Bound: empty buffer returns empty array', () => {
      const lines = snapshotLinesFromText('', 15);
      assert.deepEqual(lines, []);
    });

    it('In-Bound: strips ANSI color sequences and cursor positioning codes', () => {
      const rawText = '\x1b[32m✔\x1b[39m \x1b[1mClaude Code\x1b[22m\r\n\x1b[2K\x1b[33mApprove execution? [y/N]\x1b[0m';
      const lines = snapshotLinesFromText(rawText, 15);
      assert.equal(lines.length, 2);
      assert.equal(lines[0], '✔ Claude Code');
      assert.equal(lines[1], 'Approve execution? [y/N]');
    });

    it('Upper Bound: extracts only the last N visible lines from a long 200-line buffer', () => {
      const longOutput = Array.from({ length: 100 }, (_, i) => `Log line ${i}`).join('\n') +
        '\n\x1b[36m? Select an option:\x1b[39m\n❯ 1) Run test\n  2) Exit';
      const lines = snapshotLinesFromText(longOutput, 5);
      assert.equal(lines.length, 5);
      assert.equal(lines[lines.length - 1], '  2) Exit');
      assert.equal(lines[lines.length - 2], '❯ 1) Run test');
      assert.equal(lines[lines.length - 3], '? Select an option:');
    });
  });

  describe('Priority-Based Pattern Evaluation Algorithm', () => {
    let claudeManifest: ReturnType<typeof compileManifest>;

    beforeEach(() => {
      const tomlContent = fs.readFileSync(path.resolve('agent-detection/claude.toml'), 'utf-8');
      claudeManifest = compileManifest(parseAgentManifestToml(tomlContent));
    });

    it('Priority 1: Blocked state takes precedence over working spinner or idle prompt', () => {
      // Buffer contains both a working spinner and an approval prompt
      const bufferLines = [
        '⠋ Thinking...',
        'Generated code changes for src/App.svelte',
        'Approve execution? [y/N]'
      ];

      const result = evaluateBufferAgainstManifest(bufferLines, claudeManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
      assert.ok(result.matchedPattern);
    });

    it('Priority 1: Blocked matches permission and tool execution questions', () => {
      const lines = [
        'Tool Bash requires permission',
        'Allow tool execution "npm test"?'
      ];

      const result = evaluateBufferAgainstManifest(lines, claudeManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('Priority 2: Idle state matches prompt indicator when not blocked', () => {
      const lines = [
        'Task completed successfully in 12s',
        '❯ '
      ];

      const result = evaluateBufferAgainstManifest(lines, claudeManifest);
      assert.equal(result.status, 'idle');
      assert.equal(result.priority, 2);
    });

    it('Priority 3: Working state matches active spinner or progress tokens', () => {
      const lines = [
        'Reading files...',
        '⠋ thinking...',
        '4s | 120 tokens'
      ];

      const result = evaluateBufferAgainstManifest(lines, claudeManifest);
      assert.equal(result.status, 'working');
      assert.equal(result.priority, 3);
    });

    it('Lower Bound: completely empty buffer returns idle or null state', () => {
      const result = evaluateBufferAgainstManifest([], claudeManifest);
      assert.equal(result.status, 'idle');
      assert.equal(result.matchedPattern, null);
    });
  });

  describe('State Machine & Debouncing Transitions', () => {
    let sm: AgentStateMachine;

    beforeEach(() => {
      sm = new AgentStateMachine({ debounceMs: 50 });
    });

    it('Lower Bound: initial state for new pane is null or idle', () => {
      assert.equal(sm.getState('pane-1'), null);
    });

    it('In-Bound: blocked state transitions fast and triggers onBlocked alert callback', () => {
      let blockedEventFired = false;
      sm.onBlocked((sessionId, details) => {
        assert.equal(sessionId, 'pane-1');
        assert.equal(details.status, 'blocked');
        blockedEventFired = true;
      });

      sm.update('pane-1', {
        status: 'blocked',
        matchedPattern: 'approve',
        matchedLine: 'Approve execution? [y/N]',
        priority: 1,
      }, 'claude-code');

      assert.equal(sm.getState('pane-1'), 'blocked');
      assert.equal(blockedEventFired, true);
    });

    it('In-Bound: debounces intermediate working spinner ticks to prevent state flickering', async () => {
      // Transition to working
      sm.update('pane-1', { status: 'working', matchedPattern: 'spinner', matchedLine: '⠋', priority: 3 });
      assert.equal(sm.getState('pane-1'), 'working');

      // Brief moment where spinner is between frames (empty or unrecognised line)
      sm.update('pane-1', { status: 'idle', matchedPattern: null, matchedLine: '', priority: 2 });
      // Because of debounce, authoritative state should STILL be working!
      assert.equal(sm.getState('pane-1'), 'working');

      // Next spinner frame arrives 10ms later
      await new Promise((r) => setTimeout(r, 10));
      sm.update('pane-1', { status: 'working', matchedPattern: 'spinner', matchedLine: '⠙', priority: 3 });
      assert.equal(sm.getState('pane-1'), 'working');
    });

    it('In-Bound: transition from working to idle triggers onCompleted callback', async () => {
      let completedCalled = false;
      sm.onCompleted((sessionId) => {
        assert.equal(sessionId, 'pane-complete');
        completedCalled = true;
      });

      // Start in working
      sm.update('pane-complete', { status: 'working', matchedPattern: 'thinking', matchedLine: 'thinking...', priority: 3 });
      assert.equal(sm.getState('pane-complete'), 'working');

      // Transition to idle and let debounce elapse
      sm.update('pane-complete', { status: 'idle', matchedPattern: 'prompt', matchedLine: '❯ ', priority: 2 });

      await new Promise((r) => setTimeout(r, 70));
      assert.equal(sm.getState('pane-complete'), 'idle');
      assert.equal(completedCalled, true);
    });

    it('Upper Bound: deduplicates alerts so repeated blocked evaluations do not trigger spam', () => {
      let alertCount = 0;
      sm.onBlocked(() => {
        alertCount++;
      });

      const blockedResult: EvaluationResult = {
        status: 'blocked',
        matchedPattern: 'confirm',
        matchedLine: 'Do you want to proceed? [y/N]',
        priority: 1,
      };

      // Call 5 times in rapid succession
      sm.update('pane-dedup', blockedResult, 'claude-code');
      sm.update('pane-dedup', blockedResult, 'claude-code');
      sm.update('pane-dedup', blockedResult, 'claude-code');
      sm.update('pane-dedup', blockedResult, 'claude-code');

      assert.equal(alertCount, 1, 'onBlocked should fire only once per distinct blocked event');
    });
  });

  describe('Antigravity (agy) Status & Input Detection', () => {
    let agyManifest: ReturnType<typeof compileManifest>;

    beforeEach(() => {
      const tomlContent = fs.readFileSync(path.resolve('agent-detection/antigravity.toml'), 'utf-8');
      agyManifest = compileManifest(parseAgentManifestToml(tomlContent));
    });

    it('Lower Bound: matches agy, antigravity, and antigravity-cli binaries', () => {
      assert.equal(registry.getManifestForBinary('agy').name, 'antigravity');
      assert.equal(registry.getManifestForBinary('antigravity').name, 'antigravity');
      assert.equal(registry.getManifestForBinary('antigravity-cli').name, 'antigravity');
      assert.equal(registry.getManifestForBinary('/home/user/.local/bin/agy').name, 'antigravity');
    });

    it('In-Bound: detects blocked on "Approve this action?" dialog', () => {
      const lines = [
        '╭─ Tool Call: run_command ─────────────────────────────╮',
        '│ CommandLine: cargo test                              │',
        '╰──────────────────────────────────────────────────────╯',
        'Approve this action?',
        '  > 1. Yes, allow tool call',
        '    2. Yes, and always allow in this conversation',
        '    3. No, and always deny'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: detects blocked on tool permission choices like "Yes, allow tool call"', () => {
      const lines = [
        'The agent wants to execute: npm run build',
        'Choices:',
        '  > 1. Yes, allow tool call',
        '    2. Amend with feedback'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: detects blocked on file creation / edit prompts ("Allow creation of this file?")', () => {
      const lines = [
        'Target: /workspace/src/newComponent.svelte',
        'Allow creation of this file? (y/n)',
        'Press 1 to accept or 2 to reject'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: detects blocked on ask_question option selection', () => {
      const lines = [
        '? Select an option: (Use arrow keys)',
        '❯ (Recommended) Option A',
        '  Option B',
        '  Submit/Skip'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: question starting with "? " is NOT erroneously marked as idle', () => {
      const lines = [
        '? Would you like to proceed with database migrations? (Y/n)'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: detects true agy idle state at prompt without blocking prompts', () => {
      const lines = [
        'Turn complete in 3.4s (12,400 tokens)',
        'agy> '
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'idle');
      assert.equal(result.priority, 2);
    });

    it('In-Bound: typing / and opening slash command autocomplete does NOT trigger blocked notification', () => {
      const lines = [
        '/',
        '> /add-dir          Add a directory to the workspace',
        '/agents           List available custom agents',
        '/artifact         View and review artifacts',
        '/btw              Ask a side question without interrupting',
        '/changelog        Show release notes and changes',
        '↓ 43 more',
        '↑/↓ Navigate · enter Select · tab Complete',
        '-- INSERT -- ? for shortcuts · Gemini 3.8 Flash · low',
        'esc to cancel (Google AI Pro)'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.notEqual(result.status, 'blocked', 'Slash command completion popup must never trigger blocked state');
      assert.equal(result.status, 'idle');
    });

    it('Upper Bound: default manifest fallback also detects agy blocked questions', () => {
      const defaultManifest = registry.getManifest('default');
      const lines = [
        'Approve this action?',
        '  1. Yes, allow tool call',
        '  2. No, and always deny'
      ];
      const result = evaluateBufferAgainstManifest(lines, defaultManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('In-Bound: detects agy interactive question (ask_question tool prompt) as blocked', () => {
      const lines = [
        'Question 1/1: Which database should I use: PostgreSQL, MySQL, or MongoDB?',
        '',
        '> 1. PostgreSQL',
        '  2. MySQL',
        '  3. MongoDB',
        '  4. Write-in...',
        '',
        '  ↑/↓ Navigate · enter Select · esc Skip',
        'esc to cancel'
      ];
      const result = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });

    it('Boundary: detects multi-question and default fallback prompts as blocked', () => {
      const defaultManifest = registry.getManifest('default');
      const lines = [
        'Question 2 of 5: Select authentication strategy',
        '> 1. JWT',
        '  2. Session cookie',
        '  3. Write-in...',
        '  esc Skip'
      ];
      const resAgy = evaluateBufferAgainstManifest(lines, agyManifest);
      assert.equal(resAgy.status, 'blocked');
      const resDefault = evaluateBufferAgainstManifest(lines, defaultManifest);
      assert.equal(resDefault.status, 'blocked');
    });

    it('In-Bound: OpenCode TUI idle state detected via Ask anything and footer shortcuts', () => {
      const opencodeManifest = registry.getManifestForBinary('opencode');
      const lines = [
        '▄     █▀▀█ █▀▀█ █▀▀█ █▀▀▄█▀▀▀ █▀▀█ █▀▀█ █▀▀██  █ █  █ █▀▀▀ █  ██    █  █ █  █ █▀▀▀',
        '┃                                                                          ┃',
        '┃  Ask anything… "Fix a TODO in the codebase"                              ┃',
        '┃                                                                          ┃',
        '┃  Build · Nano Banana Pro Preview OpenRouter                              ╹',
        '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀',
        'tab agents',
        'ctrl+p commands',
        '● Tip Run opencode auth list to see all configured providers',
        '~/Projects/agent_deck',
        '1.18.30'
      ];
      const result = evaluateBufferAgainstManifest(lines, opencodeManifest);
      assert.equal(result.status, 'idle');
      assert.equal(result.priority, 2);
    });

    it('In-Bound: OpenCode working state detected via thinking and esc to interrupt', () => {
      const opencodeManifest = registry.getManifestForBinary('opencode');
      const lines = [
        '⠙ Thinking for 4.2s (142 tokens)',
        'Running bash: cargo test --workspace',
        'esc to interrupt'
      ];
      const result = evaluateBufferAgainstManifest(lines, opencodeManifest);
      assert.equal(result.status, 'working');
      assert.equal(result.priority, 3);
    });

    it('In-Bound: OpenCode blocked state detected via Allow once / Always allow permission prompt', () => {
      const opencodeManifest = registry.getManifestForBinary('opencode');
      const lines = [
        'Permission request for bash tool:',
        'Command: rm -rf target/debug',
        '> 1. Allow once',
        '  2. Always allow',
        '  3. Reject'
      ];
      const result = evaluateBufferAgainstManifest(lines, opencodeManifest);
      assert.equal(result.status, 'blocked');
      assert.equal(result.priority, 1);
    });
  });
});
