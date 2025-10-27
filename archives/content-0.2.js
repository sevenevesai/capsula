// ChatGPT Export Extension v2.0 - Full UX/UI Implementation
// Complete rewrite with Simple/Advanced modes, chat preview, code grouping, and accessibility

/* ===========================
   Config & Globals
   =========================== */
const CFG = {
  right: 40,
  bottom: 90,
  minSize: 48,
  zIndex: 2147483000,
  nudgeGap: 12,
  urlGuard: /^https:\/\/(chat\.openai\.com|chatgpt\.com)\//,
  recomputeDebounceMs: 120,
  panelWidth: 900,
  panelHeightVh: 80,
  theme: {
    light: {
      bg: 'rgba(255,255,255,0.98)',
      bgSecondary: 'rgba(249,250,251,0.98)',
      text: '#111827',
      textSecondary: '#6b7280',
      border: 'rgba(229,231,235,1)',
      hover: 'rgba(243,244,246,1)',
      userBubble: '#3b82f6',
      assistantBubble: '#f3f4f6',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981'
    },
    dark: {
      bg: 'rgba(23,23,23,0.98)',
      bgSecondary: 'rgba(31,31,31,0.98)',
      text: '#f9fafb',
      textSecondary: '#9ca3af',
      border: 'rgba(55,65,81,1)',
      hover: 'rgba(55,65,81,0.5)',
      userBubble: '#2563eb',
      assistantBubble: '#374151',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981'
    }
  }
};

let overlayHost = null;
let panelHost = null;
let contextMenuListener = null;
let keyboardShortcutListener = null;
let detachResize = null;
let detachObserver = null;

// Global state for export
let globalState = {
  mode: 'simple', // 'simple' or 'advanced'
  harvest: null,
  selection: {
    rangeStart: null,
    rangeEnd: null,
    filters: {
      user: true,
      assistant: true,
      code: false,
      tables: false,
      lists: false,
      images: false
    },
    blockSelection: {} // messageIndex -> {blockIdx: boolean}
  },
  codeGroups: {}, // filename -> [{messageIndex, blockIndex, version, content}]
  exportFormat: 'markdown',
  includeMetadata: {
    timestamps: true,
    model: true,
    title: true
  }
};

/* ===========================
   Theme Detection
   =========================== */
function getTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getThemeColors() {
  return CFG.theme[getTheme()];
}

/* ===========================
   Enhanced Overlay Button
   =========================== */
function makeButtonShadow(onClick) {
  const host = document.createElement('div');
  host.setAttribute('data-cgpt-overlay-export', '1');
  host.style.position = 'fixed';
  host.style.right = `${CFG.right}px`;
  host.style.bottom = `calc(${CFG.bottom}px + env(safe-area-inset-bottom))`;
  host.style.zIndex = String(CFG.zIndex);
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.transition = 'opacity 200ms ease';

  const shadow = host.attachShadow({ mode: 'open' });
  const colors = getThemeColors();
  
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { pointer-events: auto; }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${CFG.minSize}px;
        height: ${CFG.minSize}px;
        border-radius: 24px;
        background: ${colors.accentPrimary};
        color: white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        cursor: pointer;
        outline: none;
        transition: all 0.2s ease;
        position: relative;
      }
      .btn:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      .btn:active {
        transform: scale(0.98);
      }
      .btn:focus-visible {
        outline: 3px solid ${colors.accentSecondary};
        outline-offset: 2px;
      }
      .ico {
        width: 24px;
        height: 24px;
      }
      .tooltip {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        padding: 6px 12px;
        background: ${colors.bg};
        color: ${colors.text};
        border: 1px solid ${colors.border};
        border-radius: 8px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .btn:hover .tooltip {
        opacity: 1;
      }
      .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 12px;
        height: 12px;
        background: ${colors.accentSecondary};
        border-radius: 50%;
        display: none;
      }
      .badge.active {
        display: block;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
      }
    </style>
    <div class="wrap">
      <button class="btn" type="button" aria-label="Export conversation" role="button">
        <span class="tooltip">Export conversation (Alt+E)</span>
        <span class="badge"></span>
        <svg class="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m0 0l-4-4m4 4l4-4" 
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;

  const btn = shadow.querySelector('button.btn');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  return host;
}

/* ===========================
   Context Menu Integration
   =========================== */
function setupContextMenu() {
  if (contextMenuListener) return;
  
  contextMenuListener = (e) => {
    // Check if right-clicked on a message
    const messageEl = e.target.closest('[data-message-author-role], [data-testid="conversation-turn"]');
    if (!messageEl) return;

    const role = detectRole(messageEl);
    if (role !== 'assistant') return;

    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, messageEl);
  };

  document.addEventListener('contextmenu', contextMenuListener);
}

function showContextMenu(x, y, messageEl) {
  // Remove any existing context menu
  const existing = document.querySelector('[data-cgpt-context-menu]');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.setAttribute('data-cgpt-context-menu', '1');
  const colors = getThemeColors();
  
  menu.style.cssText = `
    position: fixed;
    left: ${Math.min(x, window.innerWidth - 200)}px;
    top: ${Math.min(y, window.innerHeight - 150)}px;
    z-index: ${CFG.zIndex + 1};
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 4px;
    min-width: 180px;
  `;

  menu.innerHTML = `
    <style>
      .menu-item {
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        color: ${colors.text};
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .menu-item:hover {
        background: ${colors.hover};
      }
      .menu-divider {
        height: 1px;
        background: ${colors.border};
        margin: 4px 8px;
      }
      .menu-icon {
        width: 16px;
        height: 16px;
        opacity: 0.7;
      }
    </style>
    <div class="menu-item" data-action="export-answer">
      <svg class="menu-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 14h10"/>
      </svg>
      Export this answer
    </div>
    <div class="menu-item" data-action="copy-answer">
      <svg class="menu-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10 3H6a1 1 0 00-1 1v8h6V4a1 1 0 00-1-1z"/>
        <path d="M11 5v8a1 1 0 01-1 1H4V6"/>
      </svg>
      Copy to clipboard
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item" data-action="export-code">
      <svg class="menu-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M9.5 3l2 2-2 2M6.5 3l-2 2 2 2M11 10l-6 0"/>
      </svg>
      Extract code only
    </div>
  `;

  document.body.appendChild(menu);

  // Handle menu clicks
  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;

    const action = item.dataset.action;
    menu.remove();

    try {
      const content = await extractMessageContent(messageEl);
      
      switch (action) {
        case 'export-answer':
          exportSingleMessage(content, 'markdown');
          break;
        case 'copy-answer':
          await navigator.clipboard.writeText(content.markdown);
          showToast('Copied to clipboard');
          break;
        case 'export-code':
          exportCodeFromMessage(content);
          break;
      }
    } catch (err) {
      console.error('Context menu action failed:', err);
      showToast('Export failed', 'error');
    }
  });

  // Close menu on click outside
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 0);
}

/* ===========================
   Keyboard Shortcuts
   =========================== */
function setupKeyboardShortcuts() {
  if (keyboardShortcutListener) return;

  keyboardShortcutListener = (e) => {
    // Alt+E to open export panel
    if (e.altKey && e.key === 'e') {
      e.preventDefault();
      onExportClickOpenPanel();
    }
    // Escape to close panel
    if (e.key === 'Escape' && panelHost) {
      closePanel();
    }
  };

  document.addEventListener('keydown', keyboardShortcutListener);
}

/* ===========================
   Enhanced Panel with Simple/Advanced Modes
   =========================== */
