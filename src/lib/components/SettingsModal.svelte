<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { appState, type LlmSettings } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import type { ThemePreference, PromptTemplate, TerminalSettings } from '$lib/types';
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

  // Derive activeTab directly from appState.settingsModalTab to maintain single source of truth
  const activeTab = $derived(appState.settingsModalTab || 'appearance');

  // LLM Settings Local Copy
  let localLlm = $state<LlmSettings>({ ...appState.llmSettings });

  // Terminal Settings Local Copy
  let localTerminal = $state<TerminalSettings>({ ...appState.terminalSettings });

  $effect(() => {
    const isOpen = appState.settingsModalOpen;
    untrack(() => {
      if (isOpen) {
        localLlm = { ...appState.llmSettings };
        localTerminal = { ...appState.terminalSettings };
      }
    });
  });

  function switchTab(tab: typeof appState.settingsModalTab) {
    appState.settingsModalTab = tab;
  }

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

  function saveTerminalConfig(e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
    appState.settingsModalTab = 'terminal';
    appState.saveTerminalSettings(localTerminal);
  }

  function resetTerminalConfig(e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
    appState.settingsModalTab = 'terminal';
    appState.resetTerminalSettings();
    localTerminal = { ...appState.terminalSettings };
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
            onclick={() => switchTab('appearance')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'appearance' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Palette class="w-4 h-4" />
            <span>Theme & Look</span>
          </button>

          <button
            onclick={() => switchTab('terminal')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'terminal' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Terminal class="w-4 h-4" />
            <span>Terminal</span>
          </button>

          <button
            onclick={() => switchTab('templates')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'templates' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <FileCode class="w-4 h-4" />
            <span>Prompt Templates</span>
          </button>

          <button
            onclick={() => switchTab('llm')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'llm' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Cpu class="w-4 h-4" />
            <span>AI / LLM Bridge</span>
          </button>

          <button
            onclick={() => switchTab('integrations')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'integrations' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Bot class="w-4 h-4" />
            <span>Agent Integrations</span>
            {#if appState.agentIntegrations.some((i) => i.installed)}
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto" title="Hooks Active"></span>
            {/if}
          </button>

          <button
            onclick={() => switchTab('shortcuts')}
            class="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition text-left cursor-pointer {activeTab === 'shortcuts' ? 'bg-white dark:bg-deck-card text-blue-600 dark:text-blue-400 font-semibold border border-deck-border shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card'}"
          >
            <Keyboard class="w-4 h-4" />
            <span>Shortcuts</span>
          </button>

          <button
            onclick={() => switchTab('about')}
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

          <!-- TERMINAL CONFIGURATION TAB -->
          {:else if activeTab === 'terminal'}
            <div class="space-y-5">
              <div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-deck-bright">Terminal Configuration</h3>
                <p class="text-slate-500 dark:text-deck-muted text-xs mt-0.5">
                  Customize shell binary, font styling, cursor behavior, and terminal buffer performance.
                </p>
              </div>

              <!-- 1. Shell & Execution -->
              <div class="p-4 bg-gray-50 dark:bg-deck-surface border border-deck-border rounded-xl space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-semibold text-slate-900 dark:text-deck-bright flex items-center space-x-1.5">
                    <Terminal class="w-3.5 h-3.5 text-blue-500" />
                    <span>Shell & Execution</span>
                  </h4>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-shell">
                    Default Shell Binary:
                  </label>
                  <input
                    id="terminal-shell"
                    type="text"
                    bind:value={localTerminal.shell}
                    placeholder="Auto-detect system default ($SHELL / COMSPEC)"
                    class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                  />
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-1">
                    Leave blank to automatically use your system's default user shell.
                  </p>
                </div>

                <!-- Shell presets -->
                <div>
                  <span class="block text-[10px] uppercase font-semibold text-slate-500 dark:text-deck-muted tracking-wider mb-1.5">Common Shells:</span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each [
                      { label: 'System Default', value: '' },
                      { label: 'Bash', value: '/bin/bash' },
                      { label: 'Zsh', value: '/bin/zsh' },
                      { label: 'Fish', value: '/bin/fish' },
                      { label: 'PowerShell', value: 'pwsh' }
                    ] as sh}
                      <button
                        type="button"
                        onclick={() => (localTerminal.shell = sh.value)}
                        class="px-2.5 py-1 text-[11px] rounded border font-mono transition cursor-pointer {localTerminal.shell === sh.value ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white dark:bg-deck-card border-deck-border text-slate-700 dark:text-deck-muted hover:border-slate-400'}"
                      >
                        {sh.label}
                      </button>
                    {/each}
                  </div>
                </div>
              </div>

              <!-- 2. Typography & Font -->
              <div class="p-4 bg-gray-50 dark:bg-deck-surface border border-deck-border rounded-xl space-y-3">
                <h4 class="text-xs font-semibold text-slate-900 dark:text-deck-bright flex items-center space-x-1.5">
                  <Command class="w-3.5 h-3.5 text-indigo-500" />
                  <span>Typography & Font</span>
                </h4>

                <div>
                  <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-font-family">
                    Font Family:
                  </label>
                  <input
                    id="terminal-font-family"
                    type="text"
                    bind:value={localTerminal.fontFamily}
                    placeholder='JetBrains Mono, Menlo, Monaco, monospace'
                    class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                  />
                </div>

                <!-- Font Presets -->
                <div class="space-y-2">
                  <div>
                    <span class="block text-[10px] uppercase font-semibold text-slate-500 dark:text-deck-muted tracking-wider mb-1">Nerd Font Presets (Icons & Glyphs):</span>
                    <div class="flex flex-wrap gap-1.5">
                      {#each [
                        { label: 'JetBrainsMono NF', value: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace" },
                        { label: 'MesloLGS NF', value: "'MesloLGS NF', 'MesloLGS Nerd Font', monospace" },
                        { label: 'FiraCode NF', value: "'FiraCode Nerd Font', 'Fira Code', monospace" },
                        { label: 'CaskaydiaCove NF', value: "'CaskaydiaCove Nerd Font', monospace" },
                        { label: 'Hack NF', value: "'Hack Nerd Font', monospace" }
                      ] as fontPreset}
                        <button
                          type="button"
                          onclick={() => (localTerminal.fontFamily = fontPreset.value)}
                          class="px-2 py-0.5 text-[10px] rounded border font-mono transition cursor-pointer {localTerminal.fontFamily === fontPreset.value ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white dark:bg-deck-card border-deck-border text-slate-700 dark:text-deck-muted hover:border-slate-400'}"
                        >
                          {fontPreset.label}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <div>
                    <span class="block text-[10px] uppercase font-semibold text-slate-500 dark:text-deck-muted tracking-wider mb-1">Standard Monospace Presets:</span>
                    <div class="flex flex-wrap gap-1.5">
                      {#each [
                        { label: 'JetBrains Mono', value: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace' },
                        { label: 'Fira Code', value: 'Fira Code, Menlo, Monaco, monospace' },
                        { label: 'Cascadia Code', value: 'Cascadia Code, Consolas, monospace' },
                        { label: 'Source Code Pro', value: 'Source Code Pro, Menlo, monospace' },
                        { label: 'System Monospace', value: 'monospace' }
                      ] as fontPreset}
                        <button
                          type="button"
                          onclick={() => (localTerminal.fontFamily = fontPreset.value)}
                          class="px-2 py-0.5 text-[10px] rounded border font-mono transition cursor-pointer {localTerminal.fontFamily === fontPreset.value ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white dark:bg-deck-card border-deck-border text-slate-700 dark:text-deck-muted hover:border-slate-400'}"
                        >
                          {fontPreset.label}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <!-- Nerd Font Symbols Fallback Toggle -->
                <div class="pt-1 border-t border-deck-border/60">
                  <label class="flex items-center space-x-2 text-xs text-slate-700 dark:text-deck-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      bind:checked={localTerminal.nerdFont}
                      class="rounded border-deck-border text-blue-600 focus:ring-blue-500"
                    />
                    <span class="font-medium">Enable Nerd Font Glyphs & Symbols Fallback</span>
                  </label>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted mt-0.5 ml-5">
                    Automatically injects Symbols Nerd Font fallback into the font stack for Git (), folders (), file icons, and Powerline prompt arrows.
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-font-size">
                      Font Size: <span class="text-blue-500 font-mono">{localTerminal.fontSize}px</span>
                    </label>
                    <input
                      id="terminal-font-size"
                      type="range"
                      min="9"
                      max="24"
                      step="1"
                      bind:value={localTerminal.fontSize}
                      class="w-full cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-line-height">
                      Line Height: <span class="text-blue-500 font-mono">{localTerminal.lineHeight}</span>
                    </label>
                    <input
                      id="terminal-line-height"
                      type="range"
                      min="1"
                      max="2"
                      step="0.05"
                      bind:value={localTerminal.lineHeight}
                      class="w-full cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-letter-spacing">
                      Letter Spacing: <span class="text-blue-500 font-mono">{localTerminal.letterSpacing}px</span>
                    </label>
                    <input
                      id="terminal-letter-spacing"
                      type="range"
                      min="-2"
                      max="5"
                      step="1"
                      bind:value={localTerminal.letterSpacing}
                      class="w-full cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-font-weight">
                    Font Weight:
                  </label>
                  <select
                    id="terminal-font-weight"
                    bind:value={localTerminal.fontWeight}
                    class="bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs text-slate-900 dark:text-deck-bright font-mono"
                  >
                    <option value="300">Light (300)</option>
                    <option value="400">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">SemiBold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </div>
              </div>

              <!-- 3. Cursor & UI -->
              <div class="p-4 bg-gray-50 dark:bg-deck-surface border border-deck-border rounded-xl space-y-4">
                <h4 class="text-xs font-semibold text-slate-900 dark:text-deck-bright flex items-center space-x-1.5">
                  <Sparkles class="w-3.5 h-3.5 text-amber-500" />
                  <span>Cursor & Buffer</span>
                </h4>

                <div>
                  <span class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-2">Cursor Style:</span>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {#each [
                      { style: 'bar', label: 'Bar Cursor ( | )', desc: 'Vertical pipe indicator' },
                      { style: 'block', label: 'Block Cursor ( █ )', desc: 'Full solid rectangle' },
                      { style: 'underline', label: 'Underline Cursor ( _ )', desc: 'Horizontal bottom line' }
                    ] as cursorOpt}
                      <button
                        type="button"
                        onclick={() => (localTerminal.cursorStyle = cursorOpt.style as any)}
                        class="p-2.5 rounded-lg border text-left transition cursor-pointer {localTerminal.cursorStyle === cursorOpt.style ? 'bg-blue-50/50 dark:bg-deck-card border-blue-500 ring-1 ring-blue-500/30 shadow-xs' : 'bg-white dark:bg-deck-card border-deck-border hover:border-slate-400'}"
                      >
                        <div class="font-semibold text-[11px] text-slate-900 dark:text-deck-bright">{cursorOpt.label}</div>
                        <div class="text-[10px] text-slate-500 dark:text-deck-muted">{cursorOpt.desc}</div>
                      </button>
                    {/each}
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <label class="flex items-center space-x-2 text-xs text-slate-700 dark:text-deck-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      bind:checked={localTerminal.cursorBlink}
                      class="rounded border-deck-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enable Cursor Blinking</span>
                  </label>

                  <label class="flex items-center space-x-2 text-xs text-slate-700 dark:text-deck-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      bind:checked={localTerminal.drawBoldTextInBrightColors}
                      class="rounded border-deck-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Draw Bold Text in Bright Colors</span>
                  </label>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-scrollback">
                      Scrollback Buffer Lines:
                    </label>
                    <input
                      id="terminal-scrollback"
                      type="number"
                      min="500"
                      max="50000"
                      step="1000"
                      bind:value={localTerminal.scrollback}
                      class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                    />
                  </div>

                  <div>
                    <label class="block text-[11px] font-semibold text-slate-700 dark:text-deck-text uppercase tracking-wider mb-1" for="terminal-scroll-speed">
                      Alt Fast-Scroll Speed:
                    </label>
                    <input
                      id="terminal-scroll-speed"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      bind:value={localTerminal.fastScrollSensitivity}
                      class="w-full bg-white dark:bg-deck-bg border border-deck-border rounded px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-deck-bright"
                    />
                  </div>
                </div>
              </div>

              <!-- 4. Interactive Live Preview -->
              <div class="p-3.5 bg-gray-900 dark:bg-black rounded-xl border border-deck-border shadow-inner font-mono text-xs overflow-hidden">
                <div class="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                  <span>Live Appearance Preview</span>
                  <span class="text-[10px] text-slate-500">{localTerminal.fontSize}px • {localTerminal.fontWeight} • {localTerminal.cursorStyle}</span>
                </div>
                <div 
                  class="p-3 rounded-lg bg-black/60 text-slate-200 border border-white/5 space-y-1" 
                  style="font-family: {localTerminal.nerdFont && !localTerminal.fontFamily.toLowerCase().includes('nerd font') ? `'Symbols Nerd Font', 'Symbols Nerd Font Mono', ${localTerminal.fontFamily}` : localTerminal.fontFamily}; font-size: {localTerminal.fontSize}px; line-height: {localTerminal.lineHeight}; letter-spacing: {localTerminal.letterSpacing}px; font-weight: {localTerminal.fontWeight};"
                >
                  <div class="text-emerald-400 font-semibold">
                    {#if localTerminal.nerdFont}
                      <span class="text-amber-400">⚡</span> <span class="text-sky-400"> ~/workspace</span> <span class="text-purple-400">on  main*</span> <span class="text-slate-100 font-normal">git status</span>
                    {:else}
                      user@agent-deck:~/workspace$ <span class="text-slate-100 font-normal">git status</span>
                    {/if}
                  </div>
                  <div class="text-slate-400">{localTerminal.nerdFont ? '✔ ' : ''}On branch main, working tree clean.</div>
                  <div class="text-emerald-400">{localTerminal.nerdFont ? '󰊢 ' : ''}Ready to execute AI agent commands.</div>
                  <div class="text-blue-400 font-semibold pt-1">
                    {#if localTerminal.nerdFont}
                      <span class="text-sky-400"> ~/workspace</span> <span class="text-slate-200 font-normal">cargo run</span>
                    {:else}
                      user@agent-deck:~/workspace$ <span class="text-slate-200 font-normal">cargo run</span>
                    {/if}
                    {#if localTerminal.cursorStyle === 'bar'}
                      <span class="inline-block w-0.5 h-3.5 bg-blue-400 {localTerminal.cursorBlink ? 'animate-pulse' : ''} align-middle ml-0.5"></span>
                    {:else if localTerminal.cursorStyle === 'block'}
                      <span class="inline-block w-2 h-3.5 bg-blue-400 {localTerminal.cursorBlink ? 'animate-pulse' : ''} align-middle ml-0.5"></span>
                    {:else}
                      <span class="inline-block w-2.5 h-0.5 bg-blue-400 {localTerminal.cursorBlink ? 'animate-pulse' : ''} align-bottom ml-0.5"></span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Actions: Save & Reset -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-deck-border">
                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    onclick={resetTerminalConfig}
                    class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-deck-muted dark:hover:text-deck-bright border border-deck-border rounded flex items-center space-x-1.5 hover:bg-gray-100 dark:hover:bg-deck-card transition cursor-pointer"
                  >
                    <RotateCcw class="w-3.5 h-3.5" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>

                <button
                  type="button"
                  onclick={saveTerminalConfig}
                  class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>Save & Apply Settings</span>
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
                  <span class="text-slate-800 dark:text-deck-text font-medium">Cycle Terminal Tabs</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Tab / Ctrl + Shift + Tab</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Switch to Terminal Tab 1..9</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Alt + 1..9</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Open New Terminal Tab</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Shift + `</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Close Current Terminal Tab</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + Shift + W</kbd>
                </div>

                <div class="flex items-center justify-between px-3.5 py-2.5">
                  <span class="text-slate-800 dark:text-deck-text font-medium">Toggle / Focus Active Terminal</span>
                  <kbd class="px-2 py-0.5 bg-white dark:bg-deck-card border border-deck-border rounded text-[11px] font-mono text-slate-900 dark:text-deck-bright font-semibold shadow-xs">Ctrl + `</kbd>
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

          <!-- 5. AGENT INTEGRATIONS TAB -->
          {:else if activeTab === 'integrations'}
            <div class="space-y-4">
              <div class="pb-3 border-b border-deck-border">
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-deck-bright">Coding Agent Integrations & Hooks</h3>
                  <p class="text-[11px] text-slate-500 dark:text-deck-muted">
                    Configure official agent lifecycle hooks so AgentDeck detects when an agent needs user input or permission.
                  </p>
                </div>
              </div>

              {#if appState.isLoadingIntegrations}
                <div class="p-8 text-center text-slate-400">Loading agent integrations...</div>
              {:else}
                <div class="space-y-3">
                  {#each appState.agentIntegrations as item (item.agent)}
                    <div class="p-3.5 rounded-xl border border-deck-border bg-slate-50/60 dark:bg-deck-card/50 space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                          <Bot class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span class="font-bold text-sm text-slate-900 dark:text-deck-bright">{item.name}</span>
                          {#if item.detected}
                            <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">CLI Detected</span>
                          {:else}
                            <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200 dark:bg-deck-card text-slate-500 dark:text-deck-muted">Not Found</span>
                          {/if}
                        </div>

                        {#if item.installed}
                          <div class="flex items-center space-x-2">
                            <span class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                              <Check class="w-3.5 h-3.5" />
                              <span>Hook Active</span>
                            </span>
                            <button
                              type="button"
                              onclick={() => appState.uninstallAgentIntegration(item.agent)}
                              class="px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-900/40 transition cursor-pointer"
                            >
                              Uninstall
                            </button>
                          </div>
                        {:else if item.agent === 'claude' || item.agent === 'antigravity' || item.agent === 'opencode'}
                          <button
                            type="button"
                            onclick={() => appState.installAgentIntegration(item.agent)}
                            class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs transition cursor-pointer"
                          >
                            Install Hook
                          </button>
                        {:else}
                          <span class="text-[11px] text-slate-400 font-mono">Available via CLI</span>
                        {/if}
                      </div>

                      <p class="text-xs text-slate-600 dark:text-deck-muted">
                        {item.description}
                      </p>

                      {#if item.configPath}
                        <div class="text-[10px] font-mono text-slate-500 dark:text-deck-muted pt-1 flex items-center space-x-1">
                          <span class="text-slate-400">Config:</span>
                          <span class="truncate">{item.configPath}</span>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

          <!-- 6. ABOUT TAB -->
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
