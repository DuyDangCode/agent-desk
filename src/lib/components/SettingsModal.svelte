<script lang="ts">
  import { tick } from 'svelte';
  import { appState, type LlmSettings } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import type { ThemePreference, PromptTemplate } from '$lib/types';
  import { 
    Settings, 
    X, 
    Check, 
    Sun, 
    Moon, 
    Monitor, 
    Palette, 
    Keyboard, 
    Bot, 
    Info, 
    Sparkles,
    Terminal,
    GitBranch,
    Command,
    FileCode,
    Plus,
    Trash2,
    Edit3,
    RotateCcw,
    Cpu
  } from 'lucide-svelte';

  let activeTab = $state<'appearance' | 'templates' | 'llm' | 'shortcuts' | 'about'>('appearance');

  // LLM Settings Local Copy
  let localLlm = $state<LlmSettings>({ ...appState.llmSettings });

  $effect(() => {
    if (appState.settingsModalOpen) {
      if (appState.settingsModalTab) {
        activeTab = appState.settingsModalTab;
      }
      localLlm = { ...appState.llmSettings };
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      appState.settingsModalOpen = false;
    }
  }

  function selectTheme(mode: ThemePreference) {
    themeState.setMode(mode);
    appState.showToast(`Theme set to ${mode.toUpperCase()}`, 'info');
  }

  function saveLlmConfig() {
    appState.saveLlmSettings(localLlm);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.settingsModalOpen}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none font-sans"
    onclick={(e) => { if (e.target === e.currentTarget) appState.closeSettings(); }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="bg-white dark:bg-deck-surface border border-deck-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
      
      <!-- Top Title Bar -->
      <div class="h-12 bg-gray-50 dark:bg-deck-card border-b border-deck-border flex items-center justify-between px-5 shrink-0">
        <div class="flex items-center space-x-2 text-slate-900 dark:text-deck-bright font-semibold text-sm">
          <Settings class="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span>AgentDeck Configuration & Power Tools</span>
        </div>
        <button
          onclick={() => appState.closeSettings()}
          class="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-gray-200 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-border transition cursor-pointer"
          title="Close Settings (Esc)"
          aria-label="Close Settings"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Content Split (Tabs Sidebar + Settings Area) -->
      <div class="flex-1 flex overflow-hidden min-h-[420px]">
        
        <!-- Navigation Tabs Sidebar -->
        <div class="w-52 bg-gray-50 dark:bg-deck-surface border-r border-deck-border p-2 space-y-1 shrink-0 font-sans text-xs">
          <button
            onclick={() => (activeTab = 'appearance')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'appearance' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Palette class="w-4 h-4" />
            <span>Theme & Look</span>
          </button>

          <button
            onclick={() => (activeTab = 'templates')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'templates' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <FileCode class="w-4 h-4" />
            <span>Prompt Templates</span>
          </button>

          <button
            onclick={() => (activeTab = 'llm')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'llm' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Cpu class="w-4 h-4" />
            <span>AI / LLM Bridge</span>
          </button>

          <button
            onclick={() => (activeTab = 'shortcuts')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'shortcuts' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Keyboard class="w-4 h-4" />
            <span>Shortcuts</span>
          </button>

          <button
            onclick={() => (activeTab = 'about')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'about' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Info class="w-4 h-4" />
            <span>About AgentDeck</span>
          </button>
        </div>

        <!-- Tab Body Content -->
        <div class="flex-1 bg-white dark:bg-deck-bg p-5 overflow-y-auto font-sans text-xs">
          
          <!-- 1. APPEARANCE & THEME TAB -->
          {#if activeTab === 'appearance'}
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">Syntax & Interface Theme</h3>
                <p class="text-slate-500 dark:text-deck-muted text-xs mt-0.5">
                  Select your preferred color theme or synchronize with your machine's system settings.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <!-- Theme: GitHub Dark / Black -->
                <button
                  type="button"
                  onclick={() => selectTheme('black')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'black' || themeState.mode === 'dark' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Moon class="w-4 h-4 text-blue-400" />
                    <span>GitHub Dark</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Default dark palette with crisp contrast.</p>
                </button>

                <!-- Theme: GitHub Light / White -->
                <button
                  type="button"
                  onclick={() => selectTheme('white')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'white' || themeState.mode === 'light' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Sun class="w-4 h-4 text-amber-500" />
                    <span>GitHub Light</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Crisp, clean daylight reading palette.</p>
                </button>

                <!-- Theme: One Dark -->
                <button
                  type="button"
                  onclick={() => selectTheme('onedark')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'onedark' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Palette class="w-4 h-4 text-cyan-400" />
                    <span>One Dark Pro</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Atom-inspired soft dark syntax theme.</p>
                </button>

                <!-- Theme: Dracula -->
                <button
                  type="button"
                  onclick={() => selectTheme('dracula')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'dracula' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Palette class="w-4 h-4 text-purple-400" />
                    <span>Dracula</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Famous gothic purple theme with vibrant highlights.</p>
                </button>

                <!-- Theme: Nord -->
                <button
                  type="button"
                  onclick={() => selectTheme('nord')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'nord' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Palette class="w-4 h-4 text-teal-400" />
                    <span>Nord Ice</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Arctic, north-bluish clean color palette.</p>
                </button>

                <!-- Theme: System Sync -->
                <button
                  type="button"
                  onclick={() => selectTheme('system')}
                  class="p-3.5 rounded-xl border text-left transition cursor-pointer {themeState.mode === 'system' ? 'bg-blue-50/40 dark:bg-deck-card border-blue-500 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-deck-surface border-deck-border hover:border-slate-400'}"
                >
                  <div class="flex items-center space-x-2 font-semibold text-slate-900 dark:text-deck-bright">
                    <Monitor class="w-4 h-4 text-blue-500" />
                    <span>System Auto-Sync</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">Match OS / machine light/dark mode.</p>
                </button>
              </div>
            </div>

          <!-- 2. PROMPT TEMPLATES TAB (Module 4) -->
          {:else if activeTab === 'templates'}
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">Prompt Template Engine</h3>
                  <p class="text-slate-500 dark:text-deck-muted text-xs mt-0.5">
                    Customize steering templates with variable tags: <code class="font-mono text-blue-600 dark:text-blue-400">&#123;&#123;file&#125;&#125;</code>, <code class="font-mono text-blue-600 dark:text-blue-400">&#123;&#123;lines&#125;&#125;</code>, <code class="font-mono text-blue-600 dark:text-blue-400">&#123;&#123;code&#125;&#125;</code>, <code class="font-mono text-blue-600 dark:text-blue-400">&#123;&#123;instructions&#125;&#125;</code>
                  </p>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    onclick={() => appState.resetTemplatesToDefault()}
                    class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-deck-card dark:hover:bg-deck-border text-slate-600 dark:text-deck-muted text-xs flex items-center space-x-1 transition cursor-pointer"
                    title="Reset to built-in presets"
                  >
                    <RotateCcw class="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </button>
                  <button
                    type="button"
                    onclick={() => appState.openNewTemplateModal()}
                    class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>New Template</span>
                  </button>
                </div>
              </div>

              <!-- Templates List -->
              <div class="space-y-2.5">
                {#each appState.templates as tmpl (tmpl.id)}
                  <div class="p-3.5 bg-slate-50 dark:bg-deck-card border border-deck-border rounded-xl flex items-start justify-between hover:border-slate-300 dark:hover:border-deck-muted/50 transition shadow-xs">
                    <div class="space-y-1.5 flex-1 pr-3 min-w-0">
                      <div class="flex items-center space-x-2">
                        <span class="font-semibold text-slate-900 dark:text-deck-bright text-xs truncate">{tmpl.title}</span>
                        {#if tmpl.isBuiltin}
                          <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-deck-bg text-slate-600 dark:text-deck-muted font-semibold">builtin</span>
                        {/if}
                      </div>
                      {#if tmpl.description}
                        <p class="text-[11px] text-slate-500 dark:text-deck-muted">{tmpl.description}</p>
                      {/if}
                      <pre class="text-[10px] font-mono bg-white dark:bg-deck-bg p-2.5 rounded-lg border border-deck-border/70 text-slate-700 dark:text-deck-text max-h-20 overflow-hidden whitespace-pre-wrap leading-relaxed shadow-inner">{tmpl.template}</pre>
                    </div>

                    <div class="flex items-center space-x-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onclick={() => appState.openEditTemplateModal(tmpl)}
                        class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-deck-surface text-slate-500 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright transition cursor-pointer"
                        title="Edit template"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onclick={() => appState.deleteTemplate(tmpl.id)}
                        disabled={appState.templates.length <= 1}
                        class="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 dark:text-deck-muted dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete template"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                {/each}

                <button
                  type="button"
                  onclick={() => appState.openNewTemplateModal()}
                  class="w-full py-3.5 px-4 border-2 border-dashed border-deck-border hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold text-slate-600 dark:text-deck-muted hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                >
                  <Plus class="w-4 h-4" />
                  <span>Create New Prompt Template</span>
                </button>
              </div>
            </div>

          <!-- 3. AI / LLM BRIDGE TAB (Module 5) -->
          {:else if activeTab === 'llm'}
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">AI & LLM Bridge Engine</h3>
                <p class="text-slate-500 dark:text-deck-muted text-xs mt-0.5">
                  Configure local or cloud LLM endpoints (Ollama, OpenAI, Anthropic, Custom) for AI Commit Synthesis and intelligent analysis.
                </p>
              </div>

              <div class="space-y-3 bg-slate-50 dark:bg-deck-card border border-deck-border rounded-xl p-4">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="llm-provider">
                    Provider Engine:
                  </label>
                  <select
                    id="llm-provider"
                    bind:value={localLlm.provider}
                    class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs text-slate-900 dark:text-deck-bright font-mono"
                  >
                    <option value="rule-based">Built-in Semantic Rule Engine (Fast, Offline)</option>
                    <option value="ollama">Ollama (Local LLM - http://localhost:11434/v1)</option>
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="anthropic">Anthropic Claude (Messages API)</option>
                    <option value="custom">Custom OpenAI-compatible HTTP Endpoint</option>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="llm-model">
                    Model Identifier:
                  </label>
                  <input
                    id="llm-model"
                    type="text"
                    bind:value={localLlm.model}
                    placeholder="e.g. llama3.2, gpt-4o, claude-3-5-sonnet-20241022"
                    class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                  />
                </div>

                {#if localLlm.provider !== 'rule-based'}
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="llm-endpoint">
                      Base URL / Endpoint:
                    </label>
                    <input
                      id="llm-endpoint"
                      type="text"
                      bind:value={localLlm.endpoint}
                      placeholder={localLlm.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                      class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                    />
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="llm-apikey">
                      API Key (Optional / Bearer Token):
                    </label>
                    <input
                      id="llm-apikey"
                      type="password"
                      bind:value={localLlm.apiKey}
                      placeholder="sk-..."
                      class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                    />
                  </div>
                {/if}

                <div class="flex justify-end pt-2">
                  <button
                    onclick={saveLlmConfig}
                    class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition cursor-pointer"
                  >
                    Save LLM Configuration
                  </button>
                </div>
              </div>
            </div>

          <!-- 4. SHORTCUTS TAB -->
          {:else if activeTab === 'shortcuts'}
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">Keyboard Shortcuts (V2.0)</h3>
                <p class="text-slate-500 dark:text-deck-muted text-xs mt-0.5">
                  Boost your review and multi-agent steering speed with power shortcuts.
                </p>
              </div>

              <div class="border border-deck-border rounded-xl overflow-hidden bg-gray-50 dark:bg-deck-card divide-y divide-deck-border/60">
                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Cycle Multi-Project Tabs</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Alt + Left / Right</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Switch to Project 1..9</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + 1..9</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Open Git Branches & Stashes Modal</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Shift + B</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Open Steer on Current Diff Block</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Shift + S</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Commit Staged Changes Gate</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Enter</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Toggle Single vs Split Workspace Panels</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + M</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Split Terminal Side-by-Side (Horizontal)</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + H</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Split Terminal Stacked (Vertical)</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + V</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Single Terminal Pane</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + S</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Swap Terminal Panes</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + X</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Switch Focused Terminal Pane</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + [ / ]</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Toggle Diff Line Wrap Mode</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + Z</kbd>
                </div>
              </div>
            </div>

          <!-- 5. ABOUT TAB -->
          {:else if activeTab === 'about'}
            <div class="space-y-4">
              <div class="flex items-center space-x-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <Sparkles class="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-deck-bright">AgentDeck Power Deck</h3>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted">Autonomous Multi-Agent AI Cockpit & Git Review Gate</p>
                </div>
              </div>

              <div class="space-y-2 text-slate-700 dark:text-deck-text leading-relaxed">
                <p>
                  AgentDeck Version 2.0 unlocks multi-project attached workspaces, split-grid PTY terminals, word-level intra-line diff highlighting, customizable prompt steering templates, and smart AI commit synthesis.
                </p>
              </div>

              <div class="pt-2 border-t border-deck-border text-[11px] text-slate-500 dark:text-deck-muted space-y-1 font-mono">
                <div>Release: <span class="text-slate-900 dark:text-deck-bright font-semibold">v2.0.0 (Power Deck)</span></div>
                <div>Frontend: Svelte 5 (Runes) + Tailwind CSS + XTerm.js (WebGL)</div>
                <div>Backend: Tauri 2.0 + Git2 Engine + Similar Intra-line Diffing</div>
              </div>
            </div>
          {/if}

        </div>
      </div>

      <!-- Footer Bar -->
      <div class="h-13 bg-gray-50 dark:bg-deck-card border-t border-deck-border flex items-center justify-end px-5 py-3 shrink-0">
        <button
          type="button"
          onclick={() => appState.closeSettings()}
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-md shadow transition cursor-pointer"
        >
          Done
        </button>
      </div>

    </div>
  </div>
{/if}
