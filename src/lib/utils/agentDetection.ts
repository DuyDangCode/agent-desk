/**
 * Agent Detection Engine: Terminal Screen Buffer & Pattern Matching
 * Black-box agent status detection engine inspired by Herdr's screen buffer architecture.
 * Evaluates live terminal output against declarative TOML manifests to determine
 * if the agent is 'idle', 'working', or 'blocked'.
 */

export type AgentStatus = 'idle' | 'working' | 'blocked';

export interface AgentManifest {
  name: string;
  binaryNames: string[];
  patterns: {
    blocked: string[];
    idle: string[];
    working: string[];
  };
  hooks?: {
    workingTitle?: string[];
    idleTitle?: string[];
  };
}

export interface CompiledAgentManifest {
  name: string;
  binaryNames: string[];
  blocked: RegExp[];
  idle: RegExp[];
  working: RegExp[];
  hooks?: {
    workingTitle?: RegExp[];
    idleTitle?: RegExp[];
  };
}

export interface EvaluationResult {
  status: AgentStatus;
  matchedPattern: string | null;
  matchedLine: string | null;
  priority: number; // 1 = blocked, 2 = idle, 3 = working, 4 = fallback
}

export interface PaneState {
  sessionId: string;
  authoritativeStatus: AgentStatus | null;
  candidateStatus: AgentStatus | null;
  candidateSince: number;
  lastEvaluationTime: number;
  agentName: string;
  lastAlertedMessage: string | null;
  lastAlertedTime: number;
  debounceTimer?: any;
  lastEvaluation?: EvaluationResult;
}

/**
 * Strips ANSI escape sequences, OSC title codes, and control characters.
 */
export function stripAnsiCodes(text: string): string {
  if (!text) return '';
  return text
    // Strip OSC sequences (e.g. \x1b]0;title\x07 or \x1b]0;title\x1b\)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Strip CSI sequences (e.g. \x1b[...m, \x1b[?25h, \x1b[2K, \x1b[1;34m)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    // Strip character set designations like \x1b(B, \x1b)0
    .replace(/\x1b[\(\)][A-Za-z0-9]/g, '')
    // Strip 2-byte escape sequences
    .replace(/\x1b[@-Z\\-_]|[\x80-\x9f]/g, '')
    // Normalize CRLF and isolated CR to LF
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');
}

/**
 * Compiles a regex pattern from manifest TOML, safely converting PCRE inline flags like (?i)
 * into JavaScript RegExp flags ('i', 'm').
 */
export function compilePattern(rawPattern: string): RegExp {
  let pattern = rawPattern.trim();
  let flags = 'm'; // always multiline so ^ and $ match line bounds

  // Handle (?i) inline case-insensitive flag
  if (pattern.includes('(?i)')) {
    flags += 'i';
    pattern = pattern.replace(/\(\?i\)/g, '');
  }

  // Handle (?m) inline multiline flag if present
  if (pattern.includes('(?m)')) {
    pattern = pattern.replace(/\(\?m\)/g, '');
  }

  return new RegExp(pattern, flags);
}

function extractQuotedStringsAndCheckEnd(line: string, output: string[]): boolean {
  let inQuote: string | null = null;
  let current = '';
  let escaped = false;
  let arrayEnded = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (escaped) {
        current += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
        current += ch;
      } else if (ch === inQuote) {
        // String ended
        output.push(unescapeTomlString(current));
        current = '';
        inQuote = null;
      } else {
        current += ch;
      }
    } else {
      if (ch === '#') {
        break; // Comment starts outside quote
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ']') {
        arrayEnded = true;
        break;
      }
    }
  }
  return arrayEnded;
}

