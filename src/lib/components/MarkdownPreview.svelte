<script lang="ts">
  import type { DiffHunk } from '$lib/types';
  import { renderMarkdownToHtml, renderDiffMarkdownToHtml } from '$lib/utils/markdown';
  import { 
    BookOpen, 
    GitCompare, 
    Copy, 
    Check, 
    Code, 
    Sparkles,
    FileText
  } from 'lucide-svelte';

  interface Props {
    content: string;
    hunks?: DiffHunk[];
    renderType?: 'document' | 'diff';
    onRenderTypeChange?: (type: 'document' | 'diff') => void;
    filePath?: string;
  }

  let {
    content = '',
    hunks = [],
    renderType = 'document',
    onRenderTypeChange,
    filePath = ''
  }: Props = $props();

  let copied = $state(false);
  let showRaw = $state(false);

  const documentHtml = $derived(renderMarkdownToHtml(content));
  const diffHtml = $derived(renderDiffMarkdownToHtml(hunks));

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {}
  }
</script>

<div class="flex-1 flex flex-col h-full bg-white dark:bg-deck-bg overflow-hidden select-text">
  <!-- Sub-toolbar: Document vs Diff & Controls -->
  <div class="h-9 px-4 bg-gray-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between text-xs shrink-0 select-none">
    <!-- View Switcher: Document vs Visual Diff -->
    <div class="flex items-center space-x-1">
      <div class="flex items-center bg-gray-200/80 dark:bg-deck-surface border border-deck-border rounded p-0.5 text-xs">
        <button
          onclick={() => {
            showRaw = false;
            onRenderTypeChange?.('document');
          }}
          class="px-2 py-0.5 rounded flex items-center space-x-1.5 transition cursor-pointer {renderType === 'document' && !showRaw ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
          title="Render clean full document"
        >
          <BookOpen class="w-3.5 h-3.5" />
          <span>Rendered Document</span>
        </button>

        <button
          onclick={() => {
            showRaw = false;
            onRenderTypeChange?.('diff');
          }}
          class="px-2 py-0.5 rounded flex items-center space-x-1.5 transition cursor-pointer {renderType === 'diff' && !showRaw ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright'}"
          title="Render visual markdown diff (additions highlighted in green, deletions in red)"
        >
          <GitCompare class="w-3.5 h-3.5" />
          <span>Rendered Diff</span>
        </button>
      </div>

      <!-- Raw Markdown Toggle -->
      <button
        onclick={() => (showRaw = !showRaw)}
        class="ml-2 px-2 py-1 rounded flex items-center space-x-1 text-xs border transition cursor-pointer {showRaw ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/40 font-medium' : 'bg-white dark:bg-deck-surface text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright border-deck-border'}"
        title="Toggle raw markdown text"
      >
        <Code class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{showRaw ? 'Rendered' : 'Raw Text'}</span>
      </button>
    </div>

    <!-- Right Controls: Copy & Metadata -->
    <div class="flex items-center space-x-2">
      {#if content}
        <span class="text-[10px] text-slate-400 dark:text-deck-muted font-mono hidden md:inline">
          {content.split('\n').length} lines
        </span>

        <button
          onclick={copyMarkdown}
          class="px-2 py-1 rounded bg-white dark:bg-deck-surface hover:bg-gray-100 dark:hover:bg-deck-border border border-deck-border text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright transition cursor-pointer flex items-center space-x-1"
          title="Copy markdown content to clipboard"
        >
          {#if copied}
            <Check class="w-3 h-3 text-emerald-500" />
            <span class="text-emerald-500 font-medium">Copied</span>
          {:else}
            <Copy class="w-3 h-3" />
            <span>Copy</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Main Scrollable Markdown Content -->
  <div class="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
    <div class="max-w-4xl mx-auto">
      {#if showRaw}
        <!-- Raw Markdown Source -->
        <pre class="p-4 rounded-lg bg-gray-50 dark:bg-deck-surface border border-deck-border font-mono text-xs text-slate-800 dark:text-deck-text whitespace-pre-wrap break-words leading-relaxed">{content || 'No content'}</pre>
      {:else if renderType === 'diff'}
        <!-- Visual Diff Markdown View -->
        <div class="space-y-4">
          <div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-300 flex items-center space-x-2 select-none">
            <Sparkles class="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400" />
            <span>Showing visual diff for Markdown: green blocks indicate added content, red struck-through blocks indicate removed content.</span>
          </div>

          <div class="markdown-body font-sans text-sm text-slate-900 dark:text-deck-text leading-relaxed">
            {@html diffHtml}
          </div>
        </div>
      {:else}
        <!-- Rendered Full Document View -->
        {#if !content && (!hunks || hunks.length === 0)}
          <div class="py-12 flex flex-col items-center justify-center text-center text-slate-400 dark:text-deck-muted space-y-2 select-none">
            <FileText class="w-10 h-10 stroke-1" />
            <p class="text-xs font-semibold">Markdown Document is Empty</p>
          </div>
        {:else}
          <div class="markdown-body font-sans text-sm text-slate-900 dark:text-deck-text leading-relaxed">
            {@html documentHtml}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.markdown-body a) {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  :global(.markdown-body table) {
    border-collapse: collapse;
    width: 100%;
    min-width: 100%;
  }
  :global(.markdown-body th),
  :global(.markdown-body td) {
    vertical-align: middle;
  }
  :global(.markdown-body .overflow-x-auto) {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }
</style>
