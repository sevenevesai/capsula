// ChatGPT Export — Overlay (v0.4.0)
// Bottom-right overlay button. On click, harvests the conversation, opens a shadow-UI picker
// to filter/select blocks, shows a live Markdown preview, and supports Copy/Download.
//
// Major pieces:
// - Overlay button (fixed bottom-right)
// - Harvester v0.3+ (sanitizer, blocks, pairs, timestamp fallback, model allowlist)
// - Picker Panel (Select + Preview tabs)
// - Exporters: MD/HTML/JSON from selected blocks

/* ===========================
   Config & Globals
   =========================== */
const CFG = {
  right: 20,
  bottom: 24,
  minSize: 44,
  zIndex: 2147483000,
  nudgeGap: 12,
  urlGuard: /^https:\/\/(chat\.openai\.com|chatgpt\.com)\//,
  recomputeDebounceMs: 120,
  panelWidth: 420,
  panelHeightVh: 70
};

let overlayHost = null;         // button host
let panelHost = null;           // panel host (shadow root)
let detachResize = null;
let detachObserver = null;

/* ===========================
   Overlay button & placement
   =========================== */
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function findComposer() {
  const candidates = [
    '[contenteditable="true"][role="textbox"]',
    'textarea',
    '[data-testid="composer"], [data-test="composer"]',
    'div[role="textbox"]'
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && isNearBottom(el)) return el;
  }
  const all = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"]'));
  if (!all.length) return null;
  all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  const bottomMost = all[0];
  return isNearBottom(bottomMost) ? bottomMost : null;
}
function isNearBottom(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return rect.top > vh * 0.5;
}

function makeButtonShadow(onClick) {
  const host = document.createElement('div');
  host.setAttribute('data-cgpt-overlay-export', '1');
  host.style.position = 'fixed';
  host.style.right = `${CFG.right}px`;
  host.style.bottom = `calc(${CFG.bottom}px + env(safe-area-inset-bottom))`;
  host.style.zIndex = String(CFG.zIndex);
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.transition = prefersReducedMotion() ? 'none' : 'opacity 200ms ease';

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { pointer-events: auto; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: ${CFG.minSize}px; height: ${CFG.minSize}px; border-radius: 9999px;
        border: 1px solid rgba(127,127,127,0.25);
        background: rgba(240,240,240,0.85);
        color: CanvasText;
        box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        cursor: pointer; outline: none;
      }
      @media (prefers-color-scheme: dark) {
        .btn {
          background: rgba(32,32,32,0.85);
          color: white;
          border-color: rgba(255,255,255,0.2);
        }
      }
      .btn:hover { filter: brightness(1.06); }
      .btn:focus-visible { outline: 2px solid rgba(0,120,255,0.7); outline-offset: 2px; }
      .ico { width: 20px; height: 20px; display: inline-block; }
      .sr-only {
        position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0,0,1px,1px); white-space: nowrap; border: 0;
      }
    </style>
    <div class="wrap">
      <button class="btn" type="button" aria-label="Export conversation" title="Export conversation">
        <span class="sr-only">Export conversation</span>
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;
  const btn = shadow.querySelector('button.btn');
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  });
  return host;
}

function recomputePosition() {
  if (!overlayHost) return;
  let bottomPx = CFG.bottom;
  const composer = findComposer();
  if (composer) {
    const oRect = overlayHost.getBoundingClientRect();
    const cRect = composer.getBoundingClientRect();
    const wouldOverlap =
      oRect.left < cRect.right &&
      oRect.right > cRect.left &&
      oRect.bottom > cRect.top - 8;
    if (wouldOverlap) {
      const needed = Math.ceil((oRect.bottom - (cRect.top - 8)) + CFG.nudgeGap);
      bottomPx += needed;
    }
  }
  overlayHost.style.bottom = `calc(${bottomPx}px + env(safe-area-inset-bottom))`;
  overlayHost.style.opacity = '1';
}

