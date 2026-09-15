/* ===========================
   Utilities (Enhanced)
   =========================== */
const Utils = {
  escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },


  safeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      const allowedProtocols = ['http:', 'https:', 'data:', 'blob:'];
      return allowedProtocols.includes(u.protocol) ? url : '#';
    } catch {
      return '#';
    }
  },

  safeTitle(t) {
    return (t || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
  },

  extractHostname(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  },

  getComputedBackgroundUrl(el) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') return null;
    
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    return match ? match[1] : null;
  },

  downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

/* ===========================
   Panel Manager
   =========================== */
const PanelManager = {
  open(harvest) {
    if (panelHost) this.close();

    const host = ExportPanel.create(harvest);
    panelHost = host;
    document.body.appendChild(host);

    // Deferred work is bound to this host: a close in the meantime must not
    // act on a newer panel
    setTimeout(() => {
      if (panelHost !== host || !host.isConnected) return;
      const shadow = host.shadowRoot;
      const firstFocusable = shadow.querySelector('button, select');
      if (firstFocusable) firstFocusable.focus();

      // Initialize tutorial system
      tutorialManager.init(shadow);

      // Trigger welcome tutorial after a short delay to let panel settle
      setTimeout(() => {
        if (panelHost === host) tutorialManager.startFlow('welcome');
      }, 500);
    }, 100);
  },

  close() {
    const host = panelHost;
    if (!host) return;
    // State is released synchronously so an open() during the fade-out starts
    // clean; only the visual removal is deferred, and only for this host
    panelHost = null;
    ChatRenderer.destroy();
    Timeline.cleanupAll();
    if (tutorialManager.isActive()) {
      tutorialManager.endFlow(true);
    }
    globalState.reset();

    host.style.pointerEvents = 'none';
    host.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => host.remove(), 200);
  }
};

/* ===========================
   Notification Manager
   =========================== */
const NotificationManager = {
  showToast(message, type = 'success') {
    const existing = document.querySelector('[data-cgpt-toast]');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.setAttribute('data-cgpt-toast', '1');
    const colors = ThemeUtils.getColors();

    // Determine border color based on type
    let borderColor;
    if (type === 'success') {
      borderColor = colors.accentSecondary;
    } else if (type === 'error') {
      borderColor = '#ef4444';
    } else if (type === 'info') {
      borderColor = colors.accentPrimary;
    } else {
      borderColor = colors.border;
    }

    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background: ${colors.bg};
      color: ${colors.text};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: ${CFG.zIndex + 100};
      animation: slideUp 0.3s ease;
    `;

    toast.textContent = message;
    document.body.appendChild(toast);

    // Adjust timeout based on type (longer for info)
    const timeout = type === 'info' ? 2000 : 3000;

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, timeout);
  }
};

/* ===========================
   Context Menu Handler
   =========================== */
const ContextMenu = {
  setup() {
    if (contextMenuListener) return;
    
    contextMenuListener = (e) => {
      const messageEl = e.target.closest('[data-message-author-role], [data-testid="conversation-turn"]');
      if (!messageEl) return;

      const role = Harvester.detectRole(messageEl);
      if (role !== 'assistant') return;

      e.preventDefault();
      this.show(e.pageX, e.pageY, messageEl);
    };

    document.addEventListener('contextmenu', contextMenuListener);
  },

  show(x, y, messageEl) {
    const existing = document.querySelector('[data-cgpt-context-menu]');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.setAttribute('data-cgpt-context-menu', '1');
    const colors = ThemeUtils.getColors();
    
    menu.style.cssText = `
      position: fixed;
      left: ${Math.min(x, window.innerWidth - 200)}px;
      top: ${Math.min(y, window.innerHeight - 250)}px;
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
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .menu-item:hover {
          background: ${colors.hover};
        }
        .menu-divider {
          height: 1px;
          background: ${colors.border};
          margin: 4px 8px;
        }
      </style>
      <div class="menu-item" data-action="copy-answer">Copy to clipboard</div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="export-markdown">Export as Markdown</div>
      <div class="menu-item" data-action="export-html">Export as HTML</div>
      <div class="menu-item" data-action="export-json">Export as JSON</div>
    `;

    document.body.appendChild(menu);

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;

      menu.remove();
      const action = item.dataset.action;
      
      if (action === 'copy-answer') {
        const content = await this.extractSingleMessage(messageEl, 'markdown');
        await navigator.clipboard.writeText(content);
        NotificationManager.showToast('Copied to clipboard');
      } else if (action.startsWith('export-')) {
        const format = action.replace('export-', '');
        const content = await this.extractSingleMessage(messageEl, format);
        const filename = `ChatGPT_Answer_${new Date().toISOString().substring(0, 19).replace(/[:.]/g, '-')}.${format === 'markdown' ? 'md' : format}`;
        
        Utils.downloadFile(filename, content, ExportManager.getMimeType(format));
        NotificationManager.showToast(`Exported answer as ${format.toUpperCase()}`);
      }
    });

    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 0);
  },

  async extractSingleMessage(messageEl, format) {
    const contentNode = Harvester.findContentNode(messageEl);
    const clone = contentNode.cloneNode(true);
    Harvester.sanitizeClone(clone);
    const blocks = Harvester.extractBlocks(clone);
    const chatFont = globalState.settings.getEffectiveFont();
    
    if (format === 'markdown') {
      return ExportManager.blocksToMarkdown(blocks);
    } else if (format === 'html') {
      const content = MessageFormatter.format({ blocks });
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none';">
  <title>ChatGPT Answer</title>
  <style>
    body { 
      font-family: ${chatFont}; 
      max-width: 800px; 
      margin: 40px auto; 
      padding: 20px;
      line-height: 1.6;
    }
    .citation {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 8px;
      margin: 8px 0;
    }
    .citation img {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
    }
    pre { 
      background: #f3f4f6; 
      padding: 12px; 
      border-radius: 8px; 
      overflow-x: auto; 
    }
    code { 
      font-family: 'Monaco', 'Menlo', monospace; 
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111827; color: #f9fafb; }
      pre { background: #1f2937; color: #f3f4f6; }
      .citation { background: rgba(255,255,255,0.05); }
    }
  </style>
</head>
<body>${content}</body>
</html>`;
    } else if (format === 'json') {
      return JSON.stringify({ blocks, timestamp: new Date().toISOString() }, null, 2);
    }
    
    return ExportManager.blocksToMarkdown(blocks);
  }
};

/* ===========================
   Keyboard Shortcuts
   =========================== */
const KeyboardShortcuts = {
  setup() {
    if (keyboardShortcutListener) return;

    keyboardShortcutListener = (e) => {
      // Alt+E to open export panel
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        App.openExportPanel();
      }
      
      // Escape to close panel
      if (e.key === 'Escape' && panelHost) {
        PanelManager.close();
      }
    };

    document.addEventListener('keydown', keyboardShortcutListener);
  }
};

/* ===========================
   Overlay Management
   =========================== */
const OverlayManager = {
  mount() {
    if (overlayHost && document.contains(overlayHost)) return;
    
    overlayHost = ExportButton.create(
      () => App.openExportPanel(),
      (position) => {
        globalState.settings.save({ buttonPosition: position });
        this.recomputePosition();
      }
    );
    document.documentElement.appendChild(overlayHost);
    
    requestAnimationFrame(() => {
      overlayHost.style.opacity = '1';
      this.recomputePosition();
    });
    
    this.startObservers();
  },

  unmount() {
    this.stopObservers();
    Timeline.cleanupAll();
    if (overlayHost?.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    overlayHost = null;
  },

  recomputePosition() {
    if (!overlayHost || overlayHost.isDragging) return;

    // A user-placed button is only clamped to the viewport, never nudged
    const custom = globalState.settings.current.buttonPosition;
    ExportButton.applyPosition(overlayHost, custom);
    if (custom) return;

    let bottomPx = CFG.bottom;
    const composer = this.findComposer();
    
    if (composer) {
      const oRect = overlayHost.getBoundingClientRect();
      const cRect = composer.getBoundingClientRect();
      const overlap = oRect.bottom > cRect.top - 8;
      
      if (overlap) {
        bottomPx += Math.ceil((oRect.bottom - (cRect.top - 8)) + CFG.nudgeGap);
      }
    }
    
    overlayHost.style.bottom = `calc(${bottomPx}px + env(safe-area-inset-bottom))`;
  },

  findComposer() {
    const candidates = [
      '[contenteditable="true"][role="textbox"]',
      'textarea[placeholder]',
      'div[role="textbox"]'
    ];
    
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && this.isNearBottom(el)) return el;
    }
    return null;
  },

  isNearBottom(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return rect.top > vh * 0.45;
  },

  startObservers() {
    const onResize = Utils.debounce(() => this.recomputePosition(), CFG.recomputeDebounceMs);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    
    detachResize = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    
    const mo = new MutationObserver(Utils.debounce(() => this.recomputePosition(), CFG.recomputeDebounceMs));
    mo.observe(document.body, { childList: true, subtree: true });
    detachObserver = () => mo.disconnect();
  },

  stopObservers() {
    if (detachResize) detachResize();
    if (detachObserver) detachObserver();
    detachResize = null;
    detachObserver = null;
  }
};

/* ===========================
   Main Application
   =========================== */
const App = {
  isProcessing: false,

  async openExportPanel() {
    // Prevent multiple concurrent requests
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // Set button to loading state
    if (overlayHost && overlayHost.setLoading) {
      overlayHost.setLoading(true);
    }

    try {
      const harvest = await Harvester.harvest();

      if (!harvest.messages || harvest.messages.length === 0) {
        // No turn container matched at all means the page markup changed,
        // which is a different problem from an empty conversation
        const layoutChanged = !Harvester.lastTurnStrategy;
        console.warn('[ChatGPT Export] Empty harvest; turn selector tier:', Harvester.lastTurnStrategy);
        NotificationManager.showToast(
          layoutChanged
            ? 'No conversation found. ChatGPT may have changed its layout; Capsula needs an update.'
            : 'No messages found to export',
          'error'
        );
        return;
      }

      PanelManager.open(harvest);
    } catch (err) {
      console.error('[ChatGPT Export] Harvest failed:', err);
      NotificationManager.showToast('Failed to harvest conversation', 'error');
    } finally {
      // Reset loading state
      this.isProcessing = false;
      if (overlayHost && overlayHost.setLoading) {
        overlayHost.setLoading(false);
      }
    }
  },

  init() {
    if (!CFG.urlGuard.test(location.href)) return;
    
    OverlayManager.mount();
    ContextMenu.setup();
    KeyboardShortcuts.setup();
    
    if (!document.querySelector('[data-cgpt-styles]')) {
      const style = document.createElement('style');
      style.setAttribute('data-cgpt-styles', '1');
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
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    this.setupRouteWatcher();
  },

  setupRouteWatcher() {
    // A route is the conversation, not the full URL: query and hash changes,
    // and a new chat acquiring its /c/<id>, keep the open panel valid
    const conversationId = () => ConversationApi.conversationIdFromUrl(location.href);
    const routeKey = () => conversationId() || location.pathname;
    let lastKey = routeKey();
    let lastHadId = !!conversationId();
    
    const handleNav = () => {
      const key = routeKey();
      if (key === lastKey) return;
      const wasNewChat = !lastHadId && /^\/(?:g\/[^/]+\/?)?$/.test(lastKey);
      const hasId = !!conversationId();
      lastKey = key;
      lastHadId = hasId;
      // A new chat acquiring its /c/<id> is still the same conversation
      if (wasNewChat && hasId) return;

      if (panelHost) console.info('[ChatGPT Export] Route changed, closing export panel:', key);
      PanelManager.close();

      if (CFG.urlGuard.test(location.href)) {
        OverlayManager.mount();
      } else {
        OverlayManager.unmount();
      }
    };
    
    const _push = history.pushState;
    const _replace = history.replaceState;
    
    history.pushState = function(...args) {
      const r = _push.apply(this, args);
      handleNav();
      return r;
    };
    
    history.replaceState = function(...args) {
      const r = _replace.apply(this, args);
      handleNav();
      return r;
    };

    window.addEventListener('popstate', handleNav);

    if (navCheckInterval) clearInterval(navCheckInterval);
    navCheckInterval = setInterval(handleNav, CFG.navCheckIntervalMs);

    handleNav();
  }
};

/* ===========================
   Bootstrap
   =========================== */

window.addEventListener('pagehide', () => {
  try {
    PanelManager.close();
    OverlayManager.unmount();
    if (navCheckInterval) {
      clearInterval(navCheckInterval);
      navCheckInterval = null;
    }
    if (contextMenuListener) {
      document.removeEventListener('contextmenu', contextMenuListener);
      contextMenuListener = null;
    }
    if (keyboardShortcutListener) {
      document.removeEventListener('keydown', keyboardShortcutListener);
      keyboardShortcutListener = null;
    }
  } catch (e) {
    // no-op
  }
});

(function bootstrap() {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => App.init(), { once: true });
    } else {
      App.init();
    }
  } catch (err) {
    console.error('[ChatGPT Export] Init error:', err);
  }
})();
