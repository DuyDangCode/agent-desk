<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    PanelLeft,
    Sparkles, 
    FolderGit2, 
    FolderOpen,
    GitBranch, 
    ChevronDown,
    Terminal, 
    GitCompare, 
    Columns, 
    RefreshCw, 
    Layers, 
    MoreHorizontal,
    ArrowDown,
    ArrowUp,
    Archive,
    Settings,
    CheckSquare,
    AlertCircle,
    Globe,
    Loader2
  } from 'lucide-svelte';

  let moreMenuOpen = $state(false);

  const hasAgentSession = $derived(appState.agentSessions.length > 0);
  const dirtyCount = $derived(
    (appState.repoInfo?.staged_count || 0) + 
    (appState.repoInfo?.unstaged_count || 0) + 
    (appState.repoInfo?.untracked_count || 0)
  );

  function handleSidebarToggle() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      appState.toggleMobileSidebar();
    } else {
      appState.toggleSidebar();
    }
  }

  function toggleMoreMenu() {
    moreMenuOpen = !moreMenuOpen;
  }

  function closeMoreMenu() {
    moreMenuOpen = false;
  }
</script>

<header class="h-11 bg-white dark:bg-deck-surface border-b border-deck-border flex items-center justify-between px-3 md:px-4 select-none shrink-0 relative z-30 font-sans shadow-xs">
  <!-- Left Cluster: Sidebar Toggle, Brand, Active Workspace Breadcrumb -->
  <div class="flex items-center space-x-2.5 overflow-hidden">
    <!-- Sidebar Toggle Button -->
    <button
      onclick={handleSidebarToggle}
      class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
      title="Toggle Workspaces Sidebar"
      aria-label="Toggle Sidebar"
    >
      <PanelLeft class="w-4 h-4" />
    </button>

    <!-- Minimal Brand Logo -->
    <div class="flex items-center space-x-2 font-bold text-xs tracking-tight">
      <img src="/kestrel-icon.png" alt="Kestrel" class="w-5 h-5 object-contain select-none" />
      <span class="text-slate-900 dark:text-deck-bright font-semibold hidden sm:inline">Kestrel</span>
    </div>

    <div class="h-4 w-px bg-deck-border/70 hidden sm:block"></div>

    <!-- Active Workspace Breadcrumb / Selector -->
    {#if appState.activeProject}
      <div class="flex items-center space-x-1.5 min-w-0">
        <button
          onclick={() => appState.openFolderPicker()}
          class="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-deck-card text-xs text-slate-800 dark:text-deck-bright transition cursor-pointer font-medium max-w-[160px] md:max-w-[200px]"
          title="{appState.activeProject.name} ({appState.repoPath})"
        >
          <FolderGit2 class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span class="truncate">{appState.activeProject.name}</span>
        </button>

        <!-- Active Git Branch Pill -->
        {#if appState.repoInfo?.branch}
          <button
            onclick={() => appState.openBranchModal()}
            class="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-500/30 text-[11px] font-mono text-blue-700 dark:text-blue-300 transition cursor-pointer"
            title="Switch git branch: {appState.repoInfo.branch}"
          >
            <GitBranch class="w-3 h-3 text-blue-500 shrink-0" />
            <span class="font-semibold truncate max-w-[90px]">{appState.repoInfo.branch}</span>
            <ChevronDown class="w-2.5 h-2.5 text-blue-400 shrink-0" />
          </button>
        {/if}
      </div>
    {:else}
      <button
        onclick={() => appState.openFolderPicker()}
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
      >
        <FolderOpen class="w-3.5 h-3.5" />
        <span>Attach Workspace</span>
      </button>
    {/if}
  </div>

  <!-- Center: Primary Workspace View Segmented Switcher -->
  <div class="flex items-center bg-slate-100 dark:bg-deck-card/80 p-0.5 rounded-lg border border-deck-border/60 text-xs font-medium shadow-inner">
    <!-- Terminal Tab Button -->
    <button
      onclick={() => appState.setWorkspaceView('terminal')}
      class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition cursor-pointer {appState.workspaceView === 'terminal' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 shadow-xs font-semibold' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright'}"
      title="Terminal Cockpit (Alt+S)"
    >
      <Terminal class="w-3.5 h-3.5" />
      <span class="hidden md:inline">Terminal</span>
      {#if appState.hasAttentionAlert}
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-bounce" title="Agent needs attention"></span>
      {:else if hasAgentSession}
        <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
      {/if}
    </button>

    <!-- File Changes Review Tab Button -->
    <button
      onclick={() => {
        if (appState.workspaceView === 'split') {
          appState.setCanvasTab('diff');
        } else {
          appState.setWorkspaceView('review');
        }
      }}
      class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition cursor-pointer {appState.workspaceView === 'review' && appState.activeCanvasTab === 'diff' ? 'bg-white dark:bg-deck-bg text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright'}"
      title="File Changes & Diff Review"
    >
      <GitCompare class="w-3.5 h-3.5" />
      <span class="hidden md:inline">Changes</span>
      {#if dirtyCount > 0}
        <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-white leading-none">
          {dirtyCount}
        </span>
      {/if}
    </button>

    <!-- Web Preview & Component Steering Tab Button -->
    <button
      onclick={() => {
        if (appState.workspaceView === 'split') {
          appState.setCanvasTab('preview');
        } else {
          appState.setWorkspaceView('preview');
        }
      }}
      class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition cursor-pointer {appState.workspaceView === 'review' && appState.activeCanvasTab === 'preview' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 shadow-xs font-semibold' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright'}"
      title="Frontend Webview Preview & Direct Component Steering"
    >
      <Globe class="w-3.5 h-3.5" />
      <span class="hidden md:inline">Preview</span>
      {#if appState.isInspectMode}
        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
      {/if}
    </button>

    <!-- Split View (Both Panes Side-by-Side) -->
    <button
      onclick={() => appState.setWorkspaceView('split')}
      class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition cursor-pointer {appState.workspaceView === 'split' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 shadow-xs font-semibold' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright'}"
      title="Split View (Terminal + Canvas)"
    >
      <Columns class="w-3.5 h-3.5" />
      <span class="hidden md:inline">Split</span>
    </button>
  </div>

  <!-- Right Cluster: Essential Actions + Secondary More Dropdown -->
  <div class="flex items-center space-x-2 relative">
    <!-- Attention Alert Pill -->
    {#if appState.hasAttentionAlert}
      {@const alertSess = appState.attentionSessions[0]}
      <button
        onclick={() => appState.navigateToSession(undefined, alertSess?.id)}
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium text-xs shadow-xs animate-pulse transition cursor-pointer"
        title="Coding Agent requires input ({alertSess?.title || 'Terminal'})"
      >
        <AlertCircle class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Require Input</span>
      </button>
    {/if}

    <!-- Refresh Button -->
    <button
      onclick={() => appState.refreshDiffs(false)}
      class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
      title="Refresh Git status and diffs"
      aria-label="Refresh"
    >
      <RefreshCw class="w-3.5 h-3.5 {appState.isRefreshing || appState.isLoading ? 'animate-spin text-blue-500' : ''}" />
    </button>

    <!-- Essential Git Action (Commit or Stage All) -->
    {#if appState.repoInfo}
      {#if (appState.repoInfo.staged_count ?? 0) > 0}
        <button
          onclick={() => (appState.commitPanelOpen = true)}
          class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
          title="Commit staged changes"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Commit ({appState.repoInfo.staged_count})</span>
        </button>
      {:else if appState.filteredUnstagedFiles.length > 0}
        <button
          onclick={() => appState.stageAll()}
          class="hidden sm:flex items-center space-x-1 px-2.5 py-1 bg-slate-100 dark:bg-deck-card hover:bg-slate-200 dark:hover:bg-deck-border/80 border border-deck-border text-xs text-slate-800 dark:text-deck-text rounded-md transition cursor-pointer font-medium"
          title="Stage all modified files"
        >
          <CheckSquare class="w-3.5 h-3.5" />
          <span>Stage All</span>
        </button>
      {/if}
    {/if}

    <!-- Secondary Actions Dropdown Menu Button -->
    <button
      onclick={toggleMoreMenu}
      class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer {moreMenuOpen ? 'bg-slate-100 dark:bg-deck-card text-slate-900 dark:text-deck-bright' : ''}"
      title={appState.isPushing ? 'Pushing commits to remote...' : appState.isPulling ? 'Pulling latest changes...' : 'More Actions & Tools'}
      aria-label="More Actions"
    >
      {#if appState.isPushing}
        <Loader2 class="w-4 h-4 text-emerald-500 animate-spin" />
      {:else if appState.isPulling}
        <Loader2 class="w-4 h-4 text-blue-500 animate-spin" />
      {:else}
        <MoreHorizontal class="w-4 h-4" />
      {/if}
    </button>

    <!-- More Dropdown Popover Menu -->
    {#if moreMenuOpen}
      <!-- Backdrop to close dropdown -->
      <div 
        class="fixed inset-0 z-40" 
        onclick={closeMoreMenu}
        role="presentation"
      ></div>

      <div class="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in duration-100 font-sans text-xs">
        {#if appState.repoInfo}
          <!-- Pull Changes -->
          <button
            onclick={() => {
              closeMoreMenu();
              appState.pullChanges();
            }}
            disabled={appState.isPulling || appState.isPushing}
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer disabled:opacity-50"
          >
            <div class="flex items-center space-x-2">
              {#if appState.isPulling}
                <Loader2 class="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span class="font-medium text-blue-600 dark:text-blue-400">Pulling...</span>
              {:else}
                <ArrowDown class="w-3.5 h-3.5 text-blue-500" />
                <span>Pull Changes</span>
              {/if}
            </div>
            {#if (appState.repoInfo.behind_count ?? 0) > 0}
              <span class="text-[10px] font-mono px-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                ↓{appState.repoInfo.behind_count}
              </span>
            {/if}
          </button>

          <!-- Push Changes -->
          <button
            onclick={() => {
              closeMoreMenu();
              appState.pushChanges();
            }}
            disabled={appState.isPulling || appState.isPushing}
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer disabled:opacity-50"
          >
            <div class="flex items-center space-x-2">
              {#if appState.isPushing}
                <Loader2 class="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                <span class="font-medium text-emerald-600 dark:text-emerald-400">Pushing...</span>
              {:else}
                <ArrowUp class="w-3.5 h-3.5 text-emerald-500" />
                <span>Push Commits</span>
              {/if}
            </div>
            {#if (appState.repoInfo.ahead_count ?? 0) > 0}
              <span class="text-[10px] font-mono px-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                ↑{appState.repoInfo.ahead_count}
              </span>
            {/if}
          </button>

          <!-- Quick Stash -->
          <button
            onclick={() => {
              closeMoreMenu();
              appState.stashSave();
            }}
            disabled={!appState.repoInfo.is_dirty}
            class="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer disabled:opacity-40"
          >
            <Archive class="w-3.5 h-3.5 text-amber-500" />
            <span>Stash Changes</span>
          </button>

          <!-- Branches & Stashes Modal -->
          <button
            onclick={() => {
              closeMoreMenu();
              appState.openBranchModal();
            }}
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer"
          >
            <div class="flex items-center space-x-2">
              <GitBranch class="w-3.5 h-3.5 text-purple-500" />
              <span>Branches & Stashes</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400">Ctrl+Shift+B</span>
          </button>

          <div class="h-px bg-deck-border/60 my-1"></div>
        {/if}

        <!-- Open Folder / Attach Workspace -->
        <button
          onclick={() => {
            closeMoreMenu();
            appState.openFolderPicker();
          }}
          class="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer"
        >
          <FolderOpen class="w-3.5 h-3.5 text-blue-500" />
          <span>Open Folder...</span>
        </button>

        <!-- Settings -->
        <button
          onclick={() => {
            closeMoreMenu();
            appState.openSettings();
          }}
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card transition text-left cursor-pointer"
        >
          <div class="flex items-center space-x-2">
            <Settings class="w-3.5 h-3.5 text-slate-500" />
            <span>Settings</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400">Ctrl+,</span>
        </button>
      </div>
    {/if}
  </div>
</header>
