<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { 
    FolderGit2, 
    Plus, 
    X, 
    GitBranch, 
    Bot, 
    ChevronLeft, 
    ChevronRight,
    Settings,
    Sun,
    Moon,
    Monitor,
    Layers,
    AlertCircle
  } from 'lucide-svelte';

  function cycleTheme() {
    if (themeState.mode === 'black' || themeState.mode === 'dark') {
      themeState.setMode('white');
      appState.showToast('Theme set to Light', 'info');
    } else if (themeState.mode === 'white' || themeState.mode === 'light') {
      themeState.setMode('system');
      appState.showToast('Theme set to System sync', 'info');
    } else {
      themeState.setMode('black');
      appState.showToast('Theme set to Dark', 'info');
    }
  }

  function handleSelectProject(projectId: string) {
    appState.switchProject(projectId);
    if (appState.mobileSidebarOpen) {
      appState.toggleMobileSidebar(false);
    }
  }

  function handleAddProject() {
    appState.openFolderPicker();
    if (appState.mobileSidebarOpen) {
      appState.toggleMobileSidebar(false);
    }
  }
</script>

<!-- Desktop / Tablet Responsive Sidebar -->
<aside
  class="hidden md:flex flex-col h-full bg-slate-50 dark:bg-deck-surface border-r border-deck-border shrink-0 select-none transition-all duration-200 z-20 {appState.sidebarMode === 'expanded' ? 'w-60' : appState.sidebarMode === 'rail' ? 'w-12' : 'w-0 overflow-hidden border-r-0'}"
  aria-label="Workspaces & Navigation Sidebar"
