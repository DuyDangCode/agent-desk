<script lang="ts">
  import { appState } from '$lib/stores/appState.svelte';
  import type { AgentKind } from '$lib/types';
  import { 
    Target, 
    X, 
    Send, 
    CornerDownLeft, 
    Sparkles, 
    FileCode, 
    AlertCircle, 
    Bot, 
    Terminal as TerminalIcon,
    Rocket,
    CheckCircle2,
    Layers,
    FileEdit,
    Eye
  } from 'lucide-svelte';

  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let allowShellOverride = $state(false);
  let activeTab: 'form' | 'preview' = $state('form');

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if ((hasAgentTarget || allowShellOverride)) {
        appState.injectSteerFeedback();
      }
    } else if (e.key === 'Escape') {
      appState.steerModalOpen = false;
    }
  }

  interface SteerPreset {
    label: string;
    text: string;
    templateId?: string;
  }

  // Pre-configured quick steering presets
  const presets: SteerPreset[] = [
    {
      label: '🔍 Explain function & removal impact',
      text: 'Explain the role of this code, why it was written this way, and what breaks if removed',
      templateId: 'default-explain-code'
    },
    {
      label: '⚡ Refactor & clean',
      text: 'Refactor to eliminate duplicate logic and improve readability',
      templateId: 'default-refactor'
    },
    {
      label: '🧪 Add unit tests',
      text: 'Add unit tests covering edge cases, assertions, and mock boundaries',
      templateId: 'default-unit-test'
    },
    {
      label: '🐛 Fix bug & validation',
      text: 'Fix logic error, null dereference, and add runtime validation',
      templateId: 'default-fix-bug'
    },
    {
      label: '🚀 Optimize performance',
      text: 'Optimize memory allocations and algorithmic complexity',
      templateId: 'default-optimize'
    },
    {
      label: '🛡️ Security hardening',
      text: 'Harden against security vulnerabilities, race conditions, and unhandled errors',
      templateId: 'default-security'
    },
    {
      label: '↩️ Revert regression',
      text: 'Revert this change, it causes a regression'
    },
  ];

  function applyPreset(preset: SteerPreset) {
    appState.steerFeedback = preset.text;
    if (preset.templateId && appState.templates.some((t) => t.id === preset.templateId)) {
      appState.activeTemplateId = preset.templateId;
    }
    textareaEl?.focus();
  }

  const agentSessions = $derived(appState.agentSessions);
  const targetSession = $derived(
    appState.sessions.find((s) => s.id === appState.steerTargetSessionId) ||
    appState.sessions.find((s) => s.id === appState.activeSessionId)
  );

  const hasAgentTarget = $derived(targetSession?.isAgent === true);

  const synthesizedPreview = $derived(appState.getSynthesizedPrompt());

  function handleLaunchAgent(kind: AgentKind) {
    appState.launchAgentAndSteer(kind);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.steerModalOpen && appState.steerContext}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none font-sans">
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="h-12 bg-gray-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between px-5 shrink-0">
        <div class="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
          <Target class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Steer Agent (Context Injection & Templates)</span>
        </div>
        <button
          onclick={() => (appState.steerModalOpen = false)}
          class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-gray-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
          aria-label="Close steer modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Mode Tabs (Form vs Raw Prompt Preview) -->
      <div class="flex items-center px-5 pt-2.5 border-b border-deck-border bg-slate-50/50 dark:bg-deck-bg shrink-0 gap-4">
        <button
          onclick={() => (activeTab = 'form')}
          class="pb-2 text-xs font-medium border-b-2 transition flex items-center space-x-1.5 cursor-pointer {activeTab === 'form' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-bright'}"
        >
          <FileEdit class="w-3.5 h-3.5" />
          <span>Template & Instructions</span>
        </button>
        <button
          onclick={() => (activeTab = 'preview')}
          class="pb-2 text-xs font-medium border-b-2 transition flex items-center space-x-1.5 cursor-pointer {activeTab === 'preview' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-bright'}"
        >
          <Eye class="w-3.5 h-3.5" />
          <span>Packet Preview</span>
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 overflow-y-auto space-y-4 text-xs select-text bg-white dark:bg-deck-surface">
        
        <!-- Target File & Agent Session Selector -->
        <div class="bg-gray-50 dark:bg-deck-bg p-3 rounded-lg border border-deck-border space-y-2.5">
          <!-- File & Lines -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 font-mono">
              <FileCode class="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span class="text-slate-900 dark:text-deck-bright font-medium">{appState.steerContext.filePath}</span>
              <span class="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-500/30 text-[11px] font-semibold">
                {appState.steerContext.startLine === appState.steerContext.endLine ? `Line ${appState.steerContext.startLine}` : `Lines ${appState.steerContext.startLine}-${appState.steerContext.endLine}`}
              </span>
            </div>

            <!-- Agent indicator badge -->
            {#if targetSession?.isAgent}
              <span class="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-[10px] font-mono flex items-center space-x-1 font-semibold">
                <Bot class="w-3 h-3 text-purple-600 dark:text-purple-400 animate-pulse" />
                <span>AI Agent: {targetSession.title}</span>
              </span>
            {:else}
              <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-deck-card text-slate-600 dark:text-deck-muted border border-deck-border text-[10px] font-mono flex items-center space-x-1">
                <TerminalIcon class="w-3 h-3 text-slate-500 dark:text-deck-muted" />
                <span>Standard Shell</span>
              </span>
            {/if}
          </div>

          <!-- Session Selector Dropdown -->
          <div class="flex items-center justify-between pt-1 border-t border-deck-border/60 text-xs">
            <span class="text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider flex items-center space-x-1">
              Target Terminal Session:
            </span>

            <select
              bind:value={appState.steerTargetSessionId}
              class="bg-white dark:bg-deck-card border border-deck-border rounded px-2 py-1 text-xs text-slate-900 dark:text-deck-bright font-mono focus:outline-none focus:border-blue-500"
            >
              {#if agentSessions.length > 0}
                <optgroup label="🤖 AI Coding Agents">
                  {#each agentSessions as session}
                    <option value={session.id}>🤖 {session.title} (#{session.id})</option>
                  {/each}
                </optgroup>
              {/if}
              <optgroup label="💻 Terminal Shells">
                {#each appState.sessions.filter(s => !s.isAgent) as session}
                  <option value={session.id}>💻 {session.title} (#{session.id})</option>
                {/each}
              </optgroup>
            </select>
          </div>
        </div>

        <!-- Warning Callout IF No AI Agent Session Active -->
        {#if !hasAgentTarget && !allowShellOverride}
          <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-lg p-3 space-y-2.5">
            <div class="flex items-start space-x-2 text-amber-800 dark:text-amber-300">
              <AlertCircle class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span class="font-semibold text-xs">No Active AI Coding Agent Selected</span>
                <p class="text-[11px] text-amber-900/80 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                  You haven't opened an AI coding agent session (Antigravity, OpenCode, Claude Code, Aider, etc.) yet. Sending code feedback directly to a plain bash terminal will execute raw text as shell commands.
                </p>
              </div>
            </div>

            <!-- Quick 1-Click Launch Buttons -->
            <div class="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onclick={() => handleLaunchAgent('antigravity')}
                class="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-md font-medium text-xs shadow flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
              >
                <Rocket class="w-3.5 h-3.5" />
                <span>Launch Antigravity & Steer</span>
              </button>

              <button
                type="button"
                onclick={() => handleLaunchAgent('opencode')}
                class="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-md font-medium text-xs shadow flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
              >
                <Rocket class="w-3.5 h-3.5" />
                <span>Launch OpenCode & Steer</span>
              </button>

              <button
                type="button"
                onclick={() => handleLaunchAgent('claude')}
                class="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-md font-medium text-xs shadow flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
              >
                <Rocket class="w-3.5 h-3.5" />
                <span>Launch Claude & Steer</span>
              </button>

              <button
                type="button"
                onclick={() => handleLaunchAgent('aider')}
                class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md font-medium text-xs shadow flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
              >
                <Rocket class="w-3.5 h-3.5" />
                <span>Launch Aider & Steer</span>
              </button>

              <button
                type="button"
                onclick={() => (allowShellOverride = true)}
                class="px-2.5 py-1.5 bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-slate-600 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-bright rounded-md text-xs border border-deck-border transition cursor-pointer"
              >
                Send to Shell Anyway
              </button>
            </div>
          </div>
        {/if}

        {#if activeTab === 'form'}
          <!-- Prompt Template Selector (Module 4) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider">
                Prompt Template:
              </span>
              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  onclick={() => appState.openNewTemplateModal()}
                  class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  + New Template
                </button>
                <span class="text-slate-300 dark:text-deck-border text-xs">|</span>
                <button
                  type="button"
                  onclick={() => appState.openSettings('templates')}
                  class="text-[11px] text-slate-500 hover:text-slate-800 dark:text-deck-muted dark:hover:text-deck-bright hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>
            </div>
            <select
              bind:value={appState.activeTemplateId}
              class="w-full bg-gray-50 dark:bg-deck-bg border border-deck-border rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-deck-bright focus:outline-none focus:border-blue-500"
            >
              {#each appState.templates as tmpl}
                <option value={tmpl.id}>{tmpl.title} {tmpl.description ? `- ${tmpl.description}` : ''}</option>
              {/each}
            </select>
          </div>

          <!-- Quick Presets -->
          <div>
            <div class="block text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider mb-1.5">
              Quick Instructions Presets:
            </div>
            <div class="flex flex-wrap gap-1.5">
              {#each presets as preset}
                <button
                  type="button"
                  onclick={() => applyPreset(preset)}
                  class="px-2.5 py-1 rounded bg-gray-100 dark:bg-deck-card hover:bg-gray-200 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text hover:text-slate-900 dark:hover:text-deck-bright text-[11px] border border-deck-border transition cursor-pointer font-medium"
                >
                  {preset.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Steering Instruction Input -->
          <div>
            <div class="block text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider mb-1.5">
              Custom Instructions (Replaces &#123;&#123;instructions&#125;&#125; in template):
            </div>
            <textarea
              bind:this={textareaEl}
              bind:value={appState.steerFeedback}
              placeholder="e.g., Refactor this function to validate arguments and prevent null pointer exceptions..."
              rows="3"
              class="w-full bg-gray-50 dark:bg-deck-bg border border-deck-border rounded-lg p-3 text-xs text-slate-900 dark:text-deck-bright placeholder-slate-400 dark:placeholder-deck-muted focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-mono shadow-inner"
            ></textarea>
          </div>
        {:else}
          <!-- Tab 2: Raw Interpolated Prompt Packet Preview -->
          <div>
            <div class="block text-[11px] font-semibold text-slate-500 dark:text-deck-muted uppercase tracking-wider mb-1.5">
              Synthesized Prompt Packet (Direct Injected Payload):
            </div>
            <div class="bg-gray-50 dark:bg-deck-bg p-3.5 rounded-lg border border-deck-border font-mono text-[11px] max-h-60 overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-800 dark:text-deck-text leading-relaxed select-text shadow-inner">
              {synthesizedPreview}
            </div>
          </div>
        {/if}

        <!-- Synthesized Packet Callout -->
        <div class="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg p-2.5 flex items-start space-x-2 text-slate-600 dark:text-deck-muted text-[11px]">
          <Sparkles class="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span class="text-blue-700 dark:text-blue-300 font-medium">Atomic Bracketed Paste:</span>
            Submitting wraps this review packet as an atomic paste block and injects it directly into <b class="text-slate-900 dark:text-deck-bright">{targetSession?.title || 'the selected agent'}</b>.
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="h-14 bg-gray-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-between px-5 shrink-0 select-none">
        <span class="text-[11px] text-slate-500 dark:text-deck-muted flex items-center space-x-1">
          <CornerDownLeft class="w-3 h-3" />
          <span>Press <b>Ctrl+Enter</b> to inject</span>
        </span>

        <div class="flex items-center space-x-2">
          <button
            onclick={() => (appState.steerModalOpen = false)}
            class="px-3 py-1.5 bg-white dark:bg-deck-card hover:bg-gray-100 dark:hover:bg-deck-border text-slate-700 dark:text-deck-text rounded-md text-xs border border-deck-border transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onclick={() => appState.injectSteerFeedback()}
            disabled={(!hasAgentTarget && !allowShellOverride)}
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-md shadow-lg shadow-blue-500/20 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            title={!hasAgentTarget && !allowShellOverride ? 'Launch or select an AI agent session before steering' : 'Inject review feedback into terminal agent'}
          >
            <Send class="w-3.5 h-3.5" />
            <span>Inject Prompt to Agent</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
