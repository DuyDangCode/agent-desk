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

  let isInspectEnabled = false;
  let hoveredElement = null;

  // Create floating highlight overlay
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

  document.documentElement.appendChild(overlay);

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
    if (!el || el === overlay || el === badge) {
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
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === overlay || target === badge) return;
    hoveredElement = target;
    updateOverlay(target);
  }, true);

  window.addEventListener('click', function(e) {
    if (!isInspectEnabled) return;
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
        htmlSnippet: target.outerHTML ? target.outerHTML.slice(0, 1000) : '',
        textContent: target.innerText ? target.innerText.slice(0, 150) : '',
        classes: typeof target.className === 'string' ? target.className : '',
        pageUrl: window.location.href
      }
    };

    window.parent.postMessage(payload, '*');
  }, true);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'AGENTDECK_SET_INSPECT') {
      isInspectEnabled = !!e.data.enabled;
      if (!isInspectEnabled) {
        overlay.style.display = 'none';
        hoveredElement = null;
      }
    }
  });
})();
  `.trim();
}
