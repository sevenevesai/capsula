/**
 * ChatGPT Export Extension v3.3.0 - Enhanced Production Release
 * 
 * A Firefox extension for exporting ChatGPT conversations with improved
 * model detection, thinking state capture, media handling, and settings.
 * 
 * @author Mark T. Short (seveneves.ai)
 * @license MIT
 * @copyright 2025
 * 
 * Security & Compliance:
 * - Content script only (no background scripts)
 * - No eval() or remote code execution
 * - No external dependencies or CDN resources
 * - HTML exports include CSP headers
 * - All content is properly escaped
 */

/* ===========================
   Configuration & Constants
   =========================== */
const CFG = {
  // UI positioning
  right: 40,
  bottom: 90,
  minSize: 48,
  zIndex: 2147483000,
  nudgeGap: 12,
  
  // Extension metadata
  version: '3.3.0',
  
  // URL pattern for ChatGPT domains
  urlGuard: /^https:\/\/(chat\.openai\.com|chatgpt\.com)\//,
  
  // Performance tuning
  recomputeDebounceMs: 120,
  navCheckIntervalMs: 3000,
  autoExpandDelay: 50, // ms between auto-expand clicks
  
  // Panel dimensions
  panelWidth: 900,
  panelHeightVh: 85,
  timelineWidth: 60,
  
  // Supported models (expanded list)
  knownModels: [
    'o1-preview', 'o1-mini', 'o3', 'o3-mini',
    'gpt-5-thinking', 'gpt-5', 
    'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4',
    'gpt-3.5-turbo'
  ],
  
  // Theme configuration
  theme: {
    light: {
      bg: 'rgba(255,255,255,0.98)',
      bgSecondary: 'rgba(249,250,251,0.98)',
      text: '#111827',
      textSecondary: '#6b7280',
      border: 'rgba(229,231,235,1)',
      hover: 'rgba(243,244,246,1)',
      userBubble: '#3b82f6',
      userTimeline: '#60a5fa',
      assistantBubble: '#f3f4f6',
      assistantTimeline: '#d1d5db',
      thinkingTimeline: '#fbbf24',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#1f2937',
      exportButtonHover: '#111827',
      exportButtonText: 'white',
      highlightGlow: 'rgba(59, 130, 246, 0.75)',
      settingsIcon: '#6b7280'
    },
    dark: {
      bg: 'rgba(23,23,23,0.98)',
      bgSecondary: 'rgba(31,31,31,0.98)',
      text: '#f9fafb',
      textSecondary: '#9ca3af',
      border: 'rgba(55,65,81,1)',
      hover: 'rgba(55,65,81,0.5)',
      userBubble: '#2563eb',
      userTimeline: '#3b82f6',
      assistantBubble: '#374151',
      assistantTimeline: '#6b7280',
      thinkingTimeline: '#f59e0b',
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#3b82f6',
      exportButtonHover: '#2563eb',
      exportButtonText: 'white',
      highlightGlow: 'rgba(59, 130, 246, 0.7)',
      settingsIcon: '#9ca3af'
    }
  },
  
  // Enhanced thinking patterns
  thinkingPatterns: {
    timePatterns: [
      /\b(?:Thought|Thinking|Processing|Analyzing|Working)\s+for\s+((\d+(?:\.\d+)?)\s*(?:seconds?|secs?)|(\d+)\s*(?:mins?|minutes?)(?:\s+(?:and\s+)?(\d+)\s*(?:seconds?|secs?))?|(\d+)m\s*(\d+)s)\b/i
    ],
    statePatterns: [
      /\b(Analyzing|Analyzed|Processing|Searching|Thinking|Working|Calculating|Reasoning|Summarizing|Refining|Formatting|Compiling|Running|Executing|Uploading|Transcribing|Translating|Using tools|Tool call(?:ing)?|Calling tool|Browsing|Looking up|Reading|Planning|Outlining|Drafting|Analysis (?:stopped|paused|complete)|Failed to generate|Starting|Stopping|Resuming)(?:\.{0,3}|\s|$)/i
    ]
  }
};

/* ===========================
   Settings Management
   =========================== */
class Settings {
  constructor() {
    this.storageKey = 'cgpt_export_settings_v1';
    this.defaults = {
      autoExpandThinking: false,
      inlineCode: true,
      font: 'auto',
      colors: {
        assistant: null, // null = use theme default
        user: null,
        panelBg: null
      },
      exportTemplate: 'classic',
      mdPrefix: '',
      mdSuffix: ''
    };
    this.current = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...this.defaults, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[ChatGPT Export] Failed to load settings:', e);
    }
    return { ...this.defaults };
  }

  save(updates) {
    this.current = { ...this.current, ...updates };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.current));
      return true;
    } catch (e) {
      console.error('[ChatGPT Export] Failed to save settings:', e);
      return false;
    }
  }

  reset() {
    this.current = { ...this.defaults };
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      // no-op
    }
  }

  getEffectiveColors() {
    const themeColors = ThemeUtils.getColors();
    return {
      assistant: this.current.colors.assistant || themeColors.assistantBubble,
      user: this.current.colors.user || themeColors.userBubble,
      panelBg: this.current.colors.panelBg || themeColors.bg,
      assistantTimeline: this.current.colors.assistant || themeColors.assistantTimeline,
      userTimeline: this.current.colors.user || themeColors.userTimeline
    };
  }

  getEffectiveFont() {
    return this.current.font === 'auto' ? ThemeUtils.getChatGPTFont() : this.current.font;
  }
}

/* ===========================
   State Management (Enhanced)
   =========================== */
class ExportState {
  constructor() {
    this.reset();
    this.settings = new Settings();
  }

  reset() {
    this.harvest = null;
    this.filters = {
      assistantOnly: false,
      code: false,
      tables: false,
      lists: false
    };
    this.rangeSelection = {
      start: null,
      end: null,
      isSelecting: false
    };
    this.exportFormat = 'markdown';
    if (typeof this.scrollObserver === 'function') {
      try {
        this.scrollObserver();
      } catch (err) {
        console.warn('[ChatGPT Export] Failed to detach scroll observer', err);
      }
    }
    this.scrollObserver = null;
    this.viewMode = 'main'; // 'main' or 'settings'
    this.onRangeChange = null;
    this.onViewModeChange = null;
  }

  setFilter(filterName, value) {
    this.filters[filterName] = value;
  }

  hasActiveFilters() {
    return Object.values(this.filters).some(v => v);
  }

  setRange(start, end) {
    this.rangeSelection.start = start;
    this.rangeSelection.end = end;
    if (this.onRangeChange) {
      this.onRangeChange();
    }
  }

  clearRange() {
    this.rangeSelection.start = null;
    this.rangeSelection.end = null;
    this.rangeSelection.isSelecting = false;
    if (this.onRangeChange) {
      this.onRangeChange();
    }
  }

  setExportFormat(format) {
    this.exportFormat = format;
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (this.onViewModeChange) {
      this.onViewModeChange(mode);
    }
  }
}

// Global state instance
let globalState = new ExportState();

/* ===========================
   DOM Elements Management
   =========================== */
let overlayHost = null;
let panelHost = null;
let contextMenuListener = null;
let keyboardShortcutListener = null;
let detachResize = null;
let detachObserver = null;
let navCheckInterval = null;

/* ===========================
   Theme Utilities (Enhanced)
   =========================== */
const ThemeUtils = {
  getTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  getColors() {
    return CFG.theme[this.getTheme()];
  },

  getChatGPTFont() {
    const sampleElement = document.querySelector('.text-base, .markdown, article');
    if (sampleElement) {
      const computed = window.getComputedStyle(sampleElement);
      return computed.fontFamily || 'Söhne, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif, "Helvetica Neue", Arial';
    }
    return 'Söhne, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif, "Helvetica Neue", Arial';
  }
};

/* ===========================
   Export Button Component
   =========================== */
