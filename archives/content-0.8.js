// ChatGPT Export Extension v3.1 - Production Release
// Fixed thinking states display, simplified timeline highlighting, stable context menu
// Optimized for Firefox Addon Store release

/* ===========================
   Config & Constants
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
  panelHeightVh: 85,
  timelineWidth: 60,
  version: '3.1.0',
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
      highlightGlow: 'rgba(59, 130, 246, 0.75)'
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
      highlightGlow: 'rgba(59, 130, 246, 0.7)'
    }
  },
  // Comprehensive thinking state patterns
  thinkingPatterns: {
    // Time-based patterns
    timePatterns: [
      /Thought for (\d+(?:\.\d+)?)\s*(?:second|sec)s?/i,
      /Thought for (\d+)\s*(?:minute|min)s?\s+(?:and\s+)?(\d+)\s*(?:second|sec)s?/i,
      /Thought for (\d+)m\s*(\d+)s/i,
      /Thinking for (\d+(?:\.\d+)?)\s*(?:second|sec)s?/i,
      /Thinking for (\d+)\s*(?:minute|min)s?\s+(?:and\s+)?(\d+)\s*(?:second|sec)s?/i,
      /Processing for (\d+(?:\.\d+)?)\s*(?:second|sec)s?/i,
      /Analyzing for (\d+(?:\.\d+)?)\s*(?:second|sec)s?/i
    ],
    // State patterns
    statePatterns: [
      /^Analyzed$/i,
      /^Analysis stopped$/i,
      /^Analysis paused$/i,
      /^Stopped analyzing$/i,
      /^Failed to generate/i,
      /^Processing$/i,
      /^Analyzing$/i,
      /^Searching$/i,
      /^Thinking$/i,
      /^Working$/i,
      /^Calculating$/i,
      /^Reasoning$/i
    ]
  }
};

/* ===========================
   State Management
   =========================== */