function unescapeTomlString(str: string): string {
  return str
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

/**
 * Self-contained parser for declarative agent-detection TOML files.
 */
export function parseAgentManifestToml(tomlStr: string): AgentManifest {
  const manifest: AgentManifest = {
    name: 'unknown',
    binaryNames: [],
    patterns: {
      blocked: [],
      idle: [],
      working: [],
    },
    hooks: {},
  };

  if (!tomlStr || !tomlStr.trim()) {
    return manifest;
  }

  let currentSection = '';
  let inArrayKey: string | null = null;
  let arrayAccumulator: string[] = [];

  const lines = tomlStr.split('\n');

  for (let line of lines) {
    line = line.trim();

    // Skip blank lines and full-line comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Check for section header: [section]
    const sectionMatch = line.match(/^\[([a-zA-Z0-9_\-\.]+)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      inArrayKey = null;
      continue;
    }

    // Handle multiline array collection
    if (inArrayKey) {
      const arrayEnded = extractQuotedStringsAndCheckEnd(line, arrayAccumulator);
      if (arrayEnded) {
        assignArrayToSection(manifest, currentSection, inArrayKey, arrayAccumulator);
        inArrayKey = null;
        arrayAccumulator = [];
      }
      continue;
    }

    // Key-value pair: key = ...
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.substring(0, eqIdx).trim().toLowerCase();
    let valPart = line.substring(eqIdx + 1).trim();

    // Check if inline array
    if (valPart.startsWith('[')) {
      const arrayEnded = extractQuotedStringsAndCheckEnd(valPart.substring(1), arrayAccumulator);
      if (arrayEnded) {
        assignArrayToSection(manifest, currentSection, key, arrayAccumulator);
        arrayAccumulator = [];
      } else {
        inArrayKey = key;
      }
      continue;
    }

    // Scalar string value
    const strMatch = valPart.match(/^["']([^"']*)["']/);
    if (strMatch) {
      const strVal = strMatch[1];
      if (currentSection === 'agent' && key === 'name') {
        manifest.name = strVal;
      }
    }
  }

  return manifest;
}

function assignArrayToSection(
  manifest: AgentManifest,
  section: string,
  key: string,
  items: string[]
): void {
  if (section === 'agent' && (key === 'binary_names' || key === 'binarynames')) {
    manifest.binaryNames = [...manifest.binaryNames, ...items];
  } else if (section === 'patterns') {
    if (key === 'blocked') {
      manifest.patterns.blocked = [...manifest.patterns.blocked, ...items];
    } else if (key === 'idle') {
      manifest.patterns.idle = [...manifest.patterns.idle, ...items];
    } else if (key === 'working') {
      manifest.patterns.working = [...manifest.patterns.working, ...items];
    }
  } else if (section === 'hooks') {
    if (!manifest.hooks) manifest.hooks = {};
    if (key === 'working_title' || key === 'workingtitle') {
      manifest.hooks.workingTitle = [...(manifest.hooks.workingTitle || []), ...items];
    } else if (key === 'idle_title' || key === 'idletitle') {
      manifest.hooks.idleTitle = [...(manifest.hooks.idleTitle || []), ...items];
    }
  }
}

/**
 * Compiles an AgentManifest into regex objects for evaluation.
 */
export function compileManifest(manifest: AgentManifest): CompiledAgentManifest {
  return {
    name: manifest.name,
    binaryNames: manifest.binaryNames,
    blocked: manifest.patterns.blocked.map(compilePattern),
    idle: manifest.patterns.idle.map(compilePattern),
    working: manifest.patterns.working.map(compilePattern),
    hooks: {
      workingTitle: (manifest.hooks?.workingTitle || []).map(compilePattern),
      idleTitle: (manifest.hooks?.idleTitle || []).map(compilePattern),
    },
  };
}

/**
 * Viewport-independent buffer snapshotter:
 * Extracts bottom-most lines of active CLI viewport, regardless of user scroll position.
 */
export function snapshotLinesFromText(rawText: string, maxLines = 15): string[] {
  if (!rawText) return [];
  const clean = stripAnsiCodes(rawText);
  const allLines = clean.split('\n').map((l) => l.trimEnd());

  // Filter trailing empty lines while leaving intentional spacing
  let lastNonEmpty = allLines.length - 1;
  while (lastNonEmpty >= 0 && !allLines[lastNonEmpty].trim()) {
    lastNonEmpty--;
  }

  if (lastNonEmpty < 0) return [];

  const relevantLines = allLines.slice(0, lastNonEmpty + 1);
  return relevantLines.slice(-maxLines);
}

/**
 * Extracts live screen buffer lines directly from an xterm.js Terminal instance.
 * Ensures complete Viewport Independence using baseY and native ANSI cell decoding.
 */
export function extractLiveViewportLines(term: any, maxLines = 15): string[] {
  if (!term || !term.buffer || !term.buffer.active) {
    return [];
  }

  const buffer = term.buffer.active;
  const baseY = buffer.baseY; // scrollback offset where active screen starts
  const rows = term.rows || 24;

  const visibleLines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const line = buffer.getLine(baseY + r);
    if (line) {
      visibleLines.push(line.translateToString(true));
    }
  }

  // Find last line with non-empty content
  let lastIdx = visibleLines.length - 1;
  while (lastIdx >= 0 && !visibleLines[lastIdx].trim()) {
    lastIdx--;
  }

  if (lastIdx < 0) return [];

  const trimmed = visibleLines.slice(0, lastIdx + 1);
  return trimmed.slice(-maxLines);
}

/**
 * Component D: Priority-Based Evaluation Algorithm
 *
 * Priority 1: Check 'blocked' first (Needs user interaction/confirmation)
 * Priority 2: Check 'idle' second (Waiting at prompt indicator)
 * Priority 3: Check 'working' third / fallback (Active output / spinners / progress)
 */
export function evaluateBufferAgainstManifest(
  lines: string[],
  manifest: CompiledAgentManifest
): EvaluationResult {
  if (!lines || lines.length === 0) {
    return {
      status: 'idle',
      matchedPattern: null,
      matchedLine: null,
      priority: 4,
    };
  }

  const joinedBuffer = lines.join('\n');
  const bottomLines = lines.slice(-4); // Prompt is usually in bottom 1-4 lines

  // 1. Check 'blocked' first (Highest Priority)
  for (const rx of manifest.blocked) {
    if (rx.test(joinedBuffer)) {
      // Find the specific line that matched for descriptive reporting
      const matchedLine = lines.find((l) => rx.test(l)) || lines[lines.length - 1];
      return {
        status: 'blocked',
        matchedPattern: rx.source,
        matchedLine,
        priority: 1,
      };
    }
  }

  // 2. Check 'idle' second (Medium Priority)
  // Idle patterns (prompts like '❯', '>') match the very bottom of the buffer
  for (const rx of manifest.idle) {
    for (let i = bottomLines.length - 1; i >= 0; i--) {
      const line = bottomLines[i].trim();
      if (rx.test(line)) {
        // Double check: ensure no active working spinner is on this same line
        const hasWorkingOnSameLine = manifest.working.some((wrx) => wrx.test(line));
        if (!hasWorkingOnSameLine) {
          return {
            status: 'idle',
            matchedPattern: rx.source,
            matchedLine: line,
            priority: 2,
          };
        }
      }
    }
  }

  // 3. Check 'working' third (Lowest Priority)
  for (const rx of manifest.working) {
    if (rx.test(joinedBuffer)) {
      const matchedLine = lines.find((l) => rx.test(l)) || lines[lines.length - 1];
      return {
        status: 'working',
        matchedPattern: rx.source,
        matchedLine,
        priority: 3,
      };
    }
  }

  // Fallback: If buffer ends with standard prompt characters, treat as idle
  const lastLine = lines[lines.length - 1].trim();
  if (/^[❯>%$#]\s*$/.test(lastLine)) {
    return {
      status: 'idle',
      matchedPattern: 'fallback_prompt',
      matchedLine: lastLine,
      priority: 2,
    };
  }

  return {
    status: 'idle',
    matchedPattern: null,
    matchedLine: null,
    priority: 4,
  };
}

/**
 * State Machine & Debouncer:
 * Manages per-pane authoritative state, debouncing rapid intermediate rerenders,
 * and dispatching state changes, notifications, and alert sounds.
 */
export class AgentStateMachine {
  private panes = new Map<string, PaneState>();
  private debounceMs: number;

  private stateChangeListeners: ((sessionId: string, oldState: AgentStatus | null, newState: AgentStatus, details: EvaluationResult) => void)[] = [];
  private blockedListeners: ((sessionId: string, details: EvaluationResult, agentName: string) => void)[] = [];
  private completedListeners: ((sessionId: string, agentName: string) => void)[] = [];

  constructor(options?: { debounceMs?: number }) {
    this.debounceMs = options?.debounceMs ?? 250;
  }

  getState(sessionId: string): AgentStatus | null {
    return this.panes.get(sessionId)?.authoritativeStatus ?? null;
  }

  onStateChange(fn: (sessionId: string, oldState: AgentStatus | null, newState: AgentStatus, details: EvaluationResult) => void): () => void {
    this.stateChangeListeners.push(fn);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== fn);
    };
  }

  onBlocked(fn: (sessionId: string, details: EvaluationResult, agentName: string) => void): () => void {
    this.blockedListeners.push(fn);
    return () => {
      this.blockedListeners = this.blockedListeners.filter((l) => l !== fn);
    };
  }

  onCompleted(fn: (sessionId: string, agentName: string) => void): () => void {
    this.completedListeners.push(fn);
    return () => {
      this.completedListeners = this.completedListeners.filter((l) => l !== fn);
    };
  }

  /**
   * Updates state evaluation for a pane. Returns true if authoritative state changed.
   */
  update(sessionId: string, evaluation: EvaluationResult, agentName = 'agent'): boolean {
    const now = Date.now();
    let pane = this.panes.get(sessionId);

    if (!pane) {
      pane = {
        sessionId,
        authoritativeStatus: null,
        candidateStatus: evaluation.status,
        candidateSince: now,
        lastEvaluationTime: now,
        agentName,
        lastAlertedMessage: null,
        lastAlertedTime: 0,
      };
      this.panes.set(sessionId, pane);
    }

    pane.agentName = agentName;
    pane.lastEvaluationTime = now;
    pane.lastEvaluation = evaluation;

    // Initial state: If authoritativeStatus is null, initialize immediately
    if (pane.authoritativeStatus === null) {
      pane.authoritativeStatus = evaluation.status;
      pane.candidateStatus = evaluation.status;
      pane.candidateSince = now;
      this.notifyStateChange(sessionId, null, evaluation.status, evaluation);
      if (evaluation.status === 'blocked') {
        pane.lastAlertedMessage = evaluation.matchedLine;
        pane.lastAlertedTime = now;
        this.notifyBlocked(sessionId, evaluation, agentName);
      }
      return true;
    }

    // Fast-path: If evaluated as 'blocked', trigger immediately or transition fast
    if (evaluation.status === 'blocked') {
      if (pane.debounceTimer) {
        clearTimeout(pane.debounceTimer);
        pane.debounceTimer = undefined;
      }

      const wasBlocked = pane.authoritativeStatus === 'blocked';
      const isNewMessage = pane.lastAlertedMessage !== evaluation.matchedLine;

      pane.candidateStatus = 'blocked';
      pane.candidateSince = now;

      if (!wasBlocked || isNewMessage) {
        const oldStatus = pane.authoritativeStatus;
        pane.authoritativeStatus = 'blocked';
        pane.lastAlertedMessage = evaluation.matchedLine;
        pane.lastAlertedTime = now;

        this.notifyStateChange(sessionId, oldStatus, 'blocked', evaluation);
        this.notifyBlocked(sessionId, evaluation, agentName);
        return true;
      }
      return false;
    }

    // If evaluated status matches current authoritative status, clear any pending debounce
    if (evaluation.status === pane.authoritativeStatus) {
      if (pane.debounceTimer) {
        clearTimeout(pane.debounceTimer);
        pane.debounceTimer = undefined;
      }
      pane.candidateStatus = evaluation.status;
      return false;
    }

    // State Debouncing for working <-> idle transitions:
    // When candidate changes, restart debounce timer
    if (evaluation.status !== pane.candidateStatus || !pane.debounceTimer) {
      if (pane.debounceTimer) {
        clearTimeout(pane.debounceTimer);
      }
      pane.candidateStatus = evaluation.status;
      pane.candidateSince = now;

      pane.debounceTimer = setTimeout(() => {
        if (!pane) return;
        pane.debounceTimer = undefined;
        if (pane.candidateStatus && pane.candidateStatus !== pane.authoritativeStatus) {
          const oldStatus = pane.authoritativeStatus;
          const newStatus = pane.candidateStatus;
          pane.authoritativeStatus = newStatus;

          const evalResult = pane.lastEvaluation || {
            status: newStatus,
            matchedPattern: null,
            matchedLine: null,
            priority: newStatus === 'idle' ? 2 : 3,
          };

          this.notifyStateChange(sessionId, oldStatus, newStatus, evalResult);

          if (oldStatus === 'working' && newStatus === 'idle') {
            this.notifyCompleted(sessionId, pane.agentName);
          }
        }
      }, this.debounceMs);

      return false;
    }

    return false;
  }

  reset(sessionId: string): void {
    const pane = this.panes.get(sessionId);
    if (pane?.debounceTimer) {
      clearTimeout(pane.debounceTimer);
    }
    this.panes.delete(sessionId);
  }

  private notifyStateChange(sessionId: string, oldState: AgentStatus | null, newState: AgentStatus, details: EvaluationResult) {
    for (const fn of this.stateChangeListeners) {
      try {
        fn(sessionId, oldState, newState, details);
      } catch (e) {
        console.error('[AgentStateMachine] StateChangeListener error:', e);
      }
    }
  }

  private notifyBlocked(sessionId: string, details: EvaluationResult, agentName: string) {
    for (const fn of this.blockedListeners) {
      try {
        fn(sessionId, details, agentName);
      } catch (e) {
        console.error('[AgentStateMachine] BlockedListener error:', e);
      }
    }
  }

  private notifyCompleted(sessionId: string, agentName: string) {
    for (const fn of this.completedListeners) {
      try {
        fn(sessionId, agentName);
      } catch (e) {
        console.error('[AgentStateMachine] CompletedListener error:', e);
      }
    }
  }
}

