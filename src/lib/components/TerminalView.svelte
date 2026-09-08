<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { WebglAddon } from '@xterm/addon-webgl';
  import { Unicode11Addon } from '@xterm/addon-unicode11';
  import '@xterm/xterm/css/xterm.css';
  import { appState } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import type { AgentKind, TerminalLayout } from '$lib/types';
  import { 
    spawnPty, 
    writePty, 
    resizePty, 
    killPty, 
    listenEvent 
  } from '$lib/utils/tauri';
  import { 
    Plus, 
    X, 
    Terminal as TerminalIcon, 
    Edit2, 
    Check, 
    Bot,
    Zap,
    Columns,
    Rows,
    Square,
    ArrowDown,
    ArrowRightLeft,
    Maximize2,
    Sparkles
  } from 'lucide-svelte';

  interface SessionTerminal {
    id: string;
    wrapper: HTMLDivElement;
    term: Terminal;
    fitAddon: FitAddon;
    resizeObserver: ResizeObserver;
    spawned: boolean;
    isAtBottom: boolean;
  }

  // Persistent module-level terminal cache
  const terminalMap = new Map<string, SessionTerminal>();
  const sessionInputBuffers = new Map<string, string>();

  let unlistenOutput: (() => void) | null = null;
  let unlistenExit: (() => void) | null = null;

  // DOM Slot & Container References
  let hiddenPoolElement = $state<HTMLDivElement | null>(null);
  let pane1SlotElement = $state<HTMLDivElement | null>(null);
  let pane2SlotElement = $state<HTMLDivElement | null>(null);
  let terminalContainerElement = $state<HTMLDivElement | null>(null);

  // Tab Title Renaming state
  let editingSessionId = $state<string | null>(null);
  let editingTitle = $state<string>('');

  // Quick Launch Dropdown State
  let selectedQuickAction = $state<string>('');

  // Split Divider Drag State
  let isResizingSplit = $state(false);

  // Floating Scroll to Bottom button state for focused session
  let isFocusedScrolledUp = $state(false);

  function updateScrollStatus(sessionId: string) {
    const st = terminalMap.get(sessionId);
    if (!st) return;
    const buffer = st.term.buffer.active;
    const isAtBottom = buffer.viewportY >= buffer.baseY;
    st.isAtBottom = isAtBottom;
    if (sessionId === appState.focusedSessionId) {
      isFocusedScrolledUp = !isAtBottom;
    }
  }

  function scrollToBottom(sessionId: string) {
    const st = terminalMap.get(sessionId);
    if (st) {
      st.term.scrollToBottom();
      st.isAtBottom = true;
      updateScrollStatus(sessionId);
      st.term.focus();
    }
  }

  function startRenaming(session: { id: string; title: string }, e?: MouseEvent) {
    if (e) e.stopPropagation();
    editingSessionId = session.id;
    editingTitle = session.title;
  }

  function saveRename(sessionId: string) {
    if (editingTitle.trim()) {
      appState.renameSession(sessionId, editingTitle.trim());
    }
    editingSessionId = null;
  }

  function handleRenameKeydown(sessionId: string, e: KeyboardEvent) {
    if (e.key === 'Enter') {
      saveRename(sessionId);
    } else if (e.key === 'Escape') {
      editingSessionId = null;
    }
  }

  function focusTerminal(sessionId: string, pane?: 'primary' | 'secondary') {
    if (pane) {
      appState.setFocusedPane(pane);
    }
    const st = terminalMap.get(sessionId);
    if (st) {
      st.term.focus();
    }
  }

  function handleFocusActiveTerminal() {
    const targetId = appState.focusedSessionId;
    if (targetId) {
      focusTerminal(targetId);
    }
  }

  function handleQuickCmd(cmd: string, agentKind?: AgentKind) {
    const targetSessionId = appState.focusedSessionId;
    if (targetSessionId) {
      if (agentKind) {
        const s = appState.sessions.find((session) => session.id === targetSessionId);
        if (s) {
          s.isAgent = true;
          s.agentKind = agentKind;
        }
      }
      writePty(targetSessionId, cmd);
      focusTerminal(targetSessionId);
    }
  }

  function onSelectQuickAction(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (!val) return;

    if (val === 'reset_shell') {
      const targetSessionId = appState.focusedSessionId;
      if (targetSessionId) {
        appState.setSessionAgent(targetSessionId, false, 'shell');
        appState.showToast('Reset terminal session to Standard Shell', 'info');
      }
      selectedQuickAction = '';
      return;
    }

    if (val === 'toggle_agent') {
      const targetSessionId = appState.focusedSessionId;
      if (targetSessionId) {
        appState.toggleSessionAgent(targetSessionId);
      }
      selectedQuickAction = '';
      return;
    }

    const actionMap: Record<string, { cmd: string; agentKind?: AgentKind }> = {
      agy: { cmd: 'agy\r', agentKind: 'antigravity' },
      opencode: { cmd: 'opencode\r', agentKind: 'opencode' },
      claude: { cmd: 'claude\r', agentKind: 'claude' },
      aider: { cmd: 'aider\r', agentKind: 'aider' },
      gemini: { cmd: 'gemini\r', agentKind: 'gemini' },
      goose: { cmd: 'goose\r', agentKind: 'goose' },
      git_status: { cmd: 'git status\r' },
      git_diff: { cmd: 'git diff\r' },
      clear: { cmd: 'clear\r' },
    };

    const action = actionMap[val];
    if (action) {
      handleQuickCmd(action.cmd, action.agentKind);
    }
    selectedQuickAction = '';
  }

  // Real-time typed command agent start/exit detection
  function detectAgentFromTypedInput(sessionId: string, data: string) {
    let buf = sessionInputBuffers.get(sessionId) || '';
    if (data === '\r' || data === '\n') {
      const trimmed = buf.trim().toLowerCase();
      const firstWord = trimmed.split(/\s+/)[0];
      const s = appState.allSessions.find((session) => session.id === sessionId);

      if (s) {
        if (firstWord === 'agy' || firstWord === 'antigravity') {
          appState.setSessionAgent(sessionId, true, 'antigravity', s.title.startsWith('Terminal') ? 'Antigravity (AGY)' : undefined);
        } else if (firstWord === 'opencode') {
          appState.setSessionAgent(sessionId, true, 'opencode', s.title.startsWith('Terminal') ? 'OpenCode' : undefined);
        } else if (firstWord === 'claude') {
          appState.setSessionAgent(sessionId, true, 'claude', s.title.startsWith('Terminal') ? 'Claude Code' : undefined);
        } else if (firstWord === 'aider') {
          appState.setSessionAgent(sessionId, true, 'aider', s.title.startsWith('Terminal') ? 'Aider AI' : undefined);
        } else if (firstWord === 'gemini') {
          appState.setSessionAgent(sessionId, true, 'gemini', s.title.startsWith('Terminal') ? 'Gemini CLI' : undefined);
        } else if (firstWord === 'goose') {
          appState.setSessionAgent(sessionId, true, 'goose', s.title.startsWith('Terminal') ? 'Goose Agent' : undefined);
        } else if (['/exit', 'exit', '/quit', 'quit', ':q', ':exit', 'q'].includes(firstWord)) {
          if (s.isAgent) {
            // When an exit command is executed inside an agent session, reset agent status
            appState.setSessionAgent(sessionId, false, 'shell');
          }
        }
      }
      sessionInputBuffers.set(sessionId, '');
    } else if (data === '\u0003') {
      // Ctrl+C pressed - clear typed buffer
      sessionInputBuffers.set(sessionId, '');
    } else if (data === '\u0004') {
      // Ctrl+D (EOF/exit) on empty prompt line
      if (buf.trim().length === 0) {
        const s = appState.allSessions.find((session) => session.id === sessionId);
        if (s?.isAgent) {
          appState.setSessionAgent(sessionId, false, 'shell');
        }
      }
      sessionInputBuffers.set(sessionId, '');
    } else if (data === '\u007f' || data === '\b') {
      if (buf.length > 0) {
        sessionInputBuffers.set(sessionId, buf.slice(0, -1));
      }
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
      sessionInputBuffers.set(sessionId, buf + data);
    }
  }

  function getXtermTheme(resolved: string) {
    if (resolved === 'light') {
      return {
        background: '#ffffff',
        foreground: '#0f172a',
        cursor: '#0969da',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(9, 105, 218, 0.25)',
        selectionForeground: '#0f172a',
        black: '#0f172a',
        red: '#cf222e',
        green: '#1a7f37',
        yellow: '#9a6700',
        blue: '#0969da',
        magenta: '#8250df',
        cyan: '#1b7c83',
        white: '#64748b',
        brightBlack: '#475569',
        brightRed: '#a40e26',
        brightGreen: '#116329',
        brightYellow: '#4d2d00',
        brightBlue: '#0550ae',
        brightMagenta: '#5a32a3',
        brightCyan: '#124d54',
        brightWhite: '#0f172a',
      };
    } else if (resolved === 'onedark') {
      return {
        background: '#282c34',
        foreground: '#f0f3f6',
        cursor: '#528bff',
        cursorAccent: '#282c34',
        selectionBackground: 'rgba(97, 175, 239, 0.4)',
        selectionForeground: '#ffffff',
        black: '#1e2127',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#f0f3f6',
        brightBlack: '#7f889b',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#d19a66',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      };
    } else if (resolved === 'dracula') {
      return {
        background: '#282a36',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#282a36',
        selectionBackground: 'rgba(68, 71, 90, 0.85)',
        selectionForeground: '#ffffff',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#ffffff',
        brightBlack: '#7988b8',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      };
    } else if (resolved === 'nord') {
      return {
        background: '#2e3440',
        foreground: '#ffffff',
        cursor: '#88c0d0',
        cursorAccent: '#2e3440',
        selectionBackground: 'rgba(67, 76, 94, 0.85)',
        selectionForeground: '#ffffff',
        black: '#3b4252',
        red: '#bf616a',
        green: '#a3be8c',
        yellow: '#ebcb8b',
        blue: '#81a1c1',
        magenta: '#b48ead',
        cyan: '#88c0d0',
        white: '#ffffff',
        brightBlack: '#616e88',
        brightRed: '#bf616a',
        brightGreen: '#a3be8c',
        brightYellow: '#ebcb8b',
        brightBlue: '#81a1c1',
        brightMagenta: '#b48ead',
        brightCyan: '#8fbcbb',
        brightWhite: '#ffffff',
      };
    }

    // Default: GitHub Dark (Black)
    return {
      background: '#0d1117',
      foreground: '#f0f6fc',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: 'rgba(56, 139, 253, 0.4)',
      selectionForeground: '#ffffff',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#f0f6fc',
      brightBlack: '#8b949e',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#ffffff',
    };
  }

  function applyThemeToAllTerminals() {
    const theme = getXtermTheme(themeState.resolved);
    for (const st of terminalMap.values()) {
      st.term.options.theme = theme;
      st.wrapper.style.backgroundColor = theme.background;
      if (st.term.element) {
        st.term.element.style.backgroundColor = theme.background;
        const viewport = st.term.element.querySelector('.xterm-viewport') as HTMLElement | null;
        if (viewport) {
          viewport.style.backgroundColor = theme.background;
        }
      }
    }
  }

  $effect(() => {
    applyThemeToAllTerminals();
  });

  function getOrCreateSessionTerminal(sessionId: string): SessionTerminal {
    if (terminalMap.has(sessionId)) {
      return terminalMap.get(sessionId)!;
    }

    const currentTheme = getXtermTheme(themeState.resolved);
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full h-full overflow-hidden';
    wrapper.style.backgroundColor = currentTheme.background;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.25,
      letterSpacing: 0,
      drawBoldTextInBrightColors: true,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: currentTheme,
      allowProposedApi: true,
      scrollback: 10000,
      scrollOnUserInput: true,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      const unicodeAddon = new Unicode11Addon();
      term.loadAddon(unicodeAddon);
      term.unicode.activeVersion = '11';
    } catch {}

    term.open(wrapper);

    if (term.element) {
      term.element.style.backgroundColor = currentTheme.background;
      const viewport = term.element.querySelector('.xterm-viewport') as HTMLElement | null;
      if (viewport) {
        viewport.style.backgroundColor = currentTheme.background;
      }
    }

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {}

    term.onData((data) => {
      detectAgentFromTypedInput(sessionId, data);
      writePty(sessionId, data).catch((err) => console.error('Write PTY failed:', err));
    });

    term.onResize(({ cols, rows }) => {
      resizePty(sessionId, cols, rows).catch(() => {});
    });

    term.onTitleChange((title) => {
      if (!title || !title.trim()) return;
      const cleanTitle = title.trim();
      const lower = cleanTitle.toLowerCase();
      const s = appState.allSessions.find((session) => session.id === sessionId);
      if (!s) return;

      if (lower.includes('claude')) {
        appState.setSessionAgent(sessionId, true, 'claude', s.title.startsWith('Terminal') ? 'Claude Code' : undefined);
      } else if (lower.includes('agy') || lower.includes('antigravity')) {
        appState.setSessionAgent(sessionId, true, 'antigravity', s.title.startsWith('Terminal') ? 'Antigravity (AGY)' : undefined);
      } else if (lower.includes('opencode')) {
        appState.setSessionAgent(sessionId, true, 'opencode', s.title.startsWith('Terminal') ? 'OpenCode' : undefined);
      } else if (lower.includes('aider')) {
        appState.setSessionAgent(sessionId, true, 'aider', s.title.startsWith('Terminal') ? 'Aider AI' : undefined);
      } else if (lower.includes('gemini')) {
        appState.setSessionAgent(sessionId, true, 'gemini', s.title.startsWith('Terminal') ? 'Gemini CLI' : undefined);
      } else if (lower.includes('goose')) {
        appState.setSessionAgent(sessionId, true, 'goose', s.title.startsWith('Terminal') ? 'Goose Agent' : undefined);
      } else if (
        s.isAgent &&
        (
          lower === 'bash' ||
          lower === 'zsh' ||
          lower === 'fish' ||
          lower === 'sh' ||
          lower === 'pwsh' ||
          lower === 'powershell' ||
          lower === 'cmd.exe' ||
          lower.endsWith('/bash') ||
          lower.endsWith('/zsh') ||
          lower.endsWith('/fish') ||
          lower.endsWith('/sh') ||
          lower.includes('@') ||
          lower.startsWith('~') ||
          lower.startsWith('/') ||
          lower.startsWith('c:\\')
        )
      ) {
        // Returned to standard shell prompt
        appState.setSessionAgent(sessionId, false, 'shell');
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
        try {
          fitAddon.fit();
          term.refresh(0, term.rows - 1);
          if (st.isAtBottom) {
            term.scrollToBottom();
          }
          updateScrollStatus(sessionId);
        } catch {}
      }
    });
    resizeObserver.observe(wrapper);

    const st: SessionTerminal = {
      id: sessionId,
      wrapper,
      term,
      fitAddon,
      resizeObserver,
      spawned: false,
      isAtBottom: true,
    };
    terminalMap.set(sessionId, st);

    // Track scroll position to update reactive scroll states
    term.onScroll(() => {
      updateScrollStatus(sessionId);
    });

    // Custom key event handler for terminal shortcuts
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        if (e.shiftKey && e.key === 'PageUp') {
          term.scrollPages(-1);
          updateScrollStatus(sessionId);
          return false;
        }
        if (e.shiftKey && e.key === 'PageDown') {
          term.scrollPages(1);
          updateScrollStatus(sessionId);
          return false;
        }
        if ((e.shiftKey && e.key === 'End') || ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown')) {
          scrollToBottom(sessionId);
          return false;
        }
        if ((e.shiftKey && e.key === 'Home') || ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp')) {
          term.scrollToTop();
          updateScrollStatus(sessionId);
          return false;
        }

        // Pass through global application hotkeys so xterm does not swallow them
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isBackquote = e.code === 'Backquote' || e.key === '`' || e.key === '~';
        if (
          // Project navigation: Ctrl+Alt+Left/Right, Ctrl+1..9
          (isCtrlOrMeta && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) ||
          (isCtrlOrMeta && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') ||
          // Terminal navigation: Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PageDown/PageUp
          (isCtrlOrMeta && !e.altKey && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) ||
          // Jump terminal: Alt+1..9
          (e.altKey && !isCtrlOrMeta && !e.shiftKey && e.key >= '1' && e.key <= '9') ||
          // New/Close terminal: Ctrl+Shift+`, Ctrl+Shift+W
          (isCtrlOrMeta && e.shiftKey && (isBackquote || e.key === 'W' || e.key === 'w')) ||
          // Focus/Toggle terminal / Modals / Toggles: Ctrl+`, Ctrl+,, Ctrl+Shift+B, Ctrl+Shift+S, Ctrl+Shift+T, Ctrl+Shift+D
          (isCtrlOrMeta && !e.shiftKey && !e.altKey && isBackquote) ||
          (isCtrlOrMeta && e.key === ',') ||
          (isCtrlOrMeta && e.shiftKey && ['b', 'B', 's', 'S', 't', 'T', 'd', 'D'].includes(e.key)) ||
          // Split layouts & Layout controls: Alt+H, Alt+V, Alt+S, Alt+X, Alt+[, Alt+], Alt+M, Alt+A, Alt+Z
          (e.altKey && !isCtrlOrMeta && ['h', 'H', 'v', 'V', 's', 'S', 'x', 'X', '[', ']', 'm', 'M', 'a', 'A', 'z', 'Z'].includes(e.key))
        ) {
          return false;
        }
      }
      return true;
    });

    // Direct wheel handler on container ensuring smooth scroll all the way to bottom
    const handleWheel = (e: WheelEvent) => {
      const buffer = term.buffer.active;
      const lines = Math.round(e.deltaY / 22) || (e.deltaY > 0 ? 2 : -2);
      term.scrollLines(lines);
      const isAtBottom = buffer.viewportY >= buffer.baseY;
      st.isAtBottom = isAtBottom;
      if (isAtBottom) {
        term.scrollToBottom();
      }
      updateScrollStatus(sessionId);
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: true });

    // Focus pane on click inside wrapper
    wrapper.addEventListener('pointerdown', () => {
      if (sessionId === appState.activeSessionId) {
        appState.setFocusedPane('primary');
      } else if (sessionId === appState.secondarySessionId) {
        appState.setFocusedPane('secondary');
      }
    });

    // Spawn PTY in session's working directory
    const sessionCwd = appState.findSessionCwd(sessionId) || appState.repoPath;
    setTimeout(async () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      const cols = dims?.cols || 80;
      const rows = dims?.rows || 24;

      try {
        await spawnPty(sessionId, sessionCwd || undefined, undefined, cols, rows);
        st.spawned = true;
      } catch (err: any) {
        term.write(`\r\n\x1b[31m[AgentDeck] Failed to spawn PTY: ${err?.message || err}\x1b[0m\r\n`);
      }
    }, 50);

    // Park wrapper initially in hidden pool
    if (hiddenPoolElement) {
      hiddenPoolElement.appendChild(wrapper);
    }

    return st;
  }

  function refreshActiveTerminals() {
    const activeId = appState.activeSessionId;
    const secondaryId = appState.secondarySessionId;
    const layout = appState.terminalLayout;

    if (activeId && terminalMap.has(activeId)) {
      const st = terminalMap.get(activeId);
      if (st && pane1SlotElement && st.wrapper.parentElement === pane1SlotElement) {
        try {
          st.fitAddon.fit();
          st.term.refresh(0, st.term.rows - 1);
          if (st.isAtBottom) st.term.scrollToBottom();
          updateScrollStatus(activeId);
        } catch {}
      }
    }

    if (layout !== 'single' && secondaryId && terminalMap.has(secondaryId)) {
      const st = terminalMap.get(secondaryId);
      if (st && pane2SlotElement && st.wrapper.parentElement === pane2SlotElement) {
        try {
          st.fitAddon.fit();
          st.term.refresh(0, st.term.rows - 1);
          if (st.isAtBottom) st.term.scrollToBottom();
          updateScrollStatus(secondaryId);
        } catch {}
      }
    }
  }

  // Reactive DOM Slot Mounting & Terminal Pool Management
  $effect(() => {
    const show = appState.showTerminal;
    const activeId = appState.activeSessionId;
    const secondaryId = appState.secondarySessionId;
    const layout = appState.terminalLayout;
    const allSessions = appState.allSessions;
    const focusedId = appState.focusedSessionId;
    const splitPercent = appState.terminalSplitPercent;

    // 1. Ensure SessionTerminals exist for all project sessions
    for (const session of allSessions) {
      getOrCreateSessionTerminal(session.id);
    }

    if (!show) return;

    // 2. Mount Pane 1 terminal into pane1SlotElement
    if (pane1SlotElement && activeId) {
      const st1 = terminalMap.get(activeId);
      if (st1) {
        if (st1.wrapper.parentElement !== pane1SlotElement) {
          pane1SlotElement.replaceChildren(st1.wrapper);
        }
        requestAnimationFrame(() => {
          try {
            st1.fitAddon.fit();
            st1.term.refresh(0, st1.term.rows - 1);
            if (st1.isAtBottom) st1.term.scrollToBottom();
            updateScrollStatus(activeId);
          } catch {}
        });
      }
    }

    // 3. Mount Pane 2 terminal into pane2SlotElement in split mode
    if (layout !== 'single' && pane2SlotElement && secondaryId && secondaryId !== activeId) {
      const st2 = terminalMap.get(secondaryId);
      if (st2) {
        if (st2.wrapper.parentElement !== pane2SlotElement) {
          pane2SlotElement.replaceChildren(st2.wrapper);
        }
        requestAnimationFrame(() => {
          try {
            st2.fitAddon.fit();
            st2.term.refresh(0, st2.term.rows - 1);
            if (st2.isAtBottom) st2.term.scrollToBottom();
            updateScrollStatus(secondaryId);
          } catch {}
        });
      }
    }

    // 4. Park all background sessions into hiddenPoolElement
    if (hiddenPoolElement) {
      for (const [id, st] of terminalMap.entries()) {
        const isVisible = id === activeId || (layout !== 'single' && id === secondaryId);
        if (!isVisible && st.wrapper.parentElement !== hiddenPoolElement) {
          hiddenPoolElement.appendChild(st.wrapper);
        }
      }
    }

    // 5. Cleanup closed sessions
    for (const id of Array.from(terminalMap.keys())) {
      if (!allSessions.some((s) => s.id === id)) {
        const st = terminalMap.get(id);
        if (st) {
          st.resizeObserver.disconnect();
          st.term.dispose();
          st.wrapper.remove();
          terminalMap.delete(id);
        }
      }
    }

    // Update scroll button status for focused session
    updateScrollStatus(focusedId);
  });

  // Drag Resizer Handlers for Split Horizontal / Vertical between Pane 1 and Pane 2
  function handleSplitMouseDown(e: MouseEvent) {
    e.preventDefault();
    isResizingSplit = true;
    window.addEventListener('mousemove', handleSplitMouseMove);
    window.addEventListener('mouseup', handleSplitMouseUp);
  }

  function handleSplitMouseMove(e: MouseEvent) {
    if (!isResizingSplit || !terminalContainerElement) return;
    const rect = terminalContainerElement.getBoundingClientRect();
    if (appState.terminalLayout === 'split-horizontal') {
      const clientXInPane = e.clientX - rect.left;
      const percent = (clientXInPane / rect.width) * 100;
      appState.setTerminalSplitPercent(percent);
    } else if (appState.terminalLayout === 'split-vertical') {
      const clientYInPane = e.clientY - rect.top;
      const percent = (clientYInPane / rect.height) * 100;
      appState.setTerminalSplitPercent(percent);
    }
    refreshActiveTerminals();
  }

  function handleSplitMouseUp() {
    isResizingSplit = false;
    window.removeEventListener('mousemove', handleSplitMouseMove);
    window.removeEventListener('mouseup', handleSplitMouseUp);
    refreshActiveTerminals();
  }

  onMount(async () => {
    unlistenOutput = await listenEvent<{ session_id: string; data: string }>(
      'pty-output',
      (payload) => {
        if (payload?.session_id && payload?.data) {
          const st = terminalMap.get(payload.session_id);
          if (st) {
            st.term.write(payload.data, () => {
              if (st.isAtBottom) {
                st.term.scrollToBottom();
              }
              updateScrollStatus(payload.session_id);
            });
          }

          // 1. Check for OSC title sequences in raw output stream
          const oscMatch = payload.data.match(/\x1b\](?:0|2);([^\x07\x1b]+)(?:\x07|\x1b\\)/);
          if (oscMatch && oscMatch[1]) {
            const oscTitle = oscMatch[1].toLowerCase().trim();
            const s = appState.allSessions.find((session) => session.id === payload.session_id);
            if (s) {
              if (oscTitle.includes('claude')) {
                appState.setSessionAgent(payload.session_id, true, 'claude');
              } else if (oscTitle.includes('agy') || oscTitle.includes('antigravity')) {
                appState.setSessionAgent(payload.session_id, true, 'antigravity');
              } else if (oscTitle.includes('opencode')) {
                appState.setSessionAgent(payload.session_id, true, 'opencode');
              } else if (oscTitle.includes('aider')) {
                appState.setSessionAgent(payload.session_id, true, 'aider');
              } else if (oscTitle.includes('gemini')) {
                appState.setSessionAgent(payload.session_id, true, 'gemini');
              } else if (oscTitle.includes('goose')) {
                appState.setSessionAgent(payload.session_id, true, 'goose');
              } else if (
                s.isAgent &&
                (
                  oscTitle === 'bash' ||
                  oscTitle === 'zsh' ||
                  oscTitle === 'fish' ||
                  oscTitle === 'sh' ||
                  oscTitle === 'pwsh' ||
                  oscTitle === 'powershell' ||
                  oscTitle === 'cmd.exe' ||
                  oscTitle.endsWith('/bash') ||
                  oscTitle.endsWith('/zsh') ||
                  oscTitle.endsWith('/fish') ||
                  oscTitle.endsWith('/sh') ||
                  oscTitle.includes('@') ||
                  oscTitle.startsWith('~') ||
                  oscTitle.startsWith('/') ||
                  oscTitle.startsWith('c:\\')
                )
              ) {
                appState.setSessionAgent(payload.session_id, false, 'shell');
              }
            }
          }

          // 2. Check for agent exit farewell patterns in output text
          const s = appState.allSessions.find((session) => session.id === payload.session_id);
          if (s?.isAgent) {
            if (
              payload.data.includes('Goodbye!') ||
              payload.data.includes('Bye!') ||
              payload.data.includes('Exiting Claude') ||
              payload.data.includes('Claude Code session ended') ||
              payload.data.includes('Leaving Claude Code') ||
              payload.data.includes('Antigravity session ended') ||
              payload.data.includes('OpenCode session ended') ||
              payload.data.includes('Aider session ended') ||
              payload.data.includes('Goose session ended')
            ) {
              appState.setSessionAgent(payload.session_id, false, 'shell');
            }
          }
        }
      }
    );

    unlistenExit = await listenEvent<{ session_id: string; exit_code: number }>(
      'pty-exit',
      (payload) => {
        if (payload?.session_id) {
          appState.setSessionAgent(payload.session_id, false, 'shell');
          const st = terminalMap.get(payload.session_id);
          if (st) {
            st.term.write(`\r\n\x1b[33m[Process completed with exit code ${payload.exit_code}]\x1b[0m\r\n`, () => {
              if (st.isAtBottom) {
                st.term.scrollToBottom();
              }
              updateScrollStatus(payload.session_id);
            });
          }
        }
      }
    );

    window.addEventListener('focus-active-terminal', handleFocusActiveTerminal);
  });

  onDestroy(() => {
    if (unlistenOutput) unlistenOutput();
    if (unlistenExit) unlistenExit();
    window.removeEventListener('focus-active-terminal', handleFocusActiveTerminal);
  });