>
  {#if appState.sidebarMode === 'expanded'}
    <!-- EXPANDED SIDEBAR HEADER -->
    <div class="h-10 px-3 border-b border-deck-border/60 flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-deck-bright">
        <Layers class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span class="tracking-tight">Workspaces</span>
        {#if appState.projects.length > 0}
          <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-deck-card text-slate-600 dark:text-deck-muted">
            {appState.projects.length}
          </span>
        {/if}
      </div>

      <div class="flex items-center space-x-0.5">
        <button
          onclick={handleAddProject}
          class="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-blue-400 dark:hover:bg-deck-card transition cursor-pointer"
          title="Attach Project Workspace (+)"
          aria-label="Add project"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          onclick={() => appState.toggleSidebar()}
          class="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
          title="Collapse sidebar to icon rail"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- EXPANDED PROJECTS LIST -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      {#if appState.projects.length === 0}
        <div class="p-4 text-center text-slate-500 dark:text-deck-muted space-y-2 border border-dashed border-slate-300 dark:border-deck-border rounded-lg my-2">
          <FolderGit2 class="w-6 h-6 mx-auto text-slate-400 dark:text-deck-muted/60" />
          <p class="text-xs font-medium text-slate-700 dark:text-deck-text">No workspace attached</p>
          <button
            onclick={handleAddProject}
            class="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium transition cursor-pointer shadow-xs"
          >
            <Plus class="w-3 h-3" />
            <span>Attach Project</span>
          </button>
        </div>
      {/if}

      {#each appState.projects as project, idx (project.id)}
        {@const isActive = project.id === appState.activeProjectId}
        {@const hasAgents = project.sessions.some((s) => s.isAgent)}
        {@const needsAttention = appState.isProjectAttentionRequired(project.id)}
        {@const stagedCount = project.info?.staged_count || 0}
        {@const unstagedCount = project.info?.unstaged_count || 0}
        {@const isDirty = (project.info?.staged_count || 0) + (project.info?.unstaged_count || 0) + (project.info?.untracked_count || 0) > 0}

        <div
          class="group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer border {needsAttention ? 'border-amber-500/70 bg-amber-50/50 dark:bg-amber-950/30' : isActive ? 'bg-white dark:bg-deck-bg text-slate-900 dark:text-deck-bright border-blue-500/50 shadow-xs font-medium' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-200/60 dark:hover:bg-deck-card/70 border-transparent'}"
          onclick={() => handleSelectProject(project.id)}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleSelectProject(project.id);
          }}
        >
          <!-- Active left indicator bar -->
          {#if isActive}
            <span class="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"></span>
          {/if}

          <!-- Project Details -->
          <div class="flex items-center space-x-2 min-w-0 flex-1 pr-1.5">
            <FolderGit2 class="w-3.5 h-3.5 shrink-0 {needsAttention ? 'text-amber-500' : isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-deck-muted'}" />

            <div class="min-w-0 flex-1">
              <div class="flex items-center space-x-1.5">
                <span class="truncate font-semibold {isActive ? 'text-slate-900 dark:text-deck-bright' : ''}" title={project.path}>
                  {project.name}
                </span>

                {#if idx < 9}
                  <span class="text-[9px] font-mono text-slate-400 dark:text-deck-muted/70 px-1 rounded bg-slate-200 dark:bg-deck-card shrink-0" title="Ctrl+{idx + 1}">
                    {idx + 1}
                  </span>
                {/if}
              </div>

              <!-- Secondary Row: Git Branch & Agents -->
              <div class="flex items-center space-x-1.5 pt-0.5 text-[10px] font-mono">
                {#if project.info?.branch}
                  <span class="truncate max-w-[90px] text-blue-600 dark:text-blue-400 flex items-center space-x-0.5">
                    <GitBranch class="w-2.5 h-2.5 shrink-0 inline" />
                    <span class="truncate">{project.info.branch}</span>
                  </span>
                {/if}

                {#if needsAttention}
                  <span class="flex items-center space-x-0.5 text-amber-600 dark:text-amber-400 font-semibold" title="Agent requires user input/permission">
                    <AlertCircle class="w-2.5 h-2.5 animate-bounce" />
                    <span>Attention</span>
                  </span>
                {:else if hasAgents}
                  <span class="flex items-center space-x-0.5 text-purple-600 dark:text-purple-400 font-semibold" title="AI Agent Running">
                    <Bot class="w-2.5 h-2.5 animate-pulse" />
                    <span>Agent</span>
                  </span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Status badges & close button -->
          <div class="flex items-center space-x-1 shrink-0">
            {#if stagedCount > 0}
              <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-400 font-bold" title="{stagedCount} staged">
                +{stagedCount}
              </span>
            {/if}
            {#if unstagedCount > 0}
              <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-400 font-bold" title="{unstagedCount} modified">
                ~{unstagedCount}
              </span>
            {/if}
            {#if !isDirty && project.info}
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Clean working tree"></span>
            {/if}

            <button
              onclick={(e) => {
                e.stopPropagation();
                appState.closeProject(project.id);
              }}
              class="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-deck-card transition cursor-pointer"
              title="Detach project"
              aria-label="Detach project"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- EXPANDED SIDEBAR FOOTER -->
    <div class="p-2 border-t border-deck-border/60 flex items-center justify-between text-xs text-slate-500 dark:text-deck-muted">
      <button
        onclick={cycleTheme}
        class="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-deck-card hover:text-slate-900 dark:hover:text-deck-bright transition flex items-center space-x-1.5 cursor-pointer"
        title="Cycle theme (Black / White / System)"
      >
        {#if themeState.mode === 'system'}
          <Monitor class="w-3.5 h-3.5" />
        {:else if themeState.resolved === 'dark'}
          <Moon class="w-3.5 h-3.5 text-blue-400" />
        {:else}
          <Sun class="w-3.5 h-3.5 text-amber-500" />
        {/if}
        <span class="text-[11px] font-mono capitalize">{themeState.mode}</span>
      </button>

      <button
        onclick={() => appState.openSettings()}
        class="p-1.5 rounded hover:bg-slate-200/70 dark:hover:bg-deck-card hover:text-slate-900 dark:hover:text-deck-bright transition flex items-center space-x-1.5 cursor-pointer"
        title="Settings (Ctrl+,)"
      >
        <Settings class="w-3.5 h-3.5" />
        <span class="text-[11px]">Settings</span>
      </button>
    </div>

  {:else if appState.sidebarMode === 'rail'}
    <!-- COMPACT RAIL SIDEBAR -->
    <div class="flex flex-col items-center justify-between h-full py-2.5 w-full">
      <!-- Rail Top Controls -->
      <div class="flex flex-col items-center space-y-2 w-full">
        <button
          onclick={() => appState.toggleSidebar()}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
          title="Expand Workspaces Sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight class="w-4 h-4" />
        </button>

        <div class="w-6 h-px bg-deck-border/60 my-1"></div>

        <!-- Rail Project Icons -->
        {#each appState.projects as project, idx (project.id)}
          {@const isActive = project.id === appState.activeProjectId}
          {@const hasAgents = project.sessions.some((s) => s.isAgent)}
          {@const isDirty = (project.info?.staged_count || 0) + (project.info?.unstaged_count || 0) + (project.info?.untracked_count || 0) > 0}

          <div class="relative group w-full flex justify-center">
            <button
              onclick={() => handleSelectProject(project.id)}
              class="w-8 h-8 rounded-lg flex items-center justify-center transition relative cursor-pointer {isActive ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500/50' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-200/60 dark:hover:bg-deck-card'}"
              aria-label="Select {project.name}"
            >
              {#if hasAgents}
                <Bot class="w-4 h-4 text-purple-600 dark:text-purple-400" />
              {:else}
                <FolderGit2 class="w-4 h-4" />
              {/if}

              <!-- Active Left Indicator Bar -->
              {#if isActive}
                <span class="absolute -left-1 top-2 bottom-2 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
              {/if}

              <!-- Agent dot -->
              {#if hasAgents}
                <span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              {:else if isDirty}
                <span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {/if}
            </button>

            <!-- Floating Tooltip -->
            <div class="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-mono rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              <div class="font-bold">{project.name} {idx < 9 ? `(Ctrl+${idx + 1})` : ''}</div>
              {#if project.info?.branch}
                <div class="text-[10px] text-blue-400"> {project.info.branch}</div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- Rail Add Project Button -->
        <div class="relative group w-full flex justify-center">
          <button
            onclick={handleAddProject}
            class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-blue-400 dark:hover:bg-deck-card transition cursor-pointer"
            title="Attach Workspace (+)"
            aria-label="Attach Workspace"
          >
            <Plus class="w-4 h-4" />
          </button>
          <div class="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-deck-card text-white dark:text-deck-bright text-[11px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
            Attach Project Workspace
          </div>
        </div>
      </div>

      <!-- Rail Bottom Utilities -->
      <div class="flex flex-col items-center space-y-1.5 w-full">
        <button
          onclick={cycleTheme}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
          title="Cycle Theme"
          aria-label="Cycle Theme"
        >
          {#if themeState.mode === 'system'}
            <Monitor class="w-4 h-4" />
          {:else if themeState.resolved === 'dark'}
            <Moon class="w-4 h-4 text-blue-400" />
          {:else}
            <Sun class="w-4 h-4 text-amber-500" />
          {/if}
        </button>

        <button
          onclick={() => appState.openSettings()}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
          title="Settings (Ctrl+,)"
          aria-label="Settings"
        >
          <Settings class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}
</aside>

<!-- Mobile Drawer Overlay (< 768px) -->
{#if appState.mobileSidebarOpen}
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden flex animate-in fade-in duration-150"
    onclick={() => appState.toggleMobileSidebar(false)}
    role="dialog"
    aria-modal="true"
    aria-label="Workspaces drawer"
  >
    <div
      class="w-72 h-full bg-white dark:bg-deck-surface border-r border-deck-border shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="flex items-center justify-between pb-3 border-b border-deck-border">
        <div class="flex items-center space-x-2 font-bold text-slate-900 dark:text-deck-bright text-sm">
          <Layers class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Workspaces</span>
        </div>
        <button
          onclick={() => appState.toggleMobileSidebar(false)}
          class="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-deck-bright hover:bg-slate-100 dark:hover:bg-deck-card cursor-pointer"
          aria-label="Close drawer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-3 space-y-1">
        {#each appState.projects as project (project.id)}
          {@const isActive = project.id === appState.activeProjectId}
          <div
            class="flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer border {isActive ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 text-blue-950 dark:text-deck-bright font-semibold' : 'text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card border-transparent'}"
            onclick={() => handleSelectProject(project.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelectProject(project.id);
            }}
          >
            <div class="flex items-center space-x-2 truncate flex-1">
              <FolderGit2 class="w-4 h-4 text-slate-400 shrink-0" />
              <span class="truncate">{project.name}</span>
            </div>
            {#if project.info?.branch}
              <span class="text-[10px] font-mono text-blue-600 dark:text-blue-400 shrink-0">
                {project.info.branch}
              </span>
            {/if}
          </div>
        {/each}

        <button
          onclick={handleAddProject}
          class="w-full mt-2 py-2 px-3 border border-dashed border-slate-300 dark:border-deck-border rounded-lg text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center justify-center space-x-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Attach Project</span>
        </button>
      </div>

      <div class="pt-3 border-t border-deck-border flex items-center justify-between text-xs">
        <button
          onclick={cycleTheme}
          class="flex items-center space-x-1.5 text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright cursor-pointer"
        >
          {#if themeState.mode === 'system'}
            <Monitor class="w-3.5 h-3.5" />
          {:else if themeState.resolved === 'dark'}
            <Moon class="w-3.5 h-3.5 text-blue-400" />
          {:else}
            <Sun class="w-3.5 h-3.5 text-amber-500" />
          {/if}
          <span class="font-mono capitalize">{themeState.mode}</span>
        </button>

        <button
          onclick={() => {
            appState.toggleMobileSidebar(false);
            appState.openSettings();
          }}
          class="flex items-center space-x-1.5 text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright cursor-pointer"
        >
          <Settings class="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  </div>
{/if}
