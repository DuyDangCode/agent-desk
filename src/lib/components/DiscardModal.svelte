<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { AlertTriangle, X, Trash2 } from 'lucide-svelte';

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      appState.discardModalOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.discardModalOpen && appState.discardTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="h-12 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-500/30 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
          <AlertTriangle class="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Confirm Discard Changes</span>
        </div>
        <button
          onclick={() => (appState.discardModalOpen = false)}
          class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-rose-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-3 text-xs">
        <p class="text-slate-800 dark:text-deck-text leading-relaxed">
          Are you sure you want to discard
          {#if appState.discardTarget.isHunk && appState.discardTarget.hunkIndex !== undefined}
            <b class="text-slate-950 dark:text-deck-bright">Hunk #{appState.discardTarget.hunkIndex + 1}</b> in
          {:else}
            all changes in
          {/if}
          <span class="font-mono text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-deck-card px-1 py-0.5 rounded break-all font-medium border border-amber-200 dark:border-deck-border">
            {appState.discardTarget.path}
          </span>?
        </p>

        <div class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg p-3 text-[11px] text-rose-800 dark:text-rose-300">
          <b>Warning:</b> This action cannot be undone. Any uncommitted agent modifications in this scope will be permanently reverted.
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="h-14 bg-gray-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-end space-x-2 px-5 shrink-0">
        <button
          onclick={() => (appState.discardModalOpen = false)}
          class="px-3 py-1.5 bg-white dark:bg-deck-surface hover:bg-gray-100 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded-md text-xs border border-deck-border transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onclick={() => appState.executeDiscard()}
          class="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs rounded-md shadow flex items-center space-x-1.5 transition cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Discard Changes</span>
        </button>
      </div>
    </div>
  </div>
{/if}
