<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    FolderGit2, 
    FolderOpen,
    GitBranch, 
    RefreshCw, 
    CheckSquare, 
    Layers, 
    Sparkles, 
    Check, 
    AlertCircle,
    Edit3,
    Archive,
    ChevronDown,
    ArrowDown,
    ArrowUp
  } from 'lucide-svelte';

  let customPath = $state('');
  let isEditingPath = $state(false);

  function handlePathSubmit(e: Event) {
    e.preventDefault();
    if (customPath.trim()) {
      appState.attachProject(customPath.trim(), true);
      isEditingPath = false;
    }
  }

  function startEditing() {
    customPath = appState.repoPath;
    isEditingPath = true;
  }
</script>

<header class="h-14 bg-white dark:bg-deck-surface border-b border-deck-border flex items-center justify-between px-5 py-2 select-none shrink-0 relative z-30 shadow-xs">
  <!-- Left: Logo & Active Workspace Info -->
  <div class="flex items-center space-x-3 overflow-hidden">
    <div class="flex items-center space-x-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-md text-blue-600 dark:text-blue-400 font-semibold text-xs shadow-xs">
      <Sparkles class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <span class="font-bold tracking-tight">AgentDeck</span>
      <span class="text-[9px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono px-1 rounded font-semibold">v2.0</span>
    </div>

    <!-- Repository Breadcrumb / Folder Picker Trigger -->
    {#if isEditingPath}
      <form onsubmit={handlePathSubmit} class="flex items-center space-x-1">
        <input
          type="text"
          bind:value={customPath}
          placeholder="/path/to/git/repository"
          class="bg-gray-50 dark:bg-deck-bg border border-blue-500/50 rounded px-2 py-0.5 text-xs text-slate-900 dark:text-deck-bright font-mono focus:outline-none w-80 shadow-inner"
          autofocus
          onblur={() => (isEditingPath = false)}
        />
        <button
          type="submit"
          class="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition cursor-pointer"
        >
          Open
        </button>
      </form>
    {:else}
      <div class="flex items-center space-x-1.5">
        <!-- Open Folder Picker Modal -->
        <button
          onclick={() => appState.openFolderPicker()}
          class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border/80 border border-deck-border text-xs text-slate-800 dark:text-deck-text transition cursor-pointer group"
          title={appState.activeProject ? "Browse local folders to open Git repository" : "Attach a project workspace"}
        >
          <FolderGit2 class="w-3.5 h-3.5 text-slate-500 dark:text-deck-muted group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          <span class="font-semibold text-slate-900 dark:text-deck-bright truncate max-w-[200px]">
            {appState.repoInfo?.name || appState.activeProject?.name || 'No project attached'}
          </span>
          {#if appState.activeProject}
            <span class="text-[11px] text-slate-500 dark:text-deck-muted truncate max-w-[140px] font-mono hidden md:inline">
              {appState.repoPath}
            </span>
          {:else}
            <span class="text-[11px] text-slate-400 dark:text-deck-muted/80 truncate max-w-[160px] font-mono hidden md:inline">
              (Click to attach)
            </span>
          {/if}
        </button>

        <!-- Quick Browse Button -->
        <button
          onclick={() => appState.openFolderPicker()}
          class="p-1 px-2 rounded-md bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-xs text-blue-600 dark:text-blue-400 font-medium border border-deck-border transition flex items-center space-x-1 cursor-pointer"
          title="Open Folder Selector Dialog"
        >
          <FolderOpen class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Browse</span>
        </button>

        <!-- Quick manual path edit button -->
        <button
          onclick={startEditing}
          class="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
          title="Type path manually"
        >
          <Edit3 class="w-3.5 h-3.5" />
        </button>
      </div>
    {/if}

    <!-- Git Branch & Stash Trigger (Module 5) -->
    {#if appState.repoInfo}
      <button
        onclick={() => appState.openBranchModal()}
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 font-mono transition cursor-pointer"
        title="Click to switch/create branches or manage stashes"
      >
        <GitBranch class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span class="font-semibold">{appState.repoInfo.branch}</span>
        {#if appState.repoInfo.head_commit_short}
          <span class="text-slate-400 dark:text-deck-muted text-[10px]">@{appState.repoInfo.head_commit_short}</span>
        {/if}
        <ChevronDown class="w-3 h-3 text-blue-500" />
      </button>
    {/if}
  </div>

  <!-- Right: Actions & Status Counters -->
  <div class="flex items-center space-x-3">
    {#if appState.repoInfo}
      <!-- Changes Counters -->
      <div class="flex items-center space-x-2 text-xs font-mono">
        {#if appState.repoInfo.staged_count > 0}
          <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center space-x-1 font-medium">
            <Check class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{appState.repoInfo.staged_count} staged</span>
          </span>
        {/if}

        {#if appState.repoInfo.unstaged_count > 0}
          <span class="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 flex items-center space-x-1 font-medium">
            <AlertCircle class="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{appState.repoInfo.unstaged_count} modified</span>
          </span>
        {/if}

        {#if appState.repoInfo.untracked_count > 0}
          <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-deck-card text-slate-600 dark:text-deck-muted border border-deck-border font-medium">
            +{appState.repoInfo.untracked_count} untracked
          </span>
        {/if}

        {#if !appState.repoInfo.is_dirty}
          <span class="text-xs text-slate-600 dark:text-deck-muted flex items-center space-x-1 font-medium">
            <Check class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Clean</span>
          </span>
        {/if}
      </div>

      <!-- Quick Stash Button -->
      <button
        onclick={() => appState.stashSave()}
        disabled={!appState.repoInfo.is_dirty}
        class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-500 hover:text-amber-600 dark:text-deck-muted dark:hover:text-amber-400 transition disabled:opacity-40 cursor-pointer"
        title="Quick stash working tree modifications"
      >
        <Archive class="w-3.5 h-3.5" />
      </button>

      <!-- Refresh Button -->
      <button
        onclick={() => appState.refreshDiffs(false)}
        class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright transition cursor-pointer"
        title="Refresh Git status and diffs"
      >
        <RefreshCw class="w-3.5 h-3.5 {appState.isRefreshing || appState.isLoading ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}" />
      </button>

      <!-- Pull Button -->
      <button
        onclick={() => appState.pullChanges()}
        disabled={appState.isPulling || appState.isPushing}
        class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border/80 border border-deck-border text-xs text-slate-800 dark:text-deck-text transition cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        title="Pull latest commits from remote (git pull)"
      >
        {#if appState.isPulling}
          <RefreshCw class="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
          <span>Pulling...</span>
        {:else}
          <ArrowDown class="w-3.5 h-3.5 text-slate-600 dark:text-deck-muted" />
          <span>Pull</span>
          {#if (appState.repoInfo.behind_count ?? 0) > 0}
            <span class="text-[10px] font-mono px-1 py-0.2 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded font-bold">
              ↓{appState.repoInfo.behind_count}
            </span>
          {/if}
        {/if}
      </button>

      <!-- Push Button -->
      <button
        onclick={() => appState.pushChanges()}
        disabled={appState.isPulling || appState.isPushing}
        class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border/80 border border-deck-border text-xs text-slate-800 dark:text-deck-text transition cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        title="Push local commits to remote (git push)"
      >
        {#if appState.isPushing}
          <RefreshCw class="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
          <span>Pushing...</span>
        {:else}
          <ArrowUp class="w-3.5 h-3.5 text-slate-600 dark:text-deck-muted" />
          <span>Push</span>
          {#if (appState.repoInfo.ahead_count ?? 0) > 0}
            <span class="text-[10px] font-mono px-1 py-0.2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded font-bold">
              ↑{appState.repoInfo.ahead_count}
            </span>
          {/if}
        {/if}
      </button>

      <!-- Stage All / Commit Gate Trigger -->
      <div class="flex items-center space-x-2 pl-2 border-l border-deck-border">
        {#if appState.filteredUnstagedFiles.length > 0}
          <button
            onclick={() => appState.stageAll()}
            class="px-2.5 py-1 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-slate-800 dark:text-deck-text text-xs rounded border border-deck-border transition flex items-center space-x-1.5 font-medium cursor-pointer"
            title="Stage all {appState.filteredUnstagedFiles.length} file{appState.filteredUnstagedFiles.length === 1 ? '' : 's'} in sidebar view"
          >
            <CheckSquare class="w-3.5 h-3.5" />
            <span>Stage All ({appState.filteredUnstagedFiles.length})</span>
          </button>
        {/if}

        <button
          onclick={() => (appState.commitPanelOpen = !appState.commitPanelOpen)}
          class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          disabled={appState.repoInfo.staged_count === 0}
          title={appState.repoInfo.staged_count === 0 ? 'Stage changes before committing' : 'Commit staged changes'}
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Commit ({appState.repoInfo.staged_count})</span>
        </button>
      </div>
    {:else}
      <!-- When no project is attached -->
      <div class="flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-deck-muted">
        <span class="px-2.5 py-1 rounded bg-slate-100 dark:bg-deck-card text-slate-600 dark:text-deck-muted border border-deck-border hidden sm:inline">
          No project attached
        </span>
        <button
          onclick={() => appState.openFolderPicker()}
          class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
        >
          <FolderOpen class="w-3.5 h-3.5" />
          <span>Attach Project</span>
        </button>
      </div>
    {/if}
  </div>
</header>
