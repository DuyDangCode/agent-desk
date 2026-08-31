<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import type { DiffHunk, DiffLine, FileDiff } from '$lib/types';
  import { 
    Plus, 
    Minus, 
    Trash2, 
    Columns, 
    AlignJustify, 
    Target, 
    Sparkles, 
    FileCode, 
    ArrowRight, 
    Check, 
    Copy,
    X,
    MessageSquareQuote,
    WrapText
  } from 'lucide-svelte';

  const file = $derived(appState.selectedFileDiff);

  // Multi-line selection state
  let selectedHunkIdx = $state<number | null>(null);
  let selectionStartLineIdx = $state<number | null>(null);
  let selectionEndLineIdx = $state<number | null>(null);
  let isDragging = $state(false);
  let lastClickedIdx = $state<number | null>(null);
  let selectedSide = $state<'unified' | 'split-left' | 'split-right'>('unified');

  // Computed range
  const minLineIdx = $derived(
    selectionStartLineIdx !== null && selectionEndLineIdx !== null
      ? Math.min(selectionStartLineIdx, selectionEndLineIdx)
      : null
  );

  const maxLineIdx = $derived(
    selectionStartLineIdx !== null && selectionEndLineIdx !== null
      ? Math.max(selectionStartLineIdx, selectionEndLineIdx)
      : null
  );

  const selectedLineCount = $derived(
    minLineIdx !== null && maxLineIdx !== null ? maxLineIdx - minLineIdx + 1 : 0
  );

  // Reset selection when changing files
  $effect(() => {
    if (appState.selectedFilePath) {
      clearSelection();
    }
  });

  function clearSelection() {
    selectedHunkIdx = null;
    selectionStartLineIdx = null;
    selectionEndLineIdx = null;
    lastClickedIdx = null;
    isDragging = false;
  }

  function handleLineMouseDown(
    hIdx: number,
    lIdx: number,
    e: MouseEvent,
    side: 'unified' | 'split-left' | 'split-right'
  ) {
    // If user clicked a button or interactive control, ignore
    if ((e.target as HTMLElement)?.closest('button')) {
      return;
    }

    if (e.shiftKey && selectedHunkIdx === hIdx && lastClickedIdx !== null) {
      // Shift + Click range selection
      selectionStartLineIdx = lastClickedIdx;
      selectionEndLineIdx = lIdx;
      selectedSide = side;
      isDragging = false;
    } else {
      // Normal click / start drag
      selectedHunkIdx = hIdx;
      selectionStartLineIdx = lIdx;
      selectionEndLineIdx = lIdx;
      lastClickedIdx = lIdx;
      selectedSide = side;
      isDragging = true;
    }
  }

  function handleLineMouseEnter(
    hIdx: number,
    lIdx: number,
    side: 'unified' | 'split-left' | 'split-right'
  ) {
    if (isDragging && selectedHunkIdx === hIdx && selectedSide === side) {
      selectionEndLineIdx = lIdx;
    }
  }

  function isLineSelected(
    hIdx: number,
    lIdx: number,
    side: 'unified' | 'split-left' | 'split-right'
  ): boolean {
    if (selectedHunkIdx !== hIdx || selectedSide !== side) return false;
    if (minLineIdx === null || maxLineIdx === null) return false;
    return lIdx >= minLineIdx && lIdx <= maxLineIdx;
  }

  function getSelectedSnippetInfo(): {
    startLine: number;
    endLine: number;
    snippet: string;
    count: number;
  } | null {
    if (!file || selectedHunkIdx === null || minLineIdx === null || maxLineIdx === null) {
      return null;
    }

    const hunk = file.hunks[selectedHunkIdx];
    if (!hunk) return null;

    if (selectedSide === 'unified') {
      const selectedLines = hunk.lines.slice(minLineIdx, maxLineIdx + 1);
      if (selectedLines.length === 0) return null;

      const firstLine = selectedLines[0];
      const lastLine = selectedLines[selectedLines.length - 1];
      const startLine = firstLine.new_lineno || firstLine.old_lineno || 1;
      const endLine = lastLine.new_lineno || lastLine.old_lineno || startLine;

      const snippet = selectedLines
        .map((l) => `${l.line_type === 'add' ? '+' : l.line_type === 'delete' ? '-' : ' '} ${l.content}`)
        .join('\n');

      return { startLine, endLine, snippet, count: selectedLines.length };
    } else {
      // Split view
      const rows = getSplitRows(hunk).slice(minLineIdx, maxLineIdx + 1);
      if (rows.length === 0) return null;

      const targetLines: DiffLine[] = [];
      for (const r of rows) {
        if (selectedSide === 'split-left' && r.left) {
          targetLines.push(r.left);
        } else if (selectedSide === 'split-right' && r.right) {
          targetLines.push(r.right);
        }
      }

      if (targetLines.length === 0) return null;

      const firstLine = targetLines[0];
      const lastLine = targetLines[targetLines.length - 1];
      const startLine = firstLine.new_lineno || firstLine.old_lineno || 1;
      const endLine = lastLine.new_lineno || lastLine.old_lineno || startLine;

      const snippet = targetLines
        .map((l) => `${l.line_type === 'add' ? '+' : l.line_type === 'delete' ? '-' : ' '} ${l.content}`)
        .join('\n');

      return { startLine, endLine, snippet, count: targetLines.length };
    }
  }

  function triggerSteerOnSelection() {
    const info = getSelectedSnippetInfo();
    if (info && file) {
      appState.openSteerOnLines(
        file.path,
        info.startLine,
        info.endLine,
        info.snippet,
        file.is_staged
      );
    }
  }

  function copySelectedSnippet() {
    const info = getSelectedSnippetInfo();
    if (info) {
      navigator.clipboard.writeText(info.snippet);
      appState.showToast(`Copied ${info.count} lines to clipboard`, 'success');
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'added': return 'Added';
      case 'deleted': return 'Deleted';
      case 'renamed': return 'Renamed';
      case 'untracked': return 'Untracked';
      case 'modified':
      default: return 'Modified';
    }
  }

  // Pre-process hunks for side-by-side (split) rendering
  function getSplitRows(hunk: DiffHunk) {
    const leftRows: (DiffLine | null)[] = [];
    const rightRows: (DiffLine | null)[] = [];

    let currentDeletes: DiffLine[] = [];
    let currentAdds: DiffLine[] = [];

    const flushBlock = () => {
      const maxLen = Math.max(currentDeletes.length, currentAdds.length);
      for (let i = 0; i < maxLen; i++) {
        leftRows.push(currentDeletes[i] || null);
        rightRows.push(currentAdds[i] || null);
      }
      currentDeletes = [];
      currentAdds = [];
    };

    for (const line of hunk.lines) {
      if (line.line_type === 'delete') {
        currentDeletes.push(line);
      } else if (line.line_type === 'add') {
        currentAdds.push(line);
      } else {
        flushBlock();
        leftRows.push(line);
        rightRows.push(line);
      }
    }
    flushBlock();

    return leftRows.map((left, idx) => ({
      left,
      right: rightRows[idx],
    }));
  }
