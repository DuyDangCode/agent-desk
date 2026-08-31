<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { 
    Terminal, 
    GitCompare, 
    Columns, 
    Square,
    Settings, 
    Sun, 
    Moon, 
    Monitor,
    Bot,
    FolderGit2
  } from 'lucide-svelte';

  const hasAgentSession = $derived(appState.agentSessions.length > 0);
  const fileCount = $derived(appState.files.length);
  const isSplit = $derived(appState.layoutMode === 'split');

  function cycleTheme() {
    if (themeState.mode === 'black' || themeState.mode === 'dark') {
      themeState.setMode('white');
      appState.showToast('Theme set to White (Light)', 'info');
    } else if (themeState.mode === 'white' || themeState.mode === 'light') {
      themeState.setMode('system');
      appState.showToast('Theme set to System sync', 'info');
    } else {
      themeState.setMode('black');
      appState.showToast('Theme set to Black (Dark)', 'info');
    }
  }
</script>

<aside 
  class="w-12 h-full bg-white dark:bg-deck-surface border-r border-deck-border flex flex-col items-center justify-between py-3 shrink-0 select-none relative z-40"
  aria-label="Panel Navigation Sidebar"
>
  <!-- Top: Panel Toggle Controls & Layout Mode in order -->
  <div class="flex flex-col items-center space-y-2 w-full">
    <!-- 1. Terminal Panel Toggle / Tab Button -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={() => appState.toggleTerminal()}
        class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 relative cursor-pointer {appState.showTerminal ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-100 dark:hover:bg-deck-card'}"
        title="Terminal Cockpit {isSplit ? (appState.showTerminal ? '(Visible - Click to hide)' : '(Hidden - Click to show)') : (appState.showTerminal ? '(Active Tab - Click to hide)' : '(Click to switch to Terminal)')} [Ctrl+Shift+T]"
        aria-label="Toggle Terminal Panel"
      >
        {#if hasAgentSession}
          <Bot class="w-4 h-4" />
        {:else}
          <Terminal class="w-4 h-4" />
        {/if}

        <!-- Active Left Indicator Pill -->
        {#if appState.showTerminal}
          <span class="absolute -left-1.5 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"></span>
        {/if}

        <!-- Agent active indicator dot -->
        {#if hasAgentSession}
          <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white dark:ring-deck-surface"></span>
        {/if}
      </button>

      <!-- Hover Tooltip -->
      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        Terminal Cockpit {isSplit ? (appState.showTerminal ? '(Visible)' : '(Hidden)') : (appState.showTerminal ? '(Active Tab)' : '(Switch Tab)')}
      </div>
    </div>

    <!-- 2. File Change & Review Panel Toggle / Tab Button -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={() => appState.toggleReview()}
        class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 relative cursor-pointer {appState.showReview ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-100 dark:hover:bg-deck-card'}"
        title="File Changes & Review {isSplit ? (appState.showReview ? '(Visible - Click to hide)' : '(Hidden - Click to show)') : (appState.showReview ? '(Active Tab - Click to hide)' : '(Click to switch to Review)')} [Ctrl+Shift+D]"
        aria-label="Toggle File Changes Review Panel"
      >
        <GitCompare class="w-4 h-4" />

        <!-- Active Left Indicator Pill -->
        {#if appState.showReview}
          <span class="absolute -left-1.5 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"></span>
        {/if}

        <!-- Changed Files Count Badge Pill -->
        {#if fileCount > 0}
          <span class="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
            {fileCount > 9 ? '9+' : fileCount}
          </span>
        {/if}
      </button>

      <!-- Hover Tooltip -->
      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        File Changes Review {isSplit ? (appState.showReview ? '(Visible)' : '(Hidden)') : (appState.showReview ? '(Active Tab)' : '(Switch Tab)')}
      </div>
    </div>

    <!-- 3. Layout Mode Control Button (Split vs Unsplit/Single) -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={() => appState.toggleLayoutMode()}
        class="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer {isSplit ? 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-card'}"
        title="Layout Mode: {isSplit ? 'Split Multi-Panel (Click for Single Tab Mode)' : 'Single Panel Tab Mode (Click for Split Mode)'} [Alt+M]"
        aria-label="Toggle Layout Mode"
      >
        {#if isSplit}
          <Columns class="w-4 h-4" />
        {:else}
          <Square class="w-4 h-4" />
        {/if}
      </button>

      <!-- Hover Tooltip -->
      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        {isSplit ? 'Mode: Split (Multiple Panels) - Click for Single' : 'Mode: Single (One Panel) - Click for Split'}
      </div>
    </div>

    <!-- 4. Attach / Open Project Deck Button -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={() => appState.openFolderPicker()}
        class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-100 dark:hover:bg-deck-card transition-all cursor-pointer"
        title="Attach Project Workspace (+)"
        aria-label="Attach Project Workspace"
      >
        <FolderGit2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </button>

      <!-- Hover Tooltip -->
      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        Attach Project Workspace
      </div>
    </div>
  </div>

  <!-- Bottom: Settings & Appearance Controls -->
  <div class="flex flex-col items-center space-y-2 w-full">
    <!-- Quick Theme Toggle -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={cycleTheme}
        class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-100 dark:hover:bg-deck-card transition-all cursor-pointer"
        title="Cycle theme appearance (Black / White / System)"
        aria-label="Cycle theme"
      >
        {#if themeState.mode === 'system'}
          <Monitor class="w-4 h-4" />
        {:else if themeState.resolved === 'dark'}
          <Moon class="w-4 h-4 text-blue-400" />
        {:else}
          <Sun class="w-4 h-4 text-amber-500" />
        {/if}
      </button>

      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        Theme: {themeState.mode}
      </div>
    </div>

    <!-- Settings Modal Trigger -->
    <div class="relative group w-full flex justify-center">
      <button
        onclick={() => appState.openSettings()}
        class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-100 dark:hover:bg-deck-card transition-all cursor-pointer"
        title="Settings (Ctrl+,)"
        aria-label="Open Settings"
      >
        <Settings class="w-4 h-4" />
      </button>

      <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
        Settings (Ctrl+,)
      </div>
    </div>
  </div>
</aside>
