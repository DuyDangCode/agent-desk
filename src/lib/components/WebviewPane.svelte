<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appState } from '$lib/stores/appState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { 
    normalizePreviewUrl, 
    generateInspectorScript,
    buildPreviewProxyUrl,
    calculateDesktopViewportScale,
    resolveEffectiveColorScheme
  } from '$lib/utils/webviewSteer';
  import {
    openNativePreviewWindow,
    closeNativePreviewWindow,
    focusNativePreviewWindow,
    reloadNativePreviewWindow,
    isNativePreviewOpen,
    setNativePreviewInspect,
    closeNativeSteerPopup,
    listenEvent,
    isTauri
  } from '$lib/utils/tauri';
  import { 
    Globe, 
    RotateCw, 
    ExternalLink, 
    Crosshair, 
    Smartphone, 
    Tablet, 
    Monitor,
    Laptop,
    Send, 
    X, 
    Code2, 
    Sparkles, 
    Check, 
    ChevronDown, 
    Home, 
    ArrowRight, 
    Radio,
    Sun,
    Moon,
    Maximize2,
    Minimize2
  } from 'lucide-svelte';

  // Local state
  let urlInputValue = $state(appState.webPreviewUrl || '');
  let viewportMode = $state<'full' | 'desktop' | 'tablet' | 'mobile'>('full');
  let previewColorScheme = $state<'auto' | 'dark' | 'light'>('auto');
  let previewMode = $state<'direct' | 'smart' | 'native'>('direct');
  let isNativeActive = $state(false);
  let hasInspectorReady = $state(false);
  let iframeElement = $state<HTMLIFrameElement | null>(null);
  let containerElement = $state<HTMLDivElement | null>(null);
  let containerWidth = $state<number>(1280);
  let steerInputElement = $state<HTMLInputElement | null>(null);
  let isIframeLoading = $state(false);
  let crossOriginRestricted = $state(false);
  let copyScriptSuccess = $state(false);
  let showCrossoriginAssistant = $state(false);
  let isToolbarAgentDropdownOpen = $state(false);
  let isSteerAgentDropdownOpen = $state(false);
  let isPreviewModeDropdownOpen = $state(false);
  let targetSessionId = $state<string>(
    appState.webviewSteerTargetSessionId ||
    appState.agentSessions.find((s) => s.id === appState.activeSessionId)?.id ||
    appState.agentSessions[0]?.id ||
    appState.activeSessionId ||
    ''
  );

  const effectiveColorScheme = $derived(
    resolveEffectiveColorScheme(previewColorScheme, themeState.resolved)
  );

  const desktopScale = $derived.by(() => {
    if (viewportMode !== 'desktop') return 1;
    return calculateDesktopViewportScale(containerWidth, 1280);
  });

  const effectiveIframeSrc = $derived(
    !appState.webPreviewUrl
      ? ''
      : previewMode === 'smart'
        ? buildPreviewProxyUrl(appState.webPreviewUrl)
        : appState.webPreviewUrl
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

  // Broadcast inspect mode state to iframe and native preview
  $effect(() => {
    if (previewMode === 'native') {
      setNativePreviewInspect(appState.isInspectMode);
    } else if (iframeElement && iframeElement.contentWindow) {
      try {
        iframeElement.contentWindow.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
      } catch {}
    }
  });

  // Broadcast color scheme & theme state to iframe
  $effect(() => {
    if (iframeElement && iframeElement.contentWindow) {
      try {
        iframeElement.contentWindow.postMessage({
          type: 'AGENTDECK_SET_THEME',
          colorScheme: effectiveColorScheme
        }, '*');
      } catch {}
    }
  });

  async function connectToUrl(url: string) {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      goHome();
      return;
    }
    const normalized = normalizePreviewUrl(trimmed);
    urlInputValue = normalized;
    appState.setWebPreviewUrl(normalized);
    hasInspectorReady = false;
    crossOriginRestricted = false;
    showCrossoriginAssistant = false;
    if (previewMode === 'native') {
      await openNativePreviewWindow(normalized);
      isNativeActive = true;
    } else {
      reloadIframe();
    }
  }

  async function setPreviewMode(mode: 'direct' | 'smart' | 'native') {
    if (previewMode === mode) return;
    previewMode = mode;
    if (mode === 'native') {
      if (appState.webPreviewUrl) {
        await openNativePreviewWindow(appState.webPreviewUrl);
        isNativeActive = true;
      }
    } else {
      if (isNativeActive) {
        await closeNativePreviewWindow();
        isNativeActive = false;
      }
      reloadIframe();
    }
  }

  async function cyclePreviewMode() {
    if (previewMode === 'direct') {
      await setPreviewMode('smart');
    } else if (previewMode === 'smart') {
      await setPreviewMode('native');
    } else {
      await setPreviewMode('direct');
    }
  }

  async function handleLaunchNative() {
    previewMode = 'native';
    const target = appState.webPreviewUrl || urlInputValue || 'http://localhost:5173';
    await connectToUrl(target);
  }

  async function handleFocusNative() {
    const open = await isNativePreviewOpen();
    if (!open && appState.webPreviewUrl) {
      await openNativePreviewWindow(appState.webPreviewUrl);
      isNativeActive = true;
    } else {
      await focusNativePreviewWindow();
    }
  }

  async function handleReloadNative() {
    const open = await isNativePreviewOpen();
    if (!open && appState.webPreviewUrl) {
      await openNativePreviewWindow(appState.webPreviewUrl);
      isNativeActive = true;
    } else if (appState.webPreviewUrl) {
      await reloadNativePreviewWindow();
    }
  }

  async function handleCloseNative() {
    await closeNativePreviewWindow();
    isNativeActive = false;
    previewMode = 'direct';
    reloadIframe();
  }

  function goHome() {
    appState.setWebPreviewUrl('');
    urlInputValue = '';
    hasInspectorReady = false;
    crossOriginRestricted = false;
    showCrossoriginAssistant = false;
    if (appState.isInspectMode) {
      appState.toggleInspectMode(false);
    }
  }

  function handleUrlSubmit(e?: Event) {
    if (e) e.preventDefault();
    connectToUrl(urlInputValue);
  }

  function reloadIframe() {
    if (!appState.webPreviewUrl) return;
    if (previewMode === 'native') {
      reloadNativePreviewWindow();
      return;
    }
    if (iframeElement) {
      isIframeLoading = true;
      try {
        iframeElement.src = effectiveIframeSrc;
      } catch (err) {
        console.warn('Failed to reload iframe:', err);
      }
    }
  }

  function openExternalBrowser() {
    if (typeof window !== 'undefined' && appState.webPreviewUrl) {
      window.open(appState.webPreviewUrl, '_blank');
    }
  }

  function toggleInspect() {
    if (!appState.webPreviewUrl) return;
    appState.toggleInspectMode();
    if (previewMode === 'native') {
      setNativePreviewInspect(appState.isInspectMode);
    }
    if (appState.isInspectMode && previewMode === 'direct' && !hasInspectorReady && crossOriginRestricted) {
      showCrossoriginAssistant = true;
    } else {
      showCrossoriginAssistant = false;
    }
  }

  function handleIframeLoad() {
    isIframeLoading = false;
    if (!iframeElement || !appState.webPreviewUrl) return;

    // Send theme sync message on load
    try {
      iframeElement.contentWindow?.postMessage({
        type: 'AGENTDECK_SET_THEME',
        colorScheme: effectiveColorScheme
      }, '*');
    } catch {}

    if (previewMode === 'smart') {
      // In Smart Preview mode, inspector script was injected into HTML by proxy
      // Ping iframe to establish 2-way communication channel
      try {
        iframeElement.contentWindow?.postMessage({
          type: 'AGENTDECK_PING'
        }, '*');
        iframeElement.contentWindow?.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
      } catch {}
      crossOriginRestricted = false;
      return;
    }

    // Direct mode: ping inspector and try local script injection if accessible
    try {
      iframeElement.contentWindow?.postMessage({
        type: 'AGENTDECK_PING'
      }, '*');

      const doc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
      if (doc) {
        try {
          doc.documentElement.style.colorScheme = effectiveColorScheme;
          if (effectiveColorScheme === 'dark') {
            doc.documentElement.classList.add('dark');
            doc.documentElement.classList.remove('light');
          } else {
            doc.documentElement.classList.remove('dark');
            doc.documentElement.classList.add('light');
          }
        } catch {}

        const existingScript = doc.getElementById('__agentdeck_inspector_script');
        if (!existingScript) {
          const scriptEl = doc.createElement('script');
          scriptEl.id = '__agentdeck_inspector_script';
          scriptEl.textContent = generateInspectorScript();
          doc.head?.appendChild(scriptEl) || doc.documentElement.appendChild(scriptEl);
        }

        iframeElement.contentWindow?.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
        hasInspectorReady = true;
        crossOriginRestricted = false;
      }
    } catch {
      crossOriginRestricted = true;
    }
  }

  function handleWindowMessage(event: MessageEvent) {
    if (!event.data) return;

    // 1. Inspector confirmed ready inside preview page
    if (event.data.type === 'AGENTDECK_INSPECTOR_READY') {
      hasInspectorReady = true;
      crossOriginRestricted = false;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.postMessage({
          type: 'AGENTDECK_SET_THEME',
          colorScheme: effectiveColorScheme
        }, '*');
        iframeElement.contentWindow.postMessage({
          type: 'AGENTDECK_SET_INSPECT',
          enabled: appState.isInspectMode
        }, '*');
      }
      return;
    }

    // 2. Component clicked / selected in preview
    if (event.data.type === 'AGENTDECK_COMPONENT_PICKED' && event.data.payload) {
      appState.setSelectedComponent(event.data.payload);
      appState.showToast(`Selected <${event.data.payload.componentName || 'element'}>`, 'info');
      return;
    }

    // 2b. Direct steer submitted from in-window popup
    if (event.data.type === 'AGENTDECK_COMPONENT_STEER' && event.data.payload) {
      const meta = event.data.payload.meta;
      const instruction = event.data.payload.instruction;
      if (meta && instruction) {
        appState.setSelectedComponent(meta);
        appState.steerComponentDirectly(instruction, targetSessionId);
      }
      return;
    }

    // 2c. Direct selection cancelled from in-window popup
    if (event.data.type === 'AGENTDECK_COMPONENT_CANCEL') {
      appState.setSelectedComponent(null);
      return;
    }

    // 3. User clicked internal link in preview
    if (event.data.type === 'AGENTDECK_NAVIGATE' && event.data.url) {
      const normalized = normalizePreviewUrl(event.data.url);
      urlInputValue = normalized;
      appState.setWebPreviewUrl(normalized);
      reloadIframe();
      return;
    }
  }

  function handleDirectSteerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitDirectSteer();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelSelection();
    }
  }

  async function submitDirectSteer() {
    if (!appState.directSteerInput.trim() && !appState.selectedComponent) return;
    const text = appState.directSteerInput;
    await appState.steerComponentDirectly(text, targetSessionId);
    if (iframeElement && iframeElement.contentWindow) {
      iframeElement.contentWindow.postMessage({ type: 'AGENTDECK_CLOSE_STEER' }, '*');
    }
    if (isTauri()) {
      closeNativeSteerPopup().catch(() => {});
    }
  }

  function cancelSelection() {
    appState.setSelectedComponent(null);
    if (iframeElement && iframeElement.contentWindow) {
      iframeElement.contentWindow.postMessage({ type: 'AGENTDECK_CLOSE_STEER' }, '*');
    }
    if (isTauri()) {
      closeNativeSteerPopup().catch(() => {});
    }
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

  let unlistenTauriComponent: (() => void) | undefined;
  let unlistenTauriSteer: (() => void) | undefined;
  let isDestroyed = false;

  function normalizePickedData(raw: any): any {
    if (!raw || typeof raw !== 'object') return null;
    let cur = raw;
    while (cur && cur.payload && typeof cur.payload === 'object' && !cur.componentName && !cur.selector) {
      cur = cur.payload;
    }
    return cur;
  }

  onMount(() => {
    window.addEventListener('message', handleWindowMessage);

    // Listen for component picked events (from native OS preview window or HTTP POST bridge)
    listenEvent<any>('agentdeck:component-picked', (payload) => {
      const data = normalizePickedData(payload);
      if (data && (data.componentName || data.selector || data.filePath)) {
        appState.setSelectedComponent(data);
        appState.showToast(`Selected <${data.componentName || 'element'}>`, 'info');
      }
    }).then((fn) => {
      if (fn) {
        if (isDestroyed) {
          fn();
        } else {
          unlistenTauriComponent = fn;
        }
      }
    }).catch(() => {});

    // Listen for component steer events (from in-window modal inside native OS preview window)
    listenEvent<any>('agentdeck:steer-component', async (payload) => {
      let data = payload?.payload !== undefined ? payload.payload : payload;
      while (data && data.payload && typeof data.payload === 'object' && !data.instruction) {
        data = data.payload;
      }
      const meta = data?.meta || data?.component || appState.selectedComponent;
      const instruction = (data?.instruction || '').trim();
      if (meta && instruction) {
        appState.setSelectedComponent(meta);
        await appState.steerComponentDirectly(instruction, targetSessionId);
      }
    }).then((fn) => {
      if (fn) {
        if (isDestroyed) {
          fn();
        } else {
          unlistenTauriSteer = fn;
        }
      }
    }).catch(() => {});

    if (containerElement && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerWidth = entry.contentRect.width;
        }
      });
      ro.observe(containerElement);
      return () => ro.disconnect();
    }
  });

  onDestroy(() => {
    isDestroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', handleWindowMessage);
    }
    if (unlistenTauriComponent) {
      unlistenTauriComponent();
    }
    if (unlistenTauriSteer) {
      unlistenTauriSteer();
    }
  });
