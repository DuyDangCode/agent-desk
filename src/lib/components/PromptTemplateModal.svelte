<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import { Sparkles, X, Check } from 'lucide-svelte';

  const AVAILABLE_TAGS = [
    '{{file}}',
    '{{lines}}',
    '{{code}}',
    '{{instructions}}',
    '{{project}}',
    '{{branch}}'
  ];
  const PLACEHOLDER_TEXT = 'Template markdown with {{file}}, {{lines}}, {{code}}, {{instructions}}...';

  let titleInputRef = $state<HTMLInputElement | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    if (appState.templateModalOpen) {
      setTimeout(() => {
        titleInputRef?.focus();
      }, 50);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && appState.templateModalOpen) {
      appState.closeTemplateModal();
    }
  }

  function insertTag(tag: string) {
    if (!textareaRef) {
      appState.templateFormBody += tag;
      return;
    }

    const start = textareaRef.selectionStart ?? appState.templateFormBody.length;
    const end = textareaRef.selectionEnd ?? appState.templateFormBody.length;
    const currentVal = appState.templateFormBody;

    // Insert tag at caret position or replace selected text
    const newVal = currentVal.substring(0, start) + tag + currentVal.substring(end);
    appState.templateFormBody = newVal;

    // Set cursor position right after the inserted tag and restore focus
    const nextCursorPos = start + tag.length;
    setTimeout(() => {
      textareaRef?.focus();
      textareaRef?.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 0);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.templateModalOpen}
  <div
    class="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans select-none"
    onclick={(e) => { if (e.target === e.currentTarget) appState.closeTemplateModal(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="h-14 bg-slate-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between px-6 py-3.5 shrink-0">
        <div class="flex items-center space-x-2.5 text-slate-900 dark:text-deck-bright font-bold text-sm">
          <div class="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/30">
            <Sparkles class="w-4 h-4" />
          </div>
          <span>{appState.editingTemplateId ? 'Edit Prompt Template' : 'Create New Prompt Template'}</span>
        </div>
        <button
          type="button"
          onclick={() => appState.closeTemplateModal()}
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
          title="Close dialog (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4.5 overflow-y-auto text-xs">
        <div>
          <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1.5" for="tmpl-title-input">
            Template Title <span class="text-rose-500">*</span>
          </label>
          <input
            id="tmpl-title-input"
            bind:this={titleInputRef}
            type="text"
            bind:value={appState.templateFormTitle}
            placeholder="e.g. Add TypeScript Types & JSDoc"
            class="w-full bg-slate-50 dark:bg-deck-bg border border-deck-border rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-deck-bright font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
          />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1.5" for="tmpl-desc-input">
            Description (Optional)
          </label>
          <input
            id="tmpl-desc-input"
            type="text"
            bind:value={appState.templateFormDesc}
            placeholder="e.g. Instructs agent to annotate arguments, types, and edge cases"
            class="w-full bg-slate-50 dark:bg-deck-bg border border-deck-border rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-deck-bright focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider" for="tmpl-body-input">
              Prompt Template Body <span class="text-rose-500">*</span>
            </label>
            <span class="text-[10px] text-slate-500 dark:text-deck-muted">Click tag to insert:</span>
          </div>

          <!-- Variable Tags Insertion Helper Bar -->
          <div class="flex flex-wrap gap-1.5 mb-2.5">
            {#each AVAILABLE_TAGS as tag}
              <button
                type="button"
                onclick={() => insertTag(tag)}
                class="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-[10px] transition cursor-pointer font-medium shadow-2xs"
                title={`Insert ${tag}`}
              >
                + {tag}
              </button>
            {/each}
          </div>

          <textarea
            id="tmpl-body-input"
            bind:this={textareaRef}
            bind:value={appState.templateFormBody}
            rows="8"
            placeholder={PLACEHOLDER_TEXT}
            class="w-full bg-slate-50 dark:bg-deck-bg border border-deck-border rounded-lg p-3.5 text-xs font-mono text-slate-900 dark:text-deck-bright focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y shadow-inner leading-relaxed"
          ></textarea>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="h-15 bg-slate-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-end px-6 py-3.5 space-x-2.5 shrink-0">
        <button
          type="button"
          onclick={() => appState.closeTemplateModal()}
          class="px-4 py-2 bg-slate-200 dark:bg-deck-surface hover:bg-slate-300 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded-lg text-xs font-medium cursor-pointer transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={() => appState.saveTemplateFromModal()}
          class="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition flex items-center space-x-1.5"
        >
          <Check class="w-3.5 h-3.5" />
          <span>{appState.editingTemplateId ? 'Save Changes' : 'Create Template'}</span>
        </button>
      </div>

    </div>
  </div>
{/if}
