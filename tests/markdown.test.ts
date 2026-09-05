import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMarkdownFile, renderMarkdownToHtml, renderDiffMarkdownToHtml } from '../src/lib/utils/markdown.ts';
import type { DiffHunk } from '../src/lib/types/index.ts';

describe('Markdown Utility & Renderer Tests', () => {
  describe('File Extension Detection (isMarkdownFile)', () => {
    it('Lower Boundary: empty string, non-markdown files, or files without extensions', () => {
      assert.equal(isMarkdownFile(''), false);
      assert.equal(isMarkdownFile('README'), false);
      assert.equal(isMarkdownFile('main.rs'), false);
      assert.equal(isMarkdownFile('app.svelte'), false);
      assert.equal(isMarkdownFile('data.json'), false);
      assert.equal(isMarkdownFile('.gitignore'), false);
    });

    it('In-Bound: common markdown extensions (.md, .markdown, .mdown, .mkdn, .mdx)', () => {
      assert.equal(isMarkdownFile('README.md'), true);
      assert.equal(isMarkdownFile('docs/CONTRIBUTING.markdown'), true);
      assert.equal(isMarkdownFile('notes/todo.mdown'), true);
      assert.equal(isMarkdownFile('wiki/page.mkdn'), true);
      assert.equal(isMarkdownFile('components/Doc.mdx'), true);
    });

    it('Upper Boundary: mixed case extensions and deep paths', () => {
      assert.equal(isMarkdownFile('src/docs/CHANGELOG.MD'), true);
      assert.equal(isMarkdownFile('/var/log/notes.MarkDown'), true);
      assert.equal(isMarkdownFile('file.md.bak'), false);
      assert.equal(isMarkdownFile('.hidden.md'), true);
    });
  });

  describe('Markdown HTML Rendering (renderMarkdownToHtml)', () => {
    it('Lower Boundary: empty, null, or whitespace markdown string', () => {
      assert.equal(renderMarkdownToHtml(''), '');
      assert.equal(renderMarkdownToHtml('   \n\n   '), '');
    });

    it('In-Bound: headers, bold, italics, strikethrough, links, and code spans', () => {
      const md = '# Header 1\n\n## Header 2\n\nThis is **bold** and *italic* and ~~strike~~ and `inline_code`. Visit [AgentDeck](https://agentdeck.dev).';
      const html = renderMarkdownToHtml(md);

      assert.ok(html.includes('<h1'));
      assert.ok(html.includes('Header 1'));
      assert.ok(html.includes('<h2'));
      assert.ok(html.includes('Header 2'));
      assert.ok(html.includes('<strong>bold</strong>'));
      assert.ok(html.includes('<em>italic</em>'));
      assert.ok(html.includes('<del') && html.includes('strike</del>'));
      assert.ok(html.includes('<code'));
      assert.ok(html.includes('inline_code'));
      assert.ok(html.includes('<a href="https://agentdeck.dev"'));
      assert.ok(html.includes('AgentDeck</a>'));
    });

    it('In-Bound: code blocks with language specification', () => {
      const md = '```typescript\nconst greeting: string = "Hello World";\nconsole.log(greeting);\n```';
      const html = renderMarkdownToHtml(md);

      assert.ok(html.includes('<pre'));
      assert.ok(html.includes('language-typescript'));
      assert.ok(html.includes('const greeting: string = &quot;Hello World&quot;;'));
    });

    it('In-Bound: lists and task checklists', () => {
      const md = '- Item 1\n- Item 2\n- [ ] Unchecked task\n- [x] Completed task';
      const html = renderMarkdownToHtml(md);

      assert.ok(html.includes('<ul'));
      assert.ok(html.includes('Item 1'));
      assert.ok(html.includes('type="checkbox"'));
      assert.ok(html.includes('checked'));
    });

    it('In-Bound: tables with column alignment', () => {
      const md = '| Feature | Status | Priority |\n| :--- | :---: | ---: |\n| Markdown | Ready | High |\n| Diffs | Done | High |';
      const html = renderMarkdownToHtml(md);

      assert.ok(html.includes('<table'));
      assert.ok(html.includes('<th'));
      assert.ok(html.includes('Feature'));
      assert.ok(html.includes('<td'));
      assert.ok(html.includes('Markdown'));
      assert.ok(html.includes('text-center'));
      assert.ok(html.includes('text-right'));
    });

    it('Upper Boundary: XSS protection and HTML tag sanitization', () => {
      const dangerous = '<script>alert("hack")</script>\n<iframe src="evil.com"></iframe>\n<img src=x onerror="alert(1)">';
      const html = renderMarkdownToHtml(dangerous);

      assert.ok(!html.includes('<script>'));
      assert.ok(!html.includes('<iframe>'));
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(html.includes('&lt;iframe'));
    });

    it('Upper Boundary: URI scheme sanitization against javascript: and data: links', () => {
      const maliciousLinks = '[Evil Link](javascript:alert("XSS"))\n[Data](data:text/html,<script>alert(1)</script>)\n![Bad Image](javascript:stealCookies())';
      const html = renderMarkdownToHtml(maliciousLinks);

      assert.ok(!html.includes('href="javascript:'));
      assert.ok(!html.includes('href="data:'));
      assert.ok(!html.includes('src="javascript:'));
      assert.ok(html.includes('href="#"'));
      assert.ok(html.includes('src="#"'));
    });

    it('In-Bound: does not double-escape special characters in code spans or links', () => {
      const codeSpan = 'Check out `x < y && a > b`.';
      const codeHtml = renderMarkdownToHtml(codeSpan);
      assert.ok(codeHtml.includes('x &lt; y &amp;&amp; a &gt; b'));
      assert.ok(!codeHtml.includes('&amp;lt;'));
      assert.ok(!codeHtml.includes('&amp;amp;'));

      const link = '[Docs & Info](https://example.com?query=a&b=c)';
      const linkHtml = renderMarkdownToHtml(link);
      assert.ok(linkHtml.includes('>Docs &amp; Info</a>'));
      assert.ok(!linkHtml.includes('&amp;amp;'));
      assert.ok(linkHtml.includes('href="https://example.com?query=a&amp;b=c"'));
    });
  });

  describe('Markdown Diff Rendering (renderDiffMarkdownToHtml)', () => {
    it('Lower Boundary: empty hunks list', () => {
      assert.equal(renderDiffMarkdownToHtml([]), '<div class="text-slate-400 dark:text-deck-muted italic text-center py-6">No diff changes detected in this markdown file.</div>');
    });

    it('In-Bound: renders added, deleted, and context markdown lines with visual indicators', () => {
      const mockHunks: DiffHunk[] = [
        {
          hunk_index: 0,
          header: '@@ -1,3 +1,4 @@',
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          is_staged: false,
          lines: [
            { line_type: 'context', content: '# Project Overview' },
            { line_type: 'delete', content: '- Old deprecated bullet point' },
            { line_type: 'add', content: '- New improved feature bullet point' },
            { line_type: 'add', content: '- Second added feature' },
            { line_type: 'context', content: '## Setup Instructions' },
          ],
        },
      ];

      const html = renderDiffMarkdownToHtml(mockHunks);

      // Check diff indicators & styling
      assert.ok(html.includes('diff-addition'));
      assert.ok(html.includes('diff-deletion'));
      assert.ok(html.includes('diff-context'));
      assert.ok(html.includes('New improved feature bullet point'));
      assert.ok(html.includes('Old deprecated bullet point'));
      assert.ok(html.includes('Project Overview'));
    });
  });
});
