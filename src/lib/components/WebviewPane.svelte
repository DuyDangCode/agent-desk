<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import { 
    normalizePreviewUrl, 
    generateInspectorScript 
  } from '$lib/utils/webviewSteer';
  import { 
    Globe, 
    RotateCw, 
    ExternalLink, 
    Crosshair, 
    Smartphone, 
    Tablet, 
    Monitor, 
    Send, 
    X, 
    Layers, 
    Code2, 
    Sparkles,
    AlertCircle,
    Check,
    Bot,
    ChevronDown
  } from 'lucide-svelte';

  // Local state
  let urlInputValue = $state(appState.webPreviewUrl);
  let viewportMode = $state<'full' | 'tablet' | 'mobile'>('full');
  let iframeElement = $state<HTMLIFrameElement | null>(null);
  let steerInputElement = $state<HTMLInputElement | null>(null);
  let isIframeLoading = $state(false);
  let crossOriginRestricted = $state(false);
  let copyScriptSuccess = $state(false);
  let isToolbarAgentDropdownOpen = $state(false);
  let isSteerAgentDropdownOpen = $state(false);
  let targetSessionId = $state<string>(
    appState.webviewSteerTargetSessionId ||
    appState.agentSessions.find((s) => s.id === appState.activeSessionId)?.id ||
    appState.agentSessions[0]?.id ||
    appState.activeSessionId ||
    ''
  );

  const selectedSessionObj = $derived(
    appState.sessions.find((s) => s.id === targetSessionId) ||
    appState.agentSessions[0] ||
    appState.sessions[0]
  );

  // Sync targetSessionId when session list changes or store updates
  $effect(() => {
    if (appState.webviewSteerTargetSessionId) {
      targetSessionId = appState.webviewSteerTargetSessionId;
    } else if (!targetSessionId && appState.sessions.length > 0) {
      targetSessionId =
        appState.agentSessions.find((s) => s.id === appState.activeSessionId)?.id ||
        appState.agentSessions[0]?.id ||
        appState.activeSessionId ||
        appState.sessions[0]?.id ||
        '';
    }
  });

  function handleTargetSessionChange(newId: string) {
    targetSessionId = newId;
    appState.setWebviewSteerTarget(newId);
  }

  // Sync url input if changed externally
  $effect(() => {
    urlInputValue = appState.webPreviewUrl;
  });

  // Focus steer input when a component is selected
  $effect(() => {
    if (appState.selectedComponent && steerInputElement) {
      setTimeout(() => steerInputElement?.focus(), 50);
    }
  });

  // Broadcast inspect mode state to iframe
  $effect(() => {
    if (iframeElement && iframeElement.contentWindow) {
      try {
        iframeElement.contentWindow.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
      } catch {}
    }
  });

  function handleUrlSubmit(e?: Event) {
    if (e) e.preventDefault();
    const normalized = normalizePreviewUrl(urlInputValue);
    urlInputValue = normalized;
    appState.setWebPreviewUrl(normalized);
    reloadIframe();
  }

  function reloadIframe() {
    if (iframeElement) {
      isIframeLoading = true;
      try {
        iframeElement.src = appState.webPreviewUrl;
      } catch (err) {
        console.warn('Failed to reload iframe:', err);
      }
    }
  }

  function openExternalBrowser() {
    if (typeof window !== 'undefined') {
      window.open(appState.webPreviewUrl, '_blank');
    }
  }

  function handleIframeLoad() {
    isIframeLoading = false;
    crossOriginRestricted = false;

    if (!iframeElement) return;

    try {
      const doc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
      if (doc) {
        // Inject inspector script into accessible iframe
        const existingScript = doc.getElementById('__agentdeck_inspector_script');
        if (!existingScript) {
          const scriptEl = doc.createElement('script');
          scriptEl.id = '__agentdeck_inspector_script';
          scriptEl.textContent = generateInspectorScript();
          doc.head?.appendChild(scriptEl) || doc.documentElement.appendChild(scriptEl);
        }

        // Send current inspect state
        iframeElement.contentWindow?.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
      }
    } catch {
      // Cross-origin boundary between different localhost ports
      crossOriginRestricted = true;
    }
  }

  function handleWindowMessage(event: MessageEvent) {
    if (!event.data) return;

    if (event.data.type === 'AGENTDECK_COMPONENT_PICKED' && event.data.payload) {
      appState.setSelectedComponent(event.data.payload);
      appState.showToast(`Selected <${event.data.payload.componentName || 'element'}>`, 'info');
    }
  }

  function handleDirectSteerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitDirectSteer();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      appState.setSelectedComponent(null);
    }
  }

  async function submitDirectSteer() {
    if (!appState.directSteerInput.trim() && !appState.selectedComponent) return;
    await appState.steerComponentDirectly(appState.directSteerInput, targetSessionId);
  }

  function cancelSelection() {
    appState.setSelectedComponent(null);
  }

  async function copyDevScript() {
    const snippet = `<script>${generateInspectorScript()}<\/script>`;
    try {
      await navigator.clipboard.writeText(snippet);
      copyScriptSuccess = true;
      setTimeout(() => (copyScriptSuccess = false), 2500);
      appState.showToast('Inspector script copied to clipboard', 'success');
    } catch {}
  }

  onMount(() => {
    window.addEventListener('message', handleWindowMessage);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', handleWindowMessage);
    }
  });

  const activeAgent = $derived(
    appState.agentSessions.find((s) => s.id === appState.activeSessionId) ||
    appState.agentSessions[0] ||
    appState.sessions.find((s) => s.id === appState.activeSessionId)
  );