function openPanel(harvest) {
  if (panelHost && document.contains(panelHost)) {
    panelHost.__updateHarvest(harvest);
    return;
  }

  globalState.harvest = harvest;
  analyzeCodeBlocks(harvest);

  panelHost = document.createElement('div');
  panelHost.setAttribute('data-cgpt-panel', '1');
  panelHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: ${CFG.zIndex + 10};
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  const shadow = panelHost.attachShadow({ mode: 'open' });
  const colors = getThemeColors();

  shadow.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
      }
      .panel {
        position: relative;
        width: 90%;
        max-width: ${CFG.panelWidth}px;
        height: ${CFG.panelHeightVh}vh;
        max-height: 90vh;
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
        overflow: hidden;
      }
      
      /* Header */
      .header {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
      .title {
        flex: 1;
        font-size: 16px;
        font-weight: 600;
        color: ${colors.text};
      }
      .mode-toggle {
        display: flex;
        gap: 4px;
        padding: 2px;
        background: ${colors.bg};
        border-radius: 8px;
      }
      .mode-btn {
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: ${colors.textSecondary};
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      }
      .mode-btn.active {
        background: ${colors.accentPrimary};
        color: white;
      }
      .close-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: ${colors.textSecondary};
        cursor: pointer;
        border-radius: 8px;
        margin-left: 12px;
      }
      .close-btn:hover {
        background: ${colors.hover};
      }
      
      /* Body */
      .body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      
      /* Simple Mode Styles */
      .simple-view {
        display: flex;
        width: 100%;
      }
      .chat-preview {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: ${colors.bgSecondary};
      }
      .message {
        display: flex;
        margin-bottom: 16px;
        animation: fadeIn 0.3s ease;
      }
      .message.user {
        justify-content: flex-end;
      }
      .message.assistant {
        justify-content: flex-start;
      }
      .bubble {
        max-width: 70%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
      }
      .message.user .bubble {
        background: ${colors.userBubble};
        color: white;
        border-bottom-right-radius: 4px;
      }
      .message.assistant .bubble {
        background: ${colors.assistantBubble};
        color: ${colors.text};
        border-bottom-left-radius: 4px;
      }
      .bubble pre {
        background: rgba(0,0,0,0.1);
        padding: 8px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .bubble code {
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 12px;
      }
      .message-role {
        font-size: 11px;
        color: ${colors.textSecondary};
        margin-bottom: 4px;
        font-weight: 500;
      }
      
      /* Filters Sidebar */
      .filters-panel {
        width: 200px;
        padding: 20px;
        border-right: 1px solid ${colors.border};
        background: ${colors.bg};
      }
      .filter-section {
        margin-bottom: 20px;
      }
      .filter-title {
        font-size: 12px;
        font-weight: 600;
        color: ${colors.textSecondary};
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .filter-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .filter-option:hover {
        background: ${colors.hover};
      }
      .filter-checkbox {
        width: 16px;
        height: 16px;
        accent-color: ${colors.accentPrimary};
      }
      .filter-label {
        font-size: 13px;
        color: ${colors.text};
      }
      .preset-btn {
        width: 100%;
        padding: 8px;
        border: 1px solid ${colors.border};
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        margin-bottom: 6px;
        transition: all 0.2s;
      }
      .preset-btn:hover {
        background: ${colors.accentPrimary};
        color: white;
        border-color: ${colors.accentPrimary};
      }
      
      /* Advanced Mode Styles */
      .advanced-view {
        display: flex;
        width: 100%;
      }
      .tree-panel {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
      }
      .tree-message {
        margin-bottom: 16px;
        border: 1px solid ${colors.border};
        border-radius: 8px;
        overflow: hidden;
      }
      .tree-message-header {
        padding: 12px;
        background: ${colors.bgSecondary};
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .tree-message-header:hover {
        background: ${colors.hover};
      }
      .tree-blocks {
        padding: 12px;
        background: ${colors.bg};
      }
      .tree-block {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
        border-radius: 4px;
      }
      .tree-block:hover {
        background: ${colors.hover};
      }
      .block-type {
        font-size: 10px;
        padding: 2px 6px;
        background: ${colors.accentSecondary};
        color: white;
        border-radius: 4px;
        font-weight: 600;
      }
      
      /* Code Diff Viewer */
      .diff-viewer {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        background: ${colors.bg};
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        z-index: 1000;
      }
      .diff-header {
        padding: 16px;
        border-bottom: 1px solid ${colors.border};
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .diff-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        font-family: monospace;
        font-size: 13px;
      }
      .diff-line {
        padding: 2px 4px;
        white-space: pre-wrap;
      }
      .diff-add {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }
      .diff-remove {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      
      /* Footer */
      .footer {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
      .format-select {
        padding: 8px 12px;
        border: 1px solid ${colors.border};
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
      }
      .export-btn {
        padding: 8px 20px;
        background: ${colors.accentPrimary};
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      .export-btn:hover {
        background: ${colors.accentSecondary};
      }
      .secondary-btn {
        padding: 8px 16px;
        background: transparent;
        color: ${colors.text};
        border: 1px solid ${colors.border};
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .secondary-btn:hover {
        background: ${colors.hover};
      }
      
      /* Range Selection */
      .message.range-selecting {
        cursor: pointer;
        position: relative;
      }
      .message.range-selecting:hover::before {
        content: '';
        position: absolute;
        inset: -4px;
        border: 2px dashed ${colors.accentPrimary};
        border-radius: 8px;
        pointer-events: none;
      }
      .message.range-start,
      .message.range-end {
        position: relative;
      }
      .message.range-start::before,
      .message.range-end::before {
        content: attr(data-marker);
        position: absolute;
        left: -30px;
        top: 50%;
        transform: translateY(-50%);
        background: ${colors.accentPrimary};
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
      }
      .message.in-range {
        background: ${colors.hover};
        border-radius: 8px;
        padding: 4px;
        margin: 4px 0;
      }
      
      /* Toast Notifications */
      .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        background: ${colors.bg};
        color: ${colors.text};
        border: 1px solid ${colors.border};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideUp 0.3s ease;
        z-index: 10000;
      }
      .toast.success {
        border-color: ${colors.accentSecondary};
      }
      .toast.error {
        border-color: #ef4444;
      }
      
      /* Accessibility */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
        border: 0;
      }
      
      *:focus-visible {
        outline: 2px solid ${colors.accentPrimary};
        outline-offset: 2px;
      }
      
      /* Loading State */
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid ${colors.border};
        border-top-color: ${colors.accentPrimary};
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    
    <div class="backdrop" role="presentation"></div>
    <div class="panel" role="dialog" aria-label="Export ChatGPT Conversation" aria-modal="true">
      <div class="header">
        <h2 class="title">Export Conversation</h2>
        <div class="mode-toggle" role="tablist">
          <button class="mode-btn active" role="tab" aria-selected="true" data-mode="simple">
            💬 Simple
          </button>
          <button class="mode-btn" role="tab" aria-selected="false" data-mode="advanced">
            ⚙️ Advanced
          </button>
        </div>
        <button class="close-btn" aria-label="Close dialog">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
      </div>
      
      <div class="body">
        <!-- Content will be rendered here -->
      </div>
      
      <div class="footer">
        <select class="format-select" aria-label="Export format">
          <option value="markdown">Markdown (.md)</option>
          <option value="html">HTML (.html)</option>
          <option value="json">JSON (.json)</option>
          <option value="pdf">PDF (Beta)</option>
          <option value="zip">Multi-format ZIP</option>
        </select>
        
        <button class="secondary-btn" data-action="copy">
          Copy to Clipboard
        </button>
        
        <div style="flex: 1"></div>
        
        <button class="export-btn" data-action="export">
          Export Conversation
        </button>
      </div>
    </div>
  `;

  // Wire up event handlers
  const panel = shadow.querySelector('.panel');
  const backdrop = shadow.querySelector('.backdrop');
  const closeBtn = shadow.querySelector('.close-btn');
  const modeBtns = shadow.querySelectorAll('.mode-btn');
  const formatSelect = shadow.querySelector('.format-select');
  const exportBtn = shadow.querySelector('.export-btn');
  const copyBtn = shadow.querySelector('[data-action="copy"]');

  // Close handlers
  backdrop.addEventListener('click', closePanel);
  closeBtn.addEventListener('click', closePanel);

  // Mode toggle
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      globalState.mode = mode;
      modeBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderPanelContent(shadow, harvest);
    });
  });

  // Format change
  formatSelect.addEventListener('change', (e) => {
    globalState.exportFormat = e.target.value;
    updateExportButton(shadow);
  });

  // Export action
  exportBtn.addEventListener('click', () => performExport(harvest));
  copyBtn.addEventListener('click', () => performCopy(harvest));

  // Update harvest function
  panelHost.__updateHarvest = (newHarvest) => {
    harvest = newHarvest;
    globalState.harvest = newHarvest;
    analyzeCodeBlocks(newHarvest);
    renderPanelContent(shadow, newHarvest);
  };

  document.body.appendChild(panelHost);
  renderPanelContent(shadow, harvest);

  // Focus management
  setTimeout(() => {
    const firstFocusable = shadow.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  }, 100);

  // Trap focus within panel
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusables = shadow.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

/* ===========================
   Render Panel Content
   =========================== */
function renderPanelContent(shadow, harvest) {
  const body = shadow.querySelector('.body');
  
  if (globalState.mode === 'simple') {
    renderSimpleMode(body, harvest);
  } else {
    renderAdvancedMode(body, harvest);
  }
}

function renderSimpleMode(container, harvest) {
  container.innerHTML = `
    <div class="simple-view">
      <div class="filters-panel">
        <div class="filter-section">
          <div class="filter-title">Quick Presets</div>
          <button class="preset-btn" data-preset="full">Save Full Chat</button>
          <button class="preset-btn" data-preset="assistant">Assistant Only</button>
          <button class="preset-btn" data-preset="code">Code Snippets</button>
          <button class="preset-btn" data-preset="tables">Tables Only</button>
        </div>
        
        <div class="filter-section">
          <div class="filter-title">Filters</div>
          <div class="filter-option">
            <input type="checkbox" class="filter-checkbox" id="filter-user" checked>
            <label class="filter-label" for="filter-user">User messages</label>
          </div>
          <div class="filter-option">
            <input type="checkbox" class="filter-checkbox" id="filter-assistant" checked>
            <label class="filter-label" for="filter-assistant">Assistant messages</label>
          </div>
          <div class="filter-option">
            <input type="checkbox" class="filter-checkbox" id="filter-code">
            <label class="filter-label" for="filter-code">Code only</label>
          </div>
          <div class="filter-option">
            <input type="checkbox" class="filter-checkbox" id="filter-tables">
            <label class="filter-label" for="filter-tables">Tables only</label>
          </div>
          <div class="filter-option">
            <input type="checkbox" class="filter-checkbox" id="filter-lists">
            <label class="filter-label" for="filter-lists">Lists only</label>
          </div>
        </div>
        
        <div class="filter-section">
          <div class="filter-title">Range Selection</div>
          <button class="preset-btn" data-action="toggle-range">Select Range</button>
          <button class="preset-btn" data-action="clear-range">Clear Range</button>
        </div>
      </div>
      
      <div class="chat-preview">
        <!-- Messages will be rendered here -->
      </div>
    </div>
  `;

  // Render messages
  const preview = container.querySelector('.chat-preview');
  renderChatPreview(preview, harvest);

  // Wire up filters
  const filters = container.querySelectorAll('.filter-checkbox');
  filters.forEach(filter => {
    filter.addEventListener('change', () => {
      const type = filter.id.replace('filter-', '');
      globalState.selection.filters[type] = filter.checked;
      renderChatPreview(preview, harvest);
    });
  });

  // Wire up presets
  const presets = container.querySelectorAll('[data-preset]');
  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
      updateFilters(container);
      renderChatPreview(preview, harvest);
    });
  });

  // Wire up range selection
  container.querySelector('[data-action="toggle-range"]').addEventListener('click', () => {
    toggleRangeSelection(preview, harvest);
  });
  
  container.querySelector('[data-action="clear-range"]').addEventListener('click', () => {
    clearRangeSelection();
    renderChatPreview(preview, harvest);
  });
}

function renderAdvancedMode(container, harvest) {
  container.innerHTML = `
    <div class="advanced-view">
      <div class="tree-panel">
        <div style="margin-bottom: 16px;">
          <button class="secondary-btn" data-action="select-all">Select All</button>
          <button class="secondary-btn" data-action="select-none">Select None</button>
          <button class="secondary-btn" data-action="invert">Invert</button>
          <button class="secondary-btn" data-action="view-code">Code Groups</button>
        </div>
        <div class="tree-container">
          <!-- Message tree will be rendered here -->
        </div>
      </div>
      
      <div class="chat-preview" style="flex: 1; padding: 20px; overflow-y: auto;">
        <!-- Live preview -->
      </div>
    </div>
  `;

  // Render message tree
  const treeContainer = container.querySelector('.tree-container');
  renderMessageTree(treeContainer, harvest);

  // Render preview
  const preview = container.querySelector('.chat-preview');
  renderAdvancedPreview(preview, harvest);

  // Wire up buttons
  container.querySelector('[data-action="select-all"]').addEventListener('click', () => {
    selectAllBlocks(harvest);
    renderMessageTree(treeContainer, harvest);
    renderAdvancedPreview(preview, harvest);
  });

  container.querySelector('[data-action="select-none"]').addEventListener('click', () => {
    selectNoBlocks();
    renderMessageTree(treeContainer, harvest);
    renderAdvancedPreview(preview, harvest);
  });

  container.querySelector('[data-action="invert"]').addEventListener('click', () => {
    invertBlockSelection(harvest);
    renderMessageTree(treeContainer, harvest);
    renderAdvancedPreview(preview, harvest);
  });

  container.querySelector('[data-action="view-code"]').addEventListener('click', () => {
    showCodeGroups(harvest);
  });
}

/* ===========================
   Chat Preview Rendering
   =========================== */
function renderChatPreview(container, harvest) {
  container.innerHTML = '';
  
  const filteredMessages = filterMessages(harvest);
  
  filteredMessages.forEach((msg, idx) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;
    messageDiv.dataset.messageIndex = msg.index;
    
    // Check if in range
    if (globalState.selection.rangeStart !== null && globalState.selection.rangeEnd !== null) {
      const start = Math.min(globalState.selection.rangeStart, globalState.selection.rangeEnd);
      const end = Math.max(globalState.selection.rangeStart, globalState.selection.rangeEnd);
      
      if (msg.index === start) {
        messageDiv.classList.add('range-start');
        messageDiv.dataset.marker = 'S';
      }
      if (msg.index === end) {
        messageDiv.classList.add('range-end');
        messageDiv.dataset.marker = 'E';
      }
      if (msg.index >= start && msg.index <= end) {
        messageDiv.classList.add('in-range');
      }
    }
    
    const bubbleContent = formatMessageContent(msg);
    
    messageDiv.innerHTML = `
      <div class="bubble">
        <div class="message-role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
        ${bubbleContent}
      </div>
    `;
    
    container.appendChild(messageDiv);
  });
}

function filterMessages(harvest) {
  const filters = globalState.selection.filters;
  let messages = [...harvest.messages];
  
  // Apply role filters
  messages = messages.filter(msg => {
    if (msg.role === 'user' && !filters.user) return false;
    if (msg.role === 'assistant' && !filters.assistant) return false;
    return true;
  });
  
  // Apply content filters
  if (filters.code || filters.tables || filters.lists) {
    messages = messages.map(msg => {
      const filteredBlocks = msg.blocks.filter(block => {
        if (filters.code && block.kind === 'code') return true;
        if (filters.tables && block.kind === 'table') return true;
        if (filters.lists && block.kind === 'list') return true;
        if (!filters.code && !filters.tables && !filters.lists) return true;
        return false;
      });
      
      return { ...msg, blocks: filteredBlocks };
    }).filter(msg => msg.blocks.length > 0);
  }
  
  // Apply range selection
  if (globalState.selection.rangeStart !== null && globalState.selection.rangeEnd !== null) {
    const start = Math.min(globalState.selection.rangeStart, globalState.selection.rangeEnd);
    const end = Math.max(globalState.selection.rangeStart, globalState.selection.rangeEnd);
    messages = messages.filter(msg => msg.index >= start && msg.index <= end);
  }
  
  return messages;
}

function formatMessageContent(message) {
  if (!message.blocks || message.blocks.length === 0) {
    return escapeHtml(message.plain?.text || '');
  }
  
  return message.blocks.map(block => {
    switch (block.kind) {
      case 'heading':
        const level = Math.max(1, Math.min(6, block.level || 1));
        return `<h${level}>${escapeHtml(block.text || '')}</h${level}>`;
        
      case 'para':
        return `<p>${formatInlineMarkdown(block.md || '')}</p>`;
        
      case 'code':
        return `<pre><code class="language-${escapeHtml(block.language || '')}">${escapeHtml(block.text || '')}</code></pre>`;
        
      case 'list':
        const items = (block.items || []).map(item => `<li>${formatInlineMarkdown(item)}</li>`).join('');
        return block.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
        
      case 'table':
        return block.html || '<p>[Table]</p>';
        
      case 'image':
        return `<img src="${escapeHtml(block.src || '')}" alt="${escapeHtml(block.alt || '')}" style="max-width: 100%;">`;
        
      case 'quote':
        return `<blockquote>${formatInlineMarkdown(block.md || '')}</blockquote>`;
        
      case 'math':
        return `<div class="math">$$${escapeHtml(block.latex || '')}$$</div>`;
        
      case 'divider':
        return '<hr>';
        
      default:
        return '';
    }
  }).join('');
}

function formatInlineMarkdown(md) {
  let html = escapeHtml(md);
  
  // Code spans
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  return html;
}

/* ===========================
   Advanced Mode Tree Rendering
   =========================== */
function renderMessageTree(container, harvest) {
  container.innerHTML = '';
  
  harvest.messages.forEach((msg, idx) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'tree-message';
    
    const isExpanded = globalState.selection.blockSelection[idx] !== undefined;
    
    messageDiv.innerHTML = `
      <div class="tree-message-header" data-index="${idx}">
        <input type="checkbox" class="message-checkbox" data-index="${idx}">
        <span>${isExpanded ? '▼' : '▶'}</span>
        <strong>#${idx + 1}</strong>
        <span style="color: var(--text-secondary)">${msg.role}</span>
        <span style="color: var(--text-secondary); font-size: 11px;">
          ${new Date(msg.timestamp || harvest.meta.exported_at).toLocaleTimeString()}
        </span>
      </div>
      ${isExpanded ? `
        <div class="tree-blocks">
          ${msg.blocks.map((block, bIdx) => `
            <div class="tree-block">
              <input type="checkbox" class="block-checkbox" 
                     data-msg="${idx}" data-block="${bIdx}"
                     ${globalState.selection.blockSelection[idx]?.[bIdx] ? 'checked' : ''}>
              <span class="block-type">${block.kind}</span>
              <span style="flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis;">
                ${getBlockPreview(block)}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    
    container.appendChild(messageDiv);
  });
  
  // Wire up expansion
  container.querySelectorAll('.tree-message-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      
      const idx = parseInt(header.dataset.index);
      if (globalState.selection.blockSelection[idx]) {
        delete globalState.selection.blockSelection[idx];
      } else {
        globalState.selection.blockSelection[idx] = {};
        harvest.messages[idx].blocks.forEach((_, bIdx) => {
          globalState.selection.blockSelection[idx][bIdx] = true;
        });
      }
      
      renderMessageTree(container, harvest);
    });
  });
  
  // Wire up checkboxes
  container.querySelectorAll('.block-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const msgIdx = parseInt(cb.dataset.msg);
      const blockIdx = parseInt(cb.dataset.block);
      
      if (!globalState.selection.blockSelection[msgIdx]) {
        globalState.selection.blockSelection[msgIdx] = {};
      }
      
      globalState.selection.blockSelection[msgIdx][blockIdx] = cb.checked;
    });
  });
}

