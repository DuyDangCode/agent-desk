<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    GitBranch, 
    Bot, 
    Check, 
    ArrowUp, 
    ArrowDown, 
    Layers, 
    FolderGit2,
    AlertCircle,
    Loader2
  } from 'lucide-svelte';

  const hasAgents = $derived(appState.agentSessions.length > 0);
  const dirtyCount = $derived(
    (appState.repoInfo?.staged_count || 0) + 
    (appState.repoInfo?.unstaged_count || 0) + 
    (appState.repoInfo?.untracked_count || 0)
  );
</script>

<footer 
  class="h-6 bg-slate-100 dark:bg-deck-surface border-t border-deck-border/70 px-3 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-deck-muted select-none shrink-0 z-30 overflow-hidden"
  aria-label="Application Status Bar"
>
  <!-- Left Status Cluster -->
  <div class="flex items-center space-x-3 truncate">
    <!-- Active Workspace / Project -->
    {#if appState.activeProject}
      <div class="flex items-center space-x-1 text-slate-700 dark:text-deck-bright truncate" title={appState.repoPath}>
        <FolderGit2 class="w-3 h-3 text-slate-400 shrink-0" />
        <span class="truncate max-w-[150px] font-medium">{appState.activeProject.name}</span>
      </div>
    {:else}
      <div class="flex items-center space-x-1 text-slate-400">
        <FolderGit2 class="w-3 h-3 shrink-0" />
        <span>No project</span>
      </div>
    {/if}

    <!-- Git Branch Indicator (Clickable to switch branches) -->
    {#if appState.repoInfo?.branch}
      <button
        onclick={() => appState.openBranchModal()}
        class="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer shrink-0"
        title="Git branch: {appState.repoInfo.branch} (Click to switch)"
      >
        <GitBranch class="w-3 h-3 text-blue-500 shrink-0" />
        <span class="font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[120px]">{appState.repoInfo.branch}</span>
      </button>
    {/if}

    <!-- Git Sync Ahead/Behind -->
    {#if appState.repoInfo}
      <div class="hidden sm:flex items-center space-x-1.5 shrink-0">
        {#if appState.isPushing}
          <span class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium" title="Pushing commits to remote...">
            <Loader2 class="w-2.5 h-2.5 animate-spin" />
            <span>Pushing...</span>
          </span>
        {:else if appState.isPulling}
          <span class="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-medium" title="Pulling latest changes from remote...">
            <Loader2 class="w-2.5 h-2.5 animate-spin" />
            <span>Pulling...</span>
          </span>
        {:else}
          {#if (appState.repoInfo.behind_count ?? 0) > 0}
            <span class="flex items-center text-blue-600 dark:text-blue-400" title="{appState.repoInfo.behind_count} commits behind remote">
              <ArrowDown class="w-2.5 h-2.5" />
              <span>{appState.repoInfo.behind_count}</span>
            </span>
          {/if}
          {#if (appState.repoInfo.ahead_count ?? 0) > 0}
            <span class="flex items-center text-emerald-600 dark:text-emerald-400" title="{appState.repoInfo.ahead_count} commits ahead of remote">
              <ArrowUp class="w-2.5 h-2.5" />
              <span>{appState.repoInfo.ahead_count}</span>
            </span>
          {/if}
          {#if dirtyCount === 0}
            <span class="flex items-center space-x-0.5 text-emerald-600 dark:text-emerald-400" title="Clean working tree">
              <Check class="w-3 h-3" />
              <span class="hidden md:inline">Clean</span>
            </span>
          {:else}
            <span class="text-amber-600 dark:text-amber-400 font-medium" title="{dirtyCount} modified files">
              ● {dirtyCount} changes
            </span>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Active Agent or Attention Status -->
    {#if appState.hasAttentionAlert}
      {@const alertSess = appState.attentionSessions[0]}
      <button
        onclick={() => appState.navigateToSession(undefined, alertSess?.id)}
        class="flex items-center space-x-1 text-amber-600 dark:text-amber-400 shrink-0 font-semibold cursor-pointer animate-bounce"
        title="Coding Agent needs attention (Click to jump to session)"
      >
        <AlertCircle class="w-3 h-3 text-amber-500" />
        <span class="hidden md:inline">{alertSess?.title || 'Agent'}: Attention Required</span>
      </button>
    {:else if hasAgents}
      {@const workingAgents = appState.agentSessions.filter((s) => s.agentStatus === 'working')}
      {#if workingAgents.length > 0}
        <div class="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 shrink-0 font-medium" title="AI Coding Agent working">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-ping shrink-0"></span>
          <Bot class="w-3 h-3 text-blue-500 shrink-0" />
          <span class="hidden md:inline">{workingAgents[0].title}: Working</span>
        </div>
      {:else}
        <div class="flex items-center space-x-1 text-purple-600 dark:text-purple-400 shrink-0 font-medium" title="AI Coding Agent active">
          <Bot class="w-3 h-3 text-purple-500 shrink-0" />
          <span class="hidden md:inline">{appState.agentSessions.length} Agent Active</span>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Right Information Cluster -->
  <div class="flex items-center space-x-3 text-slate-500 dark:text-deck-muted shrink-0 text-[10px]">
    <!-- Workspace View Indicator -->
    <div class="hidden sm:flex items-center space-x-1">
      <Layers class="w-2.5 h-2.5" />
      <span class="capitalize">
        {appState.workspaceView === 'review'
          ? (appState.activeCanvasTab === 'preview' ? 'Preview' : 'Changes')
          : appState.workspaceView === 'split'
            ? `Split (${appState.activeCanvasTab === 'preview' ? 'Preview' : 'Changes'})`
            : appState.workspaceView} view
      </span>
    </div>

    <!-- Layout Mode -->
    {#if appState.workspaceView === 'terminal' || appState.workspaceView === 'split'}
      <span class="hidden md:inline px-1 py-0.2 rounded bg-slate-200/60 dark:bg-deck-card">
        {appState.terminalLayout === 'split-horizontal' ? 'Split H' : appState.terminalLayout === 'split-vertical' ? 'Split V' : 'Single Pane'}
      </span>
    {/if}

    <!-- Line wrap toggle -->
    {#if appState.workspaceView === 'review' || appState.workspaceView === 'split'}
      <button
        onclick={() => appState.toggleWrapLines()}
        class="hidden lg:inline hover:text-slate-900 dark:hover:text-deck-bright cursor-pointer"
        title="Toggle Line Wrap (Alt+Z)"
      >
        Wrap: {appState.wrapLines ? 'On' : 'Off'}
      </button>
    {/if}

    <!-- Shortcuts Hint -->
    <span class="hidden xl:inline text-slate-400 dark:text-deck-muted/70">
      Ctrl+` Terminal
    </span>
  </div>
</footer>
