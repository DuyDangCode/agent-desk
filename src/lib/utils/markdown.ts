import type { DiffHunk } from '$lib/types';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkdn', '.mdx']);

/**
 * Checks if a given file path is a Markdown document.
 */
export function isMarkdownFile(filePath: string): boolean {
  if (!filePath) return false;
  const lower = filePath.toLowerCase().trim();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = lower.slice(lastDot);
  return MARKDOWN_EXTENSIONS.has(ext);
}

/**
 * Escapes raw HTML to prevent XSS attacks while rendering.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs in Markdown links and images to prevent javascript: or data: XSS attacks.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  const decoded = trimmed
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const lower = decoded.toLowerCase().replace(/[\s\x00-\x1f]+/g, '');
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:')
  ) {
    return '#';
  }
  return escapeHtml(decoded);
}

/**
 * Parses inline formatting: code spans, bold, italics, strikethrough, links, images.
 */
export function parseInline(text: string): string {
  // First, extract inline code spans so other formatting isn't applied inside them
  const codeSpans: string[] = [];
  let processed = text.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-deck-card border border-deck-border font-mono text-[0.85em] text-blue-600 dark:text-blue-400">${code}</code>`);
    return `\u0000CODESPAN${idx}\u0000`;
  });

  // Images: ![alt](url)
  processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<img src="${safeUrl}" alt="${alt}" class="max-w-full h-auto rounded border border-deck-border my-2" loading="lazy" />`;
  });

  // Links: [text](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 font-medium">${linkText}</a>`;
  });

  // Bold & Italic: ***text*** or ___text___
  processed = processed.replace(/(\*{3}|_{3})(.*?)\1/g, '<strong><em>$2</em></strong>');

  // Bold: **text** or __text__
  processed = processed.replace(/(\*{2}|_{2})(.*?)\1/g, '<strong>$2</strong>');

  // Italic: *text* or _text_
  processed = processed.replace(/(?<!\w)([*_])([^*\n\r]+?)\1(?!\w)/g, '<em>$2</em>');

  // Strikethrough: ~~text~~
  processed = processed.replace(/~~(.*?)~~/g, '<del class="text-slate-400 dark:text-deck-muted">$1</del>');

  // Checkbox / Task items in inline text
  processed = processed.replace(/^\[ \]\s+/, '<input type="checkbox" disabled class="mr-2 rounded text-blue-600 align-middle" />');
  processed = processed.replace(/^\[x\]\s+/i, '<input type="checkbox" checked disabled class="mr-2 rounded text-blue-600 align-middle" />');

  // Restore code spans
  processed = processed.replace(/\u0000CODESPAN(\d+)\u0000/g, (_match, id) => {
    return codeSpans[parseInt(id, 10)] || '';
  });

  return processed;
}

/**
 * Converts a Markdown document into clean, GitHub-Flavored sanitized HTML.
 */
