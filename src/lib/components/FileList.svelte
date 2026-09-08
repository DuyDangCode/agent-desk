<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import type { FileDiff } from '$lib/types';
  import { 
    FileText, 
    Check, 
    Plus, 
    Minus, 
    Trash2, 
    CheckSquare, 
    Square, 
    Search, 
    FilePlus, 
    FileX, 
    FileEdit, 
    FileCode2,
    Layers,
    ChevronDown,
    ChevronRight,
    FolderGit2
  } from 'lucide-svelte';

  let stagedCollapsed = $state(false);
  let unstagedCollapsed = $state(false);

  const stagedFiles = $derived(appState.filteredStagedFiles);
  const unstagedFiles = $derived(appState.filteredUnstagedFiles);

  function getStatusBadge(status: string) {
    switch (status) {
      case 'added':
        return { label: 'A', bg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40' };
      case 'deleted':
        return { label: 'D', bg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40' };
      case 'renamed':
        return { label: 'R', bg: 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/40' };
      case 'untracked':
        return { label: 'U', bg: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' };
      case 'modified':
      default:
        return { label: 'M', bg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/40' };
    }
  }

  function getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  function getDirName(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/') + '/';
  }

  function selectFile(file: FileDiff) {
    appState.selectedFilePath = file.path;
    appState.selectedIsStaged = file.is_staged;
  }
</script>

<div class="h-full flex flex-col bg-white dark:bg-deck-surface border-r border-deck-border select-none w-56 sm:w-64 md:w-72 shrink-0">
  <!-- Search & Filter Header -->
  <div class="p-2 border-b border-deck-border space-y-1.5">
    <div class="relative">
      <Search class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-deck-muted" />
      <input
        type="text"
        bind:value={appState.searchQuery}
        placeholder="Filter changed files..."
        class="w-full bg-gray-50 dark:bg-deck-bg border border-deck-border rounded pl-8 pr-2 py-1 text-xs text-slate-900 dark:text-deck-bright placeholder-slate-400 dark:placeholder-deck-muted focus:outline-none focus:border-blue-500 font-mono shadow-inner"
      />
    </div>

    <!-- Filter Pills / Tabs -->
    <div class="flex items-center justify-between text-[11px] font-medium pt-0.5">
      <div class="flex space-x-1 p-0.5 bg-gray-100 dark:bg-deck-bg rounded-lg w-full">
        <button
          onclick={() => (appState.fileFilter = 'all')}
          class="flex-1 py-1 rounded-md transition-all duration-150 text-center font-medium {appState.fileFilter === 'all' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 shadow-xs font-semibold' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-200/60 dark:hover:bg-deck-card/70'}"
        >
          All ({stagedFiles.length + unstagedFiles.length})
        </button>
        <button
          onclick={() => (appState.fileFilter = 'staged')}
          class="flex-1 py-1 rounded-md transition-all duration-150 text-center font-medium {appState.fileFilter === 'staged' ? 'bg-white dark:bg-deck-card text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-200/60 dark:hover:bg-deck-card/70'}"
        >
          Staged ({stagedFiles.length})
        </button>
        <button
          onclick={() => (appState.fileFilter = 'unstaged')}
          class="flex-1 py-1 rounded-md transition-all duration-150 text-center font-medium {appState.fileFilter === 'unstaged' ? 'bg-white dark:bg-deck-card text-amber-600 dark:text-amber-400 shadow-xs font-semibold' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright hover:bg-gray-200/60 dark:hover:bg-deck-card/70'}"
        >
          Changes ({unstagedFiles.length})
        </button>
      </div>
    </div>

    <!-- File Extension Filter Chips (Module 3: ADV-DIFF) -->
    {#if appState.availableExtensions.length > 1}
      <div class="flex flex-wrap items-center gap-1 pt-1">
        <button
          type="button"
          onclick={() => (appState.fileExtensionFilter = 'all')}
          class="px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer {appState.fileExtensionFilter === 'all' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-200/70 dark:bg-deck-bg text-slate-600 dark:text-deck-muted hover:bg-slate-300 dark:hover:bg-deck-card border border-transparent dark:border-deck-border/40'}"
        >
          *.*
        </button>
        {#each appState.availableExtensions as ext}
          <button
            type="button"
            onclick={() => (appState.fileExtensionFilter = ext)}
            class="px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer {appState.fileExtensionFilter === ext ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-200/70 dark:bg-deck-bg text-slate-600 dark:text-deck-muted hover:bg-slate-300 dark:hover:bg-deck-card border border-transparent dark:border-deck-border/40'}"
          >
            {ext}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- File List Scroll Area -->
  <div class="flex-1 overflow-y-auto">
    <!-- 1. Staged Files Section -->
    {#if appState.fileFilter !== 'unstaged' && stagedFiles.length > 0}
      <div class="py-1">
        <div 
          class="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500 dark:text-deck-muted font-semibold tracking-wide uppercase hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer rounded mx-1 select-none"
          onclick={() => (stagedCollapsed = !stagedCollapsed)}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') stagedCollapsed = !stagedCollapsed;
          }}
        >
          <div class="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
            {#if stagedCollapsed}
              <ChevronRight class="w-3.5 h-3.5" />
            {:else}
              <ChevronDown class="w-3.5 h-3.5" />
            {/if}
            <span>Staged Changes ({stagedFiles.length})</span>
          </div>

          <button
            onclick={(e) => {
              e.stopPropagation();
              appState.unstageAll(stagedFiles);
            }}
            class="text-[10px] text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-500 normal-case lowercase transition font-mono cursor-pointer"
            title="Unstage all files in view"
          >
            unstage all
          </button>
        </div>

        {#if !stagedCollapsed}
          <div class="space-y-0.5 px-1">
            {#each stagedFiles as file}
              {@const badge = getStatusBadge(file.status)}
              {@const isSelected = appState.selectedFilePath === file.path && appState.selectedIsStaged === file.is_staged}
              <div
                class="group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 cursor-pointer {isSelected ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-950 dark:text-deck-bright font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-deck-text'}"
                onclick={() => selectFile(file)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectFile(file);
                }}
              >
                <!-- Active Indicator Pill on left -->
                {#if isSelected}
                  <span class="absolute -left-1 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                {/if}

                <div class="flex items-center space-x-2 min-w-0 flex-1 pr-2">
                  <span class="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 {badge.bg}">
                    {badge.label}
                  </span>
                  <div class="min-w-0 flex-1 truncate">
                    <span class="text-slate-900 dark:text-deck-bright font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{getFileName(file.path)}</span>
                    <span class="text-[10px] text-slate-500 dark:text-deck-muted ml-1 font-mono transition-colors group-hover:text-slate-600 dark:group-hover:text-deck-text">{getDirName(file.path)}</span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      appState.unstageFile(file.path);
                    }}
                    class="p-1 rounded text-slate-400 hover:text-amber-600 dark:text-deck-muted dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-all cursor-pointer"
                    title="Unstage file"
                  >
                    <Minus class="w-3 h-3" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- 2. Unstaged / Working Tree Changes Section -->
    {#if appState.fileFilter !== 'staged' && unstagedFiles.length > 0}
      <div class="py-1">
        <div 
          class="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500 dark:text-deck-muted font-semibold tracking-wide uppercase hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer rounded mx-1 select-none"
          onclick={() => (unstagedCollapsed = !unstagedCollapsed)}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') unstagedCollapsed = !unstagedCollapsed;
          }}
        >
          <div class="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400">
            {#if unstagedCollapsed}
              <ChevronRight class="w-3.5 h-3.5" />
            {:else}
              <ChevronDown class="w-3.5 h-3.5" />
            {/if}
            <span>Changes ({unstagedFiles.length})</span>
          </div>

          <button
            onclick={(e) => {
              e.stopPropagation();
              appState.stageAll(unstagedFiles);
            }}
            class="text-[10px] text-slate-400 hover:text-emerald-600 dark:text-deck-muted dark:hover:text-emerald-500 normal-case lowercase transition font-mono cursor-pointer"
            title="Stage all files in view"
          >
            stage all
          </button>
        </div>

        {#if !unstagedCollapsed}
          <div class="space-y-0.5 px-1">
            {#each unstagedFiles as file}
              {@const badge = getStatusBadge(file.status)}
              {@const isSelected = appState.selectedFilePath === file.path && appState.selectedIsStaged === file.is_staged}
              <div
                class="group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 cursor-pointer {isSelected ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-950 dark:text-deck-bright font-semibold shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-deck-text'}"
                onclick={() => selectFile(file)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectFile(file);
                }}
              >
                <!-- Active Indicator Pill on left -->
                {#if isSelected}
                  <span class="absolute -left-1 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                {/if}

                <div class="flex items-center space-x-2 min-w-0 flex-1 pr-2">
                  <span class="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 {badge.bg}">
                    {badge.label}
                  </span>
                  <div class="min-w-0 flex-1 truncate">
                    <span class="text-slate-900 dark:text-deck-bright font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{getFileName(file.path)}</span>
                    <span class="text-[10px] text-slate-500 dark:text-deck-muted ml-1 font-mono transition-colors group-hover:text-slate-600 dark:group-hover:text-deck-text">{getDirName(file.path)}</span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      appState.stageFile(file.path);
                    }}
                    class="p-1 rounded text-slate-400 hover:text-emerald-600 dark:text-deck-muted dark:hover:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-all cursor-pointer"
                    title="Stage file"
                  >
                    <Plus class="w-3 h-3" />
                  </button>
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      appState.confirmDiscardFile(file.path);
                    }}
                    class="p-1 rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-all cursor-pointer"
                    title="Discard changes in file"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Empty State -->
    {#if !appState.activeProject}
      <div class="p-6 text-center text-deck-muted space-y-3 mt-6 select-none">
        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
          <FolderGit2 class="w-6 h-6" />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold text-slate-800 dark:text-deck-bright">No project attached</p>
          <p class="text-[11px] text-slate-500 dark:text-deck-muted leading-relaxed max-w-[200px] mx-auto">
            Attach a local repository or folder to review changed files and stage hunks.
          </p>
        </div>
        <button
          onclick={() => appState.openFolderPicker()}
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium shadow-xs transition cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Attach Project</span>
        </button>
      </div>
    {:else if appState.files.length === 0}
      <div class="p-8 text-center text-deck-muted space-y-2 mt-8">
        <FileCode2 class="w-8 h-8 mx-auto text-slate-400 dark:text-deck-muted/50" />
        <p class="text-xs font-semibold text-slate-800 dark:text-deck-bright">Working Tree Clean</p>
        <p class="text-[11px] text-slate-500 dark:text-deck-muted/70">Agent file writes will automatically appear here in real-time.</p>
      </div>
    {/if}
  </div>
</div>