const ExportButton = {
  create(onClick) {
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
    const colors = ThemeUtils.getColors();
    
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
          background: ${colors.exportButton};
          color: ${colors.exportButtonText};
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          position: relative;
        }
        .btn:hover {
          transform: scale(1.05);
          background: ${colors.exportButtonHover};
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
      </style>
      <div class="wrap">
        <button class="btn" type="button" aria-label="Export conversation" role="button">
          <span class="tooltip">Export conversation (Alt+E)</span>
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
};

/* ===========================
   Timeline Component (Enhanced)
   =========================== */
const Timeline = {
  render(container, messages) {
    const effectiveColors = globalState.settings.getEffectiveColors();
    
    // Filter out thinking/incomplete messages from timeline
    const realMessages = messages.filter(m => !(m.isThinking || m.incomplete));
    
    // Calculate proportional heights
    const totalLength = realMessages.reduce((sum, msg) => 
      sum + (msg.blocks?.length || 1), 0);
    
    let timeline = `
      <div class="timeline-container">
        <div class="timeline-track">
    `;
    
    realMessages.forEach((msg) => {
      const heightPercent = ((msg.blocks?.length || 1) / totalLength) * 100;
      const color = msg.role === 'user' ? effectiveColors.userTimeline : effectiveColors.assistantTimeline;
      const isInRange = this.isMessageInRange(msg.index);
      
      timeline += `
        <div class="timeline-segment" 
             data-index="${msg.index}"
             data-role="${msg.role}"
             style="height: ${heightPercent}%; 
                    background: ${color};
                    opacity: ${isInRange ? '1' : '0.3'};"
             title="${msg.role === 'user' ? 'You' : 'ChatGPT'}">
        </div>
      `;
    });
    
    timeline += `
        </div>
        <div class="timeline-selection" style="display: none; pointer-events: none;"></div>
        <div class="resize-handle top" style="display: none;"></div>
        <div class="resize-handle bottom" style="display: none;"></div>
      </div>
    `;
    
    container.innerHTML = timeline;
    this.attachHandlers(container);
    this.setupScrollHighlighting(container);
  },

  setupScrollHighlighting(container) {
    const previewPanel = container.closest('.panel').querySelector('.chat-preview');
    const segments = container.querySelectorAll('.timeline-segment');

    if (!previewPanel || !segments.length) return;

    if (globalState.scrollObserver) {
      try {
        globalState.scrollObserver();
      } catch (err) {
        console.warn('[ChatGPT Export] Failed to detach previous scroll listener', err);
      }
      globalState.scrollObserver = null;
    }

    const updateHighlight = () => {
      const scrollTop = previewPanel.scrollTop;
      const clientHeight = previewPanel.clientHeight;
      const viewportCenter = scrollTop + (clientHeight / 2);
      
      const messages = previewPanel.querySelectorAll('.message');
      let currentIndex = -1;
      
      messages.forEach((message) => {
        const messageTop = message.offsetTop;
        const messageBottom = messageTop + message.offsetHeight;
        
        if (messageTop <= viewportCenter && messageBottom >= viewportCenter) {
          currentIndex = parseInt(message.dataset.messageIndex, 10);
        }
      });
      
      segments.forEach((segment) => {
        const segIndex = parseInt(segment.getAttribute('data-index'), 10);
        const isInRange = this.isMessageInRange(segIndex);
        
        if (segIndex === currentIndex && isInRange) {
          segment.style.boxShadow = `
            inset 0 0 0 2px ${globalState.settings.getEffectiveColors().user}, 
            0 0 0 2px ${globalState.settings.getEffectiveColors().user}, 
            0 0 16px 6px ${ThemeUtils.getColors().highlightGlow}
          `;
          segment.style.transform = 'scaleX(1.12)';
          segment.style.opacity = '1';
          segment.style.filter = 'brightness(1.25) saturate(1.1)';
        } else if (isInRange) {
          segment.style.boxShadow = 'none';
          segment.style.transform = 'scaleX(1)';
          segment.style.filter = 'none';
          segment.style.opacity = '1';
        } else {
          segment.style.boxShadow = 'none';
          segment.style.transform = 'scaleX(1)';
          segment.style.filter = 'none';
          segment.style.opacity = '0.3';
        }
      });
    };
    
    let scrollTimeout;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateHighlight, 50);
    };
    
    previewPanel.addEventListener('scroll', handleScroll);
    
    setTimeout(updateHighlight, 100);
    
    globalState.scrollObserver = () => {
      previewPanel.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  },

  attachHandlers(container) {
    const track = container.querySelector('.timeline-track');
    const selection = container.querySelector('.timeline-selection');
    const resizeHandles = container.querySelectorAll('.resize-handle');
    
    let isDragging = false;
    let isResizing = false;
    let resizeType = null;
    let startIndex = null;
    
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      globalState.clearRange();
      this.updateSelection(container);
      return false;
    });
    
    track.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const segment = e.target.closest('.timeline-segment');
      
      if (segment) {
        const clickedIndex = parseInt(segment.dataset.index);
        
        if (globalState.rangeSelection.start !== null && 
            globalState.rangeSelection.end !== null) {
          const start = Math.min(globalState.rangeSelection.start, globalState.rangeSelection.end);
          const end = Math.max(globalState.rangeSelection.start, globalState.rangeSelection.end);
          
          if (clickedIndex < start || clickedIndex > end) {
            globalState.clearRange();
          }
        }
        
        isDragging = true;
        startIndex = clickedIndex;
        globalState.rangeSelection.isSelecting = true;
        globalState.setRange(startIndex, startIndex);
        this.updateSelection(container);
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && !isResizing) {
        e.preventDefault();
        const segments = track.querySelectorAll('.timeline-segment');
        const rects = Array.from(segments).map(s => s.getBoundingClientRect());
        
        let endIndex = null;
        for (let i = 0; i < rects.length; i++) {
          if (e.clientY >= rects[i].top && e.clientY <= rects[i].bottom) {
            endIndex = parseInt(segments[i].getAttribute('data-index'), 10);
            break;
          }
        }
        
        if (endIndex !== null) {
          globalState.setRange(
            Math.min(startIndex, endIndex),
            Math.max(startIndex, endIndex)
          );
          this.updateSelection(container);
        }
      } else if (isResizing) {
        e.preventDefault();
        this.handleResize(e, container, resizeType);
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      resizeType = null;
      globalState.rangeSelection.isSelecting = false;
    });
    
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        resizeType = handle.classList.contains('top') ? 'top' : 'bottom';
      });
    });
  },

  updateSelection(container) {
    const track = container.querySelector('.timeline-track');
    const selection = container.querySelector('.timeline-selection');
    const segments = track.querySelectorAll('.timeline-segment');
    const handles = container.querySelectorAll('.resize-handle');
    
    if (globalState.rangeSelection.start !== null && 
        globalState.rangeSelection.end !== null) {
      
      let startSegment = null;
      let endSegment = null;
      
      segments.forEach(seg => {
        const idx = parseInt(seg.getAttribute('data-index'), 10);
        if (idx === globalState.rangeSelection.start) startSegment = seg;
        if (idx === globalState.rangeSelection.end) endSegment = seg;
      });
      
      if (startSegment && endSegment) {
        const startRect = startSegment.getBoundingClientRect();
        const endRect = endSegment.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const top = startRect.top - containerRect.top;
        const height = endRect.bottom - startRect.top;
        
        selection.style.display = 'block';
        selection.style.top = `${top}px`;
        selection.style.height = `${height}px`;
        
        handles[0].style.display = 'block';
        handles[0].style.top = `${top - 5}px`;
        handles[1].style.display = 'block';
        handles[1].style.top = `${top + height - 5}px`;
      }
      
      segments.forEach((seg) => {
        const segIndex = parseInt(seg.getAttribute('data-index'), 10);
        const isInRange = this.isMessageInRange(segIndex);
        seg.style.opacity = isInRange ? '1' : '0.3';
      });
    } else {
      selection.style.display = 'none';
      handles.forEach(h => h.style.display = 'none');
      segments.forEach(seg => {
        seg.style.opacity = '1';
      });
    }
    
    const previewPanel = container.closest('.panel')?.querySelector('.chat-preview');
    if (previewPanel) {
      previewPanel.dispatchEvent(new Event('scroll'));
    }
  },

  handleResize(e, container, type) {
    const track = container.querySelector('.timeline-track');
    const segments = track.querySelectorAll('.timeline-segment');
    const rects = Array.from(segments).map(s => s.getBoundingClientRect());
    
    let newIndex = null;
    for (let i = 0; i < rects.length; i++) {
      if (e.clientY >= rects[i].top && e.clientY <= rects[i].bottom) {
        newIndex = parseInt(segments[i].getAttribute('data-index'), 10);
        break;
      }
    }
    
    if (newIndex !== null) {
      if (type === 'top') {
        globalState.rangeSelection.start = Math.min(newIndex, globalState.rangeSelection.end);
      } else {
        globalState.rangeSelection.end = Math.max(newIndex, globalState.rangeSelection.start);
      }
      globalState.setRange(globalState.rangeSelection.start, globalState.rangeSelection.end);
      this.updateSelection(container);
    }
  },

  isMessageInRange(idx) {
    if (globalState.rangeSelection.start === null || 
        globalState.rangeSelection.end === null) {
      return true;
    }
    return idx >= globalState.rangeSelection.start && 
           idx <= globalState.rangeSelection.end;
  }
};