export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '';
  }

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const output: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableAlignments: string[] = [];
  let tableRows: string[][] = [];

  let inList: 'ul' | 'ol' | null = null;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const flushList = () => {
    if (inList) {
      output.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      const bqContent = blockquoteLines.map((l) => parseInline(escapeHtml(l))).join('<br/>');
      output.push(`<blockquote class="border-l-4 border-blue-500/60 dark:border-blue-400/60 pl-4 py-1 my-3 text-slate-600 dark:text-deck-muted italic bg-slate-50/50 dark:bg-deck-card/30 rounded-r">${bqContent}</blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  };

  const flushTable = () => {
    if (inTable) {
      let tableHtml = '<div class="overflow-x-auto my-4 border border-deck-border rounded-lg shadow-2xs"><table class="min-w-full divide-y divide-deck-border text-xs">';
      // Header
      tableHtml += '<thead class="bg-gray-50 dark:bg-deck-card text-slate-700 dark:text-deck-bright font-semibold"><tr>';
      tableHeaders.forEach((th, i) => {
        const align = tableAlignments[i] || 'left';
        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
        tableHtml += `<th class="px-3.5 py-2 ${alignClass}">${parseInline(escapeHtml(th.trim()))}</th>`;
      });
      tableHtml += '</tr></thead>';

      // Body
      tableHtml += '<tbody class="divide-y divide-deck-border/60 bg-white dark:bg-deck-surface text-slate-800 dark:text-deck-text">';
      tableRows.forEach((row) => {
        tableHtml += '<tr class="hover:bg-gray-50/50 dark:hover:bg-deck-card/40 transition">';
        row.forEach((td, i) => {
          const align = tableAlignments[i] || 'left';
          const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
          tableHtml += `<td class="px-3.5 py-2 ${alignClass}">${parseInline(escapeHtml(td.trim()))}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table></div>';

      output.push(tableHtml);
      inTable = false;
      tableHeaders = [];
      tableAlignments = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Blocks (```)
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList();
        flushBlockquote();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        inCodeBlock = false;
        const codeContent = codeBlockLines.map(escapeHtml).join('\n');
        const langBadge = codeBlockLang
          ? `<div class="bg-gray-100 dark:bg-deck-card text-slate-500 dark:text-deck-muted font-mono text-[10px] px-3 py-1 border-b border-deck-border uppercase font-semibold flex items-center justify-between"><span>${escapeHtml(codeBlockLang)}</span></div>`
          : '';
        output.push(
          `<div class="my-4 rounded-lg border border-deck-border overflow-hidden bg-gray-50 dark:bg-deck-card/60 shadow-2xs">${langBadge}<pre class="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-slate-900 dark:text-deck-bright"><code class="language-${escapeHtml(codeBlockLang)}">${codeContent}</code></pre></div>`
        );
        codeBlockLines = [];
        codeBlockLang = '';
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 2. Blockquotes (> ...)
    if (trimmed.startsWith('>')) {
      flushList();
      flushTable();
      inBlockquote = true;
      blockquoteLines.push(trimmed.replace(/^>\s?/, ''));
      continue;
    } else if (inBlockquote && trimmed !== '') {
      // Continuation of blockquote
      blockquoteLines.push(trimmed);
      continue;
    } else {
      flushBlockquote();
    }

    // 3. Tables (| ... |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      flushBlockquote();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if this line is alignment delimiter (e.g. | :--- | :---: | ---: |)
      const isDelimiter = cells.every((c) => /^:?-+:?$/.test(c));

      if (isDelimiter && tableHeaders.length > 0) {
        tableAlignments = cells.map((c) => {
          const starts = c.startsWith(':');
          const ends = c.endsWith(':');
          if (starts && ends) return 'center';
          if (ends) return 'right';
          return 'left';
        });
        inTable = true;
        continue;
      } else if (inTable) {
        tableRows.push(cells);
        continue;
      } else {
        // Table header candidate
        tableHeaders = cells;
        continue;
      }
    } else {
      flushTable();
    }

    // 4. Blank lines
    if (trimmed === '') {
      flushList();
      continue;
    }

    // 5. Horizontal Rules (---, ***, ___)
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      flushList();
      output.push('<hr class="my-6 border-t border-deck-border" />');
      continue;
    }

    // 6. Headers (# ... ######)
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const title = parseInline(escapeHtml(headerMatch[2]));
      const classes: Record<number, string> = {
        1: 'text-2xl font-bold border-b border-deck-border pb-2 mt-6 mb-4 text-slate-900 dark:text-deck-bright',
        2: 'text-xl font-bold border-b border-deck-border pb-1.5 mt-5 mb-3 text-slate-900 dark:text-deck-bright',
        3: 'text-lg font-semibold mt-4 mb-2 text-slate-900 dark:text-deck-bright',
        4: 'text-base font-semibold mt-3 mb-2 text-slate-900 dark:text-deck-bright',
        5: 'text-sm font-semibold mt-2 mb-1 text-slate-900 dark:text-deck-bright',
        6: 'text-xs font-semibold uppercase tracking-wider mt-2 mb-1 text-slate-500 dark:text-deck-muted',
      };
      output.push(`<h${level} class="${classes[level]}">${title}</h${level}>`);
      continue;
    }

    // 7. Unordered Lists and Checklists (- , * , + )
    const ulMatch = trimmed.match(/^([-*+])\s+(.*)$/);
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
        output.push('<ul class="list-disc list-inside space-y-1 my-2 text-slate-800 dark:text-deck-text leading-relaxed">');
      }
      const itemContent = parseInline(escapeHtml(ulMatch[2]));
      // Check if task checklist item
      if (itemContent.includes('type="checkbox"')) {
        output.push(`<li class="list-none flex items-center">${itemContent}</li>`);
      } else {
        output.push(`<li>${itemContent}</li>`);
      }
      continue;
    }

    // 8. Ordered Lists (1. , 2. )
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
        output.push('<ol class="list-decimal list-inside space-y-1 my-2 text-slate-800 dark:text-deck-text leading-relaxed">');
      }
      output.push(`<li>${parseInline(escapeHtml(olMatch[2]))}</li>`);
      continue;
    }

    // 9. Standard Paragraph
    flushList();
    output.push(`<p class="my-2.5 text-slate-800 dark:text-deck-text leading-relaxed">${parseInline(escapeHtml(trimmed))}</p>`);
  }

  flushList();
  flushBlockquote();
  flushTable();

  return output.join('\n');
}

/**
 * Renders Git diff hunks for a Markdown file into a visual diff view,
 * highlighting added lines with green and deleted lines with red/strikethrough.
 */
export function renderDiffMarkdownToHtml(hunks: DiffHunk[]): string {
  if (!hunks || hunks.length === 0) {
    return '<div class="text-slate-400 dark:text-deck-muted italic text-center py-6">No diff changes detected in this markdown file.</div>';
  }

  const output: string[] = [];

  for (const hunk of hunks) {
    output.push(
      `<div class="my-4 rounded-lg border border-deck-border overflow-hidden shadow-2xs">`
    );
    output.push(
      `<div class="bg-gray-100 dark:bg-deck-card px-3 py-1.5 border-b border-deck-border font-mono text-[11px] text-slate-500 dark:text-deck-muted font-semibold flex items-center justify-between"><span>${escapeHtml(hunk.header)}</span></div>`
    );
    output.push(`<div class="p-3 divide-y divide-deck-border/40 font-mono text-xs">`);

    for (const line of hunk.lines) {
      const isAdd = line.line_type === 'add';
      const isDel = line.line_type === 'delete';
      const isContext = line.line_type === 'context';

      if (isAdd) {
        output.push(
          `<div class="diff-addition flex items-start space-x-2 py-1 px-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border-l-2 border-emerald-500 text-emerald-900 dark:text-emerald-300">` +
            `<span class="select-none font-bold text-emerald-600 dark:text-emerald-400 shrink-0">+</span>` +
            `<div class="flex-1 min-w-0 break-words font-sans text-xs">${parseInline(escapeHtml(line.content))}</div>` +
          `</div>`
        );
      } else if (isDel) {
        output.push(
          `<div class="diff-deletion flex items-start space-x-2 py-1 px-2 rounded bg-rose-50 dark:bg-rose-950/40 border-l-2 border-rose-500 text-rose-900 dark:text-rose-300">` +
            `<span class="select-none font-bold text-rose-600 dark:text-rose-400 shrink-0">-</span>` +
            `<div class="flex-1 min-w-0 break-words font-sans text-xs line-through opacity-80">${parseInline(escapeHtml(line.content))}</div>` +
          `</div>`
        );
      } else if (isContext) {
        output.push(
          `<div class="diff-context flex items-start space-x-2 py-0.5 px-2 text-slate-700 dark:text-deck-muted">` +
            `<span class="select-none text-slate-300 dark:text-deck-muted shrink-0">&nbsp;</span>` +
            `<div class="flex-1 min-w-0 break-words font-sans text-xs">${parseInline(escapeHtml(line.content))}</div>` +
          `</div>`
        );
      }
    }

    output.push(`</div></div>`);
  }

  return output.join('\n');
}