</script>

<div class="h-full w-full flex flex-col bg-slate-50 dark:bg-deck-bg text-slate-800 dark:text-deck-text overflow-hidden relative font-sans select-none">
  <!-- 1. Webview Omnibar / Toolbar -->
  <div class="h-10 bg-white dark:bg-deck-surface border-b border-deck-border flex items-center justify-between px-3 gap-2 shrink-0 z-20 shadow-xs">
    <!-- Left: URL Input & Actions -->
    <form onsubmit={handleUrlSubmit} class="flex items-center flex-1 max-w-xl min-w-0">
      <div class="flex items-center w-full bg-slate-100 dark:bg-deck-card/90 rounded-md border border-deck-border/70 px-2 py-1 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
        <Globe class="w-3.5 h-3.5 text-slate-400 dark:text-deck-muted shrink-0 mr-1.5" />
        <input
          type="text"
          bind:value={urlInputValue}
          placeholder="http://localhost:5173"
          class="bg-transparent border-none outline-hidden text-xs text-slate-800 dark:text-deck-text w-full font-mono placeholder:text-slate-400 dark:placeholder:text-deck-muted"
        />
        {#if isIframeLoading}
          <RotateCw class="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0 ml-1.5" />
        {/if}
      </div>
    </form>

    <!-- Center: Viewport Presets -->
    <div class="hidden sm:flex items-center bg-slate-100 dark:bg-deck-card/80 p-0.5 rounded-md border border-deck-border/60 text-xs">
      <button
        onclick={() => (viewportMode = 'full')}
        class="px-2 py-1 rounded transition {viewportMode === 'full' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 font-semibold shadow-2xs' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-text'}"
        title="Responsive Viewport (100%)"
      >
        <Monitor class="w-3.5 h-3.5" />
      </button>
      <button
        onclick={() => (viewportMode = 'tablet')}
        class="px-2 py-1 rounded transition {viewportMode === 'tablet' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 font-semibold shadow-2xs' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-text'}"
        title="Tablet Viewport (768px)"
      >
        <Tablet class="w-3.5 h-3.5" />
      </button>
      <button
        onclick={() => (viewportMode = 'mobile')}
        class="px-2 py-1 rounded transition {viewportMode === 'mobile' ? 'bg-white dark:bg-deck-bg text-blue-600 dark:text-blue-400 font-semibold shadow-2xs' : 'text-slate-500 dark:text-deck-muted hover:text-slate-900 dark:hover:text-deck-text'}"
        title="Mobile Viewport (375px)"
      >
        <Smartphone class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Right: Inspect Element Toggle & External Link -->
    <div class="flex items-center space-x-1.5 shrink-0">
      <!-- Custom Attached Agent Selector Dropdown -->
      {#if appState.sessions.length > 0}
        <div class="relative hidden sm:block">
          <button
            type="button"
            onclick={() => (isToolbarAgentDropdownOpen = !isToolbarAgentDropdownOpen)}
            class="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-deck-card dark:hover:bg-deck-border border border-deck-border/80 text-slate-700 dark:text-deck-bright rounded-md text-xs font-mono font-medium transition cursor-pointer max-w-[170px]"
            title="Choose target agent session to steer"
          >
            <span>{selectedSessionObj?.isAgent ? '🤖' : '💻'}</span>
            <span class="truncate">{selectedSessionObj?.title || 'Select Agent'}</span>
            <ChevronDown class="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
          </button>

          {#if isToolbarAgentDropdownOpen}
            <!-- Transparent backdrop for outside click -->
            <div
              class="fixed inset-0 z-40"
              onclick={() => (isToolbarAgentDropdownOpen = false)}
            ></div>

            <div class="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-deck-surface border border-deck-border rounded-lg shadow-xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
              <div class="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-deck-muted uppercase tracking-wider border-b border-deck-border/50">
                Steer Target Session
              </div>
              <div class="max-h-56 overflow-y-auto py-0.5">
                {#each appState.sessions as sess}
                  <button
                    type="button"
                    onclick={() => {
                      handleTargetSessionChange(sess.id);
                      isToolbarAgentDropdownOpen = false;
                    }}
                    class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-deck-card transition cursor-pointer {sess.id === targetSessionId ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-deck-text'}"
                  >
                    <div class="flex items-center space-x-2 truncate">
                      <span>{sess.isAgent ? '🤖' : '💻'}</span>
                      <span class="font-mono truncate">{sess.title}</span>
                    </div>
                    <div class="flex items-center space-x-1 shrink-0 ml-1.5">
                      {#if sess.id === appState.activeSessionId}
                        <span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                      {/if}
                      {#if sess.id === targetSessionId}
                        <Check class="w-3.5 h-3.5 text-blue-500" />
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 🎯 Component Inspector Toggle Button -->
      <button
        onclick={() => appState.toggleInspectMode()}
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer {appState.isInspectMode ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/50' : 'bg-slate-100 hover:bg-slate-200 dark:bg-deck-card dark:hover:bg-deck-border text-slate-700 dark:text-deck-bright border border-deck-border/70'}"
        title={appState.isInspectMode ? 'Click on any element in the webview to steer active agent' : 'Enable element inspector to choose component'}
      >
        <Crosshair class="w-3.5 h-3.5 {appState.isInspectMode ? 'animate-pulse' : ''}" />
        <span class="hidden md:inline">{appState.isInspectMode ? 'Inspecting UI...' : 'Inspect UI'}</span>
      </button>

      <!-- Reload Button -->
      <button
        onclick={reloadIframe}
        class="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
        title="Reload webview"
      >
        <RotateCw class="w-3.5 h-3.5 {isIframeLoading ? 'animate-spin text-blue-500' : ''}" />
      </button>

      <!-- Open in Browser Button -->
      <button
        onclick={openExternalBrowser}
        class="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-deck-muted dark:hover:text-deck-bright dark:hover:bg-deck-card transition cursor-pointer"
        title="Open in default browser"
      >
        <ExternalLink class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>

  <!-- 2. Main Webview Container -->
  <div class="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-100/70 dark:bg-deck-bg">
    <div
      class="h-full transition-all duration-200 flex flex-col bg-white dark:bg-black {viewportMode === 'mobile' ? 'w-[375px] shadow-2xl border-x border-deck-border' : viewportMode === 'tablet' ? 'w-[768px] shadow-2xl border-x border-deck-border' : 'w-full'}"
    >
      <iframe
        bind:this={iframeElement}
        src={appState.webPreviewUrl}
        onload={handleIframeLoad}
        title="Frontend Webview Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        class="w-full h-full border-none bg-white"
      ></iframe>
    </div>

    <!-- Cross-Origin Helper Tip (only if iframe blocks direct script injection) -->
    {#if crossOriginRestricted && appState.isInspectMode && !appState.selectedComponent}
      <div class="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-md bg-white dark:bg-deck-surface border border-amber-500/40 rounded-lg p-2.5 shadow-xl text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
        <div class="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-semibold">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>Cross-Port Dev Server Active</span>
        </div>
        <p class="text-slate-600 dark:text-deck-muted text-[11px] leading-relaxed">
          Browsers restrict cross-port DOM inspection. To enable 1-click element selection in this app, copy our helper script or inject into your HTML.
        </p>
        <div class="flex items-center justify-between pt-1">
          <button
            onclick={copyDevScript}
            class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-medium transition cursor-pointer flex items-center space-x-1"
          >
            {#if copyScriptSuccess}
              <Check class="w-3 h-3" />
              <span>Copied!</span>
            {:else}
              <Code2 class="w-3 h-3" />
              <span>Copy Inspector Script</span>
            {/if}
          </button>
          <button
            onclick={() => (crossOriginRestricted = false)}
            class="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    {/if}

    <!-- 3. Direct Component Steer Floating Bar (Appears when element is picked!) -->
    {#if appState.selectedComponent}
      {@const comp = appState.selectedComponent}
      <div class="absolute bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto bg-white dark:bg-deck-surface border border-blue-500/40 rounded-xl p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-150 space-y-2.5 ring-1 ring-blue-500/20 font-sans">
        <!-- Target Header & Metadata Pill Row -->
        <div class="flex items-center justify-between gap-2 border-b border-deck-border/60 pb-2">
          <div class="flex items-center space-x-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <!-- Target Component Badge -->
            <div class="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold shrink-0">
              <Sparkles class="w-3 h-3 text-blue-500" />
              <span>&lt;{comp.componentName || 'UI Element'}&gt;</span>
            </div>

            <!-- Source File Location Pill -->
            {#if comp.filePath}
              <div class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-deck-card text-slate-700 dark:text-deck-muted text-[11px] font-mono truncate max-w-[200px]" title="{comp.filePath}:{comp.lineNumber || 1}">
                {comp.filePath.split('/').pop()}{comp.lineNumber ? `:${comp.lineNumber}` : ''}
              </div>
            {/if}

            <!-- CSS Selector Pill -->
            {#if comp.selector}
              <div class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-deck-card text-slate-500 dark:text-deck-muted text-[11px] font-mono truncate max-w-[160px]" title={comp.selector}>
                {comp.selector}
              </div>
            {/if}
          </div>

          <!-- Close / Cancel Button -->
          <button
            onclick={cancelSelection}
            class="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-deck-bright hover:bg-slate-100 dark:hover:bg-deck-card transition cursor-pointer shrink-0"
            title="Cancel selection (Esc)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Direct Prompt Input & Steer Action -->
        <div class="flex items-center space-x-2">
          <input
            bind:this={steerInputElement}
            bind:value={appState.directSteerInput}
            onkeydown={handleDirectSteerKeydown}
            type="text"
            placeholder="Describe what to change on <{comp.componentName || 'element'}> (e.g. 'Make button blue with 8px radius')..."
            class="flex-1 bg-slate-50 dark:bg-deck-card border border-deck-border rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-deck-text placeholder:text-slate-400 dark:placeholder:text-deck-muted outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />

          <button
            onclick={submitDirectSteer}
            class="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition cursor-pointer shrink-0"
            title="Send directly to active agent (Enter)"
          >
            <Send class="w-3.5 h-3.5" />
            <span>Steer to Agent</span>
          </button>
        </div>

        <!-- Hint & Agent Selector footer -->
        <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-deck-muted pt-0.5">
          <div class="flex items-center space-x-1.5">
            <span>Steer to:</span>
            <div class="relative">
              <button
                type="button"
                onclick={() => (isSteerAgentDropdownOpen = !isSteerAgentDropdownOpen)}
                class="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-deck-card dark:hover:bg-deck-border border border-deck-border/80 text-blue-600 dark:text-blue-400 rounded text-xs font-mono font-semibold transition cursor-pointer"
                title="Choose which agent terminal session receives this instruction"
              >
                <span>{selectedSessionObj?.isAgent ? '🤖' : '💻'}</span>
                <span class="truncate max-w-[130px]">{selectedSessionObj?.title || 'Select Session'}</span>
                <ChevronDown class="w-3 h-3 text-blue-500 shrink-0 ml-0.5" />
              </button>

              {#if isSteerAgentDropdownOpen}
                <!-- Transparent backdrop for outside click -->
                <div
                  class="fixed inset-0 z-40"
                  onclick={() => (isSteerAgentDropdownOpen = false)}
                ></div>

                <div class="absolute bottom-full left-0 mb-1.5 w-56 bg-white dark:bg-deck-surface border border-deck-border rounded-lg shadow-xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div class="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-deck-muted uppercase tracking-wider border-b border-deck-border/50">
                    Target Agent Session
                  </div>
                  <div class="max-h-56 overflow-y-auto py-0.5">
                    {#each appState.sessions as sess}
                      <button
                        type="button"
                        onclick={() => {
                          handleTargetSessionChange(sess.id);
                          isSteerAgentDropdownOpen = false;
                        }}
                        class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-deck-card transition cursor-pointer {sess.id === targetSessionId ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-deck-text'}"
                      >
                        <div class="flex items-center space-x-2 truncate">
                          <span>{sess.isAgent ? '🤖' : '💻'}</span>
                          <span class="font-mono truncate">{sess.title}</span>
                        </div>
                        <div class="flex items-center space-x-1 shrink-0 ml-1.5">
                          {#if sess.id === appState.activeSessionId}
                            <span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                          {/if}
                          {#if sess.id === targetSessionId}
                            <Check class="w-3.5 h-3.5 text-blue-500" />
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <span class="text-[10px] text-slate-400 dark:text-deck-muted">
            Press <strong class="text-slate-600 dark:text-deck-bright font-mono">Enter</strong> to steer • <strong class="text-slate-600 dark:text-deck-bright font-mono">Esc</strong> to cancel
          </span>
        </div>
      </div>
    {/if}
  </div>
</div>