/**
 * Plays a pleasant notification alert chime using Web Audio API.
 * Safe to call in browser, Tauri, or headless environments.
 */
export function playAlertSound(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Pleasant two-tone chime: D5 (587.33Hz) -> A5 (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
  } catch (e) {
    console.debug('[AgentDetection] Audio alert playback unavailable:', e);
  }
}

/**
 * Built-in default manifests embedded so the application works out-of-the-box
 * and can be supplemented by disk-loaded TOML files from agent-detection/.
 */
const BUILTIN_MANIFESTS: AgentManifest[] = [
  {
    name: 'claude-code',
    binaryNames: ['claude', 'claude-code'],
    patterns: {
      blocked: [
        '(?i)approve\\s+(command|execution)',
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)allow\\s+.*\\?',
        '(?i)do you want to proceed\\?',
        '(?i)would you like to (run|proceed)',
        '(?i)press enter to confirm',
        '(?i)select an? option',
        '(?i)permission\\s+to\\s+run',
        '(?i)confirm\\s+(changes|action)'
      ],
      idle: [
        '^❯\\s*$',
        '^[\\w\\-\\.]+>\\s*$',
        '^\\?\\s+Type your command',
        '^\\s*╭─',
        '^Claude Code v[0-9]'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)running\\s+command',
        '\\d+s\\s+\\|\\s+\\d+\\s+tokens',
        '(?i)executing',
        '(?i)searching\\.\\.\\.'
      ]
    }
  },
  {
    name: 'antigravity',
    binaryNames: ['agy', 'antigravity', 'antigravity-cli'],
    patterns: {
      blocked: [
        '(?i)question\\s+\\d+\\s*[/|of]\\s*\\d+',
        '(?i)esc\\s+skip',
        '(?i)write-in(\\.\\.\\.)?',
        '(?i)enter\\s+select\\s*·\\s*esc\\s+skip',
        '(?i)approve\\s+(this\\s+action|command|execution|tool|changes?)',
        '(?i)yes,\\s*(allow|accept|and\\s+always)',
        '(?i)no,\\s*and\\s+always\\s+deny',
        '(?i)allow\\s+(tool|execution|creation|this|access|all)',
        '(?i)allow\\s+.*\\?',
        '(?i)confirm\\s+to\\s+proceed',
        '(?i)do you want to proceed\\?',
        '(?i)would you like to (proceed|run|continue)',
        '(?i)press\\s+1\\s+to\\s+accept\\s+or\\s+2\\s+to\\s+reject',
        '(?i)amend\\s+with\\s+feedback',
        '(?i)select\\s+an?\\s+option',
        '(?i)submit/skip',
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)press\\s+enter\\s+to\\s+(confirm|continue|submit)',
        '(?i)is\\s+ready\\s+for\\s+input',
        '(?i)delete\\?\\s*\\(',
        '(?i)permission\\s+(required|needed|request)',
        '(?i)ask_question',
        '(?i)type\\s+your\\s+(own|response|answer|input)',
        '(?i)enter\\s+your\\s+(response|answer|input)',
        '(?i)type\\s+a\\s+number',
        '(?i)choose\\s+an?\\s+option'
      ],
      idle: [
        '^❯\\s*$',
        '^agy>\\s*$',
        '^[\\w\\-\\.]+>\\s*$',
        '(?i)enter\\s+a\\s+prompt',
        '(?i)how\\s+can\\s+i\\s+help',
        '(?i)type\\s+a\\s+message'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)running\\s+command',
        '(?i)working\\.\\.\\.',
        '(?i)executing',
        '(?i)generating\\.\\.\\.',
        '\\d+s\\s+\\|\\s+\\d+\\s+tokens'
      ]
    }
  },
  {
    name: 'gemini',
    binaryNames: ['gemini', 'gemini-cli'],
    patterns: {
      blocked: [
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)allow\\s+.*\\?',
        '(?i)approve\\s+',
        '(?i)do you want to proceed\\?',
        '(?i)permission\\s+required'
      ],
      idle: [
        '^❯\\s*$',
        '^gemini>\\s*$',
        '^[\\w\\-\\.]+>\\s*$',
        '^\\?\\s+'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)generating\\.\\.\\.',
        '(?i)running'
      ]
    }
  },
  {
    name: 'cursor',
    binaryNames: ['cursor', 'cursor-agent'],
    patterns: {
      blocked: [
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)approve\\s+',
        '(?i)accept\\s+or\\s+reject',
        '(?i)do you want to run'
      ],
      idle: [
        '^❯\\s*$',
        '^cursor>\\s*$',
        '^[\\w\\-\\.]+>\\s*$'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)generating\\.\\.\\.',
        '(?i)running'
      ]
    }
  },
  {
    name: 'codex',
    binaryNames: ['codex', 'codex-cli'],
    patterns: {
      blocked: [
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)approve',
        '(?i)do you want to proceed'
      ],
      idle: [
        '^❯\\s*$',
        '^codex>\\s*$',
        '^[\\w\\-\\.]+>\\s*$'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)generating\\.\\.\\.'
      ]
    }
  },
  {
    name: 'opencode',
    binaryNames: ['opencode'],
    patterns: {
      blocked: [
        '(?i)allow\\s+once',
        '(?i)always\\s+allow',
        '(?i)allow\\s+.*\\?',
        '(?i)approve',
        '(?i)permission\\s+(required|needed|request)',
        '(?i)do you want to (allow|proceed|run)',
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)reject'
      ],
      idle: [
        '(?i)ask\\s+anything',
        '(?i)tab\\s+agents',
        '(?i)ctrl\\+p\\s+commands',
        '(?i)tip\\s+run\\s+opencode',
        '^opencode>\\s*$',
        '^❯\\s*$',
        '^[\\w\\-\\.]+>\\s*$'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking',
        '(?i)reasoning',
        '(?i)executing',
        '(?i)running\\s+(tool|command|bash|subagent)?',
        '(?i)applying\\s+patch',
        '(?i)esc\\s+to\\s+(interrupt|stop|cancel)',
        '\\d+s\\s+\\|'
      ]
    }
  },
  {
    name: 'aider',
    binaryNames: ['aider'],
    patterns: {
      blocked: [
        '(?i)\\[y/n\\]',
        '(?i)apply changes\\?',
        '(?i)run shell command\\?',
        '(?i)add to git\\?'
      ],
      idle: [
        '^aider>\\s*$',
        '^>\\s*$'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)tokens\\b'
      ]
    }
  },
  {
    name: 'default',
    binaryNames: [],
    patterns: {
      blocked: [
        '(?i)question\\s+\\d+\\s*[/|of]\\s*\\d+',
        '(?i)esc\\s+skip',
        '(?i)write-in(\\.\\.\\.)?',
        '(?i)enter\\s+select\\s*·\\s*esc\\s+skip',
        '(?i)approve\\s+(this\\s+action|command|execution|tool|changes?)',
        '(?i)yes,\\s*(allow|accept|and\\s+always)',
        '(?i)no,\\s*and\\s+always\\s+deny',
        '(?i)allow\\s+(tool|execution|creation|this|access|all)',
        '(?i)allow\\s+.*\\?',
        '(?i)confirm\\s+to\\s+proceed',
        '(?i)do you want to (proceed|run|continue)',
        '(?i)press\\s+1\\s+to\\s+accept\\s+or\\s+2\\s+to\\s+reject',
        '(?i)press\\s+enter\\s+to\\s+(confirm|continue|submit|return)',
        '(?i)select\\s+(an?\\s+)?option',
        '(?i)submit/skip',
        '(?i)\\[y/N\\]',
        '(?i)\\(y/n\\)',
        '(?i)amend\\s+with\\s+feedback',
        '(?i)is\\s+ready\\s+for\\s+input',
        '(?i)type\\s+your\\s+(own|response|answer|input)',
        '(?i)enter\\s+your\\s+(response|answer|input)',
        '(?i)choose\\s+an?\\s+option',
        '(?i)permission\\s+(required|needed|request)'
      ],
      idle: [
        '^❯\\s*$',
        '^[\\w\\-\\.]+>\\s*$',
        '^\\?\\s+Type your command',
        '(?i)enter\\s+a\\s+prompt',
        '(?i)how\\s+can\\s+i\\s+help'
      ],
      working: [
        '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]',
        '(?i)thinking\\.\\.\\.',
        '(?i)running\\s+command',
        '\\d+s\\s+\\|\\s+\\d+\\s+tokens'
      ]
    }
  }
];

