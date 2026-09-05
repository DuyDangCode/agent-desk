<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    FolderGit2, 
    Plus, 
    X, 
    GitBranch, 
    Bot, 
    AlertCircle, 
    Check, 
    ChevronLeft, 
    ChevronRight,
    Layers
  } from 'lucide-svelte';

  let scrollContainer: HTMLDivElement | null = $state(null);

  function scrollLeft() {
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }

  function scrollRight() {
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }

  function handleWheel(e: WheelEvent) {
    if (scrollContainer && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollContainer.scrollLeft += e.deltaY;
    }
  }
</script>

<div class="h-11 bg-slate-100 dark:bg-[#161b22] border-b border-deck-border flex items-center justify-between px-4 py-1.5 select-none shrink-0 relative z-30 gap-3 font-sans">
  <!-- Left: Scroll Left Button -->
  <button
    onclick={scrollLeft}
    class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition shrink-0 hidden sm:flex items-center justify-center cursor-pointer"
    title="Scroll projects left"
    aria-label="Scroll projects left"
  >
    <ChevronLeft class="w-3.5 h-3.5" />
  </button>

  <!-- Middle: Horizontal Scrolling Projects Pill Tabs -->
  <div
    bind:this={scrollContainer}
    onwheel={handleWheel}
    class="flex-1 flex items-center space-x-2 overflow-x-auto no-scrollbar py-1"
    role="tablist"
    aria-label="Attached Projects Deck"
  >
    {#if appState.projects.length === 0}
      <div class="shrink-0 flex items-center space-x-1.5 px-3 py-1 text-xs rounded-lg bg-slate-200/70 dark:bg-deck-surface text-slate-600 dark:text-deck-muted border border-dashed border-slate-300 dark:border-deck-border/80">
        <FolderGit2 class="w-3.5 h-3.5 text-slate-400 dark:text-deck-muted" />
        <span class="font-medium text-slate-700 dark:text-deck-text">No project attached</span>
      </div>
    {/if}

    {#each appState.projects as project, idx (project.id)}
      {@const isActive = project.id === appState.activeProjectId}
      {@const hasAgents = project.sessions.some((s) => s.isAgent)}
      {@const dirtyCount = (project.info?.staged_count || 0) + (project.info?.unstaged_count || 0) + (project.info?.untracked_count || 0)}
      {@const stagedCount = project.info?.staged_count || 0}
      {@const unstagedCount = project.info?.unstaged_count || 0}

      <div
        class="group relative shrink-0 flex items-center space-x-2 px-3.5 py-1.5 text-xs rounded-lg transition-all duration-150 cursor-pointer border {isActive ? 'bg-white dark:bg-deck-bg text-slate-900 dark:text-deck-bright border-blue-500/80 shadow-xs font-semibold ring-1 ring-blue-500/20' : 'bg-slate-200/60 dark:bg-deck-surface/70 hover:bg-slate-200 dark:hover:bg-deck-surface text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright border-transparent'}"
        onclick={() => appState.switchProject(project.id)}
        role="tab"
        tabindex="0"
        aria-selected={isActive}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') appState.switchProject(project.id);
        }}
      >
        <!-- Project Icon & Hotkey index -->
        <div class="flex items-center space-x-1 shrink-0">
          <FolderGit2 class="w-3.5 h-3.5 {isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-deck-muted'}" />
          {#if idx < 9}
            <span class="text-[9px] font-mono text-slate-400 dark:text-deck-muted/70 px-1 py-0.2 rounded bg-slate-300/40 dark:bg-deck-card" title="Switch to project (Ctrl+{idx + 1})">
              {idx + 1}
            </span>
          {/if}
        </div>

        <!-- Project Folder Name -->
        <span class="truncate max-w-[130px] font-medium" title={project.path}>
          {project.name}
        </span>

        <!-- Git Branch Badge (if loaded) -->
        {#if project.info?.branch}
          <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100/70 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center space-x-0.5 shrink-0 border border-blue-200 dark:border-blue-500/20">
            <GitBranch class="w-2.5 h-2.5" />
            <span class="truncate max-w-[70px]">{project.info.branch}</span>
          </span>
        {/if}

        <!-- Active Agent Indicator Badge -->
        {#if hasAgents}
          <span class="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[10px] font-mono shrink-0 border border-purple-300 dark:border-purple-500/30" title="Active AI Coding Agent running in this project">
            <Bot class="w-3 h-3 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span class="hidden md:inline">Agent</span>
          </span>
        {/if}

        <!-- Dirty File Status Counters -->
        {#if stagedCount > 0}
          <span class="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-400 font-bold shrink-0" title="{stagedCount} files staged">
            +{stagedCount}
          </span>
        {/if}

        {#if unstagedCount > 0}
          <span class="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-400 font-bold shrink-0" title="{unstagedCount} files modified">
            ~{unstagedCount}
          </span>
        {/if}

        {#if dirtyCount === 0 && project.info}
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Clean working tree"></span>
        {/if}

        <!-- Close / Detach Project Button (Available on all tabs) -->
        <button
          onclick={(e) => {
            e.stopPropagation();
            appState.closeProject(project.id);
          }}
          class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-300 dark:hover:bg-deck-card rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 transition ml-0.5 cursor-pointer"
          title="Detach project from deck"
          aria-label="Detach project {project.name}"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    {/each}

    <!-- Add Project (+) Button -->
    <button
      onclick={() => appState.openFolderPicker()}
      class="shrink-0 flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg bg-slate-200/80 dark:bg-deck-surface hover:bg-slate-300 dark:hover:bg-deck-card text-slate-700 hover:text-slate-900 dark:text-deck-text dark:hover:text-deck-bright border border-dashed border-slate-300 dark:border-deck-border transition cursor-pointer font-medium"
      title="Attach a project repository (Folder Picker)"
      aria-label="Attach project"
    >
      <Plus class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <span class="font-mono text-xs">Add Project</span>
    </button>
  </div>

  <!-- Right: Scroll Right Button & Project Count -->
  <div class="flex items-center space-x-2 shrink-0">
    <button
      onclick={scrollRight}
      class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition hidden sm:flex items-center justify-center cursor-pointer"
      title="Scroll projects right"
      aria-label="Scroll projects right"
    >
      <ChevronRight class="w-3.5 h-3.5" />
    </button>

    {#if appState.projects.length > 1}
      <button
        onclick={() => appState.closeAllProjects()}
        class="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-deck-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/40 transition cursor-pointer"
        title="Detach all attached projects"
      >
        Detach All
      </button>
    {/if}

    <div class="hidden lg:flex items-center space-x-1 text-[11px] font-mono text-slate-500 dark:text-deck-muted pl-2 border-l border-deck-border">
      <Layers class="w-3 h-3 text-slate-400 dark:text-deck-muted" />
      {#if appState.projects.length === 0}
        <span>No project attached</span>
      {:else}
        <span>{appState.projects.length} {appState.projects.length === 1 ? 'project' : 'projects'} attached</span>
      {/if}
    </div>
  </div>
</div>
