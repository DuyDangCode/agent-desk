import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  normalizePreviewUrl, 
  detectDevServerUrl, 
  truncateHtmlSnippet, 
  formatComponentSteerPrompt,
  encodeBracketedPaste,
  generateInspectorScript,
  resolveSteerTargetSession
} from '../src/lib/utils/webviewSteer.ts';
import type { UIComponentContext } from '../src/lib/types/index.ts';

describe('Webview & Component Steering Utility Tests', () => {
  describe('normalizePreviewUrl', () => {
    it('Lower Boundary: empty, whitespace or invalid strings default to standard localhost:5173', () => {
      assert.equal(normalizePreviewUrl(''), 'http://localhost:5173');
      assert.equal(normalizePreviewUrl('   '), 'http://localhost:5173');
    });

    it('In-Bound: port-only or domain-only inputs are prefixed with http://', () => {
      assert.equal(normalizePreviewUrl('3000'), 'http://localhost:3000');
      assert.equal(normalizePreviewUrl('5173'), 'http://localhost:5173');
      assert.equal(normalizePreviewUrl('localhost:8080'), 'http://localhost:8080');
      assert.equal(normalizePreviewUrl('127.0.0.1:4173'), 'http://127.0.0.1:4173');
      assert.equal(normalizePreviewUrl('my-app.test:3000/dashboard'), 'http://my-app.test:3000/dashboard');
    });

    it('Upper Boundary: full http/https URLs with paths and query params are preserved intact', () => {
      assert.equal(normalizePreviewUrl('http://localhost:5173/admin?tab=settings'), 'http://localhost:5173/admin?tab=settings');
      assert.equal(normalizePreviewUrl('https://staging.internal.app/login'), 'https://staging.internal.app/login');
      assert.equal(normalizePreviewUrl('http://127.0.0.1:3000/#section-2'), 'http://127.0.0.1:3000/#section-2');
    });
  });

  describe('detectDevServerUrl', () => {
    it('Lower Boundary: empty string or terminal output without URLs returns null', () => {
      assert.equal(detectDevServerUrl(''), null);
      assert.equal(detectDevServerUrl('Compiling assets... Done in 140ms.'), null);
      assert.equal(detectDevServerUrl('git status\nOn branch main\nnothing to commit'), null);
    });

    it('In-Bound: extracts Vite, Next.js, and general dev server URLs', () => {
      const viteLog = `
        VITE v5.4.2  ready in 280 ms

        ➜  Local:   http://localhost:5173/
        ➜  Network: use --host to expose
      `;
      assert.equal(detectDevServerUrl(viteLog), 'http://localhost:5173/');

      const nextLog = `
        - Local:        http://localhost:3000
        - Environments: .env.local
      `;
      assert.equal(detectDevServerUrl(nextLog), 'http://localhost:3000');

      const ipLog = `Server running at http://127.0.0.1:8080/`;
      assert.equal(detectDevServerUrl(ipLog), 'http://127.0.0.1:8080/');
    });

    it('Upper Boundary: multiple URLs picks the first local dev server match', () => {
      const complexLog = `
        ➜  Local:   http://localhost:5173/
        ➜  Network: http://192.168.1.100:5173/
      `;
      assert.equal(detectDevServerUrl(complexLog), 'http://localhost:5173/');
    });
  });

  describe('truncateHtmlSnippet', () => {
    it('Lower Boundary: empty string or short snippet remains unchanged', () => {
      assert.equal(truncateHtmlSnippet(''), '');
      assert.equal(truncateHtmlSnippet('<button>Click</button>'), '<button>Click</button>');
    });

    it('In-Bound: collapses excessive whitespace and newlines', () => {
      const input = `
        <div class="card">
           <h1>Title</h1>
        </div>
      `;
      const result = truncateHtmlSnippet(input, 100);
      assert.ok(!result.includes('   '));
    });

    it('Upper Boundary: long HTML snippets are safely truncated with ellipsis indicator', () => {
      const longHtml = '<div>' + '<span>Item</span>'.repeat(100) + '</div>';
      const truncated = truncateHtmlSnippet(longHtml, 120);
      assert.ok(truncated.length <= 130);
      assert.ok(truncated.endsWith('... [truncated]'));
    });
  });

  describe('formatComponentSteerPrompt', () => {
    it('Lower Boundary: element with minimal info (no file/line, generic tag)', () => {
      const context: UIComponentContext = {
        selector: 'div > span',
        htmlSnippet: '<span>Hello World</span>',
        pageUrl: 'http://localhost:5173/'
      };
      const prompt = formatComponentSteerPrompt(context, 'Make this text bold and red');
      
      assert.ok(prompt.includes('[UI Component Request]'));
      assert.ok(prompt.includes('Target: <span>'));
      assert.ok(prompt.includes('Selector: div > span'));
      assert.ok(prompt.includes('<span>Hello World</span>'));
      assert.ok(prompt.includes('Make this text bold and red'));
    });

    it('In-Bound: element with full component name, file path, line number and classes', () => {
      const context: UIComponentContext = {
        componentName: 'Navbar',
        filePath: 'src/lib/components/Navbar.svelte',
        lineNumber: 42,
        selector: 'header > nav.navbar-container',
        htmlSnippet: '<nav class="navbar-container"><a href="/">Home</a></nav>',
        textContent: 'Home',
        classes: 'navbar-container flex justify-between',
        pageUrl: 'http://localhost:5173/docs'
      };
      const prompt = formatComponentSteerPrompt(context, 'Add responsive mobile hamburger menu toggle');

      assert.ok(prompt.includes('Target: <Navbar> (src/lib/components/Navbar.svelte:42)'));
      assert.ok(prompt.includes('File: src/lib/components/Navbar.svelte (Line 42)'));
      assert.ok(prompt.includes('Selector: header > nav.navbar-container'));
      assert.ok(prompt.includes('Page URL: http://localhost:5173/docs'));
      assert.ok(prompt.includes('Classes: navbar-container flex justify-between'));
      assert.ok(prompt.includes('Add responsive mobile hamburger menu toggle'));
    });

    it('Upper Boundary: prompt handles empty instruction by defaulting to inspection inquiry', () => {
      const context: UIComponentContext = {
        componentName: 'UserProfile',
        filePath: 'src/components/UserProfile.tsx',
        lineNumber: 15,
        selector: 'div.user-profile',
        htmlSnippet: '<div class="user-profile">User</div>',
        pageUrl: 'http://localhost:3000'
      };
      const prompt = formatComponentSteerPrompt(context, '');
      assert.ok(prompt.includes('Please review and explain this component'));
    });
  });

  describe('encodeBracketedPaste', () => {
    it('In-Bound: correctly encapsulates prompt inside bracketed paste terminal escape sequences', () => {
      const rawPrompt = 'Hello Agent!';
      const encoded = encodeBracketedPaste(rawPrompt);
      assert.equal(encoded, '\x1b[200~Hello Agent!\x1b[201~\r');
    });
  });

  describe('generateInspectorScript', () => {
    it('In-Bound: generates self-contained client JavaScript string with message dispatch', () => {
      const script = generateInspectorScript();
      assert.ok(typeof script === 'string');
      assert.ok(script.includes('AGENTDECK_COMPONENT_PICKED'));
      assert.ok(script.includes('postMessage'));
      assert.ok(script.includes('__reactFiber'));
      assert.ok(script.includes('__svelte_meta'));
    });
  });

  describe('resolveSteerTargetSession', () => {
    const mockSessions = [
      { id: 'sess-shell', isAgent: false, title: 'bash' },
      { id: 'sess-agy', isAgent: true, title: 'Antigravity CLI' },
      { id: 'sess-claude', isAgent: true, title: 'Claude Code' }
    ];

    it('Lower Boundary: empty or null session list returns null', () => {
      assert.equal(resolveSteerTargetSession([], 'sess-agy', null, null), null);
    });

    it('In-Bound: explicit target takes highest precedence', () => {
      const target = resolveSteerTargetSession(mockSessions, 'sess-agy', 'sess-claude', 'sess-agy');
      assert.equal(target, 'sess-claude');
    });

    it('In-Bound: configured UI dropdown target takes precedence over active agent', () => {
      const target = resolveSteerTargetSession(mockSessions, 'sess-agy', null, 'sess-claude');
      assert.equal(target, 'sess-claude');
    });

    it('In-Bound: active session is picked if it is an agent and no override specified', () => {
      const target = resolveSteerTargetSession(mockSessions, 'sess-agy', null, null);
      assert.equal(target, 'sess-agy');
    });

    it('In-Bound: first agent session is picked if active session is a non-agent shell', () => {
      const target = resolveSteerTargetSession(mockSessions, 'sess-shell', null, null);
      assert.equal(target, 'sess-agy');
    });

    it('Upper Boundary: fallback to active session if no agent sessions exist', () => {
      const shellOnlySessions = [
        { id: 'shell-1', isAgent: false, title: 'sh' },
        { id: 'shell-2', isAgent: false, title: 'zsh' }
      ];
      const target = resolveSteerTargetSession(shellOnlySessions, 'shell-2', null, null);
      assert.equal(target, 'shell-2');
    });
  });
});
