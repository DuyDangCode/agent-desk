<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import type { FolderItem } from '$lib/types';
  import { 
    Folder, 
    FolderGit2, 
    FolderUp, 
    Home, 
    Laptop, 
    Search, 
    X, 
    ChevronRight, 
    Check, 
    FolderOpen, 
    GitBranch, 
    RefreshCw,
    ArrowLeft,
    ArrowRight,
    LayoutGrid,
    List,
    Clock,
    HardDrive,
    FileCode,
    Sparkles,
    FolderKanban,
    Compass,
    Plus
  } from 'lucide-svelte';

  let searchQuery = $state('');
  let selectedFolder = $state<FolderItem | null>(null);
  let viewMode = $state<'list' | 'grid'>('list');
  let isEditingManualPath = $state(false);
  let manualPathInput = $state('');

  // History tracking for Back / Forward buttons
  let history = $state<string[]>([]);
  let historyIndex = $state(-1);

  const listing = $derived(appState.directoryListing);

  const filteredDirs = $derived.by(() => {
    if (!listing?.directories) return [];
    let list = listing.directories.filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Sort: Git repos first, then alphabetically
    list.sort((a, b) => {
      if (a.is_git_repo && !b.is_git_repo) return -1;
      if (!a.is_git_repo && b.is_git_repo) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    return list;
  });

  // Recent repositories stored in localStorage
  let recentRepos = $state<string[]>([]);

  function loadRecentRepos() {
    try {
      const saved = localStorage.getItem('agentdeck_recent_repos');
      if (saved) {
        recentRepos = JSON.parse(saved);
      }
    } catch (e) {
      recentRepos = [];
    }
  }

  function saveRecentRepo(path: string) {
    try {
      const updated = [path, ...recentRepos.filter((p) => p !== path)].slice(0, 8);
      recentRepos = updated;
      localStorage.setItem('agentdeck_recent_repos', JSON.stringify(updated));
    } catch (e) {}
  }

  $effect(() => {
    if (appState.folderPickerOpen) {
      loadRecentRepos();
      if (listing?.current_path) {
        manualPathInput = listing.current_path;
      }
    }
  });

  function getPathSegments(pathStr: string) {
    if (!pathStr) return [];
    const parts = pathStr.split('/').filter(Boolean);
    const segments: { name: string; fullPath: string }[] = [];
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      segments.push({ name: part, fullPath: current });
    }
    return segments;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      appState.folderPickerOpen = false;
    } else if (e.key === 'Enter' && !isEditingManualPath) {
      if (selectedFolder) {
        enterDir(selectedFolder);
      } else {
        openCurrentAsRepo();
      }
    }
  }

  function selectDir(dir: FolderItem) {
    selectedFolder = dir;
    manualPathInput = dir.path;
  }

  function enterDir(dir: FolderItem) {
    navigateTo(dir.path);
  }

  function navigateTo(path: string, pushHistory = true) {
    selectedFolder = null;
    searchQuery = '';
    isEditingManualPath = false;

    if (pushHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(path);
      history = newHistory;
      historyIndex = newHistory.length - 1;
    }

    manualPathInput = path;
    appState.browseDirectory(path);
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex -= 1;
      navigateTo(history[historyIndex], false);
    }
  }

  function goForward() {
    if (historyIndex < history.length - 1) {
      historyIndex += 1;
      navigateTo(history[historyIndex], false);
    }
  }

  function handleManualSubmit(e: Event) {
    e.preventDefault();
    if (manualPathInput.trim()) {
      navigateTo(manualPathInput.trim());
      isEditingManualPath = false;
    }
  }

  async function openCurrentAsRepo() {
    const target = selectedFolder?.path || listing?.current_path;
    if (target) {
      saveRecentRepo(target);
      await appState.attachProject(target, true);
      appState.folderPickerOpen = false;
    }
  }

  async function quickAttachDir(dir: FolderItem, e?: MouseEvent) {
    if (e) e.stopPropagation();
    saveRecentRepo(dir.path);
    await appState.attachProject(dir.path, true);
    appState.folderPickerOpen = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.folderPickerOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 select-none">
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-2xl w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden">
      
      <!-- Top Title Bar -->
      <div class="h-11 bg-gray-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-semibold text-xs tracking-wide">
          <FolderKanban class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>File Explorer & Git Repository Selector</span>
        </div>
        <button
          onclick={() => (appState.folderPickerOpen = false)}
          class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-gray-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation & Address Toolbar -->
      <div class="h-12 bg-gray-50 dark:bg-deck-bg border-b border-deck-border flex items-center space-x-2 px-3 shrink-0">
        <!-- History Navigation: Back, Forward, Up, Refresh -->
        <div class="flex items-center space-x-1">
          <button
            onclick={goBack}
            disabled={historyIndex <= 0}
            class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-deck-card disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-deck-text transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
          </button>
          
          <button
            onclick={goForward}
            disabled={historyIndex >= history.length - 1}
            class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-deck-card disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-deck-text transition cursor-pointer"
            title="Forward"
          >
            <ArrowRight class="w-3.5 h-3.5" />
          </button>

          <button
            onclick={() => listing?.parent_path && navigateTo(listing.parent_path)}
            disabled={!listing?.parent_path}
            class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-deck-card disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-deck-text transition cursor-pointer"
            title="Up to Parent Directory"
          >
            <FolderUp class="w-3.5 h-3.5" />
          </button>

          <button
            onclick={() => listing?.current_path && navigateTo(listing.current_path, false)}
            class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw class="w-3.5 h-3.5 {appState.isLoadingDirs ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}" />
          </button>
        </div>

        <!-- Address Bar (Breadcrumb or Text Input) -->
        <div class="flex-1 min-w-0 bg-white dark:bg-deck-surface border border-deck-border rounded flex items-center px-2 py-0.5 text-xs font-mono h-8 shadow-inner overflow-hidden">
          <HardDrive class="w-3.5 h-3.5 text-slate-500 dark:text-deck-muted shrink-0 mr-1.5" />
          
          {#if isEditingManualPath}
            <form onsubmit={handleManualSubmit} class="flex-1 flex items-center">
              <input
                type="text"
                bind:value={manualPathInput}
                class="w-full bg-transparent text-slate-900 dark:text-deck-bright focus:outline-none font-mono text-xs"
                autofocus
                onblur={() => (isEditingManualPath = false)}
              />
            </form>
          {:else}
            <div 
              class="flex-1 flex items-center space-x-1 overflow-x-auto cursor-text truncate py-0.5"
              onclick={() => (isEditingManualPath = true)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter') isEditingManualPath = true;
              }}
            >
              <button
                onclick={(e) => {
                  e.stopPropagation();
                  navigateTo('/');
                }}
                class="hover:text-blue-600 dark:hover:text-blue-400 text-slate-500 dark:text-deck-muted font-bold px-1"
              >
                /
              </button>
              {#if listing?.current_path}
                {#each getPathSegments(listing.current_path) as segment}
                  <ChevronRight class="w-3 h-3 text-slate-400 dark:text-deck-muted shrink-0" />
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      navigateTo(segment.fullPath);
                    }}
                    class="hover:text-blue-600 dark:hover:text-blue-400 text-slate-800 dark:text-deck-bright px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card transition truncate max-w-[150px]"
                  >
                    {segment.name}
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>

        <!-- Search Input -->
        <div class="relative w-48 shrink-0">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-deck-muted" />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search folders..."
            class="w-full bg-white dark:bg-deck-surface border border-deck-border rounded pl-8 pr-6 py-1 text-xs text-slate-900 dark:text-deck-bright placeholder-slate-400 dark:placeholder-deck-muted focus:outline-none focus:border-blue-500 font-mono h-8"
          />
          {#if searchQuery}
            <button
              onclick={() => (searchQuery = '')}
              class="absolute right-2 top-2 text-slate-400 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          {/if}
        </div>

        <!-- View Mode Toggles -->
        <div class="flex items-center bg-gray-100 dark:bg-deck-surface border border-deck-border rounded p-0.5 shrink-0">
          <button
            onclick={() => (viewMode = 'list')}
            class="p-1 rounded {viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
            title="List View"
          >
            <List class="w-3.5 h-3.5" />
          </button>
          <button
            onclick={() => (viewMode = 'grid')}
            class="p-1 rounded {viewMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
            title="Grid View"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Main Explorer Body (Split Sidebar + Content Area) -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Left Sidebar: Quick Access & Places -->
        <div class="w-56 bg-gray-50 dark:bg-deck-surface border-r border-deck-border flex flex-col p-2.5 space-y-4 shrink-0 overflow-y-auto select-none text-xs">
          <!-- Places -->
          <div>
            <span class="text-[10px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider px-2 block mb-1">
              Quick Places
            </span>
            <div class="space-y-0.5">
              {#if listing?.home_path}
                <button
                  onclick={() => navigateTo(listing.home_path)}
                  class="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright transition text-left {listing.current_path === listing.home_path ? 'bg-gray-200 dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-500' : ''}"
                >
                  <Home class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span class="truncate">Home Directory</span>
                </button>

                <button
                  onclick={() => navigateTo(`${listing.home_path}/Projects`)}
                  class="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright transition text-left {listing.current_path === `${listing.home_path}/Projects` ? 'bg-gray-200 dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-500' : ''}"
                >
                  <FolderKanban class="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
                  <span class="truncate">Projects</span>
                </button>
              {/if}

              {#if appState.repoPath}
                <button
                  onclick={() => navigateTo(appState.repoPath)}
                  class="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright transition text-left {listing?.current_path === appState.repoPath ? 'bg-gray-200 dark:bg-deck-card text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500' : ''}"
                >
                  <FolderGit2 class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span class="truncate">Current Workspace</span>
                </button>
              {/if}

              <button
                onclick={() => navigateTo('/')}
                class="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright transition text-left {listing?.current_path === '/' ? 'bg-gray-200 dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-500' : ''}"
              >
                <HardDrive class="w-3.5 h-3.5 text-slate-500 dark:text-deck-muted shrink-0" />
                <span class="truncate">Root Filesystem (/)</span>
              </button>
            </div>
          </div>

          <!-- Recent Repositories -->
          {#if recentRepos.length > 0}
            <div>
              <span class="text-[10px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider px-2 block mb-1 flex items-center justify-between">
                <span>Recent Repositories</span>
                <Clock class="w-3 h-3 text-slate-500 dark:text-deck-muted" />
              </span>
              <div class="space-y-0.5">
                {#each recentRepos as repo}
                  {@const parts = repo.split('/')}
                  {@const name = parts[parts.length - 1] || repo}
                  <button
                    onclick={() => navigateTo(repo)}
                    class="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright transition text-left group"
                    title={repo}
                  >
                    <FolderGit2 class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 shrink-0" />
                    <div class="min-w-0 flex-1 truncate">
                      <div class="truncate text-slate-900 dark:text-deck-bright font-medium">{name}</div>
                      <div class="truncate text-[10px] text-slate-500 dark:text-deck-muted font-mono">{repo}</div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Right Main Panel: Folder Explorer Content -->
        <div class="flex-1 bg-white dark:bg-deck-bg p-4 overflow-y-auto flex flex-col">
          {#if appState.isLoadingDirs}
            <div class="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-deck-muted space-y-2">
              <RefreshCw class="w-6 h-6 animate-spin text-blue-500 dark:text-blue-400" />
              <span class="text-xs">Scanning directory contents...</span>
            </div>
          {:else if filteredDirs.length === 0}
            <div class="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-deck-muted p-8 text-center space-y-3">
              <FolderOpen class="w-12 h-12 text-slate-400 dark:text-deck-muted/30" />
              <div>
                <p class="text-xs font-semibold text-slate-900 dark:text-deck-bright">No Subdirectories Found</p>
                <p class="text-[11px] text-slate-500 dark:text-deck-muted max-w-xs mt-1">
                  You can click <b>"Open This Folder"</b> below to open this folder as your active Git repository workspace.
                </p>
              </div>
            </div>
          {:else}
            <!-- 1. LIST VIEW -->
            {#if viewMode === 'list'}
              <div class="divide-y divide-deck-border/40 font-mono text-xs">
                <!-- Column Headers -->
                <div class="flex items-center justify-between pb-2 text-[10px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider select-none px-2">
                  <div class="flex-1">Folder Name</div>
                  <div class="w-28 text-center">Type</div>
                  <div class="w-20 text-right">Action</div>
                </div>

                {#each filteredDirs as dir}
                  {@const isSelected = selectedFolder?.path === dir.path}
                  <div
                    class="flex items-center justify-between px-2.5 py-2 rounded-md transition cursor-pointer {isSelected ? 'bg-blue-50 dark:bg-blue-600/25 border border-blue-300 dark:border-blue-500/50 text-blue-950 dark:text-deck-bright font-medium' : 'hover:bg-gray-50 dark:hover:bg-deck-card text-slate-700 dark:text-deck-text border border-transparent'}"
                    onclick={() => selectDir(dir)}
                    ondblclick={() => enterDir(dir)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') enterDir(dir);
                    }}
                  >
                    <!-- Folder Name & Icon -->
                    <div class="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                      {#if dir.is_git_repo}
                        <FolderGit2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      {:else}
                        <Folder class="w-4 h-4 text-slate-400 dark:text-deck-muted shrink-0" />
                      {/if}
                      <span class="truncate font-sans font-medium text-slate-900 dark:text-deck-bright">{dir.name}</span>
                    </div>

                    <!-- Folder Type / Badge -->
                    <div class="w-28 text-center shrink-0">
                      {#if dir.is_git_repo}
                        <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-semibold flex items-center justify-center space-x-1">
                          <GitBranch class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Git Repo</span>
                        </span>
                      {:else}
                        <span class="text-[11px] text-slate-500 dark:text-deck-muted">Directory</span>
                      {/if}
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center space-x-1.5 text-right shrink-0">
                      {#if dir.is_git_repo}
                        <button
                          onclick={(e) => quickAttachDir(dir, e)}
                          class="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium shadow-xs transition cursor-pointer flex items-center space-x-1"
                          title="Attach this Git repository to AgentDeck"
                        >
                          <Plus class="w-3 h-3" />
                          <span>Attach</span>
                        </button>
                      {/if}
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          enterDir(dir);
                        }}
                        class="px-2 py-0.5 rounded bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-[11px] text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright border border-deck-border transition cursor-pointer"
                        title="Browse into folder"
                      >
                        Enter →
                      </button>
                    </div>
                  </div>
                {/each}
              </div>

            <!-- 2. GRID / TILES VIEW -->
            {:else}
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {#each filteredDirs as dir}
                  {@const isSelected = selectedFolder?.path === dir.path}
                  <div
                    class="flex flex-col items-center p-3 rounded-lg border text-center transition cursor-pointer relative group {isSelected ? 'bg-blue-50 dark:bg-blue-600/25 border-blue-400 dark:border-blue-500/50 shadow-md text-blue-950 dark:text-deck-bright' : 'bg-gray-50 dark:bg-deck-surface hover:bg-gray-100 dark:hover:bg-deck-card border-deck-border text-slate-800 dark:text-deck-text'}"
                    onclick={() => selectDir(dir)}
                    ondblclick={() => enterDir(dir)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') enterDir(dir);
                    }}
                  >
                    {#if dir.is_git_repo}
                      <FolderGit2 class="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2 shrink-0" />
                      <span class="absolute top-1.5 right-1.5 px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-[9px] font-mono font-semibold">
                        GIT
                      </span>
                    {:else}
                      <Folder class="w-8 h-8 text-slate-400 dark:text-deck-muted group-hover:text-blue-500 dark:group-hover:text-blue-400 mb-2 shrink-0 transition" />
                    {/if}

                    <span class="text-xs font-medium text-slate-900 dark:text-deck-bright truncate w-full px-1">
                      {dir.name}
                    </span>

                    {#if dir.is_git_repo}
                      <button
                        onclick={(e) => quickAttachDir(dir, e)}
                        class="mt-2 opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium transition cursor-pointer flex items-center space-x-1"
                      >
                        <Plus class="w-2.5 h-2.5" />
                        <span>Attach</span>
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="h-14 bg-gray-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-between px-5 shrink-0 select-none">
        <!-- Selected Path Display -->
        <div class="flex items-center space-x-2 truncate max-w-md text-xs font-mono">
          <span class="text-slate-500 dark:text-deck-muted shrink-0">Target:</span>
          <span class="text-slate-900 dark:text-deck-bright truncate bg-white dark:bg-deck-bg px-2 py-1 rounded border border-deck-border font-medium">
            {selectedFolder?.path || listing?.current_path || 'No folder selected'}
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-2.5">
          <button
            onclick={() => (appState.folderPickerOpen = false)}
            class="px-3.5 py-1.5 bg-white dark:bg-deck-surface hover:bg-gray-100 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded-md text-xs border border-deck-border transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onclick={openCurrentAsRepo}
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-md shadow flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Attach Workspace</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
