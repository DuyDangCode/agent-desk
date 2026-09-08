import type { AgentEvent, AgentEventType, ProjectItem, PtySession } from '$lib/types';

export interface ResolvedSessionTarget {
  projectId?: string;
  projectName?: string;
  sessionId?: string;
  sessionTitle?: string;
}

export class NotificationManager {
  private deduplicationCache = new Map<string, number>();
  private readonly defaultWindowMs = 5000;

  /**
   * Evaluates whether an event is duplicate within the deduplication window
   */
  isDuplicate(event: AgentEvent, windowMs = this.defaultWindowMs): boolean {
    const key = `${event.agent}:${event.sessionId || event.cwd || 'any'}:${event.type}`;
    const now = Date.now();
    const lastTime = this.deduplicationCache.get(key);

    if (lastTime && now - lastTime < windowMs) {
      return true;
    }

    this.deduplicationCache.set(key, now);
    // Prune stale cache entries
    if (this.deduplicationCache.size > 200) {
      for (const [k, time] of this.deduplicationCache.entries()) {
        if (now - time > windowMs * 2) {
          this.deduplicationCache.delete(k);
        }
      }
    }
    return false;
  }

  /**
   * Checks whether the application window is currently focused and visible
   */
  isAppFocused(): boolean {
    if (typeof document === 'undefined') return false;
    return document.hasFocus() && document.visibilityState === 'visible';
  }

  /**
   * Maps an incoming AgentEvent to the corresponding project and terminal session
   */
  resolveSessionTarget(
    event: AgentEvent,
    projects: ProjectItem[],
    standaloneSessions: PtySession[],
    activeProjectId?: string,
    focusedSessionId?: string
  ): ResolvedSessionTarget {
    // 1. Direct Session ID match
    if (event.sessionId) {
      for (const p of projects) {
        const s = p.sessions.find((sess) => sess.id === event.sessionId);
        if (s) {
          return {
            projectId: p.id,
            projectName: p.name,
            sessionId: s.id,
            sessionTitle: s.title,
          };
        }
      }

      const standalone = standaloneSessions.find((s) => s.id === event.sessionId);
      if (standalone) {
        return {
          sessionId: standalone.id,
          sessionTitle: standalone.title,
        };
      }
    }

    // 2. Working Directory Match against Projects
    if (event.cwd) {
      const normCwd = event.cwd.trim().replace(/\/+$/, '').toLowerCase();
      const matchedProj = projects.find(
        (p) => p.path.toLowerCase() === normCwd || normCwd.startsWith(p.path.toLowerCase())
      );

      if (matchedProj) {
        // Find agent session matching the agent type in that project
        const agentSess =
          matchedProj.sessions.find((s) => s.isAgent && s.agentKind === event.agent) ||
          matchedProj.sessions.find((s) => s.id === matchedProj.activeSessionId) ||
          matchedProj.sessions[0];

        return {
          projectId: matchedProj.id,
          projectName: matchedProj.name,
          sessionId: agentSess?.id,
          sessionTitle: agentSess?.title,
        };
      }
    }

    // 3. Fallback to active project or current focused session
    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (activeProject) {
      const activeSess = activeProject.sessions.find((s) => s.id === activeProject.activeSessionId);
      return {
        projectId: activeProject.id,
        projectName: activeProject.name,
        sessionId: activeSess?.id || focusedSessionId,
        sessionTitle: activeSess?.title,
      };
    }

    return {
      sessionId: focusedSessionId,
      sessionTitle: 'Terminal',
    };
  }

  /**
   * Formats a clean, readable notification title
   */
  formatTitle(event: AgentEvent, target: ResolvedSessionTarget): string {
    const agentCapitalized = event.agent.charAt(0).toUpperCase() + event.agent.slice(1);
    if (event.type === 'permission_required') {
      return `AgentDeck — ${agentCapitalized} Permission Required`;
    }
    return `AgentDeck — ${agentCapitalized} Needs Attention`;
  }

  /**
   * Formats a descriptive notification body
   */
  formatBody(event: AgentEvent, target: ResolvedSessionTarget): string {
    const projPrefix = target.projectName ? `[${target.projectName}] ` : '';
    if (event.message) {
      return `${projPrefix}${event.message}`;
    }
    if (event.type === 'permission_required') {
      return `${projPrefix}Approval required to execute tool or command.`;
    }
    return `${projPrefix}Waiting for your input to continue.`;
  }

  /**
   * Dispatches a native desktop notification when appropriate
   */
  async dispatchDesktopNotification(
    event: AgentEvent,
    target: ResolvedSessionTarget
  ): Promise<void> {
    const title = this.formatTitle(event, target);
    const body = this.formatBody(event, target);
    const urgency = event.type === 'permission_required' ? 'critical' : 'normal';

    try {
      const { showDesktopNotification } = await import('$lib/utils/tauri');
      await showDesktopNotification(title, body, urgency);
    } catch (e) {
      console.warn('[NotificationManager] Native desktop notification failed:', e);
    }
  }

  /**
   * Focuses the desktop application window
   */
  async focusWindow(): Promise<void> {
    try {
      const { focusAppWindow } = await import('$lib/utils/tauri');
      await focusAppWindow();
    } catch (e) {
      console.warn('[NotificationManager] Window focus failed:', e);
    }
  }
}

