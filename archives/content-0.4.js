// ChatGPT Export Extension v2.2 - Fixed & Validated
// Timeline selection, proper filters, dark mode fixes

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
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#1f2937',
      exportButtonHover: '#111827',
      exportButtonText: 'white'
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
      accentPrimary: '#3b82f6',
      accentSecondary: '#10b981',
      exportButton: '#3b82f6',
      exportButtonHover: '#2563eb',
      exportButtonText: 'white'
    }
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
    // Trigger preview update
    if (this.onRangeChange) {
      this.onRangeChange();
    }
  }

  clearRange() {
    this.rangeSelection.start = null;
    this.rangeSelection.end = null;
    this.rangeSelection.isSelecting = false;
    // Trigger preview update
    if (this.onRangeChange) {
      this.onRangeChange();
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

/* ===========================
   Theme Utilities
   =========================== */
const ThemeUtils = {
  getTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  getColors() {
    return CFG.theme[this.getTheme()];
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
   Timeline Component
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
      const isUser = msg.role === 'user';
      const color = isUser ? colors.userTimeline : colors.assistantTimeline;
      const isInRange = this.isMessageInRange(idx);
      
      timeline += `
        <div class="timeline-segment" 
             data-index="${idx}"
             style="height: ${heightPercent}%; 
                    background: ${color};
                    opacity: ${isInRange ? '1' : '0.3'};">
        </div>
      `;
    });
    
    timeline += `
        </div>
        <div class="timeline-selection" style="display: none;"></div>
        <div class="resize-handle top" style="display: none;"></div>
        <div class="resize-handle bottom" style="display: none;"></div>
      </div>
    `;
    
    container.innerHTML = timeline;
    this.attachHandlers(container);
  },

  attachHandlers(container) {
    const track = container.querySelector('.timeline-track');
    const selection = container.querySelector('.timeline-selection');
    const resizeHandles = container.querySelectorAll('.resize-handle');
    
    let isDragging = false;
    let isResizing = false;
    let resizeType = null;
    let startIndex = null;
    
    // Start selection or clear on click
    track.addEventListener('mousedown', (e) => {
      const segment = e.target.closest('.timeline-segment');
      
      if (segment) {
        // Clicked on a segment
        const clickedIndex = parseInt(segment.dataset.index);
        
        // Check if clicking outside current selection
        if (globalState.rangeSelection.start !== null && 
            globalState.rangeSelection.end !== null) {
          const start = Math.min(globalState.rangeSelection.start, globalState.rangeSelection.end);
          const end = Math.max(globalState.rangeSelection.start, globalState.rangeSelection.end);
          
          if (clickedIndex < start || clickedIndex > end) {
            // Clicking outside selection - start new selection
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
    
    // Right-click to clear selection
    track.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      globalState.clearRange();
      this.updateSelection(container);
    });
    
    // Continue selection
    document.addEventListener('mousemove', (e) => {
      if (isDragging && !isResizing) {
        const segments = track.querySelectorAll('.timeline-segment');
        const rects = Array.from(segments).map(s => s.getBoundingClientRect());
        
        // Find segment under cursor
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
        
        // Position resize handles
        handles[0].style.display = 'block';
        handles[0].style.top = `${top - 5}px`;
        handles[1].style.display = 'block';
        handles[1].style.top = `${top + height - 5}px`;
      }
      
      // Update segment opacity
      segments.forEach((seg, idx) => {
        const isInRange = this.isMessageInRange(idx);
        seg.style.opacity = isInRange ? '1' : '0.3';
      });
    } else {
      selection.style.display = 'none';
      handles.forEach(h => h.style.display = 'none');
      segments.forEach(seg => seg.style.opacity = '1');
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

    shadow.innerHTML = `
      <style>
        ${this.getStyles(colors)}
      </style>
      
      <div class="backdrop" role="presentation"></div>
      <div class="panel" role="dialog" aria-label="Export ChatGPT Conversation" aria-modal="true">
        <div class="header">
          <h2 class="title">Export Conversation</h2>
          <div class="filter-buttons">
            <button class="filter-btn" data-filter="assistantOnly">
              <span class="icon">🤖</span> Assistant Only
            </button>
            <button class="filter-btn" data-filter="code">
              <span class="icon">💻</span> Code
            </button>
            <button class="filter-btn" data-filter="tables">
              <span class="icon">📊</span> Tables
            </button>
            <button class="filter-btn" data-filter="lists">
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
            <option value="pdf">PDF (Beta)</option>
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

  getStyles(colors) {
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
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }
      
      .title {
        font-size: 16px;
        font-weight: 600;
        color: ${colors.text};
        margin: 0;
      }
      
      .filter-buttons {
        display: flex;
        gap: 8px;
        flex: 1;
        justify-content: center;
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
        transition: opacity 0.2s;
      }
      
      .timeline-segment:hover {
        opacity: 0.8 !important;
      }
      
      .timeline-selection {
        position: absolute;
        left: 10px;
        width: 40px;
        background: rgba(59, 130, 246, 0.2);
        border: 2px solid ${colors.accentPrimary};
        border-radius: 4px;
        pointer-events: none;
      }
      
      .resize-handle {
        position: absolute;
        left: 10px;
        width: 40px;
        height: 10px;
        background: ${colors.accentPrimary};
        cursor: ns-resize;
        border-radius: 2px;
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
      }
      
      .message {
        display: flex;
        margin-bottom: 16px;
        animation: fadeIn 0.3s ease;
      }
      
      .message.filtered-out {
        display: none;
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
        background: ${colors.exportButton};
        color: ${colors.exportButtonText};
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
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
      // Show/hide clear button based on selection
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
        
        // Toggle this filter
        globalState.setFilter(filter, !isActive);
        btn.classList.toggle('active');
        
        this.renderMessages(previewContainer, harvest);
      });
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
      
      const bubbleContent = MessageFormatter.format(msg);
      
      messageDiv.innerHTML = `
        <div class="bubble">
          <div class="message-role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
          ${bubbleContent}
        </div>
      `;
      
      container.appendChild(messageDiv);
    });
  }
};

/* ===========================
   Message Filtering (Fixed)
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
    
    // Apply content filters - if any are active, filter messages AND their blocks
    const hasContentFilters = globalState.filters.code || 
                             globalState.filters.tables || 
                             globalState.filters.lists;
    
    if (hasContentFilters) {
      filtered = filtered.map(msg => {
        // Filter blocks within each message
        const filteredBlocks = msg.blocks.filter(block => {
          if (globalState.filters.code && block.kind === 'code') return true;
          if (globalState.filters.tables && block.kind === 'table') return true;
          if (globalState.filters.lists && block.kind === 'list') return true;
          
          // If content filters are active but block doesn't match any, exclude it
          return false;
        });
        
        // Only include message if it has matching blocks
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
          return `<img src="${Utils.escapeHtml(block.src || '')}" alt="${Utils.escapeHtml(block.alt || '')}" style="max-width: 100%;">`;
          
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
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return html;
  }
};

/* ===========================
   Export Manager
   =========================== */
const ExportManager = {
  async export(harvest) {
    const format = globalState.exportFormat;
    const content = this.generateContent(harvest, format);
    const filename = this.generateFilename(harvest, format);
    
    if (format === 'pdf') {
      this.exportPDF(harvest);
    } else {
      Utils.downloadFile(filename, content, this.getMimeType(format));
    }
    
    NotificationManager.showToast(`✅ Exported as ${filename}`);
    PanelManager.close();
  },

  async copy(harvest) {
    const format = globalState.exportFormat;
    const content = this.generateContent(harvest, format);
    
    try {
      await navigator.clipboard.writeText(content);
      NotificationManager.showToast('✅ Copied to clipboard');
    } catch (err) {
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
        return '';
    }
  },

  toMarkdown(messages, meta) {
    let md = `# ${meta.title}\n\n`;
    md += `**Exported**: ${new Date(meta.exported_at).toLocaleString()}\n`;
    if (meta.model) md += `**Model**: ${meta.model}\n`;
    md += '\n---\n\n';
    
    messages.forEach(msg => {
      md += `## ${msg.role === 'user' ? 'You' : 'ChatGPT'}\n\n`;
      
      // When filters are active, only export filtered blocks
      const blocks = msg.blocks || [];
      if (blocks.length > 0) {
        md += Utils.blocksToMarkdown(blocks) + '\n';
      } else if (msg.plain?.text) {
        md += msg.plain.text + '\n\n';
      }
    });
    
    return md;
  },

  toHTML(messages, meta) {
    const colors = ThemeUtils.getColors();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${Utils.escapeHtml(meta.title)}</title>
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
    .message.user { justify-content: flex-end; }
    .message.assistant { justify-content: flex-start; }
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
    @media (prefers-color-scheme: dark) {
      body { background: #111827; color: #f9fafb; }
      .message.assistant .bubble { background: #374151; color: #f9fafb; }
    }
  </style>
</head>
<body>
  <h1>${Utils.escapeHtml(meta.title)}</h1>
  <p><strong>Exported:</strong> ${new Date(meta.exported_at).toLocaleString()}</p>
  ${meta.model ? `<p><strong>Model:</strong> ${Utils.escapeHtml(meta.model)}</p>` : ''}
  <hr>
  
  ${messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="bubble">
        <div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
        ${MessageFormatter.format(msg)}
      </div>
    </div>
  `).join('')}
</body>
</html>`;
  },

  toJSON(messages, meta) {
    return JSON.stringify({
      meta,
      messages,
      exportSettings: {
        filters: globalState.filters,
        range: globalState.rangeSelection
      }
    }, null, 2);
  },

  exportPDF(harvest) {
    const html = this.toHTML(MessageFilter.apply(harvest.messages), harvest.meta);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
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
      json: 'application/json;charset=utf-8',
      pdf: 'application/pdf'
    };
    return types[format] || 'text/plain;charset=utf-8';
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
    
    // Focus management
    setTimeout(() => {
      const shadow = panelHost.shadowRoot;
      const firstFocusable = shadow.querySelector('button, select');
      if (firstFocusable) firstFocusable.focus();
    }, 100);
  },

  close() {
    if (panelHost) {
      panelHost.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => {
        if (panelHost?.parentNode) {
          panelHost.parentNode.removeChild(panelHost);
        }
        panelHost = null;
        // Clear state callback
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
   Utilities
   =========================== */
const Utils = {
  escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => 
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  },

  safeTitle(t) {
    return (t || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
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
        }
        .menu-item:hover {
          background: ${colors.hover};
        }
      </style>
      <div class="menu-item" data-action="export-answer">Export this answer</div>
      <div class="menu-item" data-action="copy-answer">Copy to clipboard</div>
    `;

    document.body.appendChild(menu);

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;

      menu.remove();
      const action = item.dataset.action;
      const content = await this.extractContent(messageEl);
      
      if (action === 'export-answer') {
        const filename = `ChatGPT_Answer_${new Date().toISOString().substring(0, 19).replace(/[:.]/g, '-')}.md`;
        Utils.downloadFile(filename, content, 'text/markdown;charset=utf-8');
        NotificationManager.showToast('✅ Exported answer');
      } else if (action === 'copy-answer') {
        await navigator.clipboard.writeText(content);
        NotificationManager.showToast('✅ Copied to clipboard');
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

  async extractContent(messageEl) {
    const contentNode = Harvester.findContentNode(messageEl);
    const clone = contentNode.cloneNode(true);
    Harvester.sanitizeClone(clone);
    const blocks = Harvester.extractBlocks(clone);
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
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        App.openExportPanel();
      }
      if (e.key === 'Escape' && panelHost) {
        PanelManager.close();
      }
    };

    document.addEventListener('keydown', keyboardShortcutListener);
  }
};

/* ===========================
   Harvester Module
   =========================== */
const Harvester = {
  async harvest() {
    const meta = {
      title: this.detectTitle() || 'ChatGPT Conversation',
      url: location.href,
      model: this.detectModel(),
      exported_at: new Date().toISOString()
    };

    const msgEls = this.findMessageElements();
    const messages = msgEls
      .map((el, i) => this.normalizeMessage(el, i))
      .filter(m => (m?.plain?.text || '').trim().length > 0 || (m?.blocks || []).length > 0);

    return { meta, messages };
  },

  findMessageElements() {
    const selectors = [
      '[data-testid="conversation-turn"]',
      '[data-message-author-role]',
      'main article',
      'article[role="article"]'
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

    return result.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.top === br.top ? ar.left - br.left : ar.top - br.top;
    });
  },

  normalizeMessage(el, idx) {
    const role = this.detectRole(el) || 'assistant';
    const contentNode = this.findContentNode(el) || el;
    const clone = contentNode.cloneNode(true);
    this.sanitizeClone(clone);

    const blocks = this.extractBlocks(clone);
    const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();

    return {
      id: el.id || `msg-${idx + 1}`,
      index: idx,
      role,
      blocks: blocks.length ? blocks : (plainText ? [{ kind: 'para', md: plainText }] : []),
      plain: { text: plainText },
      timestamp: new Date().toISOString()
    };
  },

  detectTitle() {
    const candidates = ['[data-testid="conversation-name"]', 'header h1', 'h1'];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      const t = (el?.textContent || '').trim();
      if (t) return t.replace(/\s*\|\s*ChatGPT.*/i, '');
    }
    return (document.title || '').replace(/\s*\|\s*ChatGPT.*/i, '');
  },

  detectModel() {
    const text = document.body.innerText || '';
    const models = ['GPT-4o', 'GPT-4', 'o1', 'o1-mini', 'gpt-4o-mini', 'gpt-3.5'];
    for (const m of models) {
      if (new RegExp(`\\b${m}\\b`, 'i').test(text)) return m;
    }
    return null;
  },

  detectRole(el) {
    const attr = el.getAttribute('data-message-author-role');
    if (attr) return attr;
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    if (/assistant|gpt/.test(aria)) return 'assistant';
    if (/you|user/.test(aria)) return 'user';
    return 'assistant';
  },

  findContentNode(el) {
    const candidates = ['[data-testid="markdown"]', '.markdown', '.prose', 'article', 'div'];
    for (const sel of candidates) {
      const n = el.querySelector(sel);
      if (n && (n.textContent || '').trim().length) return n;
    }
    return el;
  },

  sanitizeClone(root) {
    const DROP = ['button', 'nav', 'aside', '[role="toolbar"]', 'svg[aria-hidden="true"]'];
    root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());
    root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
    root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));
  },

  extractBlocks(root) {
    const blocks = [];
    
    function visit(node) {
      if (!node || node.nodeType !== 1) return;
      
      const tag = node.tagName.toLowerCase();
      
      if (tag === 'pre') {
        const code = node.querySelector('code') || node;
        const language = (code.className || '').match(/language-([a-z0-9+.-]+)/i)?.[1] || '';
        const text = code.textContent || '';
        if (text.trim()) {
          blocks.push({ kind: 'code', language, text });
          return true;
        }
      }
      
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'heading', level, text });
        return true;
      }
      
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.querySelectorAll(':scope > li'))
          .map(li => (li.textContent || '').trim())
          .filter(Boolean);
        if (items.length) {
          blocks.push({ kind: 'list', ordered: tag === 'ol', items });
        }
        return true;
      }
      
      if (tag === 'table') {
        blocks.push({ kind: 'table', html: node.outerHTML });
        return true;
      }
      
      if (tag === 'img') {
        blocks.push({ kind: 'image', src: node.src || '', alt: node.alt || '' });
        return true;
      }
      
      if (tag === 'blockquote') {
        const md = (node.textContent || '').trim();
        if (md) blocks.push({ kind: 'quote', md });
        return true;
      }
      
      if (tag === 'hr') {
        blocks.push({ kind: 'divider' });
        return true;
      }
      
      if ((tag === 'p' || tag === 'div') && !node.querySelector('h1,h2,h3,h4,h5,h6,pre,ul,ol,table')) {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ kind: 'para', md: text });
        return true;
      }
    }
    
    Array.from(root.childNodes).forEach(child => {
      if (!visit(child) && child.nodeType === 1) {
        const subBlocks = this.extractBlocks(child);
        blocks.push(...subBlocks);
      }
    });
    
    if (!blocks.length) {
      const text = (root.textContent || '').trim();
      if (text) blocks.push({ kind: 'para', md: text });
    }
    
    return blocks;
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
    const onResize = () => this.recomputePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    
    detachResize = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    
    const mo = new MutationObserver(() => this.recomputePosition());
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
    
    // Add animation styles
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
    
    // Handle SPA navigation
    this.setupRouteWatcher();
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
    setInterval(handleNav, 500);
  }
};

// Initialize the extension
App.init();