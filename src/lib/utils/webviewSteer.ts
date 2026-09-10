import type { UIComponentContext } from '$lib/types';

/**
 * Normalizes user input into a valid HTTP/HTTPS URL for preview.
 */
export function normalizePreviewUrl(input: string): string {
  if (!input || !input.trim()) {
    return 'http://localhost:5173';
  }

  const trimmed = input.trim();

  // If just a port number (e.g. "3000" or "5173")
  if (/^\d{2,5}$/.test(trimmed)) {
    return `http://localhost:${trimmed}`;
  }

  // If already starts with http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Prepend http://
  return `http://${trimmed}`;
}

/**
 * Scans terminal PTY output lines for local development server URLs.
 */
export function detectDevServerUrl(output: string): string | null {
  if (!output) return null;

  // Patterns for Vite, Next.js, Astro, Webpack, Nuxt, SvelteKit, etc.
  // Example matches:
  // "Local:   http://localhost:5173/"
  // "- Local: http://localhost:3000"
  // "Server running at http://127.0.0.1:8080/"
  const localUrlRegex = /(?:Local:\s*|running at\s*|ready in\s*\d+\s*m?s:\s*|url:\s*)(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\/?\S*)/i;
  const match = output.match(localUrlRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback: search for any localhost/127.0.0.1 port URL
  const genericMatch = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\/?\S*/i);
  if (genericMatch && genericMatch[0]) {
    return genericMatch[0].trim();
  }

  return null;
}

/**
 * Sanitizes and truncates HTML snippet to avoid overflowing terminal prompts.
 */
export function truncateHtmlSnippet(html: string, maxLength: number = 800): string {
  if (!html) return '';
  const cleaned = html
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const suffix = '... [truncated]';
  const sliceLen = Math.max(0, maxLength - suffix.length);
  return cleaned.slice(0, sliceLen).trim() + ' ' + suffix;
}

/**
 * Encapsulates payload inside standard ANSI Bracketed Paste mode escape sequences.
 */
export function encodeBracketedPaste(text: string): string {
  return `\x1b[200~${text}\x1b[201~\r`;
}

/**
 * Synthesizes a structured, high-context steering prompt combining
 * the selected UI component details with developer instruction.
 */
export function formatComponentSteerPrompt(
  context: UIComponentContext,
  instruction: string
): string {
  let targetTag = context.componentName ? `<${context.componentName}>` : '';
  if (!targetTag) {
    const tagMatch = context.htmlSnippet ? context.htmlSnippet.match(/^<([a-zA-Z0-9_-]+)/) : null;
    targetTag = tagMatch ? `<${tagMatch[1]}>` : (context.selector || 'UI Element');
  }

  const fileInfo = context.filePath 
    ? `${context.filePath}${context.lineNumber ? ` (Line ${context.lineNumber})` : ''}` 
    : 'Unknown (inferred from DOM)';

  const shortFileLoc = context.filePath 
    ? ` (${context.filePath}${context.lineNumber ? `:${context.lineNumber}` : ''})`
    : '';

  const cleanInstruction = instruction.trim() || 'Please review and explain this component and suggest styling or structural improvements.';

  const parts = [
    `[UI Component Request]`,
    `Target: ${targetTag}${shortFileLoc}`,
    `File: ${fileInfo}`,
    `Selector: ${context.selector || 'N/A'}`,
    `Page URL: ${context.pageUrl || 'N/A'}`,
  ];

  if (context.classes) {
    parts.push(`Classes: ${context.classes}`);
  }

  if (context.textContent && context.textContent.trim()) {
    parts.push(`Text Content: "${context.textContent.trim().slice(0, 150)}"`);
  }

  parts.push(`\nHTML Snippet:`);
  parts.push(`\`\`\`html\n${truncateHtmlSnippet(context.htmlSnippet || '', 1000)}\n\`\`\``);

  parts.push(`\nInstruction:\n${cleanInstruction}`);

  return parts.join('\n');
}

/**
 * Resolves the destination terminal session ID for component steering.
 * Prioritizes explicit target -> configured UI target -> active agent -> first agent -> active session.
 */
export function resolveSteerTargetSession(
  sessions: Array<{ id: string; isAgent: boolean; title?: string }>,
  activeSessionId?: string | null,
  explicitTargetId?: string | null,
  configuredTargetId?: string | null
): string | null {
  if (!sessions || sessions.length === 0) return null;

  // 1. Explicit target passed directly
  if (explicitTargetId) {
    const found = sessions.find((s) => s.id === explicitTargetId);
    if (found) return found.id;
  }

  // 2. Configured target chosen by user in dropdown
  if (configuredTargetId) {
    const found = sessions.find((s) => s.id === configuredTargetId);
    if (found) return found.id;
  }

  // 3. Active session if it is an agent
  if (activeSessionId) {
    const active = sessions.find((s) => s.id === activeSessionId);
    if (active && active.isAgent) return active.id;
  }

  // 4. First available agent session
  const firstAgent = sessions.find((s) => s.isAgent);
  if (firstAgent) return firstAgent.id;

  // 5. Active session fallback
  if (activeSessionId) {
    const active = sessions.find((s) => s.id === activeSessionId);
    if (active) return active.id;
  }

  // 6. First available session
  return sessions[0].id;
}

/**
 * Generates the client-side JavaScript overlay & inspector engine
 * to inject into the webview iframe or development page.
 */
export function generateInspectorScript(): string {
  return `
(function() {
  if (window.__AGENTDECK_INSPECTOR_ACTIVE__) return;
  window.__AGENTDECK_INSPECTOR_ACTIVE__ = true;

  // 1. Path Virtualization for Dev Gateway
  try {
    const loc = window.location;
    const pathname = loc.pathname;
    if (pathname.startsWith('/proxy/')) {
      const afterProxy = pathname.slice(7);
      const slashIdx = afterProxy.indexOf('/');
      const virtualPath = slashIdx === -1 ? '/' : afterProxy.slice(slashIdx);
      const target = (virtualPath || '/') + loc.search + loc.hash;
      if (loc.pathname !== virtualPath) {
        window.history.replaceState(window.history.state, '', target);
      }
    } else if (pathname === '/api/preview' || pathname === '/preview') {
      const sp = new URLSearchParams(loc.search);
      const urlParam = sp.get('url');
      if (urlParam) {
        try {
          const parsed = new URL(urlParam);
          const virtualPath = (parsed.pathname || '/') + parsed.search + parsed.hash;
          window.history.replaceState(window.history.state, '', virtualPath);
        } catch {}
      }
    }
    const baseEl = document.querySelector('base');
    if (baseEl && baseEl.href && !baseEl.href.startsWith(loc.origin)) {
      baseEl.remove();
    }
  } catch (err) {}

  // 2. Prevent white background flash
  try {
    if (document.documentElement && !document.documentElement.style.backgroundColor) {
      document.documentElement.style.backgroundColor = '#0d1117';
    }
  } catch (err) {}

  let isInspectEnabled = false;
  let hoveredElement = null;

  // 3. Highlight Overlay and Badge
  const overlay = document.createElement('div');
  overlay.id = '__agentdeck_overlay';
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.border = '2px solid #3b82f6';
  overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
  overlay.style.transition = 'all 60ms ease-out';
  overlay.style.display = 'none';
  overlay.style.boxSizing = 'border-box';

  const badge = document.createElement('div');
  badge.id = '__agentdeck_badge';
  badge.style.position = 'absolute';
  badge.style.top = '-26px';
  badge.style.left = '0px';
  badge.style.backgroundColor = '#1e293b';
  badge.style.color = '#f8fafc';
  badge.style.fontFamily = 'monospace';
  badge.style.fontSize = '11px';
  badge.style.padding = '2px 6px';
  badge.style.borderRadius = '4px';
  badge.style.whiteSpace = 'nowrap';
  badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  badge.style.pointerEvents = 'none';
  overlay.appendChild(badge);

  function ensureOverlayMounted() {
    if (!document.getElementById('__agentdeck_overlay')) {
      (document.body || document.documentElement).appendChild(overlay);
    }
  }
  if (document.body || document.documentElement) {
    ensureOverlayMounted();
  } else {
    window.addEventListener('DOMContentLoaded', ensureOverlayMounted);
  }

  function getElementSourceMeta(el) {
    let componentName = el.tagName.toLowerCase();
    let filePath = null;
    let lineNumber = null;

    // React Fiber inspection
    try {
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (fiber._debugSource) {
            filePath = fiber._debugSource.fileName;
            lineNumber = fiber._debugSource.lineNumber;
          }
          if (fiber.type && typeof fiber.type === 'function') {
            componentName = fiber.type.displayName || fiber.type.name || componentName;
            break;
          }
          fiber = fiber.return;
        }
      }
    } catch {}

    // Svelte 4/5 inspection
    try {
      if (el.__svelte_meta && el.__svelte_meta.loc) {
        filePath = el.__svelte_meta.loc.file;
        lineNumber = el.__svelte_meta.loc.line;
      }
    } catch {}

    // Vue 3 inspection
    try {
      if (el.__vnode) {
        const comp = el.__vnode.type;
        if (comp && typeof comp === 'object') {
          componentName = comp.name || comp.__name || componentName;
          filePath = comp.__file || filePath;
        }
      }
    } catch {}

    // Data-attributes fallback (e.g. data-source-loc, data-component)
    if (el.dataset && el.dataset.sourceLoc) {
      const parts = el.dataset.sourceLoc.split(':');
      filePath = parts[0];
      if (parts[1]) lineNumber = parseInt(parts[1], 10);
    }
    if (el.dataset && el.dataset.component) {
      componentName = el.dataset.component;
    }

    return { componentName, filePath, lineNumber };
  }

  function getElementSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 3) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.trim().split(/\\s+/)[0];
        if (firstClass && !firstClass.startsWith('__')) {
          selector += '.' + firstClass;
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function updateOverlay(el) {
    if (!el || el === overlay || el === badge || el.id === '__agentdeck_native_pill') {
      overlay.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const meta = getElementSourceMeta(el);
    const tagLabel = meta.componentName || el.tagName.toLowerCase();
    const fileLabel = meta.filePath ? ' (' + meta.filePath.split('/').pop() + (meta.lineNumber ? ':' + meta.lineNumber : '') + ')' : '';
    badge.textContent = '<' + tagLabel + '>' + fileLabel;

    // Adjust badge positioning if element is at top of screen
    if (rect.top < 30) {
      badge.style.top = '4px';
    } else {
      badge.style.top = '-26px';
    }
  }

  window.addEventListener('mousemove', function(e) {
    if (!isInspectEnabled) return;
    if (e.target && ((e.target as any).id === '__agentdeck_steer_popup' || ((e.target as any).closest && (e.target as any).closest('#__agentdeck_steer_popup')))) {
      overlay.style.display = 'none';
      return;
    }
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === overlay || target === badge || target.id === '__agentdeck_native_pill') return;
    hoveredElement = target;
    updateOverlay(target);
  }, true);

  function escapeHtml(str: any) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function closeNativeSteerPopup() {
    const existing = document.getElementById('__agentdeck_steer_popup');
    if (existing) {
      existing.remove();
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  (window as any).__AGENTDECK_CLOSE_STEER_POPUP__ = closeNativeSteerPopup;

  function notifySelectionCancelled() {
    try {
      window.parent.postMessage({ type: 'AGENTDECK_COMPONENT_CANCEL' }, '*');
    } catch {}
    try {
      if ((window as any).__TAURI_INTERNALS__ && typeof (window as any).__TAURI_INTERNALS__.invoke === 'function') {
        (window as any).__TAURI_INTERNALS__.invoke('report_inspected_component', { payload: null });
      } else if ((window as any).__TAURI__ && (window as any).__TAURI__.core && typeof (window as any).__TAURI__.core.invoke === 'function') {
        (window as any).__TAURI__.core.invoke('report_inspected_component', { payload: null });
      }
    } catch {}
  }

  function showNativeSteerPopup(meta: any) {
    if (!meta) return;
    const existing = document.getElementById('__agentdeck_steer_popup');
    if (existing) {
      existing.remove();
    }

    const popup = document.createElement('div');
    popup.id = '__agentdeck_steer_popup';
    popup.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(640px,calc(100vw - 32px));background:#0f172a;border:1px solid rgba(59,130,246,0.4);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,0.65),0 0 0 1px rgba(59,130,246,0.2);padding:14px 16px;font-family:system-ui,-apple-system,sans-serif;color:#f8fafc;box-sizing:border-box;';

    const tag = meta.componentName || 'UI Element';
    const fileLoc = meta.filePath ? (meta.filePath.split('/').pop() + (meta.lineNumber ? ':' + meta.lineNumber : '')) : '';
    const selector = meta.selector || '';

    popup.innerHTML = [
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">',
        '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;flex:1;">',
          '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:6px;color:#60a5fa;font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;">',
            '&lt;' + escapeHtml(tag) + '&gt;',
          '</span>',
          fileLoc ? '<span style="padding:2px 7px;background:#1e293b;border-radius:6px;color:#94a3b8;font-family:monospace;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:180px;" title="' + escapeHtml(fileLoc) + '">' + escapeHtml(fileLoc) + '</span>' : '',
          selector ? '<span style="padding:2px 7px;background:#1e293b;border-radius:6px;color:#94a3b8;font-family:monospace;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:150px;" title="' + escapeHtml(selector) + '">' + escapeHtml(selector) + '</span>' : '',
        '</div>',
        '<button id="__agentdeck_popup_close" type="button" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:4px;border-radius:4px;font-size:14px;line-height:1;" title="Dismiss (Esc)">✕</button>',
      '</div>',
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">',
        '<input id="__agentdeck_steer_input" type="text" placeholder="Describe what to change on &lt;' + escapeHtml(tag) + '&gt;..." style="flex:1;min-width:0;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;font-size:12px;color:#f8fafc;outline:none;box-sizing:border-box;" />',
        '<button id="__agentdeck_steer_submit" type="button" style="padding:8px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:background 120ms;">',
          '<span>Steer to Agent</span>',
        '</button>',
      '</div>',
      '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#64748b;">',
        '<span>🎯 Steer target: <strong style="color:#93c5fd;">Active Terminal Agent</strong></span>',
        '<span>Press <strong style="color:#cbd5e1;font-family:monospace;">Enter</strong> to steer • <strong style="color:#cbd5e1;font-family:monospace;">Esc</strong> to cancel</span>',
      '</div>'
    ].join('');

    (document.body || document.documentElement).appendChild(popup);

    const input = document.getElementById('__agentdeck_steer_input') as HTMLInputElement | null;
    const submitBtn = document.getElementById('__agentdeck_steer_submit') as HTMLButtonElement | null;
    const closeBtn = document.getElementById('__agentdeck_popup_close') as HTMLButtonElement | null;

    function executeSteer() {
      const instruction = (input ? input.value : '').trim();
      if (!instruction) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Steering...';
        submitBtn.style.background = '#475569';
      }

      // 1. Post to parent iframe if embedded
      try {
        window.parent.postMessage({
          type: 'AGENTDECK_COMPONENT_STEER',
          payload: { meta: meta, instruction: instruction }
        }, '*');
      } catch {}

      // 2. HTTP POST to AgentDeck backend server (4020 and fallback 4022)
      try {
        fetch('http://127.0.0.1:4020/api/component-steer', {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meta: meta, instruction: instruction })
        }).catch(function() {
          fetch('http://127.0.0.1:4022/api/component-steer', {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meta: meta, instruction: instruction })
          }).catch(function() {});
        });
      } catch {}

      // 3. Invoke Tauri backend if running in native OS webview
      try {
        if ((window as any).__TAURI_INTERNALS__ && typeof (window as any).__TAURI_INTERNALS__.invoke === 'function') {
          (window as any).__TAURI_INTERNALS__.invoke('steer_selected_component', { meta: meta, instruction: instruction });
        } else if ((window as any).__TAURI__ && (window as any).__TAURI__.core && typeof (window as any).__TAURI__.core.invoke === 'function') {
          (window as any).__TAURI__.core.invoke('steer_selected_component', { meta: meta, instruction: instruction });
        }
      } catch {}

      if (submitBtn) {
        submitBtn.style.background = '#10b981';
        submitBtn.textContent = '✓ Steered to Agent!';
      }
      setTimeout(closeNativeSteerPopup, 1200);
    }

    if (input) {
      setTimeout(function() { input.focus(); }, 60);
      input.addEventListener('keydown', function(evt) {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          executeSteer();
        } else if (evt.key === 'Escape') {
          evt.preventDefault();
          closeNativeSteerPopup();
          notifySelectionCancelled();
        }
      });
    }

    if (closeBtn) {
      closeBtn.onclick = function(evt) {
        evt.preventDefault();
        closeNativeSteerPopup();
        notifySelectionCancelled();
      };
    }

    if (submitBtn) {
      submitBtn.onclick = function(evt) {
        evt.preventDefault();
        executeSteer();
      };
    }
  }

  function dispatchComponentPicked(payload: any) {
    // 1. Post to parent iframe if embedded
    try {
      window.parent.postMessage(payload, '*');
    } catch {}

    // 2. Post to opener window if opened in a popup or separate browser tab
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, '*');
      }
    } catch {}

    // 3. HTTP POST to AgentDeck backend server (handles standalone native webviews & external browsers)
    try {
      const data = payload.payload || payload;
      fetch('http://127.0.0.1:4020/api/component-picked', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(function() {
        fetch('http://127.0.0.1:4022/api/component-picked', {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(function() {});
      });
    } catch {}

    // 4. Invoke Tauri backend if running in native OS webview with IPC
    try {
      if ((window as any).__TAURI_INTERNALS__ && typeof (window as any).__TAURI_INTERNALS__.invoke === 'function') {
        (window as any).__TAURI_INTERNALS__.invoke('report_inspected_component', { payload: payload.payload });
      } else if ((window as any).__TAURI__ && (window as any).__TAURI__.core && typeof (window as any).__TAURI__.core.invoke === 'function') {
        (window as any).__TAURI__.core.invoke('report_inspected_component', { payload: payload.payload });
      }
    } catch {}
  }

  window.addEventListener('click', function(e) {
    if (!isInspectEnabled) return;
    if (e.target && ((e.target as any).id === '__agentdeck_native_pill' || ((e.target as any).closest && (e.target as any).closest('#__agentdeck_native_pill')))) return;
    if (e.target && ((e.target as any).id === '__agentdeck_steer_popup' || ((e.target as any).closest && (e.target as any).closest('#__agentdeck_steer_popup')))) return;

    e.preventDefault();
    e.stopPropagation();

    const target = hoveredElement || document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;

    const meta = getElementSourceMeta(target);
    const selector = getElementSelector(target);

    const payload = {
      type: 'AGENTDECK_COMPONENT_PICKED',
      payload: {
        componentName: meta.componentName,
        filePath: meta.filePath,
        lineNumber: meta.lineNumber,
        selector: selector,
        htmlSnippet: (target as HTMLElement).outerHTML ? (target as HTMLElement).outerHTML.slice(0, 1000) : '',
        textContent: (target as HTMLElement).innerText ? (target as HTMLElement).innerText.slice(0, 150) : '',
        classes: typeof (target as HTMLElement).className === 'string' ? (target as HTMLElement).className : '',
        pageUrl: window.location.href
      }
    };

    setInspectState(false);
    dispatchComponentPicked(payload);
    showNativeSteerPopup(payload.payload);
  }, true);

  function setInspectState(enabled: boolean) {
    isInspectEnabled = !!enabled;
    if (!isInspectEnabled) {
      overlay.style.display = 'none';
      hoveredElement = null;
    } else {
      closeNativeSteerPopup();
    }
    const pill = document.getElementById('__agentdeck_native_pill');
    if (pill) {
      pill.textContent = isInspectEnabled ? '🎯 Inspecting UI...' : '🎯 Inspect UI';
      pill.style.background = isInspectEnabled ? '#2563eb' : '#1e293b';
      pill.style.color = '#ffffff';
      pill.style.boxShadow = isInspectEnabled ? '0 0 12px rgba(37,99,235,0.6)' : '0 4px 14px rgba(0,0,0,0.35)';
    }
  }

  (window as any).__AGENTDECK_SET_INSPECT__ = setInspectState;

  // 4. Floating Native Inspection Pill (only when running in top-level window)
  if (window.parent === window) {
    function initNativePill() {
      if (document.getElementById('__agentdeck_native_pill')) return;
      const pill = document.createElement('button');
      pill.id = '__agentdeck_native_pill';
      pill.type = 'button';
      pill.textContent = '🎯 Inspect UI';
      pill.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;padding:8px 14px;border-radius:20px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:all 150ms ease;border:1px solid rgba(255,255,255,0.2);outline:none;user-select:none;background:#1e293b;color:#f1f5f9;';
      pill.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        setInspectState(!isInspectEnabled);
      };
      (document.body || document.documentElement).appendChild(pill);
    }
    if (document.body) {
      initNativePill();
    } else {
      window.addEventListener('DOMContentLoaded', initNativePill);
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'AGENTDECK_SET_INSPECT') {
      setInspectState(e.data.enabled);
    } else if (e.data.type === 'AGENTDECK_CLOSE_STEER') {
      closeNativeSteerPopup();
    } else if (e.data.type === 'AGENTDECK_SET_THEME') {
      const scheme = e.data.colorScheme || 'dark';
      try {
        document.documentElement.style.colorScheme = scheme;
        if (scheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
      } catch {}
    } else if (e.data.type === 'AGENTDECK_PING') {
      try {
        window.parent.postMessage({ type: 'AGENTDECK_INSPECTOR_READY', url: window.location.href }, '*');
      } catch {}
    }
  });

  // Intercept normal link clicks for parent navigation sync when not inspecting
  window.addEventListener('click', function(e) {
    if (isInspectEnabled) return;
    const targetLink = e.target && (e.target as HTMLElement).closest ? (e.target as HTMLElement).closest('a') : null;
    if (targetLink && targetLink.href && !targetLink.target && !targetLink.href.startsWith('javascript:')) {
      try {
        window.parent.postMessage({ type: 'AGENTDECK_NAVIGATE', url: targetLink.href }, '*');
      } catch {}
    }
  }, true);

  // Announce inspector presence to parent frame on load
  try {
    window.parent.postMessage({ type: 'AGENTDECK_INSPECTOR_READY', url: window.location.href }, '*');
  } catch {}
})();
  `.trim();
}

