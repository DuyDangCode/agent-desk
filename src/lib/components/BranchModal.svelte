<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    GitBranch, 
    Plus, 
    Archive, 
    Check, 
    Search, 
    X, 
    RefreshCw, 
    ArrowDownToLine, 
    ArrowUpFromLine, 
    Layers,
    Sparkles
  } from 'lucide-svelte';

  let activeTab: 'branches' | 'stashes' = $state('branches');
  let branchSearchQuery = $state('');
  let hideRemoteBranches = $state(true);
  let newBranchName = $state('');
  let stashMessage = $state('');
  let isSubmitting = $state(false);

  let filteredBranches = $derived.by(() => {
    let list = appState.branches;
    if (hideRemoteBranches) {
      list = list.filter((b) => !b.is_remote);
    }
    const q = branchSearchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q));
  });

  async function handleCreateBranch() {
    if (!newBranchName.trim() || isSubmitting) return;
    try {
      isSubmitting = true;
      await appState.createBranch(newBranchName);
      newBranchName = '';
      appState.branchModalOpen = false;
    } finally {
      isSubmitting = false;
    }
  }

  async function handleCheckout(branchName: string) {
    if (isSubmitting) return;
    const target = appState.branches.find((b) => b.name === branchName);
    if (target?.is_remote) return;
    try {
      isSubmitting = true;
      await appState.checkoutBranch(branchName);
      appState.branchModalOpen = false;
    } finally {
      isSubmitting = false;
    }
  }

  async function handleSaveStash() {
    if (isSubmitting) return;
    try {
      isSubmitting = true;
      await appState.stashSave(stashMessage.trim() || undefined);
      stashMessage = '';
    } finally {
      isSubmitting = false;
    }
  }

  async function handlePopStash() {
    if (isSubmitting) return;
    try {
      isSubmitting = true;
      await appState.stashPop();
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if appState.branchModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fade-in">
    <div class="bg-white dark:bg-deck-card border border-deck-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-deck-border bg-slate-50 dark:bg-deck-surface shrink-0">
        <div class="flex items-center space-x-2">
          <GitBranch class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">
            Git Branches & Stashes
          </h2>
          <span class="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
            {appState.repoInfo?.branch || (appState.activeProject ? 'HEAD' : 'No project attached')}
          </span>
        </div>
        <button
          onclick={() => (appState.branchModalOpen = false)}
          class="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright hover:bg-slate-200 dark:hover:bg-deck-card transition cursor-pointer"
          aria-label="Close branch modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center px-5 pt-3 border-b border-deck-border bg-slate-50 dark:bg-deck-surface shrink-0 gap-4">
        <button
          onclick={() => (activeTab = 'branches')}
          class="pb-2.5 text-xs font-medium border-b-2 transition flex items-center space-x-1.5 cursor-pointer {activeTab === 'branches' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-text'}"
        >
          <GitBranch class="w-3.5 h-3.5" />
          <span>Branches ({filteredBranches.length})</span>
        </button>
        <button
          onclick={() => (activeTab = 'stashes')}
          class="pb-2.5 text-xs font-medium border-b-2 transition flex items-center space-x-1.5 cursor-pointer {activeTab === 'stashes' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-text'}"
        >
          <Archive class="w-3.5 h-3.5" />
          <span>Stashes ({appState.stashes.length})</span>
        </button>
      </div>

      <!-- Tab Content: Branches -->
      {#if activeTab === 'branches'}
        <div class="p-5 flex flex-col flex-1 overflow-hidden space-y-4">
          <!-- Create Branch Form -->
          <div class="flex items-center space-x-2">
            <input
              type="text"
              bind:value={newBranchName}
              placeholder="New branch name (e.g. feat/multi-agent)"
              class="flex-1 bg-slate-100 dark:bg-deck-bg border border-deck-border rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              onkeydown={(e) => {
                if (e.key === 'Enter') handleCreateBranch();
              }}
            />
            <button
              onclick={handleCreateBranch}
              disabled={!newBranchName.trim() || isSubmitting}
              class="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>

          <!-- Search Filter & Hide Remote Option -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div class="relative flex-1">
              <Search class="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-deck-muted" />
              <input
                type="text"
                bind:value={branchSearchQuery}
                placeholder="Filter branches..."
                class="w-full bg-slate-100 dark:bg-deck-bg border border-deck-border rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <label class="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright cursor-pointer select-none shrink-0 px-1 py-1">
              <input
                type="checkbox"
                bind:checked={hideRemoteBranches}
                class="rounded border-deck-border text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 accent-blue-600 cursor-pointer"
              />
              <span>Hide remote branches</span>
            </label>
          </div>

          <!-- Branch List -->
          <div class="flex-1 overflow-y-auto space-y-1 pr-1 border border-deck-border rounded-lg p-2 bg-slate-50/50 dark:bg-deck-bg/40 max-h-60">
            {#if appState.isLoadingBranches}
              <div class="flex items-center justify-center py-6 text-xs text-slate-400 dark:text-deck-muted space-x-2">
                <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                <span>Loading repository branches...</span>
              </div>
            {:else if filteredBranches.length === 0}
              <div class="text-center py-6 text-xs text-slate-400 dark:text-deck-muted">
                No matching branches found
              </div>
            {:else}
              {#each filteredBranches as branch (branch.name)}
                <div
                  class="flex items-center justify-between px-3 py-2 rounded-md transition text-xs {branch.is_current ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 font-semibold' : 'hover:bg-slate-200/70 dark:hover:bg-deck-surface text-slate-700 dark:text-deck-text'}"
                >
                  <div class="flex items-center space-x-2 truncate">
                    <GitBranch class="w-3.5 h-3.5 shrink-0 {branch.is_current ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-deck-muted'}" />
                    <span class="font-mono truncate">{branch.name}</span>
                    {#if branch.commit_short}
                      <span class="text-[10px] font-mono text-slate-400 dark:text-deck-muted">[{branch.commit_short}]</span>
                    {/if}
                    {#if branch.is_remote}
                      <span class="text-[9px] px-1 rounded bg-slate-200 dark:bg-deck-surface text-slate-500 font-mono">remote</span>
                    {/if}
                  </div>

                  {#if branch.is_current}
                    <div class="flex items-center space-x-1.5 shrink-0">
                      <button
                        onclick={async () => {
                          await appState.pullChanges();
                        }}
                        disabled={appState.isPulling || appState.isPushing}
                        class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 text-[11px] font-medium transition cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                        title="Pull changes from remote (git pull)"
                      >
                        <ArrowDownToLine class="w-3 h-3 {appState.isPulling ? 'animate-bounce' : ''}" />
                        <span>{appState.isPulling ? 'Pulling...' : 'Pull'}</span>
                      </button>
                      <button
                        onclick={async () => {
                          await appState.pushChanges();
                        }}
                        disabled={appState.isPulling || appState.isPushing}
                        class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium transition cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                        title="Push commits to remote (git push)"
                      >
                        <ArrowUpFromLine class="w-3 h-3 {appState.isPushing ? 'animate-bounce' : ''}" />
                        <span>{appState.isPushing ? 'Pushing...' : 'Push'}</span>
                      </button>
                      <span class="flex items-center space-x-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold shrink-0 pl-1 border-l border-blue-200 dark:border-blue-800">
                        <Check class="w-3.5 h-3.5" />
                        <span>Current</span>
                      </span>
                    </div>
                  {:else if branch.is_remote}
                    <span
                      class="px-2 py-0.5 rounded bg-slate-200/60 dark:bg-deck-surface text-slate-500 dark:text-deck-muted text-[10px] font-mono shrink-0 select-none border border-deck-border/40"
                      title="Remote branches cannot be checked out directly. Create a local branch to checkout."
                    >
                      Remote only
                    </span>
                  {:else}
                    <button
                      onclick={() => handleCheckout(branch.name)}
                      disabled={isSubmitting}
                      class="px-2.5 py-1 rounded bg-slate-200 hover:bg-blue-600 hover:text-white dark:bg-deck-surface dark:hover:bg-blue-600 text-slate-700 dark:text-deck-text dark:hover:text-white text-[11px] font-medium transition cursor-pointer shrink-0"
                    >
                      Checkout
                    </button>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Tab Content: Stashes -->
      {#if activeTab === 'stashes'}
        <div class="p-5 flex flex-col flex-1 overflow-hidden space-y-4">
          <!-- Save Stash Form -->
          <div class="flex items-center space-x-2">
            <input
              type="text"
              bind:value={stashMessage}
              placeholder="Optional stash message..."
              class="flex-1 bg-slate-100 dark:bg-deck-bg border border-deck-border rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            <button
              onclick={handleSaveStash}
              disabled={isSubmitting}
              class="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
            >
              <ArrowDownToLine class="w-3.5 h-3.5" />
              <span>Stash Changes</span>
            </button>
          </div>

          <!-- Stash Actions & List -->
          <div class="flex items-center justify-between pt-2">
            <span class="text-xs font-medium text-slate-700 dark:text-deck-text">
              Saved Stashes ({appState.stashes.length})
            </span>
            {#if appState.stashes.length > 0}
              <button
                onclick={handlePopStash}
                disabled={isSubmitting}
                class="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition cursor-pointer"
              >
                <ArrowUpFromLine class="w-3.5 h-3.5" />
                <span>Pop Latest Stash</span>
              </button>
            {/if}
          </div>

          <div class="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-deck-border rounded-lg p-2 bg-slate-50/50 dark:bg-deck-bg/40 max-h-60">
            {#if appState.stashes.length === 0}
              <div class="text-center py-6 text-xs text-slate-400 dark:text-deck-muted">
                No git stashes currently recorded
              </div>
            {:else}
              {#each appState.stashes as stash (stash.index)}
                <div class="flex items-center justify-between px-3 py-2 rounded-md bg-white dark:bg-deck-surface border border-deck-border text-xs">
                  <div class="flex flex-col truncate pr-2">
                    <div class="flex items-center space-x-1.5 font-mono text-slate-900 dark:text-deck-bright font-medium truncate">
                      <Archive class="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span class="text-amber-600 dark:text-amber-400">stash@&#123;{stash.index}&#125;:</span>
                      <span class="truncate">{stash.message}</span>
                    </div>
                    <span class="text-[10px] font-mono text-slate-400 dark:text-deck-muted pl-5">
                      Commit: {stash.commit_short}
                    </span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-deck-border bg-slate-50 dark:bg-deck-surface flex justify-end shrink-0">
        <button
          onclick={() => (appState.branchModalOpen = false)}
          class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-deck-card dark:hover:bg-deck-surface text-slate-800 dark:text-deck-bright rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
