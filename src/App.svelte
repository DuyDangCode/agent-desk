<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import ActivityBar from '$lib/components/ActivityBar.svelte';
  import Header from '$lib/components/Header.svelte';
  import ProjectBar from '$lib/components/ProjectBar.svelte';
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
  import { CheckCircle2, AlertCircle, Info, Terminal, GitCompare, Columns, Sparkles, Loader2 } from 'lucide-svelte';

  // Resizable split pane width (percentage for left terminal pane)
  let splitPercent = $state(48);
  let isDragging = $state(false);

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const sidebarWidth = 48; // width of vertical ActivityBar
    const availableWidth = window.innerWidth - sidebarWidth;
    const clientXInWorkspace = e.clientX - sidebarWidth;
    const newPercent = (clientXInWorkspace / availableWidth) * 100;
    // Constrain split between 20% and 80%
    splitPercent = Math.min(Math.max(newPercent, 20), 80);
  }

  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
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
    // New Terminal Tab: Ctrl+Shift+` (using e.code === 'Backquote' for cross-browser/IME compatibility)
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
        appState.showToast('Terminal Cockpit Opened', 'info');
      } else {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isTerminalFocused = activeEl?.closest('.xterm') || activeEl?.classList.contains('xterm-helper-textarea');
        if (isTerminalFocused) {
          appState.toggleTerminal(false);
          appState.showToast('Terminal Cockpit Hidden', 'info');
        } else {
          appState.focusActiveTerminal();
          appState.showToast('Terminal Cockpit Focused', 'info');
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

  onMount(() => {
    appState.initWorkspace();
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="h-screen w-screen flex flex-col bg-white dark:bg-deck-bg text-slate-800 dark:text-deck-text overflow-hidden font-sans select-none {isDragging ? 'cursor-col-resize select-none' : ''}">
  <!-- Top Workspace Header -->
  <Header />

  <!-- Horizontal Multi-Project Switcher Bar (Module 1: MULTI-PROJ) -->
  <ProjectBar />

  <!-- Main Cockpit Layout with Vertical ActivityBar Sidebar -->
  <div class="flex-1 flex overflow-hidden relative">
    <!-- Leftmost Vertical Sidebar Dock -->
    <ActivityBar />

    <!-- Workspace Panes Canvas -->
    <div class="flex-1 h-full flex overflow-hidden relative">
      <!-- 1. Left Pane: Terminal Cockpit (preserved in DOM when hidden to keep PTY alive) -->
      <div
        class="h-full flex flex-col overflow-hidden {appState.showTerminal ? '' : 'hidden'}"
        style={appState.showTerminal && appState.showReview ? `width: ${splitPercent}%;` : 'width: 100%;'}
      >
        <TerminalView />
      </div>

      <!-- Draggable Resizer Gutter (Only active when BOTH panels are shown) -->
      {#if appState.showTerminal && appState.showReview}
        <div
          class="w-1.5 h-full bg-deck-border/70 hover:bg-blue-500 active:bg-blue-500 cursor-col-resize shrink-0 transition-colors z-10 flex items-center justify-center group"
          onmousedown={handleMouseDown}
          role="separator"
          aria-label="Resize layout panes"
        >
          <div class="w-0.5 h-6 bg-deck-muted group-hover:bg-white rounded-full"></div>
        </div>
      {/if}

      <!-- 2. Right Pane: Real-Time Diff & Review Canvas (preserved in DOM when hidden) -->
      <div
        class="h-full flex overflow-hidden {appState.showReview ? '' : 'hidden'}"
        style={appState.showTerminal && appState.showReview ? `width: ${100 - splitPercent}%;` : 'width: 100%;'}
      >
        <!-- File Tree / List Sidebar -->
        <FileList />

        <!-- Active File Diff Viewer -->
        <div class="flex-1 h-full overflow-hidden">
          <DiffView />
        </div>
      </div>

      <!-- 3. Blank / Empty Background State (when NO panel is open) -->
      {#if !appState.showTerminal && !appState.showReview}
        <div class="flex-1 h-full flex flex-col items-center justify-center bg-white dark:bg-deck-bg p-8 text-center select-none animate-in fade-in duration-150">
          <div class="max-w-md p-8 rounded-2xl border border-deck-border bg-gray-50/60 dark:bg-deck-surface/60 shadow-xl space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 shadow-inner">
              <Sparkles class="w-7 h-7" />
            </div>
            
            <div class="space-y-1.5">
              <h2 class="text-base font-semibold text-slate-900 dark:text-deck-bright">All Panels Hidden</h2>
              <p class="text-xs text-slate-500 dark:text-deck-muted leading-relaxed">
                Terminal sessions and background AI coding agents remain active. Click the sidebar icons or buttons below to display panels.
              </p>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onclick={() => appState.toggleTerminal(true)}
                class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-gray-100 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded-lg border border-deck-border font-medium flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
              >
                <Terminal class="w-3.5 h-3.5 text-blue-500" />
                <span>Open Terminal</span>
              </button>

              <button
                onclick={() => appState.toggleReview(true)}
                class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-gray-100 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded-lg border border-deck-border font-medium flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
              >
                <GitCompare class="w-3.5 h-3.5 text-emerald-500" />
                <span>Open File Review</span>
              </button>

              <button
                onclick={() => appState.openAllPanels()}
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium flex items-center space-x-1.5 shadow transition cursor-pointer"
              >
                <Columns class="w-3.5 h-3.5" />
                <span>Open Both Panels</span>
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

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
    <div class="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div class="flex items-center space-x-2 px-3.5 py-2.5 rounded-lg shadow-xl border text-xs font-medium {appState.toastType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40' : appState.toastType === 'error' ? 'bg-rose-50 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-500/40' : appState.toastType === 'loading' ? 'bg-blue-50 dark:bg-blue-950/90 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-500/40' : 'bg-white dark:bg-deck-card text-slate-900 dark:text-deck-bright border-deck-border'}">
        {#if appState.toastType === 'success'}
          <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {:else if appState.toastType === 'error'}
          <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        {:else if appState.toastType === 'loading'}
          <Loader2 class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
        {:else}
          <Info class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        {/if}
        <span>{appState.toastMessage}</span>
      </div>
    </div>
  {/if}
</div>