export const notificationManager = new NotificationManager();

/**
 * Strips ANSI escape sequences, OSC title codes, and control characters from terminal text
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  return text
    // Strip OSC sequences (e.g. \x1b]0;title\x07 or \x1b]0;title\x1b\)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Strip CSI sequences (e.g. \x1b[...m, \x1b[?25h, \x1b[2K, \x1b[1;34m)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    // Strip character set designations like \x1b(B, \x1b)0
    .replace(/\x1b[\(\)][A-Za-z0-9]/g, '')
    // Strip 2-byte escape sequences like \x1b=, \x1b>, \x1bN, \x1bO, etc.
    .replace(/\x1b[@-Z\\-_]|[\x80-\x9f]/g, '')
    // Normalize CRLF and isolated CR to LF
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');
}

export interface DetectedPrompt {
  type: 'permission_required' | 'input_required';
  message: string;
  matchedPattern: string;
}

// Module-level precompiled regexes for maximum throughput during PTY streaming
const PERMISSION_REGEX =
  /(?:allow|approve|permission\s+to\s+run|confirm(?:\s+changes)?|do\s+you\s+want\s+to\s+run|would\s+you\s+like\s+to\s+run|should\s+i\s+run|proceed\?|execute\s+command\?)\b/i;

const YES_NO_REGEX =
  /(?:\[[yY]\/[nN]\]|\([yY]\/[nN]\)|\b[yY]\/[nN]\b|\[(?:yes\/no)\]|\((?:yes\/no)\)|\?)/i;

const SELECT_OPTION_REGEX =
  /(?:\b(?:select|choose|pick)\s+(?:an?\s+)?(?:option|choice|action|item|model|plan|number)\b|\b(?:select|choose|pick)\s+(?:one|from)\b|\b(?:which\s+(?:one|option|would\s+you\s+like))\b)/i;

const ARROW_NAV_REGEX =
  /(?:\(use\s+arrow\s+keys\)|\barrow\s+keys\s+to\s+navigate\b|\bpress\s+(?:<enter>|enter|return)\s+to\s+(?:confirm|select|proceed|continue)\b)/i;

const INQUIRER_QUESTION_REGEX =
  /(?:^|\n)\s*(?:\?|\u276f)\s+.*?\b(?:select|choose|which|pick|option|confirm|proceed)\b/i;

const NUMBERED_CHOICE_LIST_REGEX =
  /(?:^|\n)\s*(?:[❯>•\-\*]|\(?\d+[\)\.\]])\s+.*?\n\s*(?:[❯>•\-\*]|\(?\d+[\)\.\]])\s+/m;

const OPTION_CONTEXT_REGEX =
  /(?:select|choose|option|choice)/i;

const INPUT_WAITING_REGEX =
  /(?:\bwaiting\s+for\s+(?:your\s+)?input\b|\buser\s+input\s+required\b|\btype\s+(?:your\s+)?answer\b|\benter\s+(?:your\s+)?(?:response|choice|option|selection|number)\b)/i;

/**
 * Detects if terminal output contains an interactive prompt requiring user attention,
 * such as option selection, confirmation (y/n), tool permission approval, or text input.
 */
export function detectInteractivePrompt(rawText: string): DetectedPrompt | null {
  if (!rawText || rawText.length < 3) return null;
  const clean = stripAnsi(rawText);

  // 1. Permission / Tool Approval Prompts
  if (PERMISSION_REGEX.test(clean) && YES_NO_REGEX.test(clean)) {
    return {
      type: 'permission_required',
      message: 'Agent requires permission or tool approval',
      matchedPattern: 'permission_prompt',
    };
  }

  // 2. Interactive Option Selection / Choice Prompts (e.g., "select option", "select an option", "choose option")
  if (SELECT_OPTION_REGEX.test(clean)) {
    return {
      type: 'input_required',
      message: 'Agent is waiting for you to select an option',
      matchedPattern: 'select_option',
    };
  }

  // 3. Arrow navigation / Enter to confirm prompts: "(Use arrow keys)", "Press Enter to confirm", etc.
  if (ARROW_NAV_REGEX.test(clean)) {
    return {
      type: 'input_required',
      message: 'Agent is waiting for option selection',
      matchedPattern: 'arrow_nav',
    };
  }

  // 4. Inquirer / Clack / CLI question headers: "? Select ..." or "❯ 1)"
  if (INQUIRER_QUESTION_REGEX.test(clean)) {
    return {
      type: 'input_required',
      message: 'Agent is asking a question or waiting for selection',
      matchedPattern: 'inquirer_question',
    };
  }

  // 5. Explicit choice lists (e.g. "❯ 1) ... \n  2) ...") with option context
  if (NUMBERED_CHOICE_LIST_REGEX.test(clean) && OPTION_CONTEXT_REGEX.test(clean)) {
    return {
      type: 'input_required',
      message: 'Agent is presenting options to choose from',
      matchedPattern: 'choice_list',
    };
  }

  // 6. Generic Waiting for input / enter response prompts
  if (INPUT_WAITING_REGEX.test(clean)) {
    return {
      type: 'input_required',
      message: 'Agent is waiting for your input',
      matchedPattern: 'input_waiting',
    };
  }

  return null;
}