/* ===========================
   Settings Panel Component
   =========================== */
const SettingsPanel = {
  render() {
    const settings = globalState.settings.current;
    const colors = ThemeUtils.getColors();
    const effectiveColors = globalState.settings.getEffectiveColors();
    
    return `
      <div class="settings-container">
        <div class="settings-header">
          <button class="back-btn" data-action="back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 000 1.414l7 7a1 1 0 001.414-1.414L5.414 11H17a1 1 0 100-2H5.414l5.293-5.293a1 1 0 000-1.414z"/>
            </svg>
            Back
          </button>
          <h2>Settings</h2>
          <div style="width: 80px"></div>
        </div>
        
        <div class="settings-body">
          <div class="setting-group">
            <h3>Behavior</h3>
            
            <label class="setting-item">
              <input type="checkbox" ${settings.autoExpandThinking ? 'checked' : ''} data-setting="autoExpandThinking">
              <span>Auto-expand thinking blocks before export</span>
            </label>
            
            <label class="setting-item">
              <input type="checkbox" ${settings.inlineCode ? 'checked' : ''} data-setting="inlineCode">
              <span>Render inline code formatting</span>
            </label>
          </div>
          
          <div class="setting-group">
            <h3>Appearance</h3>
            
            <div class="setting-item">
              <label>Font:</label>
              <select data-setting="font" class="setting-select">
                <option value="auto" ${settings.font === 'auto' ? 'selected' : ''}>Auto-detect</option>
                <option value="system-ui" ${settings.font === 'system-ui' ? 'selected' : ''}>System UI</option>
                <option value="serif" ${settings.font === 'serif' ? 'selected' : ''}>Serif</option>
                <option value="monospace" ${settings.font === 'monospace' ? 'selected' : ''}>Monospace</option>
              </select>
            </div>
            
            <div class="setting-item">
              <label>Export Template:</label>
              <select data-setting="exportTemplate" class="setting-select">
                <option value="classic" ${settings.exportTemplate === 'classic' ? 'selected' : ''}>Classic</option>
                <option value="dense" ${settings.exportTemplate === 'dense' ? 'selected' : ''}>Dense</option>
              </select>
            </div>
            
            <div class="setting-item color-settings">
              <label>Custom Colors (leave empty for theme defaults):</label>
              <div class="color-inputs">
                <div>
                  <label>Assistant:</label>
                  <input type="color" value="${settings.colors.assistant || effectiveColors.assistant}" data-color="assistant">
                  <button class="reset-color" data-reset="assistant">Reset</button>
                </div>
                <div>
                  <label>User:</label>
                  <input type="color" value="${settings.colors.user || effectiveColors.user}" data-color="user">
                  <button class="reset-color" data-reset="user">Reset</button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="setting-group">
            <h3>Export Options</h3>
            
            <div class="setting-item">
              <label>Markdown Prefix (optional):</label>
              <textarea data-setting="mdPrefix" placeholder="Text to add at the beginning of markdown exports">${settings.mdPrefix || ''}</textarea>
            </div>
            
            <div class="setting-item">
              <label>Markdown Suffix (optional):</label>
              <textarea data-setting="mdSuffix" placeholder="Text to add at the end of markdown exports">${settings.mdSuffix || ''}</textarea>
            </div>
          </div>
        </div>
        
        <div class="settings-footer">
          <button class="secondary-btn" data-action="reset">Reset to Defaults</button>
          <div style="flex: 1"></div>
          <button class="export-btn" data-action="save">Save Settings</button>
        </div>
      </div>
    `;
  },

  attachHandlers(shadow) {
    const container = shadow.querySelector('.settings-container');
    if (!container) return;

    // Back button
    container.querySelector('[data-action="back"]').addEventListener('click', () => {
      globalState.setViewMode('main');
    });

    // Save button
    container.querySelector('[data-action="save"]').addEventListener('click', () => {
      this.saveSettings(container);
      globalState.setViewMode('main');
    });

    // Reset button
    container.querySelector('[data-action="reset"]').addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        globalState.settings.reset();
        globalState.setViewMode('main');
      }
    });

    // Color resets
    container.querySelectorAll('.reset-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const colorType = btn.dataset.reset;
        const input = container.querySelector(`[data-color="${colorType}"]`);
        if (input) {
          input.value = ThemeUtils.getColors()[colorType + 'Bubble'] || '#000000';
          input.dataset.changed = 'reset';
        }
      });
    });

    // Track color changes
    container.querySelectorAll('[data-color]').forEach(input => {
      input.addEventListener('change', () => {
        input.dataset.changed = 'true';
      });
    });
  },

  saveSettings(container) {
    const updates = {};

    // Checkboxes
    container.querySelectorAll('input[type="checkbox"][data-setting]').forEach(input => {
      updates[input.dataset.setting] = input.checked;
    });

    // Selects
    container.querySelectorAll('select[data-setting]').forEach(select => {
      updates[select.dataset.setting] = select.value;
    });

    // Textareas
    container.querySelectorAll('textarea[data-setting]').forEach(textarea => {
      updates[textarea.dataset.setting] = textarea.value;
    });

    // Colors
    const colorUpdates = {};
    container.querySelectorAll('[data-color]').forEach(input => {
      const colorType = input.dataset.color;
      if (input.dataset.changed === 'reset') {
        colorUpdates[colorType] = null;
      } else if (input.dataset.changed === 'true') {
        colorUpdates[colorType] = input.value;
      }
    });
    
    if (Object.keys(colorUpdates).length > 0) {
      updates.colors = { ...globalState.settings.current.colors, ...colorUpdates };
    }

    globalState.settings.save(updates);
    NotificationManager.showToast('Settings saved');
  }
};

/* ===========================
   Export Panel Component (Enhanced)
   =========================== */
const ExportPanel = {
  create(harvest) {
    globalState.reset();
    globalState.harvest = harvest;

    const host = document.createElement('div');
    host.setAttribute('data-cgpt-panel', '1');
    host.style.cssText = `
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

    const shadow = host.attachShadow({ mode: 'open' });
    
    this.updateContent(shadow, harvest);
    this.attachEventHandlers(shadow, harvest);

    // Handle view mode changes
    globalState.onViewModeChange = (mode) => {
      this.updateContent(shadow, harvest);
      if (mode === 'settings') {
        SettingsPanel.attachHandlers(shadow);
      } else {
        this.attachEventHandlers(shadow, harvest);
      }
    };

    return host;
  },

  updateContent(shadow, harvest) {
    const colors = ThemeUtils.getColors();
    const effectiveColors = globalState.settings.getEffectiveColors();
    const chatFont = globalState.settings.getEffectiveFont();
    const isSettings = globalState.viewMode === 'settings';

    ChatRenderer.destroy();

    shadow.innerHTML = `
      <style>
        ${this.getStyles(colors, effectiveColors, chatFont)}
        ${SettingsStyles.get(colors)}
      </style>
      
      <div class="backdrop" role="presentation"></div>
      <div class="panel" role="dialog" aria-label="Export ChatGPT Conversation" aria-modal="true">
        ${isSettings ? SettingsPanel.render() : this.getMainContent()}
      </div>
    `;

    if (!isSettings) {
      const timelineContainer = shadow.querySelector('.timeline-panel');
      const previewContainer = shadow.querySelector('.chat-preview');

      Timeline.render(timelineContainer, harvest.messages);
      ChatRenderer.mount(previewContainer, harvest);
    }
  },

  getMainContent() {
    const colors = ThemeUtils.getColors();
    
    return `
      <div class="header">
        <div class="filter-buttons">
          <button class="filter-btn" data-filter="assistantOnly" title="Show only assistant messages">
            <span class="icon">🤖</span> Assistant Only
          </button>
          <button class="filter-btn" data-filter="code" title="Show only code blocks">
            <span class="icon">💻</span> Code
          </button>
          <button class="filter-btn" data-filter="tables" title="Show only tables">
            <span class="icon">📊</span> Tables
          </button>
          <button class="filter-btn" data-filter="lists" title="Show only lists">
            <span class="icon">📝</span> Lists
          </button>
        </div>
        <button class="settings-btn" aria-label="Settings" title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
          </svg>
        </button>
        <button class="close-btn" aria-label="Close dialog">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
      </div>
      
      <div class="body">
        <div class="timeline-panel">
          <!-- Timeline will be rendered here -->
        </div>
        <div class="chat-preview">
          <!-- Messages will be rendered here -->
        </div>
      </div>
      
      <div class="footer">
        <select class="format-select" aria-label="Export format">
          <option value="markdown">Markdown (.md)</option>
          <option value="html">HTML (.html)</option>
          <option value="json">JSON (.json)</option>
        </select>
        
        <button class="secondary-btn" data-action="copy">
          Copy to Clipboard
        </button>
        
        <button class="secondary-btn" data-action="clear-range" style="display: none;">
          Clear Selection
        </button>
        
        <div style="flex: 1"></div>
        
        <button class="export-btn" data-action="export">
          Export Conversation
        </button>
      </div>
    `;
  },

  getStyles(colors, effectiveColors, chatFont) {
    const templateStyles = globalState.settings.current.exportTemplate === 'dense' ? `
      .message { margin-bottom: 8px; }
      .bubble { max-width: 80%; padding: 8px 12px; }
      .header { padding: 12px 16px; }
      .footer { padding: 12px 16px; }
    ` : '';

    return `
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
        font-family: ${chatFont};
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
        background: ${effectiveColors.panelBg};
        color: ${colors.text};
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
        overflow: hidden;
      }
      
      .header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
        position: relative;
      }
      
      .filter-buttons {
        display: flex;
        gap: 8px;
      }
      
      .filter-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid ${colors.border};
        background: transparent;
        color: ${colors.textSecondary};
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
        font-family: ${chatFont};
      }
      
      .filter-btn:hover {
        background: ${colors.hover};
        border-color: ${colors.accentPrimary};
      }
      
      .filter-btn.active {
        background: ${colors.accentPrimary};
        color: white;
        border-color: ${colors.accentPrimary};
      }
      
      .filter-btn .icon {
        font-size: 14px;
      }
      
      .settings-btn {
        position: absolute;
        right: 60px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: ${colors.settingsIcon};
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
      }
      
      .settings-btn:hover {
        background: ${colors.hover};
        color: ${colors.text};
      }
      
      .close-btn {
        position: absolute;
        right: 20px;
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
      }
      
      .close-btn:hover {
        background: ${colors.hover};
      }
      
      .body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      
      .timeline-panel {
        width: ${CFG.timelineWidth}px;
        background: ${colors.bg};
        border-right: 1px solid ${colors.border};
        position: relative;
        overflow: hidden;
      }
      
      .timeline-container {
        position: relative;
        height: 100%;
        padding: 10px;
      }
      
      .timeline-track {
        position: relative;
        width: 40px;
        height: 100%;
        margin: 0 auto;
        background: ${colors.bgSecondary};
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
      }
      
      .timeline-segment {
        width: 100%;
        border-bottom: 1px solid ${colors.bg};
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
        -webkit-user-drag: none;
        position: relative;
        transform-origin: center;
      }
      
      .timeline-segment:hover {
        opacity: 0.9 !important;
      }
      
      .timeline-selection {
        position: absolute;
        left: 10px;
        width: 40px;
        background: rgba(59, 130, 246, 0.2);
        border: 2px solid ${colors.accentPrimary};
        border-radius: 4px;
        user-select: none;
        -webkit-user-drag: none;
      }
      
      .resize-handle {
        position: absolute;
        left: 10px;
        width: 40px;
        height: 10px;
        background: ${colors.accentPrimary};
        cursor: ns-resize;
        border-radius: 2px;
        z-index: 10;
      }
      
      .resize-handle:hover {
        background: ${colors.accentSecondary};
      }
      
      .chat-preview {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: ${colors.bgSecondary};
        scroll-behavior: smooth;
        font-family: ${chatFont};
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
      
      .thinking-container {
        max-width: 70%;
      }
      
      .thinking-labels {
        margin-bottom: 8px;
      }
      
      .thinking-label {
        font-size: 12px;
        color: ${colors.textSecondary};
        font-style: italic;
        margin-bottom: 4px;
      }
      
      .thinking-expandable {
        font-size: 11px;
        color: ${colors.accentPrimary};
        cursor: help;
      }
      
      .bubble {
        max-width: 70%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .message.user .bubble {
        background: ${effectiveColors.user};
        color: white;
        border-bottom-right-radius: 4px;
      }
      
      .message.assistant .bubble {
        background: ${effectiveColors.assistant};
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
      
      .bubble img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin: 8px 0;
      }
      
      .bubble a {
        color: inherit;
        text-decoration: underline;
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
      
      .citation a {
        flex: 1;
        color: ${colors.accentPrimary};
      }
      
      .message-role {
        font-size: 11px;
        color: ${colors.textSecondary};
        margin-bottom: 4px;
        font-weight: 500;
      }
      
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
        font-family: ${chatFont};
      }
      
      .export-btn {
        padding: 8px 20px;
        background: ${colors.exportButton};
        color: ${colors.exportButtonText};
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: ${chatFont};
      }
      
      .export-btn:hover {
        background: ${colors.exportButtonHover};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
        font-family: ${chatFont};
      }
      
      .secondary-btn:hover {
        background: ${colors.hover};
      }
      
      .chat-preview::-webkit-scrollbar {
        width: 8px;
      }
      
      .chat-preview::-webkit-scrollbar-track {
        background: ${colors.bg};
      }
      
      .chat-preview::-webkit-scrollbar-thumb {
        background: ${colors.border};
        border-radius: 4px;
      }
      
      .chat-preview::-webkit-scrollbar-thumb:hover {
        background: ${colors.textSecondary};
      }
      
      *:focus-visible {
        outline: 2px solid ${colors.accentPrimary};
        outline-offset: 2px;
      }
      
      ${templateStyles}
    `;
  },

  attachEventHandlers(shadow, harvest) {
    const backdrop = shadow.querySelector('.backdrop');
    const closeBtn = shadow.querySelector('.close-btn');
    const settingsBtn = shadow.querySelector('.settings-btn');
    const filterBtns = shadow.querySelectorAll('.filter-btn');
    const formatSelect = shadow.querySelector('.format-select');
    const exportBtn = shadow.querySelector('[data-action="export"]');
    const copyBtn = shadow.querySelector('[data-action="copy"]');
    const clearRangeBtn = shadow.querySelector('[data-action="clear-range"]');

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        globalState.setViewMode('settings');
      });
    }

    globalState.onRangeChange = () => {
      ChatRenderer.refresh();
      const hasRange = globalState.rangeSelection.start !== null &&
                       globalState.rangeSelection.end !== null;
      if (clearRangeBtn) {
        clearRangeBtn.style.display = hasRange ? 'block' : 'none';
      }
      Timeline.updateSelection(shadow.querySelector('.timeline-panel'));
    };

    backdrop?.addEventListener('click', () => PanelManager.close());
    closeBtn?.addEventListener('click', () => PanelManager.close());

    filterBtns.forEach(btn => {
      const filterName = btn.dataset.filter;
      if (filterName && globalState.filters[filterName]) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        if (!filterName) return;
        const isActive = btn.classList.contains('active');

        globalState.setFilter(filterName, !isActive);
        btn.classList.toggle('active');

        ChatRenderer.refresh();
      });
    });

    formatSelect?.addEventListener('change', (e) => {
      globalState.setExportFormat(e.target.value);
    });

    clearRangeBtn?.addEventListener('click', () => {
      globalState.clearRange();
      Timeline.updateSelection(shadow.querySelector('.timeline-panel'));
    });

    exportBtn?.addEventListener('click', () => ExportManager.export(harvest));
    copyBtn?.addEventListener('click', () => ExportManager.copy(harvest));
  }
};

/* ===========================
   Settings Styles
   =========================== */
const SettingsStyles = {
  get(colors) {
    return `
      .settings-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
      
      .settings-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: ${colors.text};
      }
      
      .back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: transparent;
        border: 1px solid ${colors.border};
        color: ${colors.text};
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .back-btn:hover {
        background: ${colors.hover};
      }
      
      .settings-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: ${colors.bg};
      }
      
      .setting-group {
        margin-bottom: 32px;
      }
      
      .setting-group h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: ${colors.text};
      }
      
      .setting-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        color: ${colors.text};
        font-size: 14px;
      }
      
      .setting-item label {
        min-width: 120px;
      }
      
      .setting-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      
      .setting-select {
        flex: 1;
        max-width: 200px;
        padding: 6px 10px;
        border: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
      }
      
      .color-settings {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .color-inputs {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }
      
      .color-inputs > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .color-inputs label {
        min-width: 80px;
        font-size: 13px;
      }
      
      .color-inputs input[type="color"] {
        width: 50px;
        height: 30px;
        border: 1px solid ${colors.border};
        border-radius: 4px;
        cursor: pointer;
      }
      
      .reset-color {
        padding: 4px 8px;
        background: transparent;
        border: 1px solid ${colors.border};
        color: ${colors.textSecondary};
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .reset-color:hover {
        background: ${colors.hover};
      }
      
      .setting-item textarea {
        width: 100%;
        min-height: 60px;
        padding: 8px;
        border: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
      }
      
      .settings-footer {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-top: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
    `;
  }
};

/* ===========================
   Message Filtering
   =========================== */
const MessageFilter = {
  apply(messages) {
    let filtered = [...messages];

    if (globalState.rangeSelection.start !== null &&
        globalState.rangeSelection.end !== null) {
      filtered = filtered.filter(msg =>
        msg.index >= globalState.rangeSelection.start &&
        msg.index <= globalState.rangeSelection.end
      );
    }

    if (globalState.filters.assistantOnly) {
      filtered = filtered.filter(msg => msg.role === 'assistant');
    }

    const hasContentFilters = globalState.filters.code ||
                             globalState.filters.tables ||
                             globalState.filters.lists;

    if (hasContentFilters) {
      filtered = filtered.map(msg => {
        const filteredBlocks = msg.blocks.filter(block => {
          if (globalState.filters.code && block.kind === 'code') return true;
          if (globalState.filters.tables && block.kind === 'table') return true;
          if (globalState.filters.lists && block.kind === 'list') return true;
          return false;
        });

        if (filteredBlocks.length > 0) {
          return { ...msg, blocks: filteredBlocks };
        }
        return null;
      }).filter(msg => msg !== null);
    }

    return filtered;
  }
};

/* ===========================
   Chat Preview Renderer
   =========================== */
const ChatRenderer = (() => {
  let container = null;
  let harvestRef = null;
  let scheduled = false;

  const raf = window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); };

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    raf(() => {
      scheduled = false;
      renderNow();
    });
  }

  function renderNow() {
    if (!container || !container.isConnected) return;

    const harvest = harvestRef || globalState.harvest;
    if (!harvest || !Array.isArray(harvest.messages)) {
      container.replaceChildren();
      return;
    }

    const filteredMessages = MessageFilter.apply(harvest.messages);

    if (!filteredMessages.length) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.padding = '40px';
      empty.textContent = 'No messages match the current filters';
      container.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredMessages.forEach(msg => {
      const bubbleContent = MessageFormatter.format(msg);
      const hasBubbleContent = bubbleContent && bubbleContent.trim().length > 0;
      const hasThinking = msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0;

      if (!hasBubbleContent && !hasThinking) {
        return;
      }

      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.role}`;
      messageDiv.dataset.messageIndex = msg.index;

      const thinkingContainer = document.createElement('div');
      thinkingContainer.className = 'thinking-container';

      if (hasThinking) {
        const labelsWrapper = document.createElement('div');
        labelsWrapper.className = 'thinking-labels';

        msg.thinking.labels.forEach(label => {
          const labelEl = document.createElement('div');
          labelEl.className = 'thinking-label';
          labelEl.textContent = label.text || '';
          labelsWrapper.appendChild(labelEl);
        });

        if (msg.thinking.expandable) {
          const expandable = document.createElement('div');
          expandable.className = 'thinking-expandable';
          expandable.textContent = '[Expandable content detected]';
          labelsWrapper.appendChild(expandable);
        }

        thinkingContainer.appendChild(labelsWrapper);
      }

      if (hasBubbleContent) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';
        roleLabel.textContent = msg.role === 'user' ? 'You' : 'ChatGPT';
        bubble.appendChild(roleLabel);

        bubble.insertAdjacentHTML('beforeend', bubbleContent);
        thinkingContainer.appendChild(bubble);
      }

      messageDiv.appendChild(thinkingContainer);
      fragment.appendChild(messageDiv);
    });

    if (!fragment.childNodes.length) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.padding = '40px';
      empty.textContent = 'No messages match the current filters';
      container.replaceChildren(empty);
      return;
    }

    container.replaceChildren(fragment);
  }

  return {
    mount(target, harvest) {
      if (!target) return;

      if (container && container !== target) {
        this.destroy();
      }

      container = target;
      harvestRef = harvest || globalState.harvest || null;
      scheduleRender();
    },

    refresh() {
      if (!container) return;
      harvestRef = harvestRef || globalState.harvest || null;
      scheduleRender();
    },

    updateHarvest(harvest) {
      harvestRef = harvest;
      scheduleRender();
    },

    destroy() {
      scheduled = false;
      harvestRef = null;

      if (container) {
        if (container.isConnected) {
          container.replaceChildren();
        }
        container = null;
      }
    }
  };
})();

/* ===========================
   Message Formatting (Enhanced)
   =========================== */
const MessageFormatter = {
  format(message) {
    if (message.isThinking && !message.blocks?.length) {
      return '';
    }
    
    if (!message.blocks || message.blocks.length === 0) {
      return Utils.escapeHtml(message.plain?.text || '');
    }
    
    return message.blocks.map(block => {
      switch (block.kind) {
        case 'heading':
          const level = Math.max(1, Math.min(6, block.level || 1));
          return `<h${level}>${Utils.escapeHtml(block.text || '')}</h${level}>`;
          
        case 'para':
          return `<p>${this.formatInlineMarkdown(block.md || '')}</p>`;
          
        case 'code':
          return `<pre><code class="language-${Utils.escapeHtml(block.language || '')}">${Utils.escapeHtml(block.text || '')}</code></pre>`;
          
        case 'list':
          const items = (block.items || []).map(item => 
            `<li>${this.formatInlineMarkdown(item)}</li>`
          ).join('');
          return block.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
          
        case 'table':
          return block.html || '<p>[Table]</p>';
          
        case 'image':
          const src = block.src || '';
          const alt = block.alt || '';
          if (src) {
            const safeSrc = Utils.safeUrl(src);
            return `<img src="${Utils.escapeHtml(safeSrc)}" alt="${Utils.escapeHtml(alt)}" style="max-width: 100%;">`;
          }
          return '';
          
        case 'link':
          const href = block.href || '';
          const text = block.text || href;
          if (href) {
            const safeHref = Utils.safeUrl(href);
            return `<p><a href="${Utils.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(text)}</a></p>`;
          }
          return '';
          
        case 'citation':
          const citationHtml = block.thumb ? 
            `<div class="citation">
              <img src="${Utils.escapeHtml(Utils.safeUrl(block.thumb))}" alt="">
              <a href="${Utils.escapeHtml(Utils.safeUrl(block.url))}" target="_blank" rel="noopener noreferrer">
                ${Utils.escapeHtml(block.title || block.url)}
              </a>
            </div>` :
            `<p><a href="${Utils.escapeHtml(Utils.safeUrl(block.url))}" target="_blank" rel="noopener noreferrer">
              ${Utils.escapeHtml(block.title || block.url)}
            </a></p>`;
          return citationHtml;
          
        case 'quote':
          return `<blockquote>${this.formatInlineMarkdown(block.md || '')}</blockquote>`;
          
        case 'math':
          return `<div class="math">$$${Utils.escapeHtml(block.latex || '')}$$</div>`;
          
        case 'divider':
          return '<hr>';
          
        default:
          return '';
      }
    }).join('');
  },

  formatInlineMarkdown(md) {
    if (!globalState.settings.current.inlineCode) {
      return Utils.escapeHtml(md);
    }
    
    let html = Utils.escapeHtml(md);
    
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const safeUrl = Utils.safeUrl(url);
      return `<a href="${Utils.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(text)}</a>`;
    });
    
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    return html;
  }
};