</script>

<div class="h-full flex flex-col bg-white dark:bg-deck-bg overflow-hidden select-none">
  <!-- Offscreen hidden pool for background session DOM containers -->
  <div bind:this={hiddenPoolElement} class="hidden pointer-events-none" aria-hidden="true"></div>

  <!-- Session Tabs Bar, Split Modes, & Quick Actions Header -->
  <div class="h-9 bg-slate-50 dark:bg-deck-surface border-b border-deck-border/60 flex items-center justify-between px-2.5 py-0.5 shrink-0 select-none gap-2 relative z-20">
    <!-- Scrolling Tabs Container (Shows active project's session tabs) -->
    <div class="flex-1 min-w-0 overflow-x-auto flex items-center space-x-1 py-0.5 pr-2 no-scrollbar">
      {#each appState.sessions as session, idx (session.id)}
        {@const isPrimary = session.id === appState.activeSessionId}
        {@const isSecondary = appState.terminalLayout !== 'single' && session.id === appState.secondarySessionId}
        {@const isFocused = (isPrimary && appState.focusedPane === 'primary') || (isSecondary && appState.focusedPane === 'secondary') || (appState.terminalLayout === 'single' && isPrimary)}
        {@const isEditing = editingSessionId === session.id}
        <div
          class="shrink-0 group relative flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-md font-mono transition cursor-pointer {isFocused ? 'bg-white dark:bg-deck-bg text-slate-900 dark:text-deck-bright shadow-xs font-semibold ring-1 ring-blue-500/40' : isPrimary ? 'bg-slate-100/80 dark:bg-deck-card/60 text-slate-800 dark:text-deck-text' : isSecondary ? 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card/40'}"
          onclick={() => {
            appState.setActiveSession(session.id);
            focusTerminal(session.id);
          }}
          ondblclick={(e) => startRenaming(session, e)}
          role="tab"
          tabindex="0"
          aria-selected={isFocused}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              appState.setActiveSession(session.id);
              focusTerminal(session.id);
            }
          }}
        >
          <!-- Split Pane Identifier Pill (P1 in Blue, P2 in Purple) -->
          {#if appState.terminalLayout !== 'single'}
            {#if isPrimary}
              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60" title="Visible in Pane 1 (Primary)">P1</span>
            {:else if isSecondary}
              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60" title="Visible in Pane 2 (Secondary)">P2</span>
            {/if}
          {/if}

          <!-- Tab Index Hotkey Badge (Alt+1..9) -->
          {#if idx < 9}
            <span class="text-[9px] font-mono text-slate-400 dark:text-deck-muted/70 px-1 py-0.2 rounded bg-slate-200/50 dark:bg-deck-card" title="Switch tab (Alt+{idx + 1})">
              {idx + 1}
            </span>
          {/if}

          <!-- Agent or Shell Icon Badge -->
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              appState.toggleSessionAgent(session.id);
            }}
            class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-deck-border/60 transition shrink-0"
            title={session.isAgent ? '🤖 AI Coding Agent Session (Click to close agent status & reset to shell)' : '💻 Standard Shell (Click to mark as AI Agent)'}
          >
            {#if session.isAgent}
              <Bot class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />
            {:else}
              <TerminalIcon class="w-3.5 h-3.5 text-slate-500 dark:text-deck-muted" />
            {/if}
          </button>
          
          {#if isEditing}
            <div class="flex items-center space-x-1" onclick={(e) => e.stopPropagation()} role="presentation">
              <input
                type="text"
                bind:value={editingTitle}
                class="bg-gray-50 dark:bg-deck-card border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-deck-bright font-mono focus:outline-none w-28 shadow-inner"
                onkeydown={(e) => handleRenameKeydown(session.id, e)}
                onblur={() => saveRename(session.id)}
              />
              <button
                onclick={() => saveRename(session.id)}
                class="p-0.5 hover:bg-gray-200 dark:hover:bg-deck-border rounded text-emerald-600 dark:text-emerald-400 cursor-pointer"
                title="Save title"
              >
                <Check class="w-3 h-3" />
              </button>
            </div>
          {:else}
            <span class="truncate max-w-[130px] text-slate-900 dark:text-deck-bright" title="Double-click to rename">{session.title}</span>

            <!-- Edit Button on Hover -->
            <button
              onclick={(e) => startRenaming(session, e)}
              class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 dark:hover:bg-deck-border rounded text-slate-400 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright transition cursor-pointer"
              title="Rename tab"
            >
              <Edit2 class="w-2.5 h-2.5" />
            </button>

            <!-- Close Tab Button -->
            {#if appState.sessions.length > 1}
              <button
                class="p-0.5 hover:bg-gray-200 dark:hover:bg-deck-border rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 transition ml-0.5 cursor-pointer"
                onclick={(e) => {
                  e.stopPropagation();
                  appState.closeSession(session.id);
                }}
                title="Close terminal (Ctrl+Shift+W)"
              >
                <X class="w-3 h-3" />
              </button>
            {/if}
          {/if}
        </div>
      {/each}

      <!-- Add New Terminal Tab Button (Targeting Focused Pane) -->
      <button
        onclick={() => appState.addTerminalSession()}
        class="shrink-0 p-1 px-2 rounded bg-gray-100 dark:bg-deck-card/70 hover:bg-gray-200 dark:hover:bg-deck-border/80 border border-deck-border/50 text-slate-700 hover:text-slate-900 dark:text-deck-text dark:hover:text-deck-bright transition flex items-center space-x-1 text-xs cursor-pointer shadow-xs"
        title="Open new terminal in active pane (Ctrl+Shift+`)"
      >
        <Plus class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span class="text-xs font-mono font-medium">New Tab</span>
      </button>
    </div>

    <!-- Right Controls: Split Layout Switcher & Quick Launch Dropdown -->
    <div class="shrink-0 flex items-center space-x-2 pl-2 border-l border-deck-border/40">
      <!-- Layout Mode Buttons (Single, Side-by-Side Horizontal, Stacked Vertical) -->
      <div class="flex items-center bg-gray-100 dark:bg-deck-card/60 border border-deck-border/50 rounded p-0.5 text-xs">
        <button
          onclick={() => appState.setTerminalLayout('single')}
          class="p-1 rounded transition cursor-pointer {appState.terminalLayout === 'single' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
          title="Single Terminal Pane (Alt+S)"
          aria-label="Single Pane"
        >
          <Square class="w-3.5 h-3.5" />
        </button>
        <button
          onclick={() => appState.setTerminalLayout('split-horizontal')}
          class="p-1 rounded transition cursor-pointer {appState.terminalLayout === 'split-horizontal' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
          title="Side-by-Side Split Panes (Alt+H)"
          aria-label="Split Horizontal"
        >
          <Columns class="w-3.5 h-3.5" />
        </button>
        <button
          onclick={() => appState.setTerminalLayout('split-vertical')}
          class="p-1 rounded transition cursor-pointer {appState.terminalLayout === 'split-vertical' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
          title="Stacked Split Panes (Alt+V)"
          aria-label="Split Vertical"
        >
          <Rows class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quick Launch Select Box -->
      <div class="relative flex items-center">
        <Zap class="w-3 h-3 text-amber-500 absolute left-2 pointer-events-none" />
        <select
          bind:value={selectedQuickAction}
          onchange={onSelectQuickAction}
          class="bg-gray-50 dark:bg-deck-card/70 hover:bg-gray-100 dark:hover:bg-deck-border/80 border border-deck-border/50 rounded-md pl-6 pr-2 py-1 text-xs text-slate-900 dark:text-deck-bright font-mono focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs transition appearance-auto"
        >
          <option value="" disabled selected>⚡ Quick Launch</option>
          <optgroup label="🤖 AI Coding Agents">
            <option value="agy">Antigravity (AGY)</option>
            <option value="opencode">OpenCode</option>
            <option value="claude">Claude Code</option>
            <option value="aider">Aider AI</option>
            <option value="gemini">Gemini CLI</option>
            <option value="goose">Goose Agent</option>
          </optgroup>
          <optgroup label="🛠️ Git & Shell">
            <option value="git_status">git status</option>
            <option value="git_diff">git diff</option>
            <option value="clear">clear terminal</option>
          </optgroup>
          <optgroup label="⚙️ Agent Session Status">
            <option value="reset_shell">Reset Tab to Standard Shell</option>
            <option value="toggle_agent">Toggle AI Agent Mark</option>
          </optgroup>
        </select>
      </div>
    </div>
  </div>

  <!-- Terminal Deck Canvas Area -->
  <div 
    bind:this={terminalContainerElement}
    class="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-deck-bg cursor-text flex {appState.terminalLayout === 'split-vertical' ? 'flex-col' : 'flex-row'}"
  >
    {#if appState.terminalLayout === 'single'}
      <!-- Single Pane Layout: Pane 1 fills 100% seamlessly -->
      <div class="flex-1 w-full h-full relative overflow-hidden flex flex-col bg-white dark:bg-deck-bg">
        <div
          bind:this={pane1SlotElement}
          class="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-deck-bg"
          onclick={() => focusTerminal(appState.activeSessionId, 'primary')}
          onkeydown={(e) => { if (e.key === 'Enter') focusTerminal(appState.activeSessionId, 'primary'); }}
          tabindex="0"
          role="button"
          aria-label="Terminal Canvas"
        ></div>
      </div>

    {:else}
      <!-- Split Mode Layout (Side-by-Side or Stacked) -->
      
      <!-- 1. PANE 1 (Primary) -->
      <div 
        class="relative flex flex-col overflow-hidden bg-white dark:bg-deck-bg {appState.focusedPane === 'primary' ? 'border-t-2 border-blue-500/80 z-10' : 'border-t-2 border-transparent z-0'}"
        style={appState.terminalLayout === 'split-horizontal' ? `width: ${appState.terminalSplitPercent}%; height: 100%;` : `width: 100%; height: ${appState.terminalSplitPercent}%;`}
        onpointerdown={() => appState.setFocusedPane('primary')}
        role="region"
        aria-label="Pane 1"
      >
        <!-- Pane 1 Header Toolbar -->
        <div class="h-7.5 bg-slate-50/70 dark:bg-deck-surface/70 border-b border-deck-border/30 px-3 flex items-center justify-between shrink-0 select-none text-xs font-mono">
          <div class="flex items-center space-x-2 min-w-0">
            <!-- Pane Indicator Badge -->
            <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>PANE 1</span>
            </div>

            <!-- Focused Active Pill -->
            {#if appState.focusedPane === 'primary'}
              <span class="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold">Active</span>
            {/if}

            <!-- Session Selector Dropdown -->
            <select
              value={appState.activeSessionId}
              onchange={(e) => appState.setPrimarySession(e.currentTarget.value)}
              class="bg-white/80 dark:bg-deck-bg/80 border border-deck-border/40 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-800 dark:text-deck-bright focus:outline-none max-w-[140px] truncate cursor-pointer shadow-2xs"
            >
              {#each appState.sessions as s}
                <option value={s.id}>{s.title}</option>
              {/each}
            </select>
          </div>

          <!-- Pane 1 Action Controls -->
          <div class="flex items-center space-x-1 shrink-0">
            <!-- Swap Panes -->
            <button
              type="button"
              onclick={() => appState.swapTerminalPanes()}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="Swap Panes (Alt+X)"
            >
              <ArrowRightLeft class="w-3.5 h-3.5" />
            </button>

            <!-- New Session in Pane 1 -->
            <button
              type="button"
              onclick={() => appState.addTerminalSession(undefined, false, 'shell', 'primary')}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="New Terminal in Pane 1"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>

            <!-- Maximize Pane 1 to Single Mode -->
            <button
              type="button"
              onclick={() => appState.setTerminalLayout('single')}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="Maximize Pane 1 (Single Panel)"
            >
              <Maximize2 class="w-3.5 h-3.5" />
            </button>

            <!-- Close Pane 1 Session -->
            {#if appState.sessions.length > 1}
              <button
                type="button"
                onclick={() => appState.closeSession(appState.activeSessionId)}
                class="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                title="Close Session"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            {/if}
          </div>
        </div>

        <!-- Pane 1 Terminal Canvas Slot (Seamless Background) -->
        <div
          bind:this={pane1SlotElement}
          class="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-deck-bg"
          onclick={() => focusTerminal(appState.activeSessionId, 'primary')}
          onkeydown={(e) => { if (e.key === 'Enter') focusTerminal(appState.activeSessionId, 'primary'); }}
          tabindex="0"
          role="button"
          aria-label="Pane 1 Terminal Canvas"
        ></div>
      </div>

      <!-- Resizer Divider Gutter -->
      <div
        class="{appState.terminalLayout === 'split-horizontal' ? 'w-1.5 h-full cursor-col-resize hover:bg-blue-500/80 active:bg-blue-500' : 'h-1.5 w-full cursor-row-resize hover:bg-blue-500/80 active:bg-blue-500'} bg-deck-border/30 shrink-0 transition-colors z-20 flex items-center justify-center group select-none"
        onmousedown={handleSplitMouseDown}
        role="separator"
        aria-label="Resize split terminals"
        tabindex="-1"
      >
        <div class="{appState.terminalLayout === 'split-horizontal' ? 'w-0.5 h-6' : 'h-0.5 w-6'} bg-deck-muted/40 group-hover:bg-white rounded-full"></div>
      </div>

      <!-- 2. PANE 2 (Secondary) -->
      <div 
        class="relative flex flex-col overflow-hidden bg-white dark:bg-deck-bg {appState.focusedPane === 'secondary' ? 'border-t-2 border-purple-500/80 z-10' : 'border-t-2 border-transparent z-0'}"
        style={appState.terminalLayout === 'split-horizontal' ? `width: ${100 - appState.terminalSplitPercent}%; height: 100%;` : `width: 100%; height: ${100 - appState.terminalSplitPercent}%;`}
        onpointerdown={() => appState.setFocusedPane('secondary')}
        role="region"
        aria-label="Pane 2"
      >
        <!-- Pane 2 Header Toolbar -->
        <div class="h-7.5 bg-slate-50/70 dark:bg-deck-surface/70 border-b border-deck-border/30 px-3 flex items-center justify-between shrink-0 select-none text-xs font-mono">
          <div class="flex items-center space-x-2 min-w-0">
            <!-- Pane Indicator Badge -->
            <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              <span>PANE 2</span>
            </div>

            <!-- Focused Active Pill -->
            {#if appState.focusedPane === 'secondary'}
              <span class="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold">Active</span>
            {/if}

            <!-- Session Selector Dropdown -->
            <select
              value={appState.secondarySessionId || ''}
              onchange={(e) => appState.setSecondarySession(e.currentTarget.value)}
              class="bg-white/80 dark:bg-deck-bg/80 border border-deck-border/40 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-800 dark:text-deck-bright focus:outline-none max-w-[140px] truncate cursor-pointer shadow-2xs"
            >
              {#each appState.sessions as s}
                <option value={s.id}>{s.title}</option>
              {/each}
            </select>
          </div>

          <!-- Pane 2 Action Controls -->
          <div class="flex items-center space-x-1 shrink-0">
            <!-- Swap Panes -->
            <button
              type="button"
              onclick={() => appState.swapTerminalPanes()}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="Swap Panes (Alt+X)"
            >
              <ArrowRightLeft class="w-3.5 h-3.5" />
            </button>

            <!-- New Session in Pane 2 -->
            <button
              type="button"
              onclick={() => appState.addTerminalSession(undefined, false, 'shell', 'secondary')}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="New Terminal in Pane 2"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>

            <!-- Maximize Pane 2 to Single Mode -->
            <button
              type="button"
              onclick={() => {
                if (appState.secondarySessionId) {
                  appState.setActiveSession(appState.secondarySessionId);
                }
                appState.setTerminalLayout('single');
              }}
              class="p-1 rounded hover:bg-gray-200/80 dark:hover:bg-deck-border/60 text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer"
              title="Maximize Pane 2 (Single Panel)"
            >
              <Maximize2 class="w-3.5 h-3.5" />
            </button>

            <!-- Close Pane 2 Session -->
            {#if appState.secondarySessionId && appState.sessions.length > 1}
              <button
                type="button"
                onclick={() => appState.closeSession(appState.secondarySessionId!)}
                class="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                title="Close Session"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            {/if}
          </div>
        </div>

        <!-- Pane 2 Terminal Canvas or Ready State (Seamless Background) -->
        {#if appState.secondarySessionId && appState.secondarySessionId !== appState.activeSessionId}
          <div
            bind:this={pane2SlotElement}
            class="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-deck-bg"
            onclick={() => focusTerminal(appState.secondarySessionId!, 'secondary')}
            onkeydown={(e) => { if (e.key === 'Enter') focusTerminal(appState.secondarySessionId!, 'secondary'); }}
            tabindex="0"
            role="button"
            aria-label="Pane 2 Terminal Canvas"
          ></div>
        {:else}
          <!-- Empty / Ready State in Pane 2 -->
          <div class="flex-1 w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50/40 dark:bg-deck-bg text-center select-none space-y-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Columns class="w-5 h-5" />
            </div>
            <div class="space-y-1">
              <h4 class="text-xs font-semibold text-slate-900 dark:text-deck-bright">Pane 2 Ready</h4>
              <p class="text-[11px] text-slate-500 dark:text-deck-muted max-w-[240px]">
                Launch an AI coding agent or shell session to run side-by-side.
              </p>
            </div>
            <div class="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onclick={() => appState.addTerminalSession(undefined, false, 'shell', 'secondary')}
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium flex items-center space-x-1 shadow-xs transition cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Launch Shell</span>
              </button>
              <button
                type="button"
                onclick={() => appState.launchAgentSession('antigravity', undefined, 'secondary')}
                class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-medium flex items-center space-x-1 shadow-xs transition cursor-pointer"
              >
                <Bot class="w-3.5 h-3.5" />
                <span>Launch AGY</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Floating Scroll-to-Bottom Button for Currently Focused Terminal -->
    {#if isFocusedScrolledUp}
      <button
        type="button"
        onclick={() => scrollToBottom(appState.focusedSessionId)}
        class="absolute bottom-4 right-6 z-30 flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/30 text-xs font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 cursor-pointer group"
        title="Scroll down to active cursor & input prompt (Shift+End)"
      >
        <ArrowDown class="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
        <span>Scroll to Bottom</span>
      </button>
    {/if}
  </div>
</div>