</script>

<div class="h-full w-full flex flex-col bg-deck-bg text-deck-text overflow-hidden relative font-sans select-none">
  <!-- 1. Webview Omnibar / Toolbar -->
  <div class="h-10 bg-deck-surface border-b border-deck-border flex items-center justify-between px-3 gap-2 shrink-0 z-20 shadow-xs">
    <!-- Left: Home + URL Input & Actions -->
    <div class="flex items-center flex-1 max-w-xl min-w-0 space-x-1.5">
      {#if appState.webPreviewUrl}
        <button
          type="button"
          onclick={goHome}
          class="p-1.5 rounded-md text-deck-muted hover:text-deck-bright hover:bg-deck-card transition cursor-pointer shrink-0"
          title="Return to Launchpad"
        >
          <Home class="w-3.5 h-3.5" />
        </button>
      {/if}

      <form onsubmit={handleUrlSubmit} class="flex items-center flex-1 min-w-0">
        <div class="flex items-center w-full bg-deck-card rounded-md border border-deck-border px-2 py-1 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
          <Globe class="w-3.5 h-3.5 text-deck-muted shrink-0 mr-1.5" />
          <input
            type="text"
            bind:value={urlInputValue}
            placeholder="Enter URL or port (e.g. 5173, localhost:3000)..."
            class="bg-transparent border-none outline-hidden text-xs text-deck-bright w-full font-mono placeholder:text-deck-muted"
          />
          {#if isIframeLoading}
            <RotateCw class="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0 ml-1.5" />
          {/if}
        </div>
      </form>
    </div>

    <!-- Center: Viewport Presets -->
    <div class="hidden sm:flex items-center bg-deck-card p-0.5 rounded-md border border-deck-border text-xs">
      <button
        type="button"
        onclick={() => (viewportMode = 'full')}
        class="px-2 py-1 rounded transition cursor-pointer {viewportMode === 'full' ? 'bg-deck-surface text-blue-500 font-semibold shadow-2xs' : 'text-deck-muted hover:text-deck-bright'}"
        title="Responsive Viewport (100%)"
      >
        <Monitor class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={() => (viewportMode = 'desktop')}
        class="px-2 py-1 rounded transition cursor-pointer {viewportMode === 'desktop' ? 'bg-deck-surface text-blue-500 font-semibold shadow-2xs' : 'text-deck-muted hover:text-deck-bright'}"
        title="Desktop Viewport (1280px direct browser parity)"
      >
        <Laptop class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={() => (viewportMode = 'tablet')}
        class="px-2 py-1 rounded transition cursor-pointer {viewportMode === 'tablet' ? 'bg-deck-surface text-blue-500 font-semibold shadow-2xs' : 'text-deck-muted hover:text-deck-bright'}"
        title="Tablet Viewport (768px)"
      >
        <Tablet class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={() => (viewportMode = 'mobile')}
        class="px-2 py-1 rounded transition cursor-pointer {viewportMode === 'mobile' ? 'bg-deck-surface text-blue-500 font-semibold shadow-2xs' : 'text-deck-muted hover:text-deck-bright'}"
        title="Mobile Viewport (375px)"
      >
        <Smartphone class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Right: Theme, Mode, Inspect, Maximize & Browser -->
    <div class="flex items-center space-x-1.5 shrink-0">
      <!-- Attached Agent Selector Dropdown -->
      {#if appState.sessions.length > 0}
        <div class="relative hidden sm:block">
          <button
            type="button"
            onclick={() => (isToolbarAgentDropdownOpen = !isToolbarAgentDropdownOpen)}
            class="flex items-center space-x-1.5 px-2.5 py-1 bg-deck-card hover:bg-deck-border/60 border border-deck-border text-deck-bright rounded-md text-xs font-mono font-medium transition cursor-pointer max-w-[170px]"
            title="Choose target agent session to steer"
          >
            <span>{selectedSessionObj?.isAgent ? '🤖' : '💻'}</span>
            <span class="truncate">{selectedSessionObj?.title || 'Select Agent'}</span>
            <ChevronDown class="w-3 h-3 text-deck-muted shrink-0 ml-0.5" />
          </button>

          {#if isToolbarAgentDropdownOpen}
            <button
              type="button"
              class="fixed inset-0 z-40 bg-transparent border-none cursor-default"
              onclick={() => (isToolbarAgentDropdownOpen = false)}
              onkeydown={(e) => { if (e.key === 'Escape') isToolbarAgentDropdownOpen = false; }}
              aria-label="Close dropdown"
            ></button>

            <div class="absolute top-full right-0 mt-1 w-56 bg-deck-surface border border-deck-border rounded-lg shadow-xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
              <div class="px-2.5 py-1 text-[10px] font-semibold text-deck-muted uppercase tracking-wider border-b border-deck-border/50">
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
                    class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-deck-card transition cursor-pointer {sess.id === targetSessionId ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-deck-text'}"
                  >
                    <div class="flex items-center space-x-2 truncate">
                      <span>{sess.isAgent ? '🤖' : '💻'}</span>
                      <span class="font-mono truncate">{sess.title}</span>
                    </div>
                    <div class="flex items-center space-x-1 shrink-0 ml-1.5">
                      {#if sess.id === appState.activeSessionId}
                        <span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
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

      <!-- Color Scheme (Theme) Toggle Pill -->
      <button
        type="button"
        onclick={() => {
          if (previewColorScheme === 'auto') previewColorScheme = 'dark';
          else if (previewColorScheme === 'dark') previewColorScheme = 'light';
          else previewColorScheme = 'auto';
        }}
        class="flex items-center space-x-1.5 px-2 py-1 bg-deck-card hover:bg-deck-border/60 border border-deck-border rounded-md text-xs font-mono transition cursor-pointer text-deck-bright"
        title="Webview Color Scheme: {previewColorScheme} (Click to cycle: Auto -> Dark -> Light)"
      >
        {#if effectiveColorScheme === 'dark'}
          <Moon class="w-3 h-3 text-blue-400" />
          <span class="hidden md:inline text-[11px] capitalize">{previewColorScheme === 'auto' ? 'Dark (Auto)' : 'Dark'}</span>
        {:else}
          <Sun class="w-3 h-3 text-amber-500" />
          <span class="hidden md:inline text-[11px] capitalize">{previewColorScheme === 'auto' ? 'Light (Auto)' : 'Light'}</span>
        {/if}
      </button>

      <!-- Preview Mode Dropdown: Direct | Smart Gateway | Tauri Native -->
      <div class="relative hidden sm:block">
        <button
          type="button"
          onclick={() => (isPreviewModeDropdownOpen = !isPreviewModeDropdownOpen)}
          class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer {previewMode === 'smart' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : previewMode === 'native' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'bg-deck-card hover:bg-deck-border/60 text-deck-bright border border-deck-border'}"
          title="Select webview preview mode"
          aria-haspopup="true"
          aria-expanded={isPreviewModeDropdownOpen}
        >
          {#if previewMode === 'direct'}
            <Radio class="w-3 h-3 text-emerald-500 shrink-0" />
            <span class="hidden md:inline">Direct</span>
          {:else if previewMode === 'smart'}
            <Sparkles class="w-3 h-3 text-blue-400 shrink-0" />
            <span class="hidden md:inline">Smart Gateway</span>
          {:else}
            <Monitor class="w-3 h-3 text-purple-400 shrink-0" />
            <span class="hidden md:inline">Tauri Native</span>
          {/if}
          <ChevronDown class="w-3 h-3 text-deck-muted shrink-0 ml-0.5" />
        </button>

        {#if isPreviewModeDropdownOpen}
          <button
            type="button"
            class="fixed inset-0 z-40 bg-transparent border-none cursor-default"
            onclick={() => (isPreviewModeDropdownOpen = false)}
            onkeydown={(e) => { if (e.key === 'Escape') isPreviewModeDropdownOpen = false; }}
            aria-label="Close dropdown"
          ></button>

          <div class="absolute top-full right-0 mt-1 w-52 bg-deck-surface border border-deck-border rounded-lg shadow-xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
            <div class="px-2.5 py-1 text-[10px] font-semibold text-deck-muted uppercase tracking-wider border-b border-deck-border/50">
              Preview Mode
            </div>
            <div class="py-0.5">
              <button
                type="button"
                onclick={() => {
                  setPreviewMode('direct');
                  isPreviewModeDropdownOpen = false;
                }}
                class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-deck-card transition cursor-pointer {previewMode === 'direct' ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-deck-text'}"
              >
                <div class="flex items-center space-x-2">
                  <Radio class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <div class="font-medium text-deck-bright">Direct</div>
                    <div class="text-[10px] text-deck-muted">Native localhost iframe</div>
                  </div>
                </div>
                {#if previewMode === 'direct'}
                  <Check class="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />
                {/if}
              </button>

              <button
                type="button"
                onclick={() => {
                  setPreviewMode('smart');
                  isPreviewModeDropdownOpen = false;
                }}
                class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-deck-card transition cursor-pointer {previewMode === 'smart' ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-deck-text'}"
              >
                <div class="flex items-center space-x-2">
                  <Sparkles class="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div>
                    <div class="font-medium text-deck-bright">Smart Gateway</div>
                    <div class="text-[10px] text-deck-muted">Transparent reverse proxy</div>
                  </div>
                </div>
                {#if previewMode === 'smart'}
                  <Check class="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                {/if}
              </button>

              <button
                type="button"
                onclick={() => {
                  setPreviewMode('native');
                  isPreviewModeDropdownOpen = false;
                }}
                class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-deck-card transition cursor-pointer {previewMode === 'native' ? 'bg-purple-500/10 text-purple-400 font-semibold' : 'text-deck-text'}"
              >
                <div class="flex items-center space-x-2">
                  <Monitor class="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <div>
                    <div class="font-medium text-deck-bright">Tauri Native</div>
                    <div class="text-[10px] text-deck-muted">OS webview window</div>
                  </div>
                </div>
                {#if previewMode === 'native'}
                  <Check class="w-3.5 h-3.5 text-purple-400 shrink-0 ml-2" />
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- 🎯 Component Inspector Toggle Button -->
      <button
        type="button"
        onclick={toggleInspect}
        disabled={!appState.webPreviewUrl}
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed {appState.isInspectMode ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/50' : 'bg-deck-card hover:bg-deck-border/60 text-deck-bright border border-deck-border'}"
        title={appState.isInspectMode ? 'Element inspection active. Click to exit.' : 'Enable 1-click element inspector'}
      >
        <Crosshair class="w-3.5 h-3.5 {appState.isInspectMode ? 'animate-pulse' : ''}" />
        <span class="hidden md:inline">{appState.isInspectMode ? 'Inspecting UI...' : 'Inspect UI'}</span>
      </button>

      <!-- Full Canvas / Split Toggle -->
      <button
        type="button"
        onclick={() => {
          if (appState.workspaceView === 'split') {
            appState.setWorkspaceView('preview');
          } else {
            appState.setWorkspaceView('split');
          }
        }}
        class="p-1.5 rounded-md text-deck-muted hover:text-deck-bright hover:bg-deck-card transition cursor-pointer"
        title={appState.workspaceView === 'split' ? 'Expand preview to full window' : 'Split preview with terminal'}
      >
        {#if appState.workspaceView === 'split'}
          <Maximize2 class="w-3.5 h-3.5" />
        {:else}
          <Minimize2 class="w-3.5 h-3.5" />
        {/if}
      </button>

      <!-- Reload Button -->
      <button
        type="button"
        onclick={reloadIframe}
        disabled={!appState.webPreviewUrl}
        class="p-1.5 rounded-md text-deck-muted hover:text-deck-bright hover:bg-deck-card transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="Reload webview"
      >
        <RotateCw class="w-3.5 h-3.5 {isIframeLoading ? 'animate-spin text-blue-500' : ''}" />
      </button>

      <!-- Open in Browser Button -->
      {#if appState.webPreviewUrl}
        <button
          type="button"
          onclick={openExternalBrowser}
          class="p-1.5 rounded-md text-deck-muted hover:text-deck-bright hover:bg-deck-card transition cursor-pointer"
          title="Open in default browser"
        >
          <ExternalLink class="w-3.5 h-3.5" />
        </button>
      {/if}
    </div>
  </div>

  <!-- 2. Main Area: Launchpad or Active Webview -->
  <div
    bind:this={containerElement}
    class="flex-1 {viewportMode === 'desktop' ? 'overflow-hidden' : 'overflow-auto'} relative flex items-center justify-center bg-deck-bg"
  >
    {#if !appState.webPreviewUrl}
      <!-- ✨ Web Preview Launchpad (Empty State - Zero White Background!) -->
      <div class="max-w-md w-full p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <!-- Hero Icon -->
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
          <Globe class="w-7 h-7" />
        </div>

        <!-- Heading & Subtitle -->
        <div class="space-y-1.5">
          <h2 class="text-base font-semibold text-deck-bright">
            Web Preview & Element Steering
          </h2>
          <p class="text-xs text-deck-muted leading-relaxed">
            Live preview your local frontend dev server, inspect UI components with 1 click, and steer AI coding agents directly.
          </p>
        </div>

        <!-- Quick Launch Ports -->
        <div class="pt-2 space-y-2.5">
          <div class="text-[11px] font-semibold text-deck-muted uppercase tracking-wider">
            Quick Connect Ports
          </div>
          <div class="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onclick={() => connectToUrl('5173')}
              class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/70 border border-deck-border text-xs font-mono font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95 text-deck-bright"
            >
              <span class="text-blue-500 font-bold">:5173</span>
              <span class="text-deck-muted text-[11px]">Vite</span>
            </button>
            <button
              type="button"
              onclick={() => connectToUrl('3000')}
              class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/70 border border-deck-border text-xs font-mono font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95 text-deck-bright"
            >
              <span class="text-emerald-500 font-bold">:3000</span>
              <span class="text-deck-muted text-[11px]">Next / CRA</span>
            </button>
            <button
              type="button"
              onclick={() => connectToUrl('8080')}
              class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/70 border border-deck-border text-xs font-mono font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95 text-deck-bright"
            >
              <span class="text-purple-500 font-bold">:8080</span>
              <span class="text-deck-muted text-[11px]">Webpack</span>
            </button>
            <button
              type="button"
              onclick={() => connectToUrl('4173')}
              class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/70 border border-deck-border text-xs font-mono font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95 text-deck-bright"
            >
              <span class="text-amber-500 font-bold">:4173</span>
              <span class="text-deck-muted text-[11px]">Preview</span>
            </button>
            <button
              type="button"
              onclick={() => connectToUrl('4321')}
              class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/70 border border-deck-border text-xs font-mono font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-105 active:scale-95 text-deck-bright"
            >
              <span class="text-pink-500 font-bold">:4321</span>
              <span class="text-deck-muted text-[11px]">Astro</span>
            </button>
          </div>
        </div>

        <!-- Quick Launch Input Bar -->
        <div class="pt-2">
          <form onsubmit={handleUrlSubmit} class="flex items-center gap-2 max-w-sm mx-auto">
            <input
              type="text"
              bind:value={urlInputValue}
              placeholder="Or type custom URL/port..."
              class="flex-1 bg-deck-card border border-deck-border rounded-lg px-3 py-2 text-xs font-mono text-deck-bright placeholder:text-deck-muted outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
            <button
              type="submit"
              class="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1 shrink-0 shadow-xs"
            >
              <span>Launch</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        <div class="pt-1 flex items-center justify-center gap-3 text-[11px]">
          <button
            type="button"
            onclick={handleLaunchNative}
            class="text-purple-400 hover:text-purple-300 transition cursor-pointer flex items-center space-x-1 underline underline-offset-2"
          >
            <Monitor class="w-3 h-3" />
            <span>Launch in Tauri Native Window</span>
          </button>
        </div>

        <p class="text-[11px] text-deck-muted">
          Tip: Run <code class="px-1.5 py-0.5 rounded bg-deck-card font-mono text-blue-400 text-[10px]">npm run dev</code> in the terminal and click a port above.
        </p>
      </div>
    {:else if previewMode === 'native'}
      <!-- 🖥️ Tauri Native Webview Active Dashboard Card -->
      <div class="max-w-md w-full p-6 text-center space-y-5 bg-deck-surface border border-deck-border rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <!-- Native status badge -->
        <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-mono font-medium">
          <span class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
          <span>Tauri Native Webview Active</span>
        </div>

        <div class="space-y-1.5">
          <h3 class="text-sm font-semibold text-deck-bright">
            Native OS Webview Window Running
          </h3>
          <p class="text-xs text-deck-muted leading-relaxed">
            Rendering on native OS browser view with zero iframe sandboxing, full WebSocket live-reloading, and complete frame header immunity.
          </p>
          <div class="p-2 rounded-lg bg-deck-bg border border-deck-border font-mono text-xs text-blue-400 select-all truncate">
            {appState.webPreviewUrl}
          </div>

          {#if appState.selectedComponent}
            <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-left space-y-1.5 animate-in fade-in duration-150">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-1.5 font-mono text-xs font-semibold text-blue-400">
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>&lt;{appState.selectedComponent.componentName || 'UI Element'}&gt;</span>
                </div>
                {#if appState.selectedComponent.filePath}
                  <span class="text-[10px] text-deck-muted font-mono truncate max-w-[180px]">
                    {appState.selectedComponent.filePath.split('/').pop()}{appState.selectedComponent.lineNumber ? `:${appState.selectedComponent.lineNumber}` : ''}
                  </span>
                {/if}
              </div>
              <p class="text-[11px] text-deck-muted">
                Component picked from native window! Use the prompt bar below or steer directly inside the native window.
              </p>
            </div>
          {/if}
        </div>

        <!-- Action Controls -->
        <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onclick={handleFocusNative}
            class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Bring to Front</span>
          </button>
          <button
            type="button"
            onclick={handleReloadNative}
            class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/60 text-deck-bright border border-deck-border text-xs font-medium transition cursor-pointer flex items-center space-x-1.5"
          >
            <RotateCw class="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            onclick={() => {
              previewMode = 'direct';
              reloadIframe();
            }}
            class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-deck-border/60 text-deck-bright border border-deck-border text-xs font-medium transition cursor-pointer flex items-center space-x-1.5"
          >
            <Radio class="w-3.5 h-3.5 text-emerald-400" />
            <span>Switch to In-Pane</span>
          </button>
          <button
            type="button"
            onclick={handleCloseNative}
            class="px-3 py-1.5 rounded-lg bg-deck-card hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-deck-muted border border-deck-border text-xs font-medium transition cursor-pointer"
          >
            <span>Close Window</span>
          </button>
        </div>
      </div>
    {:else}
      <!-- 🌐 Active Webview Preview Frame (Direct or Smart Gateway) -->
      <div
        class="transition-all duration-200 flex flex-col relative bg-deck-bg {viewportMode === 'mobile' ? 'w-[375px] h-full shadow-2xl border-x border-deck-border shrink-0' : viewportMode === 'tablet' ? 'w-[768px] h-full shadow-2xl border-x border-deck-border shrink-0' : viewportMode === 'desktop' ? 'shadow-2xl border-x border-deck-border shrink-0' : 'w-full h-full'}"
        style={viewportMode === 'desktop' ? `width: 1280px; height: ${100 / desktopScale}%; transform: scale(${desktopScale}); transform-origin: top center;` : ''}
      >
        <!-- Loading Overlay (Eliminates white flashes!) -->
        {#if isIframeLoading}
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-deck-bg/85 backdrop-blur-xs text-deck-muted pointer-events-none animate-in fade-in duration-100">
            <RotateCw class="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span class="text-xs font-mono text-deck-muted">Connecting to dev server...</span>
          </div>
        {/if}

        <iframe
          bind:this={iframeElement}
          src={effectiveIframeSrc}
          onload={handleIframeLoad}
          title="Frontend Webview Preview"
          class="w-full h-full border-none bg-deck-bg transition-colors"
          style="color-scheme: {effectiveColorScheme}; background-color: rgb(var(--deck-bg));"
          allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; screen-wake-lock; usb; web-share"
          allowtransparency={true}
        ></iframe>
      </div>

      <!-- 💡 Inspector Assistant Popover (Only when user toggles inspect and cross-origin prevents auto-injection) -->
      {#if showCrossoriginAssistant && appState.isInspectMode && !appState.selectedComponent}
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div class="bg-deck-surface border border-blue-500/40 rounded-xl p-3.5 shadow-2xl text-xs space-y-2.5 font-sans ring-1 ring-blue-500/20 text-deck-text">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1.5 text-blue-400 font-semibold">
                <Crosshair class="w-4 h-4 shrink-0" />
                <span>Enable 1-Click UI Inspection</span>
              </div>
              <button
                type="button"
                onclick={() => (showCrossoriginAssistant = false)}
                class="text-deck-muted hover:text-deck-bright cursor-pointer p-0.5"
                aria-label="Dismiss"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <p class="text-deck-muted text-[11px] leading-relaxed">
              Browser security restricts inspecting cross-port iframes. To enable 1-click element picking:
            </p>

            <div class="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onclick={() => {
                  previewMode = 'smart';
                  showCrossoriginAssistant = false;
                  reloadIframe();
                }}
                class="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center space-x-1 shadow-xs"
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>Switch to Smart Proxy</span>
              </button>

              <button
                type="button"
                onclick={copyDevScript}
                class="px-3 py-1.5 bg-deck-card hover:bg-deck-border text-deck-bright border border-deck-border rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1 shrink-0"
              >
                {#if copyScriptSuccess}
                  <Check class="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied!</span>
                {:else}
                  <Code2 class="w-3.5 h-3.5" />
                  <span>Copy Snippet</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- 3. Direct Component Steer Floating Bar (Appears when element is picked in ANY preview mode!) -->
    {#if appState.selectedComponent}
      {@const comp = appState.selectedComponent}
      <div class="absolute bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto bg-deck-surface border border-blue-500/40 rounded-xl p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-150 space-y-2.5 ring-1 ring-blue-500/20 font-sans text-deck-text">
        <!-- Target Header & Metadata Pill Row -->
        <div class="flex items-center justify-between gap-2 border-b border-deck-border/60 pb-2">
          <div class="flex items-center space-x-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <!-- Target Component Badge -->
            <div class="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-semibold shrink-0">
              <Sparkles class="w-3 h-3 text-blue-500" />
              <span>&lt;{comp.componentName || 'UI Element'}&gt;</span>
            </div>

            <!-- Source File Location Pill -->
            {#if comp.filePath}
              <div class="px-2 py-0.5 rounded-md bg-deck-card text-deck-muted text-[11px] font-mono truncate max-w-[200px]" title="{comp.filePath}:{comp.lineNumber || 1}">
                {comp.filePath.split('/').pop()}{comp.lineNumber ? `:${comp.lineNumber}` : ''}
              </div>
            {/if}

            <!-- CSS Selector Pill -->
            {#if comp.selector}
              <div class="px-2 py-0.5 rounded-md bg-deck-card text-deck-muted text-[11px] font-mono truncate max-w-[160px]" title={comp.selector}>
                {comp.selector}
              </div>
            {/if}
          </div>

          <!-- Close / Cancel Button -->
          <button
            onclick={cancelSelection}
            class="p-1 rounded-md text-deck-muted hover:text-deck-bright hover:bg-deck-card transition cursor-pointer shrink-0"
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
            class="flex-1 bg-deck-card border border-deck-border rounded-lg px-3 py-2 text-xs text-deck-bright placeholder:text-deck-muted outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
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
        <div class="flex items-center justify-between gap-2 text-[11px] text-deck-muted pt-0.5">
          <div class="flex items-center space-x-1.5">
            <span>Steer to:</span>
            <div class="relative">
              <button
                type="button"
                onclick={() => (isSteerAgentDropdownOpen = !isSteerAgentDropdownOpen)}
                class="flex items-center space-x-1.5 px-2 py-0.5 bg-deck-card hover:bg-deck-border border border-deck-border text-blue-400 rounded text-xs font-mono font-semibold transition cursor-pointer"
                title="Choose which agent terminal session receives this instruction"
              >
                <span>{selectedSessionObj?.isAgent ? '🤖' : '💻'}</span>
                <span class="truncate max-w-[130px]">{selectedSessionObj?.title || 'Select Session'}</span>
                <ChevronDown class="w-3 h-3 text-blue-500 shrink-0 ml-0.5" />
              </button>

              {#if isSteerAgentDropdownOpen}
                <button
                  type="button"
                  class="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                  onclick={() => (isSteerAgentDropdownOpen = false)}
                  onkeydown={(e) => { if (e.key === 'Escape') isSteerAgentDropdownOpen = false; }}
                  aria-label="Close dropdown"
                ></button>

                <div class="absolute bottom-full left-0 mb-1.5 w-56 bg-deck-surface border border-deck-border rounded-lg shadow-xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div class="px-2.5 py-1 text-[10px] font-semibold text-deck-muted uppercase tracking-wider border-b border-deck-border/50">
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
                        class="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-deck-card transition cursor-pointer {sess.id === targetSessionId ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-deck-text'}"
                      >
                        <div class="flex items-center space-x-2 truncate">
                          <span>{sess.isAgent ? '🤖' : '💻'}</span>
                          <span class="font-mono truncate">{sess.title}</span>
                        </div>
                        <div class="flex items-center space-x-1 shrink-0 ml-1.5">
                          {#if sess.id === appState.activeSessionId}
                            <span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
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

          <span class="text-[10px] text-deck-muted">
            Press <strong class="text-deck-bright font-mono">Enter</strong> to steer • <strong class="text-deck-bright font-mono">Esc</strong> to cancel
          </span>
        </div>
      </div>
    {/if}
  </div>
</div>