export class ManifestRegistry {
  private manifests = new Map<string, CompiledAgentManifest>();
  private defaultManifest: CompiledAgentManifest;

  constructor() {
    this.defaultManifest = compileManifest(BUILTIN_MANIFESTS.find((m) => m.name === 'default')!);
    for (const m of BUILTIN_MANIFESTS) {
      this.registerManifest(m);
    }
  }

  registerManifest(manifest: AgentManifest): void {
    const compiled = compileManifest(manifest);
    this.manifests.set(manifest.name, compiled);
    if (manifest.name === 'default') {
      this.defaultManifest = compiled;
    }
  }

  getManifest(name: string): CompiledAgentManifest {
    return this.manifests.get(name) || this.defaultManifest;
  }

  /**
   * Component A: Matches process/binary name against known manifests
   */
  getManifestForBinary(binaryPathOrName: string): CompiledAgentManifest {
    if (!binaryPathOrName) return this.defaultManifest;

    const baseName = binaryPathOrName.split('/').pop()?.toLowerCase() || '';

    for (const manifest of this.manifests.values()) {
      if (manifest.binaryNames.some((bn) => bn.toLowerCase() === baseName || baseName.includes(bn.toLowerCase()))) {
        return manifest;
      }
    }

    return this.defaultManifest;
  }
}

export const manifestRegistry = new ManifestRegistry();
export const globalAgentStateMachine = new AgentStateMachine();