/* ===========================
   Export Manager (Enhanced)
   =========================== */
const ExportManager = {
  async export(harvest, format = null) {
    const exportFormat = format || globalState.exportFormat;
    const content = this.generateContent(harvest, exportFormat);
    const filename = this.generateFilename(harvest, exportFormat);
    
    Utils.downloadFile(filename, content, this.getMimeType(exportFormat));
    NotificationManager.showToast(`✅ Exported as ${filename}`);
    
    if (!format) {
      PanelManager.close();
    }
  },

  async copy(harvest, format = null) {
    const exportFormat = format || globalState.exportFormat;
    const content = this.generateContent(harvest, exportFormat);
    
    try {
      await navigator.clipboard.writeText(content);
      NotificationManager.showToast('✅ Copied to clipboard');
    } catch (err) {
      console.error('[ChatGPT Export] Copy failed:', err);
      NotificationManager.showToast('Failed to copy', 'error');
    }
  },

  generateContent(harvest, format) {
    const filteredMessages = MessageFilter.apply(harvest.messages);
    
    switch (format) {
      case 'markdown':
        return this.toMarkdown(filteredMessages, harvest.meta);
      case 'html':
        return this.toHTML(filteredMessages, harvest.meta);
      case 'json':
        return this.toJSON(filteredMessages, harvest.meta);
      default:
        return this.toMarkdown(filteredMessages, harvest.meta);
    }
  },

  toMarkdown(messages, meta) {
    const settings = globalState.settings.current;
    
    let md = '';
    
    // Add prefix if configured
    if (settings.mdPrefix) {
      md += settings.mdPrefix + '\n\n';
    }
    
    md += `# ${meta.title}\n\n`;
    md += `**Exported**: ${new Date(meta.exported_at).toLocaleString()}\n`;
    if (meta.model) md += `**Model**: ${meta.model}\n`;
    md += `**Version**: ChatGPT Export v${CFG.version}\n`;
    md += '\n---\n\n';
    
    messages.forEach(msg => {
      const roleLabel = msg.role === 'user' ? 'You' : 'ChatGPT';
      
      // Add thinking labels
      if (msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0) {
        msg.thinking.labels.forEach(label => {
          md += `*${label.text}*\n\n`;
        });
        if (msg.thinking.expandable) {
          md += `*[Expandable content available]*\n\n`;
        }
      }
      
      const hasBlocks = Array.isArray(msg.blocks) && msg.blocks.length > 0;
      const hasPlain = !!(msg.plain && msg.plain.text && msg.plain.text.trim().length);
      const hasContent = hasBlocks || hasPlain;
      
      if (hasContent && !msg.isThinking) {
        md += `## ${roleLabel}\n\n`;
        if (hasBlocks) {
          md += this.blocksToMarkdown(msg.blocks) + '\n';
        } else if (hasPlain) {
          md += msg.plain.text + '\n\n';
        }
      }
    });
    
    // Add suffix if configured
    if (settings.mdSuffix) {
      md += '\n' + settings.mdSuffix;
    }
    
    return md;
  },

  blocksToMarkdown(blocks) {
    const out = [];
    (blocks || []).forEach(b => {
      switch (b.kind) {
        case 'heading':
          out.push(`\n\n${'#'.repeat(Math.max(1, Math.min(6, b.level || 1)))} ${b.text || ''}\n`);
          break;
        case 'para':
          out.push(`\n\n${b.md || ''}\n`);
          break;
        case 'list':
          out.push('\n' + (b.items || []).map((t, i) => 
            (b.ordered ? `${i + 1}. ${t}` : `- ${t}`)
          ).join('\n') + '\n');
          break;
        case 'code':
          out.push(`\n\n\`\`\`${b.language || ''}\n${b.text || ''}\n\`\`\`\n`);
          break;
        case 'table':
          out.push(`\n\n${b.html || ''}\n`);
          break;
        case 'image':
          out.push(`\n\n![${b.alt || 'image'}](${b.src || ''})\n`);
          break;
        case 'link':
          out.push(`\n\n[${b.text || b.href}](${b.href || ''})\n`);
          break;
        case 'citation':
          if (b.thumb) {
            out.push(`\n\n![${b.title || ''}](${b.thumb}) [${b.title || b.url}](${b.url})\n`);
          } else {
            out.push(`\n\n[${b.title || b.url}](${b.url})\n`);
          }
          break;
        case 'quote':
          out.push('\n' + String(b.md || '').split('\n').map(l => `> ${l}`).join('\n') + '\n');
          break;
        case 'math':
          out.push(`\n\n$$\n${b.latex || ''}\n$$\n`);
          break;
        case 'divider':
          out.push('\n\n---\n');
          break;
      }
    });
    return out.join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  },

  toHTML(messages, meta) {
    const chatFont = globalState.settings.getEffectiveFont();
    const effectiveColors = globalState.settings.getEffectiveColors();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none';">
  <title>${Utils.escapeHtml(meta.title)}</title>
  <style>
    body {
      font-family: ${chatFont};
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
      color: #111827;
    }
    .meta {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .message {
      margin-bottom: 20px;
      display: flex;
    }
    .message.user { justify-content: flex-end; }
    .message.assistant { justify-content: flex-start; }
    .thinking-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
      font-style: italic;
    }
    .bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 16px;
    }
    .message.user .bubble {
      background: ${effectiveColors.user};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .message.assistant .bubble {
      background: ${effectiveColors.assistant};
      color: #111827;
      border-bottom-left-radius: 4px;
    }
    .role {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      opacity: 0.7;
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
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 8px 0;
    }
    a {
      color: #3b82f6;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111827; color: #f9fafb; }
      .meta { background: #374151; }
      .message.assistant .bubble { background: #374151; color: #f9fafb; }
    }
  </style>
</head>
<body>
  <div class="meta">
    <h1>${Utils.escapeHtml(meta.title)}</h1>
    <p><strong>Exported:</strong> ${new Date(meta.exported_at).toLocaleString()}</p>
    ${meta.model ? `<p><strong>Model:</strong> ${Utils.escapeHtml(meta.model)}</p>` : ''}
    <p><strong>Version:</strong> ChatGPT Export v${CFG.version}</p>
  </div>
  
  ${messages.map(msg => {
    let thinkingHtml = '';
    if (msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0) {
      thinkingHtml = msg.thinking.labels.map(label => 
        `<div class="thinking-label">${Utils.escapeHtml(label.text)}</div>`
      ).join('');
      if (msg.thinking.expandable) {
        thinkingHtml += '<div class="thinking-label">[Expandable content available]</div>';
      }
    }
    
    const bubbleContent = MessageFormatter.format(msg);
    const hasBubbleContent = bubbleContent && bubbleContent.trim().length > 0;
    
    if (!hasBubbleContent && !thinkingHtml) return '';
    
    return `
    <div class="message ${msg.role}">
      <div style="max-width: 70%;">
        ${thinkingHtml}
        ${hasBubbleContent ? `
        <div class="bubble">
          <div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
          ${bubbleContent}
        </div>` : ''}
      </div>
    </div>
    `;
  }).join('')}
</body>
</html>`;
  },

  toJSON(messages, meta) {
    return JSON.stringify({
      meta: {
        ...meta,
        exportVersion: CFG.version
      },
      messages: messages.map(msg => ({
        ...msg,
        blocks: msg.blocks || []
      })),
      exportSettings: {
        filters: globalState.filters,
        range: globalState.rangeSelection,
        ui: globalState.settings.current
      }
    }, null, 2);
  },

  generateFilename(harvest, format) {
    const title = Utils.safeTitle(harvest.meta.title || 'ChatGPT_Conversation');
    const date = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').substring(0, 19);
    const ext = format === 'markdown' ? 'md' : format;
    return `${title}_${date}.${ext}`;
  },

  getMimeType(format) {
    const types = {
      markdown: 'text/markdown;charset=utf-8',
      html: 'text/html;charset=utf-8',
      json: 'application/json;charset=utf-8'
    };
    return types[format] || 'text/plain;charset=utf-8';
  }
};

/* ===========================
   Harvester Module (Enhanced)
   =========================== */
const Harvester = {
  async harvest() {
    // Auto-expand if enabled
    if (globalState.settings.current.autoExpandThinking) {
      await this.autoExpandThinking();
    }

    const meta = {
      title: this.detectTitle() || 'ChatGPT Conversation',
      url: location.href,
      model: this.detectModel(),
      exported_at: new Date().toISOString()
    };

    const messages = this.collectAllMessages();
    return { meta, messages };
  },

  async autoExpandThinking() {
    // Find expandable elements
    const expandButtons = document.querySelectorAll([
      'button[aria-expanded="false"]',
      'button[id^="radix-"]',
      'button:has-text("show")',
      'button:has-text("expand")',
      'button:has-text("view")'
    ].join(','));

    for (const button of expandButtons) {
      const text = (button.textContent || '').toLowerCase();
      if (/show|expand|view|details|steps|more|analysis|reasoning|tools?/.test(text)) {
        button.click();
        await new Promise(resolve => setTimeout(resolve, CFG.autoExpandDelay));
      }
    }
  },

  detectModel() {
    // Tier 1: Per-message attribute (most reliable)
    const msgAttr = document.querySelector(
      '[data-message-model-slug], [data-model], [data-model-slug]'
    );
    if (msgAttr) {
      return msgAttr.getAttribute('data-message-model-slug') ||
             msgAttr.getAttribute('data-model') ||
             msgAttr.getAttribute('data-model-slug');
    }

    // Tier 2: UI chip/button text
    const chip = Array.from(document.querySelectorAll('button, [role="button"]'))
      .map(n => (n.textContent || '').trim())
      .find(t => {
        const modelPattern = CFG.knownModels.map(m => 
          m.replace(/[.-]/g, '[.-]?')
        ).join('|');
        return new RegExp(`\\b(${modelPattern})\\b`, 'i').test(t);
      });
    if (chip) {
      // Extract just the model name
      const modelPattern = CFG.knownModels.map(m => 
        m.replace(/[.-]/g, '[.-]?')
      ).join('|');
      const match = chip.match(new RegExp(`\\b(${modelPattern})\\b`, 'i'));
      return match ? match[1] : chip;
    }

    // Tier 3: Small region search (header/toolbar only)
    const smallRegions = document.querySelectorAll('header, [data-testid*="header"], nav, [role="navigation"]');
    for (const region of smallRegions) {
      const txt = (region.innerText || '').trim();
      const modelPattern = CFG.knownModels.map(m => 
        m.replace(/[.-]/g, '[.-]?')
      ).join('|');
      const match = txt.match(new RegExp(`\\b(${modelPattern})\\b`, 'i'));
      if (match) return match[1];
    }

    return null;
  },

  collectAllMessages() {
    const messages = [];
    const processedElements = new Set();
    
    const turnContainers = this.findAllTurnContainers();
    
    turnContainers.forEach((container, index) => {
      if (processedElements.has(container)) return;
      processedElements.add(container);
      
      const role = this.detectRole(container);
      const thinkingInfo = this.detectThinkingStates(container);
      const hasContent = this.hasActualContent(container);
      
      if (!hasContent && !thinkingInfo.labels.length) return;
      
      const contentNode = this.findContentNode(container) || container;
      const clone = contentNode.cloneNode(true);
      this.sanitizeClone(clone);
      
      const blocks = this.extractBlocks(clone);
      const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();
      
      const message = {
        id: container.id || `msg-${messages.length + 1}`,
        index: messages.length,
        role: role,
        thinking: thinkingInfo.labels.length > 0 ? thinkingInfo : null,
        isThinking: thinkingInfo.labels.length > 0 && !hasContent,
        incomplete: thinkingInfo.labels.some(l => 
          /stopped|paused|failed/i.test(l.text)
        ),
        blocks: blocks.length ? blocks : (plainText && !thinkingInfo.labels.length ? 
          [{ kind: 'para', md: plainText }] : []),
        plain: { text: plainText || '' },
        timestamp: new Date().toISOString()
      };
      
      if (message.plain.text || message.blocks.length > 0 || thinkingInfo.labels.length > 0) {
        messages.push(message);
      }
    });
    
    return messages;
  },

  findAllTurnContainers() {
    const containers = [];
    const seen = new Set();
    
    // Priority order for finding containers
    const strategies = [
      // Most reliable: article with data-scroll-anchor
      () => document.querySelectorAll('article[data-scroll-anchor]'),
      
      // Standard test IDs
      () => document.querySelectorAll('[data-testid="conversation-turn"]'),
      
      // Message author role
      () => document.querySelectorAll('[data-message-author-role]'),
      
      // Message IDs
      () => document.querySelectorAll('div[data-message-id]'),
      
      // Structural patterns
      () => document.querySelectorAll('.group\\/conversation-turn, .agent-turn, .user-turn')
    ];
    
    strategies.forEach(strategy => {
      const found = strategy();
      found.forEach(el => {
        if (Array.from(seen).some(existing => existing.contains(el) || el.contains(existing))) {
          return;
        }
        
        if (!seen.has(el)) {
          containers.push(el);
          seen.add(el);
        }
      });
    });
    
    return containers.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  },

  detectThinkingStates(container) {
    const labels = [];
    const expanderSelectors = [];
    const seenTexts = new Set();
    
    // Search for thinking patterns in descendants
    const searchNodes = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim();
        if (!text) return;
        
        // Check time patterns
        for (const pattern of CFG.thinkingPatterns.timePatterns) {
          const match = text.match(pattern);
          if (match && !seenTexts.has(match[0])) {
            labels.push({ text: match[0] });
            seenTexts.add(match[0]);
          }
        }
        
        // Check state patterns
        for (const pattern of CFG.thinkingPatterns.statePatterns) {
          const match = text.match(pattern);
          if (match && !seenTexts.has(match[0])) {
            labels.push({ text: match[0] });
            seenTexts.add(match[0]);
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Check for expander buttons
        if (node.tagName === 'BUTTON' || node.getAttribute('role') === 'button') {
          const ariaExpanded = node.getAttribute('aria-expanded');
          const hasRadixId = node.id && node.id.startsWith('radix-');
          const buttonText = (node.textContent || '').toLowerCase();
          
          if (ariaExpanded === 'false' || hasRadixId || 
              /show|expand|details|view|steps|more|analysis|reasoning|tools?/.test(buttonText)) {
            const selector = this.getElementSelector(node);
            if (selector && expanderSelectors.length < 3) {
              expanderSelectors.push(selector);
            }
          }
        }
        
        // Recurse into children
        for (const child of node.childNodes) {
          searchNodes(child);
        }
      }
    };
    
    searchNodes(container);
    
    return {
      labels: labels,
      expandable: expanderSelectors.length > 0,
      expanderSelectors: expanderSelectors.length > 0 ? expanderSelectors : undefined
    };
  },

  getElementSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      
      if (element.className) {
        const classes = element.className.split(/\s+/).filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }
      
      path.unshift(selector);
      if (path.length >= 3) break;
      
      element = element.parentElement;
    }
    
    return path.join(' > ');
  },

  findContentNode(el) {
    // Priority order for content nodes
    const candidates = [
      '[data-message-content]',
      '.markdown.prose',
      '.text-message',
      '.prose',
      'article',
      'div.group\\/conversation-turn'
    ];
    
    for (const sel of candidates) {
      const n = el.querySelector(sel);
      if (n && (n.textContent || '').trim().length) return n;
    }
    return el;
  },

  hasActualContent(el) {
    const clone = el.cloneNode(true);
    
    const uiSelectors = [
      'button',
      'svg',
      '[role="button"]',
      '[aria-label]',
      '.invisible',
      '.sr-only'
    ];
    
    uiSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(elem => elem.remove());
    });
    
    const text = (clone.textContent || '').trim();
    return text.length > 0;
  },

  detectTitle() {
    const candidates = [
      '[data-testid="conversation-title"]',
      '.text-token-text-primary font-semibold',
      'h1'
    ];
    
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      const t = (el?.textContent || '').trim();
      if (t && t !== 'ChatGPT' && !t.includes('|')) return t;
    }
    
    return (document.title || '').replace(/\s*\|\s*ChatGPT.*/i, '').trim();
  },

  detectRole(el) {
    const attr = el.getAttribute('data-message-author-role');
    if (attr) return attr;

    const nested = el.querySelector('[data-message-author-role]');
    if (nested) return nested.getAttribute('data-message-author-role');

    const parent = el.closest('[data-message-author-role]');
    if (parent) return parent.getAttribute('data-message-author-role');

    const thinkingInfo = this.detectThinkingStates(el);
    if (thinkingInfo.labels.length > 0) return 'assistant';

    const text = (el.textContent || '').toLowerCase();
    if (text.startsWith('you:') || el.querySelector('img[alt*="User"]')) return 'user';
    if (text.includes('chatgpt') || el.querySelector('img[alt*="ChatGPT"]')) return 'assistant';

    const style = window.getComputedStyle(el);
    if (style.textAlign === 'right' || style.justifyContent === 'flex-end') return 'user';

    return 'assistant';
  },

  sanitizeClone(root) {
    const DROP = [
      'button',
      'svg[aria-hidden="true"]',
      '[data-testid="copy-turn-action-button"]',
      '[data-testid="copy-button"]',
      '.invisible',
      '.sr-only'
    ];
    
    root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());
    root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
    root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));
  },

extractBlocks(root) {
    const blocks = [];
    
    function visit(node) {
      if (!node || node.nodeType !== 1) return;
      
      const tag = node.tagName.toLowerCase();
      
      // Code blocks
      if (tag === 'pre') {
        const code = node.querySelector('code') || node;
        const language = (code.className || '').match(/language-([a-z0-9+.-]+)/i)?.[1] || '';
        const text = code.textContent || '';
        if (text.trim()) {
          blocks.push({ kind: 'code', language, text });
          return true;
        }
      }
      
      // Headings
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'heading', level, text });
        return true;
      }
      
      // Lists
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li'))
          .map(li => (li.textContent || '').trim())
          .filter(Boolean);
        if (items.length) {
          blocks.push({ kind: 'list', ordered: tag === 'ol', items });
        }
        return true;
      }
      
      // Tables
      if (tag === 'table') {
        blocks.push({ kind: 'table', html: node.outerHTML });
        return true;
      }
      
      // Figure with image
      if (tag === 'figure') {
        const img = node.querySelector('img');
        if (img) {
          const src = img.src || img.getAttribute('src') || '';
          const alt = img.alt || img.getAttribute('alt') || '';
          if (src) {
            blocks.push({ kind: 'image', src, alt });
            
            // Check if figure also contains a link (citation pattern)
            const link = node.querySelector('a[href]');
            if (link) {
              const href = link.href || link.getAttribute('href');
              const title = (link.textContent || '').trim() || Utils.extractHostname(href);
              blocks.push({ 
                kind: 'citation', 
                url: href, 
                title: title,
                thumb: src 
              });
            }
          }
        }
        return true;
      }
      
      // Images (including those in links)
      if (tag === 'img') {
        const src = node.src || node.getAttribute('src') || '';
        const alt = node.alt || node.getAttribute('alt') || '';
        
        // Check if image is inside a link
        const parentLink = node.closest('a[href]');
        if (parentLink) {
          const href = parentLink.href || parentLink.getAttribute('href');
          const linkText = (parentLink.textContent || '').trim();
          
          // This is likely a citation card
          blocks.push({
            kind: 'citation',
            url: href,
            title: linkText || Utils.extractHostname(href),
            thumb: src
          });
        } else if (src) {
          blocks.push({ kind: 'image', src, alt });
        }
        return true;
      }
      
      // Links (standalone, not containing images)
      if (tag === 'a' && node.href && !node.querySelector('img')) {
        const href = node.href;
        const text = (node.textContent || '').trim();
        
        // Check for background image (common in link cards)
        const bgUrl = Utils.getComputedBackgroundUrl(node);
        if (bgUrl) {
          blocks.push({
            kind: 'citation',
            url: href,
            title: text || Utils.extractHostname(href),
            thumb: bgUrl
          });
        } else if (href && text) {
          blocks.push({ kind: 'link', href, text });
        }
        return true;
      }
      
      // Check for elements with background images
      if (tag === 'div' || tag === 'span') {
        const bgUrl = Utils.getComputedBackgroundUrl(node);
        if (bgUrl) {
          // Check if this is part of a citation card structure
          const nearbyLink = node.closest('a[href]') || node.querySelector('a[href]');
          if (nearbyLink) {
            const href = nearbyLink.href || nearbyLink.getAttribute('href');
            const linkText = (nearbyLink.textContent || '').trim();
            blocks.push({
              kind: 'citation',
              url: href,
              title: linkText || Utils.extractHostname(href),
              thumb: bgUrl
            });
          } else {
            blocks.push({ kind: 'image', src: bgUrl, alt: '' });
          }
          return true;
        }
      }
      
      // Blockquotes
      if (tag === 'blockquote') {
        const md = (node.textContent || '').trim();
        if (md) blocks.push({ kind: 'quote', md });
        return true;
      }
      
      // Dividers
      if (tag === 'hr') {
        blocks.push({ kind: 'divider' });
        return true;
      }
      
      // Paragraphs and text
      if ((tag === 'p' || tag === 'div') && !node.querySelector('h1,h2,h3,h4,h5,h6,pre,ul,ol,table,img,figure')) {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'para', md: text });
        return true;
      }
    }
    
    // Process all child nodes recursively
    Array.from(root.childNodes).forEach(child => {
      if (!visit(child) && child.nodeType === 1) {
        const subBlocks = this.extractBlocks(child);
        blocks.push(...subBlocks);
      }
    });
    
    // Fallback to plain text if no blocks found
    if (!blocks.length) {
      const text = (root.textContent || '').trim();
      if (text) blocks.push({ kind: 'para', md: text });
    }
    
    return blocks;
  }
};

/* ===========================
   Utilities (Enhanced)
   =========================== */
const Utils = {
  escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => 
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
    if (panelHost && document.contains(panelHost)) {
      this.close();
    }
    
    panelHost = ExportPanel.create(harvest);
    document.body.appendChild(panelHost);
    
    setTimeout(() => {
      const shadow = panelHost.shadowRoot;
      const firstFocusable = shadow.querySelector('button, select');
      if (firstFocusable) firstFocusable.focus();
    }, 100);
  },

  close() {
    if (panelHost) {
      ChatRenderer.destroy();

      panelHost.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => {
        if (panelHost?.parentNode) {
          panelHost.parentNode.removeChild(panelHost);
        }
        panelHost = null;
        globalState.reset();
      }, 200);
    }
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
    
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background: ${colors.bg};
      color: ${colors.text};
      border: 1px solid ${type === 'success' ? colors.accentSecondary : '#ef4444'};
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: ${CFG.zIndex + 100};
      animation: slideUp 0.3s ease;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        NotificationManager.showToast('✅ Copied to clipboard');
      } else if (action.startsWith('export-')) {
        const format = action.replace('export-', '');
        const content = await this.extractSingleMessage(messageEl, format);
        const filename = `ChatGPT_Answer_${new Date().toISOString().substring(0, 19).replace(/[:.]/g, '-')}.${format === 'markdown' ? 'md' : format}`;
        
        Utils.downloadFile(filename, content, ExportManager.getMimeType(format));
        NotificationManager.showToast(`✅ Exported answer as ${format.toUpperCase()}`);
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
    
    overlayHost = ExportButton.create(() => App.openExportPanel());
    document.documentElement.appendChild(overlayHost);
    
    requestAnimationFrame(() => {
      overlayHost.style.opacity = '1';
      this.recomputePosition();
    });
    
    this.startObservers();
  },

  unmount() {
    this.stopObservers();
    if (overlayHost?.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    overlayHost = null;
  },

  recomputePosition() {
    if (!overlayHost) return;
    
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
  async openExportPanel() {
    try {
      const harvest = await Harvester.harvest();
      
      if (!harvest.messages || harvest.messages.length === 0) {
        NotificationManager.showToast('No messages found to export', 'error');
        return;
      }
      
      PanelManager.open(harvest);
    } catch (err) {
      console.error('[ChatGPT Export] Harvest failed:', err);
      NotificationManager.showToast('Failed to harvest conversation', 'error');
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
    
    console.log(`[ChatGPT Export v${CFG.version}] Extension initialized (Enhanced)`);
  },

  setupRouteWatcher() {
    let lastHref = location.href;
    
    const handleNav = () => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        PanelManager.close();
        
        if (CFG.urlGuard.test(location.href)) {
          OverlayManager.mount();
        } else {
          OverlayManager.unmount();
        }
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