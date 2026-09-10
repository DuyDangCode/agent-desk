<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import type { ProjectItem } from '$lib/types';
  import { 
    FolderGit2, 
    Plus, 
    X, 
    Bot, 
    ChevronLeft, 
    ChevronRight,
    ChevronDown,
    Terminal as TerminalIcon,
    Edit2,
    Check,
    Settings,
    Sun,
    Moon,
    Monitor,
    Layers,
    AlertCircle
  } from 'lucide-svelte';

  let collapsedProjects = $state<Record<string, boolean>>({});
  let editingSessionId = $state<string | null>(null);
  let editingTitle = $state<string>('');

  function isProjectExpanded(projectId: string): boolean {
    if (projectId in collapsedProjects) {
      return !collapsedProjects[projectId];
    }
    return true; // Expanded by default
  }

  function toggleProjectCollapse(projectId: string, e?: Event) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const currentlyExpanded = isProjectExpanded(projectId);
    collapsedProjects = {
      ...collapsedProjects,
      [projectId]: currentlyExpanded
    };
  }

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
    // Auto-expand active project
    collapsedProjects = {
      ...collapsedProjects,
      [projectId]: false
    };
    if (appState.mobileSidebarOpen) {
      appState.toggleMobileSidebar(false);
    }
  }

  function handleSelectSession(projectId: string, sessionId: string, e?: Event) {
    if (e) e.stopPropagation();
    appState.selectProjectSession(projectId, sessionId);
    if (appState.mobileSidebarOpen) {
      appState.toggleMobileSidebar(false);
    }
  }

  function handleAddSession(projectId: string, e?: Event) {
    if (e) e.stopPropagation();
    collapsedProjects = {
      ...collapsedProjects,
      [projectId]: false
    };
    appState.addProjectTerminalSession(projectId);
    if (appState.mobileSidebarOpen) {
      appState.toggleMobileSidebar(false);
    }
  }

  function handleCloseSession(projectId: string, sessionId: string, e?: Event) {
    if (e) e.stopPropagation();
    appState.closeProjectSession(projectId, sessionId);
  }

  function startRenaming(session: { id: string; title: string }, e?: Event) {
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
        {@const stagedCount = project.info?.staged_count || 0}
        {@const unstagedCount = project.info?.unstaged_count || 0}
        {@const totalChanges = stagedCount + unstagedCount}
        {@const isExpanded = isProjectExpanded(project.id)}

        <div class="space-y-0.5">
          <!-- Project Header Row (Tree Group Header) -->
          <div
            class="group relative flex items-center justify-between px-1.5 py-1 rounded-md text-xs transition cursor-pointer {isActive ? 'text-slate-900 dark:text-deck-bright font-medium bg-slate-200/50 dark:bg-deck-card/50' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-200/40 dark:hover:bg-deck-card/30'}"
            onclick={() => handleSelectProject(project.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelectProject(project.id);
            }}
          >
            <!-- Left: Chevron, Icon, Project Name -->
            <div class="flex items-center space-x-1 min-w-0 flex-1 pr-1">
              <button
                type="button"
                onclick={(e) => toggleProjectCollapse(project.id, e)}
                class="p-0.5 rounded text-slate-400 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-bright transition shrink-0 cursor-pointer"
                title={isExpanded ? 'Collapse' : 'Expand'}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {#if isExpanded}
                  <ChevronDown class="w-3.5 h-3.5" />
                {:else}
                  <ChevronRight class="w-3.5 h-3.5" />
                {/if}
              </button>

              <FolderGit2 class="w-3.5 h-3.5 shrink-0 {isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-deck-muted'}" />

              <span class="truncate {isActive ? 'text-slate-900 dark:text-deck-bright font-medium' : ''}" title={project.path}>
                {project.name}
              </span>
            </div>

            <!-- Right: Diff Count & Hover Quick Actions -->
            <div class="flex items-center space-x-1 shrink-0">
              {#if totalChanges > 0}
                <span class="text-[11px] font-mono text-slate-400 dark:text-deck-muted group-hover:hidden transition-opacity" title="{stagedCount} staged, {unstagedCount} modified">
                  +{totalChanges}
                </span>
              {/if}

              <!-- Quick Actions on hover -->
              <div class="hidden group-hover:flex items-center space-x-0.5">
                <button
                  type="button"
                  onclick={(e) => handleAddSession(project.id, e)}
                  class="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:text-deck-muted dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-deck-card transition cursor-pointer"
                  title="New Terminal (+)"
                  aria-label="New Terminal"
                >
                  <Plus class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    appState.closeProject(project.id);
                  }}
                  class="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-deck-card transition cursor-pointer"
                  title="Detach project"
                  aria-label="Detach project"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Collapsible Terminal Tabs for this Project -->
          {#if isExpanded}
            <div class="ml-3 pl-2.5 border-l border-slate-200 dark:border-deck-border/40 space-y-0.5 my-0.5">
              {#each project.sessions as session, sIdx (session.id)}
                {@const isSessionActive = isActive && session.id === appState.activeSessionId}
                {@const isSecondary = isActive && appState.terminalLayout !== 'single' && session.id === appState.secondarySessionId}
                {@const isFocused = (isSessionActive && appState.focusedPane === 'primary') || (isSecondary && appState.focusedPane === 'secondary') || (appState.terminalLayout === 'single' && isSessionActive)}
                {@const isEditing = editingSessionId === session.id}

                <div
                  class="group/tab relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-mono transition cursor-pointer {isFocused ? 'bg-slate-200/60 dark:bg-deck-card/70 text-slate-900 dark:text-deck-bright font-medium' : isSessionActive ? 'bg-slate-200/40 dark:bg-deck-card/50 text-slate-800 dark:text-deck-text' : isSecondary ? 'bg-purple-50/60 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-200/40 dark:hover:bg-deck-card/40'}"
                  onclick={(e) => handleSelectSession(project.id, session.id, e)}
                  ondblclick={(e) => startRenaming(session, e)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelectSession(project.id, session.id, e);
                  }}
                >
                  <!-- Active thin left indicator -->
                  {#if isFocused || isSessionActive}
                    <span class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                  {/if}

                  <div class="flex items-center space-x-1.5 min-w-0 flex-1 pr-1">
                    <!-- Split layout indicator if active project -->
                    {#if isActive && appState.terminalLayout !== 'single'}
                      {#if isSessionActive}
                        <span class="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">P1</span>
                      {:else if isSecondary}
                        <span class="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">P2</span>
                      {/if}
                    {/if}

                    <!-- Agent / Shell Icon -->
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        appState.toggleSessionAgent(session.id);
                      }}
                      class="p-0.5 rounded hover:bg-slate-300/60 dark:hover:bg-deck-border/60 transition shrink-0"
                      title={session.isAgent ? 'AI Agent (Click to reset to shell)' : 'Standard Shell (Click to mark as AI Agent)'}
                    >
                      {#if session.isAgent}
                        <Bot class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      {:else}
                        <TerminalIcon class="w-3.5 h-3.5 text-slate-400 dark:text-deck-muted" />
                      {/if}
                    </button>

                    <!-- Terminal Title or Inline Rename -->
                    {#if isEditing}
                      <div class="flex items-center space-x-1 flex-1 min-w-0" onclick={(e) => e.stopPropagation()} role="presentation">
                        <input
                          type="text"
                          bind:value={editingTitle}
                          class="bg-white dark:bg-deck-bg border border-blue-500 rounded px-1 py-0.5 text-xs text-slate-900 dark:text-deck-bright font-mono focus:outline-none w-full shadow-inner"
                          onkeydown={(e) => handleRenameKeydown(session.id, e)}
                          onblur={() => saveRename(session.id)}
                        />
                        <button
                          onclick={() => saveRename(session.id)}
                          class="p-0.5 hover:bg-slate-200 dark:hover:bg-deck-border rounded text-emerald-600 dark:text-emerald-400 cursor-pointer shrink-0"
                          title="Save title"
                        >
                          <Check class="w-3 h-3" />
                        </button>
                      </div>
                    {:else}
                      <span class="truncate text-xs {isFocused ? 'text-slate-900 dark:text-deck-bright font-medium' : ''}" title={session.title}>
                        {session.title}
                      </span>
                    {/if}
                  </div>

                  <!-- Right Side: Status Indicator & Actions -->
                  <div class="flex items-center space-x-1 shrink-0">
                    <!-- Terminal Status Indicators (dots/icons) -->
                    {#if session.agentStatus === 'blocked' || session.attentionState}
                      <span class="flex items-center text-amber-500 mr-0.5" title="Agent Blocked: Waiting for user input">
                        <AlertCircle class="w-3 h-3 animate-pulse" />
                      </span>
                    {:else if session.agentStatus === 'working'}
                      <span class="relative flex h-2 w-2 mr-0.5" title="Agent Working">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    {:else if session.agentStatus === 'idle' && session.isAgent}
                      <span class="w-1.5 h-1.5 rounded-full border border-emerald-500 dark:border-emerald-400 mr-0.5" title="Agent Idle"></span>
                    {/if}

                    <!-- Rename button on hover -->
                    {#if !isEditing}
                      <button
                        onclick={(e) => startRenaming(session, e)}
                        class="opacity-0 group-hover/tab:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-deck-border rounded text-slate-400 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright transition cursor-pointer"
                        title="Rename"
                        aria-label="Rename"
                      >
                        <Edit2 class="w-2.5 h-2.5" />
                      </button>
                    {/if}

                    <!-- Close session button -->
                    {#if project.sessions.length > 1}
                      <button
                        class="opacity-0 group-hover/tab:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-deck-border rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 transition cursor-pointer"
                        onclick={(e) => handleCloseSession(project.id, session.id, e)}
                        title="Close terminal"
                        aria-label="Close terminal"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}

              <!-- New Terminal Action Row -->
              <button
                onclick={(e) => handleAddSession(project.id, e)}
                class="w-full flex items-center space-x-2 px-2 py-1.5 text-xs text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-200/40 dark:hover:bg-deck-card/40 rounded-md transition cursor-pointer"
                title="New Terminal"
              >
                <Plus class="w-3.5 h-3.5 shrink-0" />
                <span>New Terminal</span>
              </button>
            </div>
          {/if}
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
          {@const stagedCount = project.info?.staged_count || 0}
          {@const unstagedCount = project.info?.unstaged_count || 0}
          {@const totalChanges = stagedCount + unstagedCount}
          {@const isExpanded = isProjectExpanded(project.id)}

          <div class="space-y-0.5">
            <div
              class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition {isActive ? 'text-slate-900 dark:text-deck-bright font-medium bg-slate-200/50 dark:bg-deck-card/50' : 'text-slate-700 dark:text-deck-text hover:bg-slate-100 dark:hover:bg-deck-card'}"
              onclick={() => handleSelectProject(project.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelectProject(project.id);
              }}
            >
              <div class="flex items-center space-x-1.5 min-w-0 flex-1 pr-1">
                <button
                  type="button"
                  onclick={(e) => toggleProjectCollapse(project.id, e)}
                  class="p-0.5 rounded text-slate-400 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-bright transition shrink-0"
                >
                  {#if isExpanded}
                    <ChevronDown class="w-3.5 h-3.5" />
                  {:else}
                    <ChevronRight class="w-3.5 h-3.5" />
                  {/if}
                </button>
                <FolderGit2 class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span class="truncate font-medium">{project.name}</span>
              </div>
              <div class="flex items-center space-x-1 shrink-0">
                {#if totalChanges > 0}
                  <span class="text-[11px] font-mono text-slate-400 dark:text-deck-muted">
                    +{totalChanges}
                  </span>
                {/if}
                {#if project.info?.branch}
                  <span class="text-[10px] font-mono text-blue-600 dark:text-blue-400 shrink-0 ml-1">
                    {project.info.branch}
                  </span>
                {/if}
              </div>
            </div>

            {#if isExpanded}
              <div class="ml-3 pl-2.5 border-l border-slate-200 dark:border-deck-border/40 space-y-0.5 my-0.5">
                {#each project.sessions as session (session.id)}
                  {@const isSessionActive = isActive && session.id === appState.activeSessionId}
                  <div
                    class="relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-mono cursor-pointer transition {isSessionActive ? 'bg-slate-200/60 dark:bg-deck-card text-slate-900 dark:text-deck-bright font-medium' : 'text-slate-600 dark:text-deck-muted hover:bg-slate-100 dark:hover:bg-deck-card'}"
                    onclick={(e) => handleSelectSession(project.id, session.id, e)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectSession(project.id, session.id, e);
                    }}
                  >
                    {#if isSessionActive}
                      <span class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                    {/if}
                    <div class="flex items-center space-x-1.5 min-w-0 truncate pr-1">
                      {#if session.isAgent}
                        <Bot class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      {:else}
                        <TerminalIcon class="w-3.5 h-3.5 text-slate-400 dark:text-deck-muted shrink-0" />
                      {/if}
                      <span class="truncate">{session.title}</span>
                    </div>
                    <div class="flex items-center space-x-1 shrink-0">
                      {#if session.agentStatus === 'blocked' || session.attentionState}
                        <span class="text-amber-500 mr-0.5" title="Blocked">
                          <AlertCircle class="w-3 h-3 animate-pulse" />
                        </span>
                      {:else if session.agentStatus === 'working'}
                        <span class="relative flex h-2 w-2 mr-0.5" title="Working">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                      {:else if session.agentStatus === 'idle' && session.isAgent}
                        <span class="w-1.5 h-1.5 rounded-full border border-emerald-500 dark:border-emerald-400 mr-0.5" title="Idle"></span>
                      {/if}
                    </div>
                  </div>
                {/each}

                <button
                  onclick={(e) => handleAddSession(project.id, e)}
                  class="w-full flex items-center space-x-2 px-2 py-1.5 text-xs text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-slate-100 dark:hover:bg-deck-card/40 rounded-md transition cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5 shrink-0" />
                  <span>New Terminal</span>
                </button>
              </div>
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