class ExportState {
  constructor() {
    this.reset();
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
    this.scrollObserver = null;
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

/* ===========================
   Theme Utilities
   =========================== */
const ThemeUtils = {
  getTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  getColors() {
    return CFG.theme[this.getTheme()];
  },

  getChatGPTFont() {
    // Try to get ChatGPT's actual font stack
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
   Timeline Component (Simplified with Current Block Highlighting)
   =========================== */
const Timeline = {
  render(container, messages) {
    const colors = ThemeUtils.getColors();
    
    // Calculate message heights proportionally
    const totalLength = messages.reduce((sum, msg) => 
      sum + (msg.blocks?.length || 1), 0);
    
    let timeline = `
      <div class="timeline-container">
        <div class="timeline-track">
    `;
    
    messages.forEach((msg, idx) => {
      const heightPercent = ((msg.blocks?.length || 1) / totalLength) * 100;
      let color;
      
      // Determine color based on message type
      if (msg.role === 'user') {
        color = colors.userTimeline;
      } else if (msg.isThinking || msg.incomplete) {
        color = colors.thinkingTimeline;
      } else {
        color = colors.assistantTimeline;
      }
      
      const isInRange = this.isMessageInRange(idx);
      
      timeline += `
        <div class="timeline-segment" 
             data-index="${idx}"
             data-role="${msg.role}"
             ${msg.isThinking ? 'data-thinking="true"' : ''}
             style="height: ${heightPercent}%; 
                    background: ${color};
                    opacity: ${isInRange ? '1' : '0.3'};"
             title="${msg.role === 'user' ? 'You' : msg.isThinking ? msg.thinkingLabel || 'Thinking...' : 'ChatGPT'}">
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
    
    const updateHighlight = () => {
      const scrollTop = previewPanel.scrollTop;
      const clientHeight = previewPanel.clientHeight;
      const viewportCenter = scrollTop + (clientHeight / 2);
      
      // Find which message is at the center of viewport
      const messages = previewPanel.querySelectorAll('.message');
      let currentIndex = -1;
      
      messages.forEach((message, idx) => {
        const messageTop = message.offsetTop;
        const messageBottom = messageTop + message.offsetHeight;
        
        if (messageTop <= viewportCenter && messageBottom >= viewportCenter) {
          currentIndex = idx;
        }
      });
      
      // Update timeline highlighting
      segments.forEach((segment, idx) => {
        const isInRange = this.isMessageInRange(idx);
        
        if (idx === currentIndex && isInRange) {
          // Highlight current segment
          segment.style.boxShadow = `inset 0 0 0 2px ${ThemeUtils.getColors().accentPrimary}, 0 0 0 2px ${ThemeUtils.getColors().accentPrimary}, 0 0 16px 6px ${ThemeUtils.getColors().highlightGlow}`;
          segment.style.transform = 'scaleX(1.12)';
          segment.style.opacity = '1';
          segment.style.filter = 'brightness(1.25) saturate(1.1)';
        } else if (isInRange) {
          // Normal range selection
          segment.style.boxShadow = 'none';
          segment.style.transform = 'scaleX(1)';
          segment.style.filter = 'none';
          segment.style.opacity = '1';
        } else {
          // Outside range
          segment.style.boxShadow = 'none';
          segment.style.transform = 'scaleX(1)';
          segment.style.filter = 'none';
          segment.style.opacity = '0.3';
        }
      });
    };
    
    // Throttled scroll handler
    let scrollTimeout;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateHighlight, 50);
    };
    
    previewPanel.addEventListener('scroll', handleScroll);
    
    // Initial update
    setTimeout(updateHighlight, 100);
    
    // Store cleanup function
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
    
    // Prevent context menu in timeline
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear selection on right-click
      globalState.clearRange();
      this.updateSelection(container);
      return false;
    });
    
    // Start selection or clear on click
    track.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const segment = e.target.closest('.timeline-segment');
      
      if (segment) {
        const clickedIndex = parseInt(segment.dataset.index);
        
        // Check if clicking outside current selection
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
    
    // Continue selection
    document.addEventListener('mousemove', (e) => {
      if (isDragging && !isResizing) {
        e.preventDefault();
        const segments = track.querySelectorAll('.timeline-segment');
        const rects = Array.from(segments).map(s => s.getBoundingClientRect());
        
        let endIndex = null;
        for (let i = 0; i < rects.length; i++) {
          if (e.clientY >= rects[i].top && e.clientY <= rects[i].bottom) {
            endIndex = i;
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
    
    // End selection
    document.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      resizeType = null;
      globalState.rangeSelection.isSelecting = false;
    });
    
    // Resize handles
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
      
      const startSegment = segments[globalState.rangeSelection.start];
      const endSegment = segments[globalState.rangeSelection.end];
      
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
      
      // Update segment opacities
      segments.forEach((seg, idx) => {
        const isInRange = this.isMessageInRange(idx);
        seg.style.opacity = isInRange ? '1' : '0.3';
      });
    } else {
      selection.style.display = 'none';
      handles.forEach(h => h.style.display = 'none');
      segments.forEach(seg => {
        seg.style.opacity = '1';
      });
    }
    
    // Trigger scroll highlight update
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
        newIndex = i;
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
   Export Panel Component
   =========================== */
const ExportPanel = {
  create(harvest) {
    // Reset state on each panel creation
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
    const colors = ThemeUtils.getColors();
    const chatFont = ThemeUtils.getChatGPTFont();

    shadow.innerHTML = `
      <style>
        ${this.getStyles(colors, chatFont)}
      </style>
      
      <div class="backdrop" role="presentation"></div>
      <div class="panel" role="dialog" aria-label="Export ChatGPT Conversation" aria-modal="true">
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
      </div>
    `;

    this.attachEventHandlers(shadow, harvest);
    return host;
  },

  getStyles(colors, chatFont) {
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
      
      /* Body */
      .body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      
      /* Timeline */
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
      
      /* Chat Preview */
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
      
      .thinking-label {
        font-size: 12px;
        color: ${colors.textSecondary};
        margin-bottom: 8px;
        font-style: italic;
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
      
      .message-role {
        font-size: 11px;
        color: ${colors.textSecondary};
        margin-bottom: 4px;
        font-weight: 500;
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
      
      /* Scrollbar */
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
      
      /* Accessibility */
      *:focus-visible {
        outline: 2px solid ${colors.accentPrimary};
        outline-offset: 2px;
      }
    `;
  },

  attachEventHandlers(shadow, harvest) {
    const backdrop = shadow.querySelector('.backdrop');
    const closeBtn = shadow.querySelector('.close-btn');
    const filterBtns = shadow.querySelectorAll('.filter-btn');
    const formatSelect = shadow.querySelector('.format-select');
    const exportBtn = shadow.querySelector('[data-action="export"]');
    const copyBtn = shadow.querySelector('[data-action="copy"]');
    const clearRangeBtn = shadow.querySelector('[data-action="clear-range"]');
    const previewContainer = shadow.querySelector('.chat-preview');

    // Set up range change callback
    globalState.onRangeChange = () => {
      this.renderMessages(previewContainer, harvest);
      if (globalState.rangeSelection.start !== null && globalState.rangeSelection.end !== null) {
        clearRangeBtn.style.display = 'block';
      } else {
        clearRangeBtn.style.display = 'none';
      }
    };

    // Close handlers
    backdrop.addEventListener('click', () => PanelManager.close());
    closeBtn.addEventListener('click', () => PanelManager.close());

    // Filter buttons
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const isActive = btn.classList.contains('active');
        
        globalState.setFilter(filter, !isActive);
        btn.classList.toggle('active');
        
        this.renderMessages(previewContainer, harvest);
      });
    });

    // Format selector
    formatSelect.addEventListener('change', (e) => {
      globalState.setExportFormat(e.target.value);
    });

    // Clear range
    clearRangeBtn.addEventListener('click', () => {
      globalState.clearRange();
      Timeline.updateSelection(shadow.querySelector('.timeline-panel'));
      this.renderMessages(previewContainer, harvest);
      clearRangeBtn.style.display = 'none';
    });

    // Export actions
    exportBtn.addEventListener('click', () => ExportManager.export(harvest));
    copyBtn.addEventListener('click', () => ExportManager.copy(harvest));

    // Initial render
    Timeline.render(shadow.querySelector('.timeline-panel'), harvest.messages);
    this.renderMessages(previewContainer, harvest);
  },

  renderMessages(container, harvest) {
    container.innerHTML = '';
    const filteredMessages = MessageFilter.apply(harvest.messages);
    
    if (filteredMessages.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">No messages match the current filters</div>';
      return;
    }
    
    filteredMessages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.role}`;
      messageDiv.dataset.messageIndex = msg.index;
      
      // Handle thinking states as simple text above assistant messages
      let thinkingLabel = '';
      if (msg.isThinking && msg.thinkingLabel) {
        thinkingLabel = `<div class="thinking-label">${Utils.escapeHtml(msg.thinkingLabel)}</div>`;
      }
      
      const bubbleContent = MessageFormatter.format(msg);
      
      const renderBubble = bubbleContent && bubbleContent.trim().length > 0;
      
      messageDiv.innerHTML = `
        <div style="max-width: 70%;">
          ${thinkingLabel}
          ${renderBubble ? `
          <div class="bubble">
            <div class="message-role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
            ${bubbleContent}
          </div>` : ''}
        </div>
      `;
      
      container.appendChild(messageDiv);
    });
  }
};

/* ===========================
   Message Filtering
   =========================== */
const MessageFilter = {
  apply(messages) {
    let filtered = [...messages];
    
    // Apply range selection first
    if (globalState.rangeSelection.start !== null && 
        globalState.rangeSelection.end !== null) {
      filtered = filtered.filter(msg => 
        msg.index >= globalState.rangeSelection.start && 
        msg.index <= globalState.rangeSelection.end
      );
    }
    
    // Apply role filter
    if (globalState.filters.assistantOnly) {
      filtered = filtered.filter(msg => msg.role === 'assistant');
    }
    
    // Apply content filters
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
   Message Formatting
   =========================== */
const MessageFormatter = {
  format(message) {
    // Skip thinking messages - they're shown as labels
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
            return `<img src="${Utils.escapeHtml(src)}" alt="${Utils.escapeHtml(alt)}" style="max-width: 100%;">`;
          }
          return '';
          
        case 'link':
          const href = block.href || '';
          const text = block.text || href;
          if (href) {
            return `<p><a href="${Utils.escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(text)}</a></p>`;
          }
          return '';
          
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
    let html = Utils.escapeHtml(md);
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      return `<a href="${Utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(text)}</a>`;
    });
    
    // Code spans
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    return html;
  }
};

