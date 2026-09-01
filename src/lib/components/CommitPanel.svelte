<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    Layers, 
    X, 
    GitCommit, 
    Check, 
    FileCheck, 
    CornerDownLeft,
    Sparkles,
    RefreshCw,
    History
  } from 'lucide-svelte';

  const stagedFiles = $derived(appState.files.filter((f) => f.is_staged));

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (appState.commitMessage.trim() && stagedFiles.length > 0 && !appState.isCommitting) {
        appState.commitChanges();
      }
    } else if (e.key === 'Escape') {
      appState.commitPanelOpen = false;
    }
  }

  const commitTags = [
    'feat:',
    'fix:',
    'refactor:',
    'test:',
    'docs:',
    'style:',
    'perf:',
    'chore:'
  ];

  function insertTag(tag: string) {
    if (!appState.commitMessage.startsWith(tag)) {
      appState.commitMessage = `${tag} ${appState.commitMessage.replace(/^[a-z]+:\s*/i, '')}`.trim();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.commitPanelOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans select-none">
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="h-12 bg-gray-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between px-5 shrink-0">
        <div class="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
          <GitCommit class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Commit Staged Changes (Smart Release Gate)</span>
        </div>
        <button
          onclick={() => (appState.commitPanelOpen = false)}
          class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-gray-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
          aria-label="Close commit modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 overflow-y-auto space-y-4 text-xs select-text">
        <!-- Staged Files Summary -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider">
              Staged Files to Commit ({stagedFiles.length}):
            </span>
            <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
              Branch: {appState.repoInfo?.branch || (appState.activeProject ? 'HEAD' : 'No project attached')}
            </span>
          </div>

          <div class="bg-gray-50 dark:bg-deck-bg rounded-lg border border-deck-border p-2 max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
            {#if stagedFiles.length === 0}
              <div class="text-slate-500 dark:text-deck-muted p-2 text-center">
                No files staged. Stage files or hunks first before committing.
              </div>
            {:else}
              {#each stagedFiles as file}
                <div class="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-deck-surface/60 border border-deck-border/40">
                  <div class="flex items-center space-x-2 truncate">
                    <FileCheck class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span class="text-slate-900 dark:text-deck-bright font-medium truncate">{file.path}</span>
                  </div>
                  <div class="flex items-center space-x-1 shrink-0 text-[10px]">
                    <span class="text-emerald-600 dark:text-emerald-400 font-semibold">+{file.additions}</span>
                    <span class="text-rose-600 dark:text-rose-400 font-semibold">-{file.deletions}</span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- AI Synthesis & Quick Tags -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider" for="commit-input">
              Commit Message:
            </label>

            <!-- 1-Click AI Synthesis Button (Module 5) -->
            <button
              type="button"
              onclick={() => appState.generateCommitMessageAI()}
              disabled={stagedFiles.length === 0 || appState.isGeneratingCommit}
              class="flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-md text-xs font-medium shadow transition cursor-pointer disabled:opacity-50"
              title="Synthesize conventional commit message from staged changes"
            >
              {#if appState.isGeneratingCommit}
                <RefreshCw class="w-3 h-3 animate-spin" />
                <span>Synthesizing...</span>
              {:else}
                <Sparkles class="w-3 h-3" />
                <span>✨ Generate Commit (AI)</span>
              {/if}
            </button>
          </div>

          <!-- Quick Tag Chips -->
          <div class="flex flex-wrap gap-1">
            {#each commitTags as tag}
              <button
                type="button"
                onclick={() => insertTag(tag)}
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-deck-card dark:hover:bg-deck-border text-slate-700 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright border border-deck-border transition cursor-pointer"
              >
                {tag}
              </button>
            {/each}
          </div>

          <textarea
            id="commit-input"
            bind:value={appState.commitMessage}
            placeholder="feat: implement feature with verified agent review"
            rows="3"
            class="w-full bg-gray-50 dark:bg-deck-bg border border-deck-border rounded-lg p-3 text-xs text-slate-900 dark:text-deck-bright placeholder-slate-400 dark:placeholder-deck-muted focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none font-mono shadow-inner"
            autofocus
          ></textarea>

          <!-- Amend Checkbox (Module 5) -->
          <div class="flex items-center space-x-2 pt-1">
            <label class="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 dark:text-deck-text">
              <input
                type="checkbox"
                bind:checked={appState.isAmendMode}
                class="rounded border-deck-border text-emerald-600 focus:ring-emerald-500"
              />
              <span class="flex items-center space-x-1 font-medium">
                <History class="w-3.5 h-3.5 text-amber-500" />
                <span>Amend previous commit (replaces HEAD commit)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="h-14 bg-gray-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-between px-5 shrink-0 select-none">
        <span class="text-[11px] text-slate-500 dark:text-deck-muted flex items-center space-x-1">
          <CornerDownLeft class="w-3 h-3" />
          <span>Press <b>Ctrl+Enter</b> to commit</span>
        </span>

        <div class="flex items-center space-x-2">
          <button
            onclick={() => (appState.commitPanelOpen = false)}
            class="px-3 py-1.5 bg-white dark:bg-deck-surface hover:bg-gray-100 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded-md text-xs border border-deck-border transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onclick={() => appState.commitChanges()}
            disabled={!appState.commitMessage.trim() || stagedFiles.length === 0 || appState.isCommitting}
            class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs rounded-md shadow flex items-center space-x-1.5 transition cursor-pointer"
          >
            <GitCommit class="w-3.5 h-3.5" />
            <span>{appState.isCommitting ? 'Committing...' : appState.isAmendMode ? 'Amend Commit' : 'Commit Staged Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