function startObservers() {
  const onResize = () => debounce(recomputePosition, CFG.recomputeDebounceMs)();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  detachResize = () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
  };
  const mo = new MutationObserver(() => {
    debounce(recomputePosition, CFG.recomputeDebounceMs)();
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  detachObserver = () => mo.disconnect();
  if (window.visualViewport) {
    const onVV = () => debounce(recomputePosition, CFG.recomputeDebounceMs)();
    window.visualViewport.addEventListener('resize', onVV);
    window.visualViewport.addEventListener('scroll', onVV);
    const oldDetach = detachResize;
    detachResize = () => {
      oldDetach && oldDetach();
      window.visualViewport.removeEventListener('resize', onVV);
      window.visualViewport.removeEventListener('scroll', onVV);
    };
  }
}
function stopObservers() { detachResize && detachResize(); detachObserver && detachObserver(); detachResize = null; detachObserver = null; }

function mountOverlay() {
  if (overlayHost && document.contains(overlayHost)) return;
  overlayHost = makeButtonShadow(onExportClickOpenPanel);
  document.documentElement.appendChild(overlayHost);
  requestAnimationFrame(() => recomputePosition());
  startObservers();
}
function unmountOverlay() { stopObservers(); if (overlayHost?.parentNode) overlayHost.parentNode.removeChild(overlayHost); overlayHost = null; }
function debounce(fn, ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); }; }

/* ===========================
   Harvest + Panel
   =========================== */

async function onExportClickOpenPanel() {
  try {
    const harvest = await harvestConversationV03();

    // Timestamp fallback (monotonic) + ensure pairs
    const exportedAt = harvest.meta.exported_at || new Date().toISOString();
    harvest.messages.forEach((m, i) => {
      if (!m.timestamp) m.timestamp = new Date(Date.parse(exportedAt) + i * 1000).toISOString();
    });
    if (!harvest.pairs) harvest.pairs = buildPairs(harvest.messages);

    window.__CGPT_EXPORT = window.__CGPT_EXPORT || {};
    window.__CGPT_EXPORT.lastHarvest = harvest;

    openPanel(harvest);
  } catch (err) {
    console.error('[ChatGPT Export v0.4] Harvest failed:', err);
    alert('Failed to harvest conversation. Check console for details.');
  }
}

/* ===========================
   Harvest v0.3 core
   =========================== */
async function harvestConversationV03() {
  const messageEls = selectMessageElements();

  const messages = [];
  let i = 0;
  for (const el of messageEls) {
    messages.push(await normalizeMessageV03(el, i++));
  }

  const titleRaw = document.title.replace(/\s*\|\s*ChatGPT.*/i, '') || 'ChatGPT Conversation';
  const meta = {
    title: safeTitle(titleRaw),
    url: location.href,
    exported_at: new Date().toISOString(),
    model: detectModel(),
    locale: document.documentElement.getAttribute('lang') || undefined
  };

  const pairs = buildPairs(messages);

  return { meta, messages, pairs };
}

function selectMessageElements() {
  const selectors = [
    '[data-testid="conversation-turn"]',
    '[data-message-author-role]',
    'main article',
    'article',
    'div[role="article"]'
  ];
  const seen = new Set();
  const out = [];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      if (seen.has(el)) return;
      const text = (el.textContent || '').trim();
      if (!text) return;
      seen.add(el);
      out.push(el);
    });
  }
  return out;
}

async function normalizeMessageV03(el, index) {
  const role = detectRole(el);
  const id = el.getAttribute('id') || el.dataset.messageId || `msg-${index+1}`;
  const timestamp = detectTimestamp(el);

  const contentNode = findContentNode(el);
  const clone = contentNode.cloneNode(true);

  sanitizeClone(clone);

  const html = clone.innerHTML;
  const text = clone.innerText || '';

  const blocks = extractBlocks(clone);
  const mdText = blocksToMarkdown(blocks);
  const segments = extractSegmentsFromBlocks(blocks); // back-compat based on blocks

  const hash = hashString([role, text, html].join('\n#'));

  return {
    index, id, role, timestamp, hash,
    plain: { text, md: mdText },
    html, blocks, segments
  };
}

function findContentNode(el) {
  return el.querySelector('[data-testid="markdown"], .markdown, .prose, .whitespace-pre-wrap, article, div') || el;
}

/* ===========================
   Sanitizer
   =========================== */
function sanitizeClone(root) {
  const DROP = [
    'button',
    '[role="toolbar"]',
    '[data-testid="webpage-citation-pill"]',
    '[data-testid="citation-chip"]',
    '[data-testid="source-chip"]',
    '[data-testid="inline-toolbar"]',
    'svg[aria-hidden="true"]',
    'nav', 'aside'
  ];
  root.querySelectorAll(DROP.join(',')).forEach(n => n.remove());

  // Strip classes/styles
  root.querySelectorAll('[class]').forEach(n => n.removeAttribute('class'));
  root.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'));

  // Drop all data-* attributes (UI/editor noise)
  root.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => { if (/^data-/.test(a.name)) el.removeAttribute(a.name); });
  });

  // Normalize links: keep href/title/name/id
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    [...a.attributes].forEach(attr => {
      if (!/^(href|title|name|id)$/.test(attr.name)) a.removeAttribute(attr.name);
    });
    if (href && !href.startsWith('#')) a.setAttribute('href', href);
  });

  // Remove empty nodes
  Array.from(root.querySelectorAll('*')).forEach(n => {
    if (!n.firstChild && !/^(img|br|hr|input|source)$/.test(n.tagName.toLowerCase())) {
      const text = (n.textContent || '').trim();
      if (!text) n.remove();
    }
  });
}

/* ===========================
   Blocks (for UI toggling)
   =========================== */