function getBlockPreview(block) {
  switch (block.kind) {
    case 'heading':
      return block.text || '';
    case 'para':
      return (block.md || '').substring(0, 80) + '...';
    case 'code':
      return `${block.language || 'code'}: ${(block.text || '').substring(0, 50)}...`;
    case 'list':
      return `${block.ordered ? 'Ordered' : 'Unordered'} list (${block.items?.length || 0} items)`;
    case 'table':
      return 'Table';
    case 'image':
      return block.alt || 'Image';
    case 'quote':
      return (block.md || '').substring(0, 60) + '...';
    case 'math':
      return 'Math expression';
    case 'divider':
      return '---';
    default:
      return block.kind;
  }
}

/* ===========================
   Code Analysis & Grouping
   =========================== */
function analyzeCodeBlocks(harvest) {
  globalState.codeGroups = {};
  
  harvest.messages.forEach((msg, msgIdx) => {
    msg.blocks.forEach((block, blockIdx) => {
      if (block.kind !== 'code') return;
      
      // Try to extract filename from comments or language
      let filename = extractFilename(block, msg);
      if (!filename) {
        filename = `snippet_${block.language || 'code'}`;
      }
      
      if (!globalState.codeGroups[filename]) {
        globalState.codeGroups[filename] = [];
      }
      
      globalState.codeGroups[filename].push({
        messageIndex: msgIdx,
        blockIndex: blockIdx,
        content: block.text,
        language: block.language,
        timestamp: msg.timestamp,
        version: globalState.codeGroups[filename].length + 1
      });
    });
  });
}

function extractFilename(block, message) {
  // Look for filename patterns in code comments or surrounding text
  const patterns = [
    /(?:file|filename|name):\s*([a-zA-Z0-9_.-]+)/i,
    /^\/\/\s*([a-zA-Z0-9_.-]+)\s*$/m,
    /^#\s*([a-zA-Z0-9_.-]+)\s*$/m,
    /^\/\*\s*([a-zA-Z0-9_.-]+)\s*\*\/$/m
  ];
  
  for (const pattern of patterns) {
    const match = (block.text || '').match(pattern);
    if (match) return match[1];
  }
  
  // Check message text for filename mentions
  const messageText = message.plain?.text || '';
  const fileMatch = messageText.match(/(?:create|file|save as|named?)\s+([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/i);
  if (fileMatch) return fileMatch[1];
  
  return null;
}

function showCodeGroups(harvest) {
  const diffModal = document.createElement('div');
  diffModal.className = 'diff-viewer';
  
  const files = Object.keys(globalState.codeGroups);
  
  diffModal.innerHTML = `
    <div class="diff-header">
      <h3>Code Files & Versions</h3>
      <button class="close-btn">×</button>
    </div>
    <div class="diff-content">
      ${files.map(filename => {
        const versions = globalState.codeGroups[filename];
        return `
          <div style="margin-bottom: 20px;">
            <h4>${filename} (${versions.length} version${versions.length > 1 ? 's' : ''})</h4>
            ${versions.length > 1 ? `
              <button class="secondary-btn" data-action="compare" data-file="${filename}">
                Compare Versions
              </button>
            ` : ''}
            <button class="secondary-btn" data-action="export-file" data-file="${filename}">
              Export Latest
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  const shadow = panelHost.shadowRoot;
  shadow.appendChild(diffModal);
  
  // Wire up actions
  diffModal.querySelector('.close-btn').addEventListener('click', () => {
    diffModal.remove();
  });
  
  diffModal.querySelectorAll('[data-action="compare"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filename = btn.dataset.file;
      showCodeDiff(filename);
    });
  });
  
  diffModal.querySelectorAll('[data-action="export-file"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filename = btn.dataset.file;
      exportCodeFile(filename);
    });
  });
}

function showCodeDiff(filename) {
  const versions = globalState.codeGroups[filename];
  if (versions.length < 2) return;
  
  const v1 = versions[versions.length - 2];
  const v2 = versions[versions.length - 1];
  
  const diff = computeSimpleDiff(v1.content, v2.content);
  
  const diffModal = document.createElement('div');
  diffModal.className = 'diff-viewer';
  
  diffModal.innerHTML = `
    <div class="diff-header">
      <h3>${filename}: v${v1.version} → v${v2.version}</h3>
      <button class="close-btn">×</button>
    </div>
    <div class="diff-content">
      ${diff.map(line => {
        if (line.added) {
          return `<div class="diff-line diff-add">+ ${escapeHtml(line.text)}</div>`;
        } else if (line.removed) {
          return `<div class="diff-line diff-remove">- ${escapeHtml(line.text)}</div>`;
        } else {
          return `<div class="diff-line">  ${escapeHtml(line.text)}</div>`;
        }
      }).join('')}
    </div>
  `;
  
  const shadow = panelHost.shadowRoot;
  shadow.appendChild(diffModal);
  
  diffModal.querySelector('.close-btn').addEventListener('click', () => {
    diffModal.remove();
  });
}

function computeSimpleDiff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const diff = [];
  
  let i = 0, j = 0;
  while (i < lines1.length || j < lines2.length) {
    if (i >= lines1.length) {
      diff.push({ added: true, text: lines2[j] });
      j++;
    } else if (j >= lines2.length) {
      diff.push({ removed: true, text: lines1[i] });
      i++;
    } else if (lines1[i] === lines2[j]) {
      diff.push({ text: lines1[i] });
      i++;
      j++;
    } else {
      // Simple diff - just show removed then added
      diff.push({ removed: true, text: lines1[i] });
      diff.push({ added: true, text: lines2[j] });
      i++;
      j++;
    }
  }
  
  return diff;
}

/* ===========================
   Export Functions
   =========================== */
async function performExport(harvest) {
  const format = globalState.exportFormat;
  const content = generateExportContent(harvest, format);
  const filename = generateFilename(harvest, format);
  
  if (format === 'zip') {
    await exportMultiFormatZip(harvest);
  } else if (format === 'pdf') {
    await exportPDF(harvest);
  } else {
    downloadFile(filename, content, getMimeType(format));
  }
  
  showToast(`✅ Exported as ${filename}`);
  closePanel();
}

async function performCopy(harvest) {
  const format = globalState.exportFormat;
  const content = generateExportContent(harvest, format);
  
  try {
    await navigator.clipboard.writeText(content);
    showToast('✅ Copied to clipboard');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
}

function generateExportContent(harvest, format) {
  const filteredMessages = filterMessages(harvest);
  
  switch (format) {
    case 'markdown':
      return exportToMarkdown(filteredMessages, harvest.meta);
    case 'html':
      return exportToHTML(filteredMessages, harvest.meta);
    case 'json':
      return exportToJSON(filteredMessages, harvest.meta);
    default:
      return '';
  }
}

function exportToMarkdown(messages, meta) {
  let md = `# ${meta.title}\n\n`;
  
  if (globalState.includeMetadata.model && meta.model) {
    md += `**Model**: ${meta.model}\n`;
  }
  if (globalState.includeMetadata.timestamps) {
    md += `**Exported**: ${new Date(meta.exported_at).toLocaleString()}\n`;
  }
  
  md += '\n---\n\n';
  
  messages.forEach(msg => {
    md += `## ${msg.role === 'user' ? 'You' : 'ChatGPT'}`;
    if (globalState.includeMetadata.timestamps && msg.timestamp) {
      md += ` - ${new Date(msg.timestamp).toLocaleTimeString()}`;
    }
    md += '\n\n';
    
    md += blocksToMarkdown(msg.blocks) + '\n';
  });
  
  return md;
}

function exportToHTML(messages, meta) {
  const colors = getThemeColors();
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
      color: #111827;
    }
    .message {
      margin-bottom: 20px;
      display: flex;
    }
    .message.user {
      justify-content: flex-end;
    }
    .message.assistant {
      justify-content: flex-start;
    }
    .bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 16px;
    }
    .message.user .bubble {
      background: #3b82f6;
      color: white;
      border-bottom-right-radius: 4px;
    }
    .message.assistant .bubble {
      background: #f3f4f6;
      color: #111827;
      border-bottom-left-radius: 4px;
    }
    .role {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      opacity: 0.7;
    }
    pre {
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 12px 0;
      padding-left: 16px;
      color: #6b7280;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #111827;
        color: #f9fafb;
      }
      .message.assistant .bubble {
        background: #374151;
        color: #f9fafb;
      }
      th {
        background: #374151;
      }
      th, td {
        border-color: #4b5563;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta.title)}</h1>
  ${globalState.includeMetadata.model && meta.model ? `<p><strong>Model:</strong> ${escapeHtml(meta.model)}</p>` : ''}
  ${globalState.includeMetadata.timestamps ? `<p><strong>Exported:</strong> ${new Date(meta.exported_at).toLocaleString()}</p>` : ''}
  <hr>
  
  ${messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="bubble">
        <div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
        ${formatMessageContent(msg)}
      </div>
    </div>
  `).join('')}
</body>
</html>`;
  
  return html;
}

function exportToJSON(messages, meta) {
  const data = {
    meta: {
      ...meta,
      exportSettings: {
        mode: globalState.mode,
        filters: globalState.selection.filters,
        includeMetadata: globalState.includeMetadata
      }
    },
    messages: messages
  };
  
  return JSON.stringify(data, null, 2);
}

async function exportMultiFormatZip(harvest) {
  // This would require a zip library like JSZip
  // For now, show a message
  showToast('Multi-format ZIP export requires additional libraries', 'error');
}

async function exportPDF(harvest) {
  // Generate HTML then use print dialog
  const html = exportToHTML(filterMessages(harvest), harvest.meta);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}

function exportCodeFile(filename) {
  const versions = globalState.codeGroups[filename];
  const latest = versions[versions.length - 1];
  
  downloadFile(filename, latest.content, 'text/plain');
  showToast(`✅ Exported ${filename}`);
}

/* ===========================
   Utility Functions
   =========================== */
function generateFilename(harvest, format) {
  const title = safeTitle(harvest.meta.title || 'ChatGPT_Conversation');
  const date = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').substring(0, 19);
  const ext = format === 'markdown' ? 'md' : format;
  return `${title}_${date}.${ext}`;
}

function getMimeType(format) {
  const types = {
    markdown: 'text/markdown;charset=utf-8',
    html: 'text/html;charset=utf-8',
    json: 'application/json;charset=utf-8',
    pdf: 'application/pdf'
  };
  return types[format] || 'text/plain;charset=utf-8';
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('[data-cgpt-toast]');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.setAttribute('data-cgpt-toast', '1');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 20px;
    background: white;
    color: #111827;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: ${CFG.zIndex + 100};
    animation: slideUp 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function closePanel() {
  if (panelHost) {
    panelHost.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      if (panelHost?.parentNode) {
        panelHost.parentNode.removeChild(panelHost);
      }
      panelHost = null;
    }, 200);
  }
}

/* ===========================
   Selection Helpers
   =========================== */
function applyPreset(preset) {
  const filters = globalState.selection.filters;
  
  switch (preset) {
    case 'full':
      filters.user = true;
      filters.assistant = true;
      filters.code = false;
      filters.tables = false;
      filters.lists = false;
      break;
    case 'assistant':
      filters.user = false;
      filters.assistant = true;
      break;
    case 'code':
      filters.code = true;
      filters.tables = false;
      filters.lists = false;
      break;
    case 'tables':
      filters.code = false;
      filters.tables = true;
      filters.lists = false;
      break;
  }
}

function updateFilters(container) {
  const filters = globalState.selection.filters;
  container.querySelectorAll('.filter-checkbox').forEach(cb => {
    const type = cb.id.replace('filter-', '');
    cb.checked = filters[type];
  });
}

function toggleRangeSelection(preview) {
  preview.classList.add('range-selecting');
  globalState.selection.rangeStart = null;
  globalState.selection.rangeEnd = null;
  
  const messages = preview.querySelectorAll('.message');
  messages.forEach(msg => {
    msg.style.cursor = 'pointer';
    msg.addEventListener('click', handleRangeClick);
  });
}

function handleRangeClick(e) {
  const messageEl = e.currentTarget;
  const index = parseInt(messageEl.dataset.messageIndex);
  
  if (globalState.selection.rangeStart === null) {
    globalState.selection.rangeStart = index;
    messageEl.classList.add('range-start');
    messageEl.dataset.marker = 'S';
  } else if (globalState.selection.rangeEnd === null) {
    globalState.selection.rangeEnd = index;
    const preview = messageEl.closest('.chat-preview');
    preview.classList.remove('range-selecting');
    renderChatPreview(preview, globalState.harvest);
  }
}

function clearRangeSelection() {
  globalState.selection.rangeStart = null;
  globalState.selection.rangeEnd = null;
}

function selectAllBlocks(harvest) {
  globalState.selection.blockSelection = {};
  harvest.messages.forEach((msg, idx) => {
    globalState.selection.blockSelection[idx] = {};
    msg.blocks.forEach((_, bIdx) => {
      globalState.selection.blockSelection[idx][bIdx] = true;
    });
  });
}

function selectNoBlocks() {
  globalState.selection.blockSelection = {};
}

function invertBlockSelection(harvest) {
  harvest.messages.forEach((msg, idx) => {
    if (!globalState.selection.blockSelection[idx]) {
      globalState.selection.blockSelection[idx] = {};
    }
    msg.blocks.forEach((_, bIdx) => {
      globalState.selection.blockSelection[idx][bIdx] = !globalState.selection.blockSelection[idx][bIdx];
    });
  });
}

function renderAdvancedPreview(container) {
  // Generate preview based on selected blocks
  const messages = [];
  
  globalState.harvest.messages.forEach((msg, msgIdx) => {
    const selectedBlocks = [];
    msg.blocks.forEach((block, blockIdx) => {
      if (globalState.selection.blockSelection[msgIdx]?.[blockIdx]) {
        selectedBlocks.push(block);
      }
    });
    
    if (selectedBlocks.length > 0) {
      messages.push({
        ...msg,
        blocks: selectedBlocks
      });
    }
  });
  
  const md = exportToMarkdown(messages, globalState.harvest.meta);
  container.innerHTML = `<pre style="white-space: pre-wrap; font-size: 12px;">${escapeHtml(md)}</pre>`;
}

function updateExportButton(shadow) {
  const btn = shadow.querySelector('.export-btn');
  const format = globalState.exportFormat;
  const formatNames = {
    markdown: 'Markdown',
    html: 'HTML',
    json: 'JSON',
    pdf: 'PDF',
    zip: 'ZIP Archive'
  };
  btn.textContent = `Export as ${formatNames[format]}`;
}

/* ===========================
   Single Message Export
   =========================== */
async function extractMessageContent(messageEl) {
  const role = detectRole(messageEl);
  const contentNode = findContentNode(messageEl);
  const clone = contentNode.cloneNode(true);
  sanitizeClone(clone);
  
  const blocks = extractBlocks(clone);
  const markdown = blocksToMarkdown(blocks);
  const html = blocksToHTML(blocks);
  
  return {
    role,
    markdown,
    html,
    blocks
  };
}

function exportSingleMessage(content, format) {
  const filename = `ChatGPT_Answer_${new Date().toISOString().substring(0, 19).replace(/[:.]/g, '-')}.${format === 'markdown' ? 'md' : format}`;
  const mimeType = getMimeType(format);
  
  let exportContent;
  switch (format) {
    case 'markdown':
      exportContent = content.markdown;
      break;
    case 'html':
      exportContent = content.html;
      break;
    case 'json':
      exportContent = JSON.stringify(content.blocks, null, 2);
      break;
    default:
      exportContent = content.markdown;
  }
  
  downloadFile(filename, exportContent, mimeType);
  showToast(`✅ Exported answer as ${filename}`);
}

function exportCodeFromMessage(content) {
  const codeBlocks = content.blocks.filter(b => b.kind === 'code');
  
  if (codeBlocks.length === 0) {
    showToast('No code found in this message', 'error');
    return;
  }
  
  if (codeBlocks.length === 1) {
    const block = codeBlocks[0];
    const filename = `code.${block.language || 'txt'}`;
    downloadFile(filename, block.text, 'text/plain');
    showToast(`✅ Exported code as ${filename}`);
  } else {
    // Multiple code blocks - export as markdown with all code
    const md = codeBlocks.map((block, idx) => 
      `## Code Block ${idx + 1}${block.language ? ` (${block.language})` : ''}\n\n\`\`\`${block.language || ''}\n${block.text}\n\`\`\`\n`
    ).join('\n');
    
    const filename = `code_snippets_${new Date().toISOString().substring(0, 19).replace(/[:.]/g, '-')}.md`;
    downloadFile(filename, md, 'text/markdown');
    showToast(`✅ Exported ${codeBlocks.length} code blocks`);
  }
}

/* ===========================
   Keep existing harvester code...
   =========================== */
// [Previous harvester functions remain unchanged - harvestConversationV03, normalizeMessageV03, etc.]

/* ===========================
   Initialize Extension
   =========================== */
(function init() {
  if (!CFG.urlGuard.test(location.href)) return;
  
  mountOverlay();
  setupContextMenu();
  setupKeyboardShortcuts();
  
  // Add styles for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();

/* ===========================
   Harvester & Normalizers (v0.3)
   =========================== */

/**
 * Main harvester: scrapes the visible conversation and returns:
 * { meta: { title, url, exported_at, model }, messages: [...] , pairs: [...] }
 */
async function harvestConversationV03() {
  const meta = {
    title: detectConversationTitle() || (document.title || 'ChatGPT Conversation').replace(/\s*\|\s*ChatGPT.*/i, ''),
    url: location.href,
    model: detectModelName() || undefined,
    exported_at: new Date().toISOString()
  };

  // Find message elements in DOM order (robust across UI updates)
  const msgEls = findConversationMessageElements();

  const messages = msgEls
    .map((el, i) => normalizeMessageV03(el, i))
    .filter(m => (m?.plain?.text || '').trim().length > 0 || (m?.blocks || []).length > 0)
    .map((m, i) => ({
      ...m,
      index: typeof m.index === 'number' ? m.index : i,
      timestamp: m.timestamp || new Date(Date.parse(meta.exported_at) + i * 1000).toISOString()
    }));

  const pairs = buildPairs(messages);

  return { meta, messages, pairs };
}

/**
 * Normalize a single message element into our message schema.
 */
function normalizeMessageV03(el, idx) {
  const role = detectRole(el) || 'assistant';
  const contentNode = findContentNode(el) || el;
  const clone = contentNode.cloneNode(true);
  sanitizeClone(clone);

  const blocks = extractBlocks(clone);
  const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();

  // If no blocks but there’s text, produce a single paragraph block
  const finalBlocks = (blocks && blocks.length)
    ? blocks
    : (plainText ? [{ kind: 'para', md: plainText }] : []);

  // Try to grab a timestamp if the UI exposes it (rare)
  const tsAttr = el.getAttribute('data-timestamp') || el.querySelector?.('time')?.getAttribute('datetime');
  const timestamp = tsAttr || null;

  return {
    id: el.id || `msg-${idx + 1}`,
    index: idx,
    role,
    blocks: finalBlocks,
    plain: { text: plainText },
    timestamp
  };
}

/**
 * Build user→assistant pairs for “Q/A” workflows.
 */
function buildPairs(messages) {
  const pairs = [];
  let current = null;
  for (const m of messages) {
    if (m.role === 'user') {
      // start new pair
      if (current && current.user && !current.assistant) {
        // user->user (no assistant in-between), push previous anyway
        pairs.push(current);
      }
      current = { user: m, assistant: null };
    } else if (m.role === 'assistant') {
      if (!current) {
        current = { user: null, assistant: m };
        pairs.push(current);
        current = null;
      } else if (!current.assistant) {
        current.assistant = m;
        pairs.push(current);
        current = null;
      } else {
        // assistant following assistant; start a new pair with no user
        pairs.push({ user: null, assistant: m });
        current = null;
      }
    } else {
      // other roles (system/tool): attach to current assistant if present
      if (current && current.assistant) {
        // no-op in this minimal implementation; can be extended to add context
      }
    }
  }
  if (current) pairs.push(current);
  return pairs;
}

/* ===========================
   DOM Discovery (resilient selectors)
   =========================== */

function findConversationMessageElements() {
  // Primary selectors that tend to be stable:
  const selectors = [
    '[data-testid="conversation-turn"]',
    '[data-message-author-role]',
    'main article',
    'article[role="article"]',
    'div[role="article"]'
  ];

  const found = new Set();
  const result = [];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!el || found.has(el)) return;
      found.add(el);
      result.push(el);
    });
  });

  // Ensure document order (top → bottom)
  result.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    if (ar.top === br.top) return ar.left - br.left;
    return ar.top - br.top;
  });

  // Filter out obvious containers (keep leaf-ish message nodes)
  const pruned = result.filter(el => {
    // If it contains other elements with role markers, skip it
    const inner = el.querySelector('[data-message-author-role]');
    if (inner && inner !== el) return false;
    return true;
  });

  // As a last resort, if nothing found, fall back to message-like blocks in the main area
  if (!pruned.length) {
    const fallback = Array.from(document.querySelectorAll('main article, article')).filter(el => (el.textContent || '').trim().length > 0);
    return fallback;
  }
  return pruned;
}

function detectConversationTitle() {
  // Common places ChatGPT renders the title
  const titleCandidates = [
    '[data-testid="conversation-name"]',
    'header h1',
    'h1',
    'h2'
  ];
  for (const sel of titleCandidates) {
    const el = document.querySelector(sel);
    const t = (el?.textContent || '').trim();
    if (t) return t.replace(/\s*\|\s*ChatGPT.*/i, '');
  }
  // Strip ChatGPT suffix from document.title
  return (document.title || '').replace(/\s*\|\s*ChatGPT.*/i, '') || null;
}

function detectModelName() {
  // Heuristic scan for model badge/label
  const text = document.body.innerText || '';
  const models = ['GPT-4o', 'GPT-4.1', 'GPT-4', 'o3', 'o4', 'o4-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4', 'gpt-3.5', 'gpt-4o mini'];
  for (const m of models) {
    const re = new RegExp(`\\b${m.replace(/[.+]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return m;
  }
  // Try specific UI elements
  const el = document.querySelector('[data-testid*="model"], [aria-label*="Model"], [id*="model"], [class*="model"]');
  const label = (el?.textContent || '').trim();
  return label || null;
}

/* ===========================
   Block Extraction
   =========================== */

function extractBlocks(root) {
  const blocks = [];
  const SKIP_DESCEND = Symbol('SKIP');

  function visit(node) {
    if (!node) return;

    // ELEMENT NODE
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();

      // Ignore hidden or empty styling nodes
      if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return;

      // Code blocks: <pre><code class="language-xyz">...</code></pre>
      if (tag === 'pre') {
        const code = node.querySelector('code') || node;
        const klass = code.getAttribute('class') || '';
        const langMatch = klass.match(/language-([a-z0-9+.-]+)/i);
        const language = code.getAttribute('data-language') || (langMatch ? langMatch[1] : '');
        const text = code.textContent || '';
        if (text.trim().length) {
          blocks.push({ kind: 'code', language, text });
          return SKIP_DESCEND;
        }
      }

      // Headings
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'heading', level, text });
        return SKIP_DESCEND;
      }

      // Lists
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li')).map(li => (li.textContent || '').trim()).filter(Boolean);
        if (items.length) {
          blocks.push({ kind: 'list', ordered: tag === 'ol', items });
        }
        return SKIP_DESCEND;
      }

      // Tables – keep HTML to preserve structure
      if (tag === 'table') {
        blocks.push({ kind: 'table', html: node.outerHTML });
        return SKIP_DESCEND;
      }

      // Images
      if (tag === 'img') {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        if (src) blocks.push({ kind: 'image', src, alt });
        return SKIP_DESCEND;
      }

      // Quotes
      if (tag === 'blockquote') {
        const md = (node.textContent || '').trim();
        if (md) blocks.push({ kind: 'quote', md });
        return SKIP_DESCEND;
      }

      // Dividers
      if (tag === 'hr') {
        blocks.push({ kind: 'divider' });
        return SKIP_DESCEND;
      }

      // KaTeX / Math – capture TeX from aria-label if present
      if (node.classList.contains('katex-display') || node.classList.contains('katex')) {
        const latex = node.getAttribute('aria-label') || (node.querySelector('.katex')?.getAttribute?.('aria-label')) || '';
        if (latex.trim()) {
          blocks.push({ kind: 'math', latex });
          return SKIP_DESCEND;
        }
      }

      // Paragraph-like containers → only if they don't contain block elements we already handle
      if ((tag === 'p' || tag === 'div') && isParagraphish(node)) {
        const md = stringifyInline(node).trim();
        if (md) blocks.push({ kind: 'para', md });
        return SKIP_DESCEND;
      }
    }

    // TEXT NODE (fallback): fold into a para if significant
    if (node.nodeType === 3) {
      const t = node.nodeValue || '';
      if (t.trim()) {
        blocks.push({ kind: 'para', md: t.trim() });
      }
    }
  }

  // Walk child nodes in-order
  for (const child of Array.from(root.childNodes)) {
    const res = visit(child);
    if (res !== SKIP_DESCEND && child.nodeType === 1) {
      // Recurse if not consumed as a block
      const subBlocks = extractBlocks(child);
      // Merge subBlocks directly (avoid nested para duplicates)
      for (const b of subBlocks) blocks.push(b);
    }
  }

  // If nothing recognized but there is text, create a single paragraph
  if (!blocks.length) {
    const text = (root.textContent || '').trim();
    if (text) blocks.push({ kind: 'para', md: text });
  }

  return coalesceAdjacentParas(blocks);
}

/* ===========================
   Block Extractor Helpers
   =========================== */

function isParagraphish(node) {
  // Treat as paragraph if it doesn't contain block-level elements we already handle
  const hasKnownBlocks = node.querySelector?.('h1,h2,h3,h4,h5,h6,pre,ul,ol,table,blockquote,hr,img,.katex,.katex-display');
  return !hasKnownBlocks;
}

function stringifyInline(node) {
  // Convert inline markup into plain-ish MD-friendly text
  // (Your formatInlineMarkdown() is used for rendering; here we keep raw text)
  const clone = node.cloneNode(true);
  // Strip blockchildren we don't want to inline
  clone.querySelectorAll('h1,h2,h3,h4,h5,h6,pre,ul,ol,table,blockquote,hr,img,.katex,.katex-display').forEach(n => n.remove());
  return (clone.textContent || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function coalesceAdjacentParas(blocks) {
  // Merge consecutive para blocks by inserting double newlines between them
  const out = [];
  for (const b of blocks) {
    if (out.length && b.kind === 'para' && out[out.length - 1].kind === 'para') {
      // merge paras
      const prev = out[out.length - 1];
      prev.md = `${(prev.md || '').trim()}\n\n${(b.md || '').trim()}`.trim();
    } else {
      out.push(b);
    }
  }
  return out;
}

/* ===========================
   Single-message helpers (robust defaults)
   =========================== */

function findContentNode(el) {
  // Prefer semantic content containers inside a message element
  const candidates = [
    '[data-testid="markdown"]',
    '.markdown',
    '.prose',
    '[data-message-content="true"]',
    'article',
    'div[role="article"]',
    'div'
  ];
  for (const sel of candidates) {
    const n = el.querySelector(sel);
    if (n && (n.textContent || '').trim().length) return n;
  }
  return el;
}

function detectRole(el) {
  const a = el.getAttribute('data-message-author-role');
  if (a) return a;
  // Look up for an ancestor that marks role
  const anc = el.closest?.('[data-message-author-role]');
  if (anc) return anc.getAttribute('data-message-author-role');

  // Heuristic by aria-label/text
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  if (/assistant|gpt|chatgpt|ai/.test(aria)) return 'assistant';
  if (/you|user|me/.test(aria)) return 'user';

  // Position heuristic: user bubbles are often right-aligned
  const style = window.getComputedStyle(el);
  if (style.textAlign === 'right') return 'user';

  return 'assistant';
}

function sanitizeClone(root) {
  // Remove UI controls & attributes
  const DROP = [
    'button',
    'nav', 'aside', '[role="toolbar"]',
    '[data-testid="inline-toolbar"]',
    '[data-testid="webpage-citation-pill"]',
    '[data-testid="citation-chip"]',
    'svg[aria-hidden="true"]',
  ];
  root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());
  root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
  root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));
  root.querySelectorAll?.('*')?.forEach(el => {
    [...el.attributes].forEach(a => { if (/^data-/.test(a.name)) el.removeAttribute(a.name); });
  });
}

/* ===========================
   NOTE:
   - We deliberately DO NOT redefine escapeHtml, safeTitle, blocksToMarkdown, blocksToHTML
     because your file now includes safe fallbacks earlier.
   - These harvester functions plug into the rest of the UI without further changes.
   =========================== */

/* ===========================
   Overlay Mounting & Positioning
   =========================== */
function mountOverlay() {
  if (overlayHost && document.contains(overlayHost)) return;
  overlayHost = makeButtonShadow(onExportClickOpenPanel);
  document.documentElement.appendChild(overlayHost);

  // fade in + position once attached
  requestAnimationFrame(() => {
    overlayHost.style.opacity = '1';
    recomputePosition();
  });

  startObservers();
}

function unmountOverlay() {
  stopObservers();
  if (overlayHost?.parentNode) overlayHost.parentNode.removeChild(overlayHost);
  overlayHost = null;
}

function startObservers() {
  // Reposition on viewport changes
  const onResize = () => recomputePosition();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  detachResize = () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
  };

  // Reposition on DOM churn (SPA updates, composer growth)
  const mo = new MutationObserver(() => {
    // debounce a touch; light enough not to need a timer
    recomputePosition();
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  detachObserver = () => mo.disconnect();

  // Keep overlay alive across SPA navigations
  (function watchRoute() {
    let last = location.href;
    const handle = () => {
      if (location.href !== last) {
        last = location.href;
        // close any open panel on nav
        closePanel();
        if (CFG.urlGuard.test(location.href)) {
          mountOverlay();
          recomputePosition();
        } else {
          unmountOverlay();
        }
      }
    };
    const _push = history.pushState;
    const _replace = history.replaceState;
    history.pushState = function (...args) { const r = _push.apply(this, args); handle(); return r; };
    history.replaceState = function (...args) { const r = _replace.apply(this, args); handle(); return r; };
    window.addEventListener('popstate', handle);
  })();
}

function stopObservers() {
  if (detachResize) detachResize();
  if (detachObserver) detachObserver();
  detachResize = null;
  detachObserver = null;
}

function recomputePosition() {
  if (!overlayHost) return;
  // Default spot
  let bottomPx = CFG.bottom;

  // If the composer overlaps, nudge up
  const composer = findComposer();
  if (composer) {
    const oRect = overlayHost.getBoundingClientRect();
    const cRect = composer.getBoundingClientRect();
    const overlap =
      oRect.left < cRect.right &&
      oRect.right > cRect.left &&
      oRect.bottom > cRect.top - 8;

    if (overlap) {
      const needed = Math.ceil((oRect.bottom - (cRect.top - 8)) + CFG.nudgeGap);
      bottomPx += needed;
    }
  }

  overlayHost.style.bottom = `calc(${bottomPx}px + env(safe-area-inset-bottom))`;
}

/* ===========================
   Composer Heuristics (safe + generic)
   =========================== */
function findComposer() {
  const candidates = [
    '[contenteditable="true"][role="textbox"]',
    'textarea[placeholder]',
    'div[role="textbox"]',
    '[data-testid="composer"], [data-test="composer"]'
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && isNearBottom(el)) return el;
  }
  // fallback: bottom-most editable
  const all = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],div[role="textbox"]'));
  if (!all.length) return null;
  all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  const bottomMost = all[0];
  return isNearBottom(bottomMost) ? bottomMost : null;
}

function isNearBottom(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  // treat things in the lower half as "the composer area"
  return rect.top > vh * 0.45;
}

/* ===========================
   Export Button → Harvest → Panel
   =========================== */
async function onExportClickOpenPanel() {
  try {
    // Use existing harvester if present
    let harvest;
    if (typeof harvestConversationV03 === 'function') {
      harvest = await harvestConversationV03();
    } else {
      // Fallback ultra-light harvester: scrape visible messages as plain text
      console.warn('[CGPT Export] Using fallback harvester (full harvester not found).');
      const msgs = Array.from(document.querySelectorAll('[data-testid="conversation-turn"], [data-message-author-role], main article, article, div[role="article"]'))
        .map((el, i) => ({
          index: i,
          id: el.id || `msg-${i + 1}`,
          role: (el.getAttribute('data-message-author-role') || '').includes('user') ? 'user' : 'assistant',
          timestamp: new Date().toISOString(),
          blocks: [{ kind: 'para', md: (el.innerText || '').trim() }],
          plain: { text: (el.innerText || '').trim() }
        }))
        .filter(m => (m.plain.text || '').length > 0);

      harvest = {
        meta: {
          title: document.title.replace(/\s*\|\s*ChatGPT.*/i, '') || 'ChatGPT Conversation',
          url: location.href,
          exported_at: new Date().toISOString()
        },
        messages: msgs
      };
    }

    // Timestamp fallback + pairs if missing
    harvest.meta = harvest.meta || {};
    harvest.meta.exported_at = harvest.meta.exported_at || new Date().toISOString();
    harvest.messages.forEach((m, i) => {
      if (!m.timestamp) m.timestamp = new Date(Date.parse(harvest.meta.exported_at) + i * 1000).toISOString();
      if (typeof m.index !== 'number') m.index = i;
    });
    if (!harvest.pairs && typeof buildPairs === 'function') {
      harvest.pairs = buildPairs(harvest.messages);
    }

    globalState.harvest = harvest;
    openPanel(harvest);
  } catch (err) {
    console.error('[ChatGPT Export v2] Harvest failed:', err);
    showToast('Failed to harvest conversation', 'error');
  }
}

/* ===========================
   Safe Fallbacks for Helper APIs
   (Only define if not already provided by existing harvester)
   =========================== */
if (typeof escapeHtml !== 'function') {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
}

if (typeof safeTitle !== 'function') {
  function safeTitle(t) {
    return (t || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

if (typeof blocksToMarkdown !== 'function') {
  function blocksToMarkdown(blocks) {
    // minimal version (your full harvester’s version takes precedence if present)
    const out = [];
    (blocks || []).forEach(b => {
      switch (b.kind) {
        case 'heading': out.push(`\n\n${'#'.repeat(Math.max(1, Math.min(6, b.level || 1)))} ${b.text || ''}\n`); break;
        case 'para': out.push(`\n\n${b.md || ''}\n`); break;
        case 'list':
          out.push('\n' + (b.items || []).map((t, i) => (b.ordered ? `${i + 1}. ${t}` : `- ${t}`)).join('\n') + '\n');
          break;
        case 'code': out.push(`\n\n\`\`\`${b.language || ''}\n${b.text || ''}\n\`\`\`\n`); break;
        case 'table': out.push(`\n\n${b.html || ''}\n`); break;
        case 'image': out.push(`\n\n![${b.alt || 'image'}](${b.src || ''})\n`); break;
        case 'quote': out.push('\n' + String(b.md || '').split('\n').map(l => `> ${l}`).join('\n') + '\n'); break;
        case 'math': out.push(`\n\n$$\n${b.latex || ''}\n$$\n`); break;
        case 'divider': out.push('\n\n---\n'); break;
      }
    });
    return out.join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
}

if (typeof blocksToHTML !== 'function') {
  function blocksToHTML(blocks, title = 'ChatGPT Export') {
    // lightweight fragment (not full page) for single-message export
    const body = (blocks || []).map((b) => {
      switch (b.kind) {
        case 'heading': {
          const lvl = Math.max(1, Math.min(6, b.level || 1));
          return `<h${lvl}>${escapeHtml(b.text || '')}</h${lvl}>`;
        }
        case 'para': return `<p>${formatInlineMarkdown(b.md || '')}</p>`;
        case 'list': {
          const items = (b.items || []).map(i => `<li>${formatInlineMarkdown(i)}</li>`).join('');
          return b.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
        }
        case 'code': return `<pre><code class="language-${escapeHtml(b.language || '')}">${escapeHtml(b.text || '')}</code></pre>`;
        case 'table': return b.html || '';
        case 'image': return `<p><img alt="${escapeHtml(b.alt || '')}" src="${escapeHtml(b.src || '')}" /></p>`;
        case 'quote': return `<blockquote>${formatInlineMarkdown(b.md || '')}</blockquote>`;
        case 'math': return `<pre class="math">$$${escapeHtml(b.latex || '')}$$</pre>`;
        case 'divider': return `<hr/>`;
        default: return '';
      }
    }).join('\n');

    return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>${body}`;
  }
}

if (typeof detectRole !== 'function') {
  function detectRole(el) {
    const attr = el.getAttribute('data-message-author-role') ||
                 el.querySelector?.('[data-message-author-role]')?.getAttribute('data-message-author-role');
    if (attr) return attr;
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    if (/assistant|gpt/.test(aria)) return 'assistant';
    if (/you|user/.test(aria)) return 'user';
    return 'assistant';
  }
}

if (typeof findContentNode !== 'function') {
  function findContentNode(el) {
    return el.querySelector?.('[data-testid="markdown"], .markdown, .prose, .whitespace-pre-wrap, article, div') || el;
  }
}

if (typeof sanitizeClone !== 'function') {
  function sanitizeClone(root) {
    // drop obvious UI chrome
    const DROP = [
      'button', '[role="toolbar"]',
      '[data-testid="webpage-citation-pill"]', '[data-testid="citation-chip"]', '[data-testid="inline-toolbar"]',
      'svg[aria-hidden="true"]', 'nav', 'aside'
    ];
    root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());
    // strip class/style/data-*
    root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
    root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));
    root.querySelectorAll?.('*')?.forEach(el => {
      [...el.attributes].forEach(a => { if (/^data-/.test(a.name)) el.removeAttribute(a.name); });
    });
  }
}

/* ===========================
   End glue additions
   =========================== */