/**
 * Extracts port from URL string (e.g. "http://localhost:5173/app" -> 5173)
 */
export function extractPortFromUrl(url: string): number | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/:(\d+)(?:\/|\?|#|$)/);
  if (match && match[1]) {
    const port = parseInt(match[1], 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return port;
    }
  }
  return null;
}

/**
 * Constructs a proxy URL directing through the local AgentDeck backend preview gateway.
 * Uses transparent /proxy/:port/* path format so scripts, CSS, assets, and APIs load flawlessly.
 * Strips X-Frame-Options & CSP frame-ancestors, and injects inspector script.
 */
export function buildPreviewProxyUrl(targetUrl: string, proxyBase: string = 'http://127.0.0.1:4020'): string {
  const normalized = normalizePreviewUrl(targetUrl);
  const base = proxyBase.replace(/\/+$/, '');
  const port = extractPortFromUrl(normalized);
  if (port) {
    try {
      const u = new URL(normalized);
      const subPath = (u.pathname || '/') + (u.search || '') + (u.hash || '');
      const cleanSub = subPath.startsWith('/') ? subPath : `/${subPath}`;
      return `${base}/proxy/${port}${cleanSub}`;
    } catch {
      return `${base}/proxy/${port}/`;
    }
  }
  return `${base}/api/preview?url=${encodeURIComponent(normalized)}`;
}


/**
 * Injects <base href="..."> and inspector <script> tag into raw HTML.
 */
export function preparePreviewHtml(rawHtml: string, baseUrl: string): string {
  if (!rawHtml) return '';
  let html = rawHtml;
  let cleanBaseUrl = normalizePreviewUrl(baseUrl);
  if (!cleanBaseUrl.endsWith('/') && !cleanBaseUrl.split('/').pop()?.includes('.')) {
    cleanBaseUrl += '/';
  }

  // 1. Inject <base href="..."> if not already present
  if (!/<base\s+[^>]*href=/i.test(html)) {
    const baseTag = `<base href="${cleanBaseUrl}">`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${baseTag}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n  ${baseTag}\n</head>`);
    } else {
      html = `<head>\n  ${baseTag}\n</head>\n${html}`;
    }
  }

  // 2. Inject inspector script tag if not already present
  if (!html.includes('__agentdeck_inspector_script')) {
    const scriptTag = `<script id="__agentdeck_inspector_script">\n${generateInspectorScript()}\n</script>`;
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `  ${scriptTag}\n</head>`);
    } else if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
    } else {
      html = `${html}\n${scriptTag}`;
    }
  }

  return html;
}

/**
 * Computes responsive scaling factor for desktop viewport emulation.
 * When container width is less than targetWidth (e.g. 1280px), scales down proportionally.
 */
export function calculateDesktopViewportScale(containerWidth: number, targetWidth: number = 1280): number {
  if (containerWidth <= 0 || targetWidth <= 0) return 1;
  const available = Math.max(320, containerWidth - 16);
  if (available < targetWidth) {
    return Math.max(0.25, Math.min(1, available / targetWidth));
  }
  return 1;
}

/**
 * Resolves effective iframe color scheme based on user preference and active theme.
 */
export function resolveEffectiveColorScheme(
  preference: 'auto' | 'dark' | 'light',
  resolvedTheme: string
): 'dark' | 'light' {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}