function extractBlocks(root) {
  const blocks = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  function pushParaFrom(el) {
    const md = toMarkdownInline(el).trim();
    if (md) blocks.push({ kind: 'para', md });
  }

  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!(n instanceof HTMLElement)) continue;
    if (n.closest('[data-block-consumed="1"]')) continue;

    const tag = n.tagName;

    if (/^H[1-6]$/.test(tag)) {
      n.setAttribute('data-block-consumed', '1');
      const level = Number(tag[1]);
      const text = (n.innerText || '').trim();
      blocks.push({ kind: 'heading', level, text });
      continue;
    }
    if (tag === 'PRE' && n.querySelector('code')) {
      n.setAttribute('data-block-consumed', '1');
      const code = n.querySelector('code');
      const language = (code?.className || '').match(/language-([a-z0-9+#-]+)/i)?.[1] || '';
      const text = code?.innerText || n.innerText || '';
      blocks.push({ kind: 'code', language, text });
      continue;
    }
    if (tag === 'TABLE') {
      n.setAttribute('data-block-consumed', '1');
      blocks.push({ kind: 'table', html: n.outerHTML });
      continue;
    }
    if (tag === 'IMG') {
      n.setAttribute('data-block-consumed', '1');
      blocks.push({ kind: 'image', alt: n.getAttribute('alt') || '', src: n.getAttribute('src') || '' });
      continue;
    }
    if (tag === 'BLOCKQUOTE') {
      n.setAttribute('data-block-consumed', '1');
      const md = toMarkdownInline(n).trim();
      if (md) blocks.push({ kind: 'quote', md });
      continue;
    }
    if (tag === 'HR') {
      n.setAttribute('data-block-consumed', '1');
      blocks.push({ kind: 'divider' });
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      n.setAttribute('data-block-consumed', '1');
      const ordered = tag === 'OL';
      const items = [];
      n.querySelectorAll(':scope > li').forEach(li => {
        const liClone = li.cloneNode(true);
        liClone.querySelectorAll('ul,ol').forEach(x => x.remove());
        const item = toMarkdownInline(liClone).trim();
        if (item) items.push(item);
      });
      if (items.length) blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    if (tag === 'P' || (tag === 'DIV' && hasMeaningfulText(n) && !containsBlockChildren(n))) {
      n.setAttribute('data-block-consumed', '1');
      pushParaFrom(n);
      continue;
    }
  }
  root.querySelectorAll('[data-block-consumed]').forEach(e => e.removeAttribute('data-block-consumed'));
  return blocks;
}

function hasMeaningfulText(el) {
  const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
  return t.length > 0;
}
function containsBlockChildren(el) {
  return !!el.querySelector('pre, table, img, blockquote, ul, ol, hr, h1, h2, h3, h4, h5, h6');
}

/* ===========================
   Inline MD helpers (for paras/lis)
   =========================== */
function toMarkdownInline(node) {
  let md = '';
  const nodes = [];
  (function collect(n) { nodes.push(n); for (let c=n.firstChild; c; c=c.nextSibling) collect(c); })(node);

  const stack = [];
  function open(tag, el) {
    if (tag === 'EM' || tag === 'I') { md += '*'; stack.push('*'); return; }
    if (tag === 'STRONG' || tag === 'B') { md += '**'; stack.push('**'); return; }
    if (tag === 'CODE' && el.parentElement?.tagName !== 'PRE') { md += '`'; stack.push('`'); return; }
    if (tag === 'A') { md += '['; stack.push({ type:'a', href: el.getAttribute('href') || '' }); return; }
    if (tag === 'BR') { md += '  \n'; return; }
  }
  for (const n of nodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      md += (n.nodeValue || '').replace(/\s+/g, ' ');
      continue;
    }
    if (!(n instanceof HTMLElement)) continue;
    open(n.tagName, n);
  }
  while (stack.length) {
    const last = stack.pop();
    if (typeof last === 'string') md += last;
    else if (last && last.type === 'a') md += `](${last.href})`;
  }
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

/* ===========================
   Segments from blocks (compat)
   =========================== */
function extractSegmentsFromBlocks(blocks) {
  const segs = [];
  for (const b of blocks) {
    if (b.kind === 'code') segs.push({ type: 'code', language: b.language || '', text: b.text });
    else if (b.kind === 'image') segs.push({ type: 'image', alt: b.alt || '', src: b.src || '' });
    else if (b.kind === 'table') segs.push({ type: 'table', html: b.html });
    else if (b.kind === 'math') segs.push({ type: 'math', latex: b.latex || '' });
  }
  // Primary text as MD from blocks
  const md = blocksToMarkdown(blocks);
  if (md.trim()) segs.unshift({ type: 'text', md });
  return segs;
}

/* ===========================
   Markdown & HTML renderers
   =========================== */
function blocksToMarkdown(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': out.push(`\n\n${'#'.repeat(Math.max(1, Math.min(6, b.level||1)))} ${b.text}\n`); break;
      case 'para': out.push(`\n\n${b.md}\n`); break;
      case 'list':
        out.push('\n' + b.items.map((t, i) => (b.ordered ? `${i+1}. ${t}` : `- ${t}`)).join('\n') + '\n');
        break;
      case 'code': out.push(`\n\n\`\`\`${b.language||''}\n${b.text}\n\`\`\`\n`); break;
      case 'table': out.push(`\n\n${b.html}\n`); break; // keep HTML for fidelity
      case 'image': out.push(`\n\n![${b.alt||'image'}](${b.src||''})\n`); break;
      case 'quote': out.push('\n' + (b.md||'').split('\n').map(l=>`> ${l}`).join('\n') + '\n'); break;
      case 'math': out.push(`\n\n$$\n${b.latex}\n$$\n`); break;
      case 'divider': out.push('\n\n---\n'); break;
    }
  }
  return out.join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function blocksToHTML(blocks, title = 'ChatGPT Export') {
  const body = blocks.map((b) => {
    switch (b.kind) {
      case 'heading': return `<h${Math.max(1,Math.min(6,b.level||1))}>${escapeHtml(b.text||'')}</h${Math.max(1,Math.min(6,b.level||1))}>`;
      case 'para': return `<p>${mdInlineToHTML(b.md||'')}</p>`;
      case 'list':
        return b.ordered
          ? `<ol>${b.items.map(i=>`<li>${mdInlineToHTML(i)}</li>`).join('')}</ol>`
          : `<ul>${b.items.map(i=>`<li>${mdInlineToHTML(i)}</li>`).join('')}</ul>`;
      case 'code': return `<pre><code class="language-${escapeHtml(b.language||'')}">${escapeHtml(b.text||'')}</code></pre>`;
      case 'table': return b.html;
      case 'image': return `<p><img alt="${escapeHtml(b.alt||'')}" src="${escapeAttr(b.src||'')}" /></p>`;
      case 'quote': return `<blockquote>${mdInlineToHTML(b.md||'')}</blockquote>`;
      case 'math': return `<pre class="math">$$${escapeHtml(b.latex||'')}$$</pre>`;
      case 'divider': return `<hr/>`;
      default: return '';
    }
  }).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Arial, sans-serif; line-height: 1.55; padding: 32px; max-width: 900px; margin: auto; }
    pre { overflow: auto; padding: 12px; border-radius: 10px; border: 1px solid #eee; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding: 0 12px; color: #555; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// Super-light inline MD to HTML (handles links, code, bold, italics)
function mdInlineToHTML(md) {
  let html = escapeHtml(md || '');
  // code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italics
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${escapeAttr(u)}">${escapeHtml(t)}</a>`);
  // hard breaks (two spaces end-of-line)
  html = html.replace(/  \n/g, '<br/>');
  return html;
}

/* ===========================
   Role, timestamp, model, hash, title
   =========================== */
function detectRole(el) {
  const attr = el.getAttribute('data-message-author-role') ||
               el.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
  if (attr) return attr;
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  if (/assistant|gpt/.test(aria)) return 'assistant';
  if (/you|user/.test(aria)) return 'user';
  const text = el.textContent?.trim().slice(0, 80).toLowerCase() || '';
  if (text.startsWith('you:')) return 'user';
  return 'assistant';
}
function detectTimestamp(el) {
  const t = el.querySelector('time')?.getAttribute('datetime') ||
            el.querySelector('time')?.getAttribute('title') ||
            el.querySelector('time')?.textContent;
  if (!t) return null;
  const iso = new Date(t);
  return isNaN(iso.getTime()) ? (t || null) : iso.toISOString();
}
// Best-effort model sniff (allowlist)
function detectModel() {
  const candidates = [
    '[data-testid="model-switcher"]',
    '[aria-label*="model"]',
    'header [role="button"][aria-haspopup="menu"]',
    'header'
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    const txt = (el?.innerText || el?.getAttribute?.('aria-label') || '').trim();
    if (txt && /(^gpt|^o\d|4\.?o|mini|pro|sonnet|flash)/i.test(txt)) return txt;
  }
  const hdr = document.querySelector('header');
  if (hdr) {
    const txt = (hdr.innerText || '').trim();
    const m = txt.match(/(^gpt[\w.-]*|o\d[\w.-]*|4\.?o[\w.-]*)/i);
    if (m) return m[1];
  }
  return undefined;
}
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(16);
}
function safeTitle(t) {
  return (t || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ===========================
   Q/A Pairs
   =========================== */
function buildPairs(messages) {
  const pairs = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      let j = i + 1;
      while (j < messages.length && messages[j].role !== 'assistant') j++;
      pairs.push({ userIndex: i, assistantIndex: j < messages.length ? j : null });
    }
  }
  return pairs;
}

/* ===========================
   UI Panel
   =========================== */
function openPanel(harvest) {
  if (panelHost && document.contains(panelHost)) {
    // If already open, refresh with new data
    panelHost.__render(harvest);
    return;
  }
  panelHost = document.createElement('div');
  panelHost.setAttribute('data-cgpt-panel', '1');
  panelHost.style.position = 'fixed';
  panelHost.style.right = `${CFG.right}px`;
  panelHost.style.bottom = `calc(${CFG.bottom + CFG.minSize + 12}px + env(safe-area-inset-bottom))`;
  panelHost.style.zIndex = String(CFG.zIndex);
  const shadow = panelHost.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        width: ${CFG.panelWidth}px;
        height: ${CFG.panelHeightVh}vh;
        max-height: 80vh;
        background: rgba(250,250,250,0.98);
        color: CanvasText;
        border: 1px solid rgba(127,127,127,0.25);
        border-radius: 14px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.18);
        display: flex; flex-direction: column;
        overflow: hidden;
        font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, Arial, sans-serif;
      }
      @media (prefers-color-scheme: dark) {
        .panel { background: rgba(24,24,24,0.98); color: white; border-color: rgba(255,255,255,0.2); }
        .tab.active { background: rgba(255,255,255,0.06); }
        .row:hover { background: rgba(255,255,255,0.04); }
        .msgCard { border-color: rgba(255,255,255,0.12); }
        textarea.preview { background: #141414; color: #f5f5f5; border-color: #333; }
      }
      .hdr { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom: 1px solid rgba(127,127,127,0.25); }
      .title { font-weight: 700; font-size: 13px; flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tabs { display:flex; gap:6px; }
      .tab { padding:6px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
      .tab.active { border-color: rgba(127,127,127,0.25); background: rgba(0,0,0,0.04); }
      .body { display:flex; flex:1; min-height:0; }
      .left { width: 100%; display:flex; flex-direction:column; }
      .filters { display:grid; grid-template-columns: 1fr 1fr; gap:8px; padding:8px 12px; border-bottom: 1px solid rgba(127,127,127,0.25); }
      .grp { display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
      .grp label { display:flex; align-items:center; gap:6px; }
      .list { flex:1; overflow:auto; padding:8px 12px; }
      .row { padding:8px; border-radius: 10px; cursor:pointer; border: 1px solid transparent; margin-bottom:8px; }
      .row:hover { background: rgba(0,0,0,0.03); }
      .msgCard { border:1px solid rgba(127,127,127,0.2); border-radius:10px; padding:8px; margin-top:8px; }
      .blocks { margin-top:6px; display:flex; flex-direction:column; gap:6px; }
      .blockLine { display:flex; align-items:center; gap:8px; }
      .blockTag { font-size:11px; padding:2px 6px; border-radius:999px; background: rgba(127,127,127,0.15); }
      .foot { display:flex; gap:8px; padding:10px 12px; border-top:1px solid rgba(127,127,127,0.25); }
      button.btn { padding:8px 10px; border-radius: 10px; border:1px solid rgba(127,127,127,0.25); background: transparent; cursor: pointer; }
      button.btn:hover { background: rgba(0,0,0,0.06); }
      .close { margin-left:auto; }
      .previewWrap { padding:8px 12px; display:flex; flex-direction:column; gap:8px; height:100%; }
      textarea.preview { flex:1; width:100%; resize:none; border-radius:10px; border:1px solid rgba(127,127,127,0.25); padding:10px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
      .subtle { opacity: 0.7; }
    </style>
    <div class="panel" role="dialog" aria-label="Chat export panel">
      <div class="hdr">
        <div class="title"></div>
        <div class="tabs">
          <div class="tab tab-select active">Select</div>
          <div class="tab tab-preview">Preview</div>
        </div>
      </div>
      <div class="body">
        <div class="left selectView" style="display:flex"></div>
        <div class="left previewView" style="display:none"></div>
      </div>
      <div class="foot">
        <button class="btn act-copy">Copy MD</button>
        <button class="btn act-dl-md">Download MD</button>
        <button class="btn act-dl-html">Download HTML</button>
        <button class="btn act-dl-json">Download JSON</button>
        <button class="btn close">Close</button>
      </div>
    </div>
  `;

  // state kept on the shadow root
  const state = {
    harvest,
    roleFilter: { user: true, assistant: true },
    blockFilter: { para:true, code:true, table:true, image:true, quote:true, math:true, heading:true, divider:false },
    expanded: {}, // messageIndex -> boolean
    selected: {}, // messageIndex -> {blockIdx: boolean}
    activeTab: 'select'
  };

  // initialize selections: select blocks that match filters
  function initSelection() {
    state.selected = {};
    harvest.messages.forEach((m, mi) => {
      const isRole = (m.role === 'user' && state.roleFilter.user) || (m.role === 'assistant' && state.roleFilter.assistant);
      const sb = {};
      m.blocks.forEach((b, bi) => {
        const okType = !!state.blockFilter[b.kind];
        sb[bi] = isRole && okType;
      });
      state.selected[mi] = sb;
    });
  }

  function selectedBlocks() {
    const chosen = [];
    harvest.messages.forEach((m, mi) => {
      m.blocks.forEach((b, bi) => {
        if (state.selected?.[mi]?.[bi]) chosen.push({ msg: m, msgIndex: mi, block: b, blockIndex: bi });
      });
    });
    return chosen;
  }

  function renderHeader() {
    shadow.querySelector('.title').textContent = harvest.meta.title || 'ChatGPT Conversation';
    shadow.querySelector('.tab-select').classList.toggle('active', state.activeTab==='select');
    shadow.querySelector('.tab-preview').classList.toggle('active', state.activeTab==='preview');
    shadow.querySelector('.selectView').style.display = state.activeTab==='select' ? 'flex' : 'none';
    shadow.querySelector('.previewView').style.display = state.activeTab==='preview' ? 'flex' : 'none';
  }

  function renderSelectView() {
    const container = shadow.querySelector('.selectView');
    container.innerHTML = `
      <div class="filters">
        <div class="grp">
          <strong>Roles</strong>
          <label><input type="checkbox" data-role="user" ${state.roleFilter.user?'checked':''}/> User</label>
          <label><input type="checkbox" data-role="assistant" ${state.roleFilter.assistant?'checked':''}/> Assistant</label>
        </div>
        <div class="grp">
          <strong>Blocks</strong>
          ${['heading','para','list','code','table','image','quote','math','divider'].map(k=>(
            `<label><input type="checkbox" data-kind="${k}" ${state.blockFilter[k]?'checked':''}/> ${k}</label>`
          )).join('')}
        </div>
      </div>
      <div class="list"></div>
    `;
    const list = container.querySelector('.list');
    const frag = document.createDocumentFragment();

    harvest.messages.forEach((m, mi) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div><strong>#${mi+1}</strong> <span class="subtle">(${m.role})</span> <span class="subtle">${new Date(m.timestamp||harvest.meta.exported_at).toLocaleString()}</span></div>
        <div class="msgCard" ${state.expanded[mi]?'':'style="display:none"'}></div>
      `;
      // blocks card
      const card = row.querySelector('.msgCard');
      if (state.expanded[mi]) {
        const blFrag = document.createDocumentFragment();
        m.blocks.forEach((b, bi) => {
          const line = document.createElement('div');
          line.className = 'blockLine';
          const checked = !!state.selected?.[mi]?.[bi];
          const label = b.kind === 'heading' ? `${'#'.repeat(Math.max(1,Math.min(6,b.level||1)))} ${b.text}` :
                        b.kind === 'para' ? (b.md||'').slice(0,120) :
                        b.kind === 'list' ? `${b.items.length} items` :
                        b.kind === 'code' ? (b.language||'code') :
                        b.kind === 'table' ? 'table' :
                        b.kind === 'image' ? (b.alt||'image') :
                        b.kind === 'quote' ? (b.md||'').slice(0,120) :
                        b.kind === 'math' ? (b.latex||'math').slice(0,60) :
                        'divider';
          line.innerHTML = `
            <label style="display:flex; align-items:center; gap:8px; width:100%;">
              <input type="checkbox" data-mi="${mi}" data-bi="${bi}" ${checked?'checked':''}/>
              <span class="blockTag">${b.kind}</span>
              <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(label)}</span>
            </label>
          `;
          blFrag.appendChild(line);
        });
        card.appendChild(blFrag);
      }

      row.addEventListener('click', (e) => {
        // toggle expand only if not clicking a checkbox
        if ((e.target instanceof HTMLInputElement) && e.target.type === 'checkbox') return;
        state.expanded[mi] = !state.expanded[mi];
        renderSelectView();
      });

      frag.appendChild(row);
    });

    list.appendChild(frag);

    // wire filters
    container.querySelectorAll('input[type="checkbox"][data-role]').forEach(cb => {
      cb.addEventListener('change', () => {
        const role = cb.getAttribute('data-role');
        state.roleFilter[role] = cb.checked;
        initSelection(); // recompute selection based on filters
        renderSelectView();
      });
    });
    container.querySelectorAll('input[type="checkbox"][data-kind]').forEach(cb => {
      cb.addEventListener('change', () => {
        const kind = cb.getAttribute('data-kind');
        state.blockFilter[kind] = cb.checked;
        initSelection();
        renderSelectView();
      });
    });
    container.querySelectorAll('input[type="checkbox"][data-mi]').forEach(cb => {
      cb.addEventListener('change', () => {
        const mi = Number(cb.getAttribute('data-mi'));
        const bi = Number(cb.getAttribute('data-bi'));
        state.selected[mi][bi] = cb.checked;
      });
    });
  }

  function renderPreviewView() {
    const container = shadow.querySelector('.previewView');
    const chosen = selectedBlocks();
    const blocks = chosen.map(x => x.block);
    const md = blocksToMarkdown(blocks);
    container.innerHTML = `
      <div class="previewWrap">
        <div class="subtle">Preview (Markdown from selected blocks)</div>
        <textarea class="preview">${md.replace(/</g,'&lt;')}</textarea>
      </div>
    `;
  }

  function copyText(text) {
    return navigator.clipboard.writeText(text);
  }
  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  function currentSelectedBlocks() {
    const chosen = selectedBlocks().map(x => x.block);
    return chosen;
  }

  function onCopyMD() {
    const md = blocksToMarkdown(currentSelectedBlocks());
    copyText(md).then(() => alert('Copied Markdown to clipboard.'));
  }
  function onDownloadMD() {
    const md = blocksToMarkdown(currentSelectedBlocks());
    const ts = new Date().toISOString().replace(/[:]/g,'-').replace(/\..+/, '');
    download(`${safeTitle(harvest.meta.title)}_${ts}.md`, 'text/markdown;charset=utf-8', md);
  }
  function onDownloadHTML() {
    const html = blocksToHTML(currentSelectedBlocks(), harvest.meta.title);
    const ts = new Date().toISOString().replace(/[:]/g,'-').replace(/\..+/, '');
    download(`${safeTitle(harvest.meta.title)}_${ts}.html`, 'text/html;charset=utf-8', html);
  }
  function onDownloadJSON() {
    // include only selected blocks per message
    const subset = {
      meta: harvest.meta,
      messages: harvest.messages.map((m, mi) => {
        const selectedBlocks = m.blocks.filter((_b, bi) => !!state.selected?.[mi]?.[bi]);
        return { ...m, blocks: selectedBlocks, segments: extractSegmentsFromBlocks(selectedBlocks) };
      }),
      pairs: harvest.pairs
    };
    const ts = new Date().toISOString().replace(/[:]/g,'-').replace(/\..+/, '');
    download(`${safeTitle(harvest.meta.title)}_${ts}.json`, 'application/json', JSON.stringify(subset, null, 2));
  }

  // wire footer + tabs
  shadow.querySelector('.act-copy').addEventListener('click', onCopyMD);
  shadow.querySelector('.act-dl-md').addEventListener('click', onDownloadMD);
  shadow.querySelector('.act-dl-html').addEventListener('click', onDownloadHTML);
  shadow.querySelector('.act-dl-json').addEventListener('click', onDownloadJSON);
  shadow.querySelector('.close').addEventListener('click', () => closePanel());

  shadow.querySelector('.tab-select').addEventListener('click', () => { state.activeTab='select'; render(); });
  shadow.querySelector('.tab-preview').addEventListener('click', () => { state.activeTab='preview'; render(); });

  function render(h = null) {
    if (h) { state.harvest = harvest = h; initSelection(); }
    renderHeader();
    if (state.activeTab === 'select') renderSelectView(); else renderPreviewView();
  }
  panelHost.__render = render;

  document.documentElement.appendChild(panelHost);
  initSelection();
  render();

  // focus management: trap basic focus into panel on open
  setTimeout(() => {
    const firstBtn = shadow.querySelector('.tab-select');
    firstBtn && firstBtn.focus();
  }, 0);
}

function closePanel() {
  if (panelHost?.parentNode) panelHost.parentNode.removeChild(panelHost);
  panelHost = null;
}

/* ===========================
   SPA nav + init
   =========================== */
(function watchRoute() {
  let lastHref = location.href;
  const handleNav = () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      closePanel(); // close panel on navigation
      if (CFG.urlGuard.test(location.href)) { mountOverlay(); recomputePosition(); }
      else { unmountOverlay(); }
    }
  };
  const _push = history.pushState;
  const _replace = history.replaceState;
  history.pushState = function(...args) { const r = _push.apply(this, args); handleNav(); return r; };
  history.replaceState = function(...args) { const r = _replace.apply(this, args); handleNav(); return r; };
  window.addEventListener('popstate', handleNav);
  setInterval(handleNav, 500);
})();

(function init() { if (CFG.urlGuard.test(location.href)) mountOverlay(); })();