/* ===========================
   Export Manager
   =========================== */
const ExportManager = {
  async export(harvest, format = null) {
    const exportFormat = format || globalState.exportFormat;
    const content = this.generateContent(harvest, exportFormat);
    const filename = this.generateFilename(harvest, exportFormat);
    
    Utils.downloadFile(filename, content, this.getMimeType(exportFormat));
    NotificationManager.showToast(`✅ Exported as ${filename}`);
    
    // Close panel only if called from panel
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
    let md = `# ${meta.title}\n\n`;
    md += `**Exported**: ${new Date(meta.exported_at).toLocaleString()}\n`;
    if (meta.model) md += `**Model**: ${meta.model}\n`;
    md += `**Version**: ChatGPT Export v${CFG.version}\n`;
    md += '\n---\n\n';
    
    messages.forEach(msg => {
      const roleLabel = msg.role === 'user' ? 'You' : 'ChatGPT';
      
      // Add thinking label if present
      if (msg.isThinking && msg.thinkingLabel) {
        md += `*${msg.thinkingLabel}*\n\n`;
      }
      
      md += `## ${roleLabel}\n\n`;
      
      if (!msg.isThinking || msg.blocks?.length) {
        const blocks = msg.blocks || [];
        if (blocks.length > 0) {
          md += Utils.blocksToMarkdown(blocks) + '\n';
        } else if (msg.plain?.text) {
          md += msg.plain.text + '\n\n';
        }
      }
    });
    
    return md;
  },

  toHTML(messages, meta) {
    const chatFont = ThemeUtils.getChatGPTFont();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      margin-bottom: 8px;
      font-style: italic;
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
    let thinkingLabel = '';
    if (msg.isThinking && msg.thinkingLabel) {
      thinkingLabel = `<div class="thinking-label">${Utils.escapeHtml(msg.thinkingLabel)}</div>`;
    }
    
    return `
    <div class="message ${msg.role}">
      <div style="max-width: 70%;">
        ${thinkingLabel}
        <div class="bubble">
          <div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
          ${MessageFormatter.format(msg)}
        </div>
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
        range: globalState.rangeSelection
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
   Harvester Module (Enhanced with Comprehensive Thinking Detection)
   =========================== */
const Harvester = {
  async harvest() {
    const meta = {
      title: this.detectTitle() || 'ChatGPT Conversation',
      url: location.href,
      model: this.detectModel(),
      exported_at: new Date().toISOString()
    };

    const messages = this.collectAllMessages();
    return { meta, messages };
  },

  collectAllMessages() {
    const messages = [];
    const processedElements = new Set();
    
    // Find all conversation turns/messages using multiple strategies
    const turnContainers = this.findAllTurnContainers();
    
    turnContainers.forEach((container, index) => {
      // Skip if already processed
      if (processedElements.has(container)) return;
      processedElements.add(container);
      
      // Detect message role and content
      const role = this.detectRole(container);
      const thinkingInfo = this.detectThinkingState(container);
      const hasContent = this.hasActualContent(container);
      
      // Skip empty containers unless they're thinking states
      if (!hasContent && !thinkingInfo.isThinking) return;
      
      const contentNode = this.findContentNode(container) || container;
      const clone = contentNode.cloneNode(true);
      this.sanitizeClone(clone);
      
      const blocks = this.extractBlocks(clone);
      const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();
      
      // Create message object
      const message = {
        id: container.id || `msg-${messages.length + 1}`,
        index: messages.length,
        role: role,
        isThinking: thinkingInfo.isThinking,
        thinkingLabel: thinkingInfo.label,
        incomplete: thinkingInfo.isThinking,
        blocks: blocks.length ? blocks : (plainText && !thinkingInfo.isThinking ? [{ kind: 'para', md: plainText }] : []),
        plain: { text: plainText || '' },
        timestamp: new Date().toISOString()
      };
      
      // Only add if there's actual content or it's a thinking state
      if (message.plain.text || message.blocks.length > 0 || thinkingInfo.isThinking) {
        messages.push(message);
      }
    });
    
    return messages;
  },

  findAllTurnContainers() {
    const containers = [];
    const seen = new Set();
    
    // Multiple strategies to find conversation turns
    const strategies = [
      // Strategy 1: Direct conversation turn elements
      () => document.querySelectorAll('[data-testid="conversation-turn"]'),
      
      // Strategy 2: Elements with message author role
      () => document.querySelectorAll('[data-message-author-role]'),
      
      // Strategy 3: Article elements used for messages
      () => document.querySelectorAll('article[data-scroll-anchor]'),
      
      // Strategy 4: Message divs
      () => document.querySelectorAll('div[data-message-id]'),
      
      // Strategy 5: Look for thinking/processing indicators
      () => {
        const elements = [];
        // Use comprehensive thinking patterns
        const patterns = [...CFG.thinkingPatterns.timePatterns, ...CFG.thinkingPatterns.statePatterns]
          .map(p => p.source);
        
        document.querySelectorAll('div, article').forEach(el => {
          const text = el.textContent || '';
          if (patterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
            // Check if this is likely a thinking container
            if (el.querySelector('button') || el.querySelector('[role="button"]')) {
              elements.push(el);
            }
          }
        });
        return elements;
      },
      
      // Strategy 6: Find by structural patterns
      () => {
        const elements = [];
        // Look for message-like structures
        document.querySelectorAll('.group\\/conversation-turn, .agent-turn, .user-turn').forEach(el => {
          elements.push(el);
        });
        return elements;
      }
    ];
    
    // Apply all strategies
    strategies.forEach(strategy => {
      const found = strategy();
      found.forEach(el => {
        // Skip if nested within another container
        if (Array.from(seen).some(existing => existing.contains(el) || el.contains(existing))) {
          return;
        }
        
        // Skip if it's a child of an already found element
        if (!seen.has(el)) {
          containers.push(el);
          seen.add(el);
        }
      });
    });
    
    // Sort by DOM position
    return containers.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  },

  detectThinkingState(el) {
    const text = (el.textContent || '').trim();
    
    // Check time-based patterns
    for (const pattern of CFG.thinkingPatterns.timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          isThinking: true,
          label: match[0]
        };
      }
    }
    
    // Check state patterns
    for (const pattern of CFG.thinkingPatterns.statePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          isThinking: true,
          label: match[0]
        };
      }
    }
    
    // Check for expand/collapse buttons (common in thinking messages)
    const hasExpandButton = el.querySelector('button[aria-label*="expand"], button[aria-label*="collapse"], [role="button"]');
    const hasThinkingKeywords = ['thought', 'thinking', 'analyzing', 'stopped', 'paused', 'processing']
      .some(keyword => text.toLowerCase().includes(keyword));
    
    if (hasExpandButton && hasThinkingKeywords) {
      // Extract the most likely thinking text
      const firstLine = text.split('\n')[0].trim();
      if (firstLine.length < 50) {
        return {
          isThinking: true,
          label: firstLine
        };
      }
    }
    
    return {
      isThinking: false,
      label: null
    };
  },

  hasActualContent(el) {
    // Check if element has meaningful content beyond UI elements
    const clone = el.cloneNode(true);
    
    // Remove UI elements
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

  detectModel() {
    const text = document.body.innerText || '';
    const models = ['o1-preview', 'o1-mini', 'GPT-4o', 'GPT-4', 'gpt-4o-mini', 'gpt-3.5-turbo'];
    
    for (const m of models) {
      if (new RegExp(`\\b${m.replace(/[.-]/g, '[.-]?')}\\b`, 'i').test(text)) {
        return m;
      }
    }
    return null;
  },

  detectRole(el, opts = {}) {
    const { skipThinking = false } = opts;

    // Direct attribute
    const attr = el.getAttribute('data-message-author-role');
    if (attr) return attr;

    // Check nested element
    const nested = el.querySelector('[data-message-author-role]');
    if (nested) return nested.getAttribute('data-message-author-role');

    // Check parent
    const parent = el.closest('[data-message-author-role]');
    if (parent) return parent.getAttribute('data-message-author-role');

    // Check if it's a thinking state
    if (!skipThinking) {
      const thinkingInfo = this.detectThinkingState(el);
      if (thinkingInfo.isThinking) return 'assistant';
    }

    // Heuristics
    const text = (el.textContent || '').toLowerCase();
    if (text.startsWith('you:') || el.querySelector('img[alt*="User"]')) return 'user';
    if (text.includes('chatgpt') || el.querySelector('img[alt*="ChatGPT"]')) return 'assistant';

    // Check position/styling
    const style = window.getComputedStyle(el);
    if (style.textAlign === 'right' || style.justifyContent === 'flex-end') return 'user';

    return 'assistant';
  },

  findContentNode(el) {
    const candidates = [
      '[data-message-content]',
      '.markdown',
      '.text-message',
      '.prose',
      'div.group\\/conversation-turn'
    ];
    
    for (const sel of candidates) {
      const n = el.querySelector(sel);
      if (n && (n.textContent || '').trim().length) return n;
    }
    return el;
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
      
      // Images
      if (tag === 'img') {
        const src = node.src || node.getAttribute('src') || '';
        const alt = node.alt || node.getAttribute('alt') || '';
        if (src) {
          blocks.push({ kind: 'image', src, alt });
        }
        return true;
      }
      
      // Links (standalone)
      if (tag === 'a' && node.href) {
        const href = node.href;
        const text = (node.textContent || '').trim();
        if (href && text) {
          blocks.push({ kind: 'link', href, text });
        }
        return true;
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
      if ((tag === 'p' || tag === 'div') && !node.querySelector('h1,h2,h3,h4,h5,h6,pre,ul,ol,table,img')) {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'para', md: text });
        return true;
      }
    }
    
    // Process all child nodes
    Array.from(root.childNodes).forEach(child => {
      if (!visit(child) && child.nodeType === 1) {
        const subBlocks = this.extractBlocks(child);
        blocks.push(...subBlocks);
      }
    });
    
    // Fallback to plain text
    if (!blocks.length) {
      const text = (root.textContent || '').trim();
      if (text) blocks.push({ kind: 'para', md: text });
    }
    
    return blocks;
  }
};

/* ===========================
   Utilities
   =========================== */
const Utils = {
  escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => 
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  },

  safeTitle(t) {
    return (t || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
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
      // Cleanup scroll observer
      if (globalState.scrollObserver) {
        globalState.scrollObserver();
        globalState.scrollObserver = null;
      }
      
      panelHost.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => {
        if (panelHost?.parentNode) {
          panelHost.parentNode.removeChild(panelHost);
        }
        panelHost = null;
        if (globalState.onRangeChange) {
          globalState.onRangeChange = null;
        }
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
   Context Menu Handler (Simplified Flat Menu)
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

    // Handle menu item clicks
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

    // Close menu on outside click
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
    const chatFont = ThemeUtils.getChatGPTFont();
    
    if (format === 'markdown') {
      return Utils.blocksToMarkdown(blocks);
    } else if (format === 'html') {
      const content = MessageFormatter.format({ blocks });
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ChatGPT Answer</title>
  <style>
    body { 
      font-family: ${chatFont}; 
      max-width: 800px; 
      margin: 40px auto; 
      padding: 20px;
      line-height: 1.6;
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
    }
  </style>
</head>
<body>${content}</body>
</html>`;
    } else if (format === 'json') {
      return JSON.stringify({ blocks, timestamp: new Date().toISOString() }, null, 2);
    }
    
    return Utils.blocksToMarkdown(blocks);
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
    // Check URL guard
    if (!CFG.urlGuard.test(location.href)) return;
    
    // Initialize components
    OverlayManager.mount();
    ContextMenu.setup();
    KeyboardShortcuts.setup();
    
    // Add global animation styles
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
    
    // Handle SPA navigation
    this.setupRouteWatcher();
    
    // Log initialization
    console.log(`[ChatGPT Export v${CFG.version}] Extension initialized`);
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
    
    // Override history methods
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
    
    // Fallback check
    setInterval(handleNav, 500);
  },

  cleanup() {
    // Cleanup function for extension unload
    OverlayManager.unmount();
    PanelManager.close();
    
    if (contextMenuListener) {
      document.removeEventListener('contextmenu', contextMenuListener);
    }
    
    if (keyboardShortcutListener) {
      document.removeEventListener('keydown', keyboardShortcutListener);
    }
    
    const styles = document.querySelector('[data-cgpt-styles]');
    if (styles) styles.remove();
    
    const toast = document.querySelector('[data-cgpt-toast]');
    if (toast) toast.remove();
    
    console.log(`[ChatGPT Export v${CFG.version}] Extension cleaned up`);
  }
};

// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

// Export for potential extension API usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App, CFG };
}