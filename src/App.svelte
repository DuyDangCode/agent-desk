<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import TerminalView from '$lib/components/TerminalView.svelte';
  import FileList from '$lib/components/FileList.svelte';
  import DiffView from '$lib/components/DiffView.svelte';
  import SteerModal from '$lib/components/SteerModal.svelte';
  import CommitPanel from '$lib/components/CommitPanel.svelte';
  import DiscardModal from '$lib/components/DiscardModal.svelte';
  import FolderPickerModal from '$lib/components/FolderPickerModal.svelte';
  import BranchModal from '$lib/components/BranchModal.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import PromptTemplateModal from '$lib/components/PromptTemplateModal.svelte';
  import WebviewPane from '$lib/components/WebviewPane.svelte';
  import { CheckCircle2, AlertCircle, Info, Terminal, GitCompare, Columns, Sparkles, Loader2, Globe } from 'lucide-svelte';

  // Resizable split pane width (percentage for left terminal pane)
  let splitPercent = $state(48);
  let isDragging = $state(false);
  let workspaceElement = $state<HTMLElement | null>(null);

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !workspaceElement) return;
    const rect = workspaceElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clientXInWorkspace = e.clientX - rect.left;
    const newPercent = (clientXInWorkspace / rect.width) * 100;
    // Constrain split between 20% and 80%
    splitPercent = Math.min(Math.max(newPercent, 20), 80);
  }

  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Toggle Sidebar: Ctrl+B / Cmd+B
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        appState.toggleMobileSidebar();
      } else {
        appState.toggleSidebar();
      }
      return;
    }

    // Project Tabs Cycling: Ctrl+Alt+Left / Right
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      appState.cycleProject(1);
    } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      appState.cycleProject(-1);
    } 
    // Jump to project 1..9: Ctrl+1..9
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      if (idx < appState.projects.length) {
        e.preventDefault();
        appState.selectProjectByIndex(idx);
      }
    }
    // Terminal Tabs Cycling: Ctrl+Tab (forward), Ctrl+Shift+Tab (backward), Ctrl+PageDown/PageUp
    else if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
      e.preventDefault();
      const direction = (e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey)) ? -1 : 1;
      appState.cycleSession(direction);
    }
    // Jump to terminal tab 1..9: Alt+1..9
    else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      if (idx < appState.sessions.length) {
        e.preventDefault();
        appState.selectSessionByIndex(idx);
      }
    }
    // New Terminal Tab: Ctrl+Shift+`
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
      e.preventDefault();
      appState.addTerminalSession();
      appState.focusActiveTerminal();
    }
    // Close Terminal Tab: Ctrl+Shift+W
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
      e.preventDefault();
      appState.closeCurrentSession();
    }
    // Toggle / Focus Active Terminal: Ctrl+` (VS Code style toggle/focus)
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
      e.preventDefault();
      if (!appState.showTerminal) {
        appState.toggleTerminal(true);
        setTimeout(() => appState.focusActiveTerminal(), 50);
        appState.showToast('Terminal Opened', 'info');
      } else {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isTerminalFocused = activeEl?.closest('.xterm') || activeEl?.classList.contains('xterm-helper-textarea');
        if (isTerminalFocused) {
          appState.toggleTerminal(false);
          appState.showToast('Terminal Hidden', 'info');
        } else {
          appState.focusActiveTerminal();
          appState.showToast('Terminal Focused', 'info');
        }
      }
    }
    // Branch & Stashes Modal: Ctrl+Shift+B
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      appState.openBranchModal();
    }
    // Steer Modal on current file: Ctrl+Shift+S
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      const current = appState.selectedFileDiff;
      if (current && current.hunks.length > 0) {
        appState.openSteerOnHunk(current.path, current.hunks[0], current.is_staged);
      } else if (current) {
        appState.openSteerOnLines(current.path, 1, 1, `// File: ${current.path}`, current.is_staged);
      }
    }
    // Settings: Ctrl+,
    else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      appState.settingsModalOpen = !appState.settingsModalOpen;
    } 
    // Word Wrap toggle: Alt+Z
    else if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      appState.toggleWrapLines();
      appState.showToast(`Line wrap ${appState.wrapLines ? 'enabled' : 'disabled'}`, 'info');
    } 
    // Panels: Ctrl+Shift+T, Ctrl+Shift+D
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      appState.toggleTerminal();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      appState.toggleReview();
    } 
    // Split layouts: Alt+H (horizontal), Alt+V (vertical), Alt+S (single), Alt+X (swap panes)
    else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      appState.setTerminalLayout('split-horizontal');
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      appState.setTerminalLayout('split-vertical');
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      appState.setTerminalLayout('single');
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      appState.swapTerminalPanes();
    } else if (e.altKey && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      appState.setFocusedPane(appState.focusedPane === 'primary' ? 'secondary' : 'primary');
    }
    // Toggle Layout Mode: Alt+M
    else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      appState.toggleLayoutMode();
    } 
    // Open all panels: Alt+A
    else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      appState.openAllPanels();
    }
  }

  function handleResize() {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768) {
      if (appState.sidebarMode !== 'hidden') {
        appState.sidebarMode = 'hidden';
      }
    } else if (window.innerWidth < 1024) {
      if (appState.sidebarMode === 'expanded') {
        appState.sidebarMode = 'rail';
      }
    }
  }

  onMount(() => {
    appState.initWorkspace();
    window.addEventListener('resize', handleResize);
    handleResize();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="h-screen w-screen flex flex-col bg-white dark:bg-deck-bg text-slate-800 dark:text-deck-text overflow-hidden font-sans select-none {isDragging ? 'cursor-col-resize select-none' : ''}">
  <!-- 1. Single Top Header -->
  <Header />

  <!-- Middle Area: Collapsible Sidebar + Workspace Canvas -->
  <div class="flex-1 flex overflow-hidden relative">
    <!-- 2. Optional Collapsible Sidebar for Projects & Navigation -->
    <Sidebar />

    <!-- 3. Main Workspace Area -->
    <main
      bind:this={workspaceElement}
      class="flex-1 h-full flex overflow-hidden relative min-w-0"
    >
      <!-- Terminal Cockpit Pane (preserved in DOM when hidden to keep PTY alive) -->
      <div
        class="h-full flex flex-col overflow-hidden {appState.showTerminal ? '' : 'hidden'}"
        style={appState.showTerminal && appState.showReview ? `width: ${splitPercent}%;` : 'width: 100%;'}
      >
        <TerminalView />
      </div>

      <!-- Draggable Resizer Gutter (Only active when BOTH panels are shown) -->
      {#if appState.showTerminal && appState.showReview}
        <div
          class="w-1.5 h-full bg-deck-border/60 hover:bg-blue-500 active:bg-blue-500 cursor-col-resize shrink-0 transition-colors z-10 flex items-center justify-center group"
          onmousedown={handleMouseDown}
          role="separator"
          aria-label="Resize layout panes"
        >
          <div class="w-0.5 h-6 bg-deck-muted group-hover:bg-white rounded-full"></div>
        </div>
      {/if}

      <!-- Real-Time Diff & Review / Webview Canvas (preserved in DOM when hidden) -->
      <div
        class="h-full flex overflow-hidden {appState.showReview ? '' : 'hidden'}"
        style={appState.showTerminal && appState.showReview ? `width: ${100 - splitPercent}%;` : 'width: 100%;'}
      >
        <!-- Diff & Git Review Canvas -->
        <div class="h-full w-full flex overflow-hidden {appState.activeCanvasTab === 'diff' ? '' : 'hidden'}">
          <!-- File Tree / List Sidebar -->
          <FileList />

          <!-- Active File Diff Viewer -->
          <div class="flex-1 h-full overflow-hidden">
            <DiffView />
          </div>
        </div>

        <!-- Frontend Webview Preview Canvas -->
        <div class="h-full w-full flex overflow-hidden {appState.activeCanvasTab === 'preview' ? '' : 'hidden'}">
          <WebviewPane />
        </div>
      </div>

      <!-- Blank / Empty Background State (when NO panel is open) -->
      {#if !appState.showTerminal && !appState.showReview}
        <div class="flex-1 h-full flex flex-col items-center justify-center bg-white dark:bg-deck-bg p-8 text-center select-none animate-in fade-in duration-150">
          <div class="max-w-md p-8 rounded-2xl border border-deck-border bg-slate-50/60 dark:bg-deck-surface/60 shadow-xl space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 shadow-inner">
              <Sparkles class="w-7 h-7" />
            </div>
            
            <div class="space-y-1.5">
              <h2 class="text-base font-semibold text-slate-900 dark:text-deck-bright">All Panels Hidden</h2>
              <p class="text-xs text-slate-500 dark:text-deck-muted leading-relaxed">
                Terminal sessions and AI coding agents remain active in the background. Use the top navigation or buttons below to display panels.
              </p>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onclick={() => appState.setWorkspaceView('terminal')}
                class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-slate-100 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded-lg border border-deck-border font-medium flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
              >
                <Terminal class="w-3.5 h-3.5 text-blue-500" />
                <span>Open Terminal</span>
              </button>

              <button
                onclick={() => appState.setWorkspaceView('review')}
                class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-slate-100 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded-lg border border-deck-border font-medium flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
              >
                <GitCompare class="w-3.5 h-3.5 text-emerald-500" />
                <span>Open Changes</span>
              </button>

              <button
                onclick={() => appState.setWorkspaceView('preview')}
                class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-slate-100 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded-lg border border-deck-border font-medium flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
              >
                <Globe class="w-3.5 h-3.5 text-blue-500" />
                <span>Open Preview</span>
              </button>

              <button
                onclick={() => appState.setWorkspaceView('split')}
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium flex items-center space-x-1.5 shadow transition cursor-pointer"
              >
                <Columns class="w-3.5 h-3.5" />
                <span>Open Both (Split)</span>
              </button>
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>

  <!-- 5. Small Optional Status Bar -->
  <StatusBar />

  <!-- Modals -->
  <FolderPickerModal />
  <BranchModal />
  <SteerModal />
  <CommitPanel />
  <DiscardModal />
  <SettingsModal />
  <PromptTemplateModal />

  <!-- Toast Notification Overlay -->
  {#if appState.toastMessage}
    <div class="fixed bottom-9 right-4 z-[100] animate-in slide-in-from-bottom-4 duration-200 max-w-md pointer-events-auto">
      <div class="flex items-center justify-between space-x-3 px-3.5 py-2.5 rounded-lg shadow-xl border text-xs font-medium {appState.toastType === 'attention' ? 'bg-amber-50 dark:bg-amber-950/95 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-500/50 shadow-amber-500/10' : appState.toastType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40' : appState.toastType === 'error' ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-500/40' : appState.toastType === 'loading' ? 'bg-blue-50 dark:bg-blue-950/90 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-500/40' : 'bg-white dark:bg-deck-card text-slate-900 dark:text-deck-bright border-deck-border'}">
        <div class="flex items-center space-x-2 min-w-0">
          {#if appState.toastType === 'attention'}
            <AlertCircle class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
          {:else if appState.toastType === 'success'}
            <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          {:else if appState.toastType === 'error'}
            <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          {:else if appState.toastType === 'loading'}
            <Loader2 class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          {:else}
            <Info class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          {/if}
          <span class="truncate">{appState.toastMessage}</span>
        </div>

        {#if appState.toastActionText && appState.toastActionCallback}
          <button
            onclick={() => {
              appState.toastActionCallback?.();
              appState.hideToast();
            }}
            class="ml-2 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold text-[11px] shrink-0 shadow-xs transition cursor-pointer"
          >
            {appState.toastActionText}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