</script>

<svelte:window 
  onmouseup={() => (isDragging = false)}
  onkeydown={(e) => {
    if (e.key === 'Escape' && selectedLineCount > 0) {
      clearSelection();
    }
  }}
/>

<div class="h-full flex flex-col bg-white dark:bg-deck-bg overflow-hidden relative select-text">
  {#if file}
    <!-- File Header Bar -->
    <div class="h-12 bg-white dark:bg-deck-surface border-b border-deck-border flex items-center justify-between px-4 shrink-0 select-none">
      <!-- File Path & Status -->
      <div class="flex items-center space-x-2.5 overflow-hidden">
        <FileCode class="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
        
        <span class="text-xs font-mono font-semibold text-slate-900 dark:text-deck-bright truncate">
          {file.path}
        </span>

        {#if file.old_path && file.old_path !== file.path}
          <span class="text-xs text-slate-500 dark:text-deck-muted flex items-center space-x-1 font-mono">
            <span>(from {file.old_path})</span>
          </span>
        {/if}

        <span class="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold {file.status === 'added' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-500/30' : file.status === 'deleted' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-500/30' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-500/30'}">
          {getStatusLabel(file.status)}
        </span>

        <div class="flex items-center space-x-1.5 text-xs font-mono">
          {#if file.additions > 0}
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold">+{file.additions}</span>
          {/if}
          {#if file.deletions > 0}
            <span class="text-rose-600 dark:text-rose-400 font-semibold">-{file.deletions}</span>
          {/if}
        </div>
      </div>

      <!-- Controls: Split/Unified Toggle & File Actions -->
      <div class="flex items-center space-x-2">
        <!-- View Mode Toggle -->
        <div class="flex items-center bg-gray-100 dark:bg-deck-card border border-deck-border rounded p-0.5 text-xs">
          <button
            onclick={() => {
              clearSelection();
              appState.setDiffViewMode('split');
            }}
            class="px-2 py-0.5 rounded flex items-center space-x-1 transition {appState.diffViewMode === 'split' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
            title="Side-by-Side (Split) View"
          >
            <Columns class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Split</span>
          </button>
          <button
            onclick={() => {
              clearSelection();
              appState.setDiffViewMode('unified');
            }}
            class="px-2 py-0.5 rounded flex items-center space-x-1 transition {appState.diffViewMode === 'unified' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
            title="Unified (Inline) View"
          >
            <AlignJustify class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Unified</span>
          </button>
        </div>

        <!-- Line Wrap Toggle -->
        <button
          onclick={() => appState.toggleWrapLines()}
          class="px-2 py-1 rounded flex items-center space-x-1 text-xs border transition cursor-pointer {appState.wrapLines ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/40 font-medium' : 'bg-gray-100 dark:bg-deck-card text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright border-deck-border'}"
          title={appState.wrapLines ? "Line wrapping is ON (click to disable wrapping and scroll horizontally, or press Alt+Z)" : "Line wrapping is OFF (click to wrap long lines, or press Alt+Z)"}
        >
          <WrapText class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{appState.wrapLines ? 'Wrap' : 'No Wrap'}</span>
        </button>

        <!-- Stage/Unstage File Button -->
        {#if file.is_staged}
          <button
            onclick={() => appState.unstageFile(file.path)}
            class="px-2.5 py-1 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-amber-600 dark:text-amber-400 text-xs rounded border border-deck-border transition flex items-center space-x-1"
            title="Unstage this file"
          >
            <Minus class="w-3.5 h-3.5" />
            <span>Unstage File</span>
          </button>
        {:else}
          <button
            onclick={() => appState.stageFile(file.path)}
            class="px-2.5 py-1 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-emerald-600 dark:text-emerald-400 text-xs rounded border border-deck-border transition flex items-center space-x-1"
            title="Stage this file"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Stage File</span>
          </button>
          
          <button
            onclick={() => appState.confirmDiscardFile(file.path)}
            class="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 border border-transparent hover:border-rose-300 dark:hover:border-rose-500/30 transition"
            title="Discard all changes in this file"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Multi-line Selection Hint Bar (Subtle) -->
    <div class="bg-gray-50 dark:bg-deck-card border-b border-deck-border px-4 py-1 flex items-center justify-between text-[11px] text-slate-600 dark:text-deck-muted select-none">
      <div class="flex items-center space-x-2">
        <MessageSquareQuote class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
        <span>Click & drag across lines, or hold <kbd class="px-1 py-0.2 bg-gray-100 dark:bg-deck-card border border-deck-border rounded font-mono text-[10px] text-slate-900 dark:text-deck-bright font-semibold">Shift</kbd> + click to select multi-line blocks for Steering.</span>
      </div>
      {#if selectedLineCount > 0}
        <button
          onclick={clearSelection}
          class="text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright underline text-[10px]"
        >
          Clear Selection (Esc)
        </button>
      {/if}
    </div>

    <!-- Diff Content Canvas -->
    <div class="flex-1 overflow-auto font-mono text-xs p-3 space-y-4 pb-20">
      {#if file.hunks.length === 0}
        <div class="p-8 text-center text-deck-muted space-y-2 border border-deck-border rounded-lg bg-gray-50 dark:bg-deck-card">
          <FileCode class="w-8 h-8 mx-auto text-deck-muted/40" />
          <p class="text-xs font-semibold text-deck-bright">No Diff Hunks Available</p>
          <p class="text-[11px] text-deck-muted">This file is either empty, binary, or unmodified.</p>
        </div>
      {:else}
        {#each file.hunks as hunk, hIdx}
            <div class="border border-slate-200 dark:border-[#30363d] rounded-lg overflow-hidden bg-white dark:bg-deck-card shadow-sm">
            <!-- Hunk Header & Action Bar -->
            <div class="bg-gray-50 dark:bg-deck-surface border-b border-slate-200 dark:border-[#30363d] px-3 py-1.5 flex items-center justify-between select-none">
              <span class="text-slate-600 dark:text-deck-muted text-[11px] font-mono font-medium">
                {hunk.header}
              </span>

              <div class="flex items-center space-x-1.5">
                <!-- Steer on Hunk -->
                <button
                  onclick={() => appState.openSteerOnHunk(file.path, hunk, file.is_staged)}
                  class="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-500/30 text-[11px] flex items-center space-x-1 transition cursor-pointer"
                  title="Inject feedback for this entire hunk into terminal agent"
                >
                  <Target class="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>Steer Hunk</span>
                </button>

                <!-- Stage/Unstage Hunk -->
                {#if file.is_staged}
                  <button
                    onclick={() => appState.unstageHunk(file.path, hunk.hunk_index)}
                    class="px-2 py-0.5 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded border border-deck-border text-[11px] flex items-center space-x-1 transition cursor-pointer"
                    title="Unstage this hunk from Git index"
                  >
                    <Minus class="w-3 h-3" />
                    <span>Unstage Hunk</span>
                  </button>
                {:else}
                  <button
                    onclick={() => appState.stageHunk(file.path, hunk.hunk_index)}
                    class="px-2 py-0.5 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-emerald-700 dark:text-emerald-400 rounded border border-deck-border text-[11px] flex items-center space-x-1 transition cursor-pointer"
                    title="Stage this hunk into Git index"
                  >
                    <Plus class="w-3 h-3" />
                    <span>Stage Hunk</span>
                  </button>

                  <button
                    onclick={() => appState.confirmDiscardHunk(file.path, hunk.hunk_index)}
                    class="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded text-slate-400 dark:text-deck-muted hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                    title="Discard changes in this hunk"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                {/if}
              </div>
            </div>

            <!-- 1. UNIFIED (INLINE) DIFF VIEW -->
            {#if appState.diffViewMode === 'unified'}
              <div class="divide-y divide-slate-200/60 dark:divide-[#21262d] overflow-x-auto select-none">
                {#each hunk.lines as line, lIdx}
                  {@const isAdd = line.line_type === 'add'}
                  {@const isDel = line.line_type === 'delete'}
                  {@const isSelected = isLineSelected(hIdx, lIdx, 'unified')}
                  <div
                    class="group flex items-start leading-5 transition-colors cursor-pointer min-w-full w-fit {isSelected ? 'bg-blue-500/20 border-l-4 border-blue-500 text-slate-900 dark:text-deck-bright font-medium ring-1 ring-inset ring-blue-500/30' : isAdd ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50' : isDel ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-950/50' : 'text-slate-800 dark:text-deck-text hover:bg-gray-100 dark:hover:bg-deck-card/50'}"
                    onmousedown={(e) => handleLineMouseDown(hIdx, lIdx, e, 'unified')}
                    onmouseenter={() => handleLineMouseEnter(hIdx, lIdx, 'unified')}
                    role="row"
                    tabindex="0"
                  >
                    <!-- Old Line No -->
                    <div class="w-10 text-right pr-2 select-none text-[10px] shrink-0 font-mono py-0.5 {isSelected ? 'text-blue-600 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 dark:text-deck-muted/70'}">
                      {line.old_lineno ?? ''}
                    </div>

                    <!-- New Line No -->
                    <div class="w-10 text-right pr-2 select-none text-[10px] shrink-0 font-mono py-0.5 {isSelected ? 'text-blue-600 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 dark:text-deck-muted/70'}">
                      {line.new_lineno ?? ''}
                    </div>

                    <!-- Origin Marker (+/-) -->
                    <div class="w-5 text-center select-none font-bold shrink-0 py-0.5 {isAdd ? 'text-emerald-600 dark:text-emerald-400' : isDel ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-deck-muted/40'}">
                      {isAdd ? '+' : isDel ? '-' : ' '}
                    </div>

                    <!-- Line Content (with Intra-Line Token Highlighting) -->
                    <div class="flex-1 min-w-0 pr-4 py-0.5 font-mono select-text {appState.wrapLines ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]' : 'whitespace-pre'} {isAdd ? 'text-emerald-950 dark:text-emerald-200 font-medium' : isDel ? 'text-rose-950 dark:text-rose-200 font-medium' : 'text-slate-900 dark:text-deck-text'}">
                      {#if line.tokens && line.tokens.length > 0}
                        {#each line.tokens as token}
                          {#if token.is_highlighted}
                            <span class="rounded-xs px-0.5 font-bold {isAdd ? 'bg-emerald-300/80 dark:bg-emerald-700/80 text-emerald-950 dark:text-white ring-1 ring-emerald-500/50' : 'bg-rose-300/80 dark:bg-rose-700/80 text-rose-950 dark:text-white ring-1 ring-rose-500/50'}">
                              {token.content}
                            </span>
                          {:else}
                            <span>{token.content}</span>
                          {/if}
                        {/each}
                      {:else}
                        {line.content}
                      {/if}
                    </div>

                    <!-- Single-line Steer Button (Hover) -->
                    <div class="opacity-0 group-hover:opacity-100 transition px-2 py-0.5 shrink-0 select-none {appState.wrapLines ? '' : 'sticky right-0'}">
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          appState.openSteerOnLine(file.path, line.new_lineno || line.old_lineno || 1, line.content, file.is_staged);
                        }}
                        class="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] flex items-center space-x-1 shadow cursor-pointer"
                        title="Steer agent on this line"
                      >
                        <Target class="w-2.5 h-2.5" />
                        <span>Steer</span>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>

            <!-- 2. SIDE-BY-SIDE (SPLIT) DIFF VIEW -->
            {:else}
              {@const splitRows = getSplitRows(hunk)}
              <div class="overflow-x-auto select-none">
                <table class="w-full border-collapse {appState.wrapLines ? 'table-fixed' : 'table-fixed min-w-[700px]'}">
                  <colgroup>
                    <col class="w-1/2" />
                    <col class="w-1/2" />
                  </colgroup>
                  <tbody>
                    {#each splitRows as row, rIdx}
                      {@const isLeftSelected = isLineSelected(hIdx, rIdx, 'split-left')}
                      {@const isRightSelected = isLineSelected(hIdx, rIdx, 'split-right')}
                      <tr class="leading-5 border-b border-slate-200/60 dark:border-[#21262d]">
                        <!-- Left (Old / Deletion) Column -->
                        <td 
                          class="w-1/2 align-top p-0 {isLeftSelected ? 'bg-blue-500/20 border-l-4 border-blue-500 text-slate-900 dark:text-deck-bright ring-1 ring-inset ring-blue-500/30' : row.left?.line_type === 'delete' ? 'bg-rose-50 dark:bg-rose-950/35 text-rose-950 dark:text-rose-200' : 'text-slate-800 dark:text-deck-text hover:bg-gray-100 dark:hover:bg-deck-card/30'} border-r border-slate-200/60 dark:border-[#21262d] cursor-pointer"
                          onmousedown={(e) => row.left && handleLineMouseDown(hIdx, rIdx, e, 'split-left')}
                          onmouseenter={() => row.left && handleLineMouseEnter(hIdx, rIdx, 'split-left')}
                        >
                          {#if row.left}
                            <div class="group flex items-start w-full">
                              <span class="w-9 text-right pr-2 select-none text-[10px] shrink-0 font-mono py-0.5 {isLeftSelected ? 'text-blue-600 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 dark:text-deck-muted/70 bg-gray-50 dark:bg-deck-surface'}">
                                {row.left.old_lineno ?? ''}
                              </span>
                              <span class="w-4 text-center select-none font-bold shrink-0 py-0.5 text-rose-600 dark:text-rose-400">
                                {row.left.line_type === 'delete' ? '-' : ' '}
                              </span>
                              <span class="flex-1 min-w-0 pr-2 py-0.5 font-mono select-text {appState.wrapLines ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]' : 'whitespace-pre overflow-x-auto'} {row.left.line_type === 'delete' ? 'text-rose-950 dark:text-rose-200 font-medium' : 'text-slate-900 dark:text-deck-text'}">
                                {#if row.left.tokens && row.left.tokens.length > 0}
                                  {#each row.left.tokens as token}
                                    {#if token.is_highlighted}
                                      <span class="bg-rose-300/80 dark:bg-rose-700/80 text-rose-950 dark:text-white rounded-xs px-0.5 font-bold ring-1 ring-rose-500/50">
                                        {token.content}
                                      </span>
                                    {:else}
                                      <span>{token.content}</span>
                                    {/if}
                                  {/each}
                                {:else}
                                  {row.left.content}
                                {/if}
                              </span>
                              <div class="opacity-0 group-hover:opacity-100 transition px-1 py-0.5 shrink-0 select-none">
                                <button
                                  onclick={(e) => {
                                    e.stopPropagation();
                                    appState.openSteerOnLine(file.path, row.left?.old_lineno || 1, row.left?.content || '', file.is_staged);
                                  }}
                                  class="px-1 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] flex items-center space-x-0.5 cursor-pointer"
                                  title="Steer agent on this deleted line"
                                >
                                  <Target class="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          {/if}
                        </td>

                        <!-- Right (New / Addition) Column -->
                        <td 
                          class="w-1/2 align-top p-0 {isRightSelected ? 'bg-blue-500/20 border-l-4 border-blue-500 text-slate-900 dark:text-deck-bright ring-1 ring-inset ring-blue-500/30' : row.right?.line_type === 'add' ? 'bg-emerald-50 dark:bg-emerald-950/35 text-emerald-950 dark:text-emerald-200' : 'text-slate-800 dark:text-deck-text hover:bg-gray-100 dark:hover:bg-deck-card/30'} cursor-pointer"
                          onmousedown={(e) => row.right && handleLineMouseDown(hIdx, rIdx, e, 'split-right')}
                          onmouseenter={() => row.right && handleLineMouseEnter(hIdx, rIdx, 'split-right')}
                        >
                          {#if row.right}
                            <div class="group flex items-start w-full">
                              <span class="w-9 text-right pr-2 select-none text-[10px] shrink-0 font-mono py-0.5 {isRightSelected ? 'text-blue-600 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 dark:text-deck-muted/70 bg-gray-50 dark:bg-deck-surface'}">
                                {row.right.new_lineno ?? ''}
                              </span>
                              <span class="w-4 text-center select-none font-bold shrink-0 py-0.5 text-emerald-600 dark:text-emerald-400">
                                {row.right.line_type === 'add' ? '+' : ' '}
                              </span>
                              <span class="flex-1 min-w-0 pr-2 py-0.5 font-mono select-text {appState.wrapLines ? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]' : 'whitespace-pre overflow-x-auto'} {row.right.line_type === 'add' ? 'text-emerald-950 dark:text-emerald-200 font-medium' : 'text-slate-900 dark:text-deck-text'}">
                                {#if row.right.tokens && row.right.tokens.length > 0}
                                  {#each row.right.tokens as token}
                                    {#if token.is_highlighted}
                                      <span class="bg-emerald-300/80 dark:bg-emerald-700/80 text-emerald-950 dark:text-white rounded-xs px-0.5 font-bold ring-1 ring-emerald-500/50">
                                        {token.content}
                                      </span>
                                    {:else}
                                      <span>{token.content}</span>
                                    {/if}
                                  {/each}
                                {:else}
                                  {row.right.content}
                                {/if}
                              </span>
                              <div class="opacity-0 group-hover:opacity-100 transition px-1 py-0.5 shrink-0 select-none">
                                <button
                                  onclick={(e) => {
                                    e.stopPropagation();
                                    appState.openSteerOnLine(file.path, row.right?.new_lineno || 1, row.right?.content || '', file.is_staged);
                                  }}
                                  class="px-1 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] flex items-center space-x-0.5 cursor-pointer"
                                  title="Steer agent on this line"
                                >
                                  <Target class="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Floating Multi-line Steer Action Bar -->
    {#if selectedLineCount > 0}
      {@const snippetInfo = getSelectedSnippetInfo()}
      {#if snippetInfo}
        <div class="absolute bottom-6 right-8 z-30 bg-white dark:bg-deck-surface border border-blue-500 shadow-2xl rounded-xl p-2.5 flex items-center space-x-3 animate-in slide-in-from-bottom-3 duration-150 select-none">
          <div class="flex items-center space-x-2 text-xs font-mono">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="text-slate-900 dark:text-deck-bright font-semibold">{snippetInfo.count} {snippetInfo.count === 1 ? 'line' : 'lines'} selected</span>
            <span class="text-slate-500 dark:text-deck-muted">(L{snippetInfo.startLine} - L{snippetInfo.endLine})</span>
          </div>

          <div class="h-4 w-px bg-deck-border"></div>

          <!-- Steer Selected Lines Button -->
          <button
            onclick={triggerSteerOnSelection}
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-lg shadow-blue-500/25 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            title="Inject feedback for selected lines directly into agent terminal"
          >
            <Target class="w-3.5 h-3.5" />
            <span>Steer Selection ({snippetInfo.count})</span>
          </button>

          <!-- Copy Snippet Button -->
          <button
            onclick={copySelectedSnippet}
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-deck-card text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright rounded-lg border border-deck-border transition cursor-pointer"
            title="Copy selected snippet to clipboard"
          >
            <Copy class="w-3.5 h-3.5" />
          </button>

          <!-- Clear Selection Button -->
          <button
            onclick={clearSelection}
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-deck-card text-slate-500 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 rounded-lg transition cursor-pointer"
            title="Clear line selection (Esc)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}
    {/if}
  {:else}
    <!-- No File Selected Empty State -->
    <div class="h-full flex flex-col items-center justify-center text-slate-500 dark:text-deck-muted p-8 text-center space-y-3">
      <FileCode class="w-12 h-12 text-slate-400 dark:text-deck-muted/40" />
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">No Modified File Selected</h3>
        <p class="text-xs max-w-sm text-slate-500 dark:text-deck-muted">
          Select a changed file from the left sidebar to inspect live diffs, stage hunks, or inject steering feedback to your CLI agent.
        </p>
      </div>
    </div>
  {/if}
</div>
