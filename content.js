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
    // New multi-selection model
    this.selection = {
      selectedIndices: new Set(), // Set of selected message indices
      isSelecting: false,
      lastAnchor: null, // Last clicked index for shift+click range
      isDragging: false,
      dragMode: null // 'add' or 'remove' for ctrl+drag
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
    this.viewMode = 'main'; // 'main', 'settings', or 'dashboard'
    this.onSelectionChange = null;
    this.onViewModeChange = null;
  }

  setFilter(filterName, value) {
    this.filters[filterName] = value;
  }

  hasActiveFilters() {
    return Object.values(this.filters).some(v => v);
  }

  // Multi-selection methods
  toggleSelection(index) {
    // Special case: If Set is empty (all messages selected), toggling OFF means
    // we need to select all EXCEPT the one being toggled off
    if (this.selection.selectedIndices.size === 0) {
      // Add all message indices except the one being toggled off
      if (this.harvest && this.harvest.messages) {
        this.harvest.messages.forEach(msg => {
          if (msg.index !== index && !(msg.isThinking || msg.incomplete)) {
            this.selection.selectedIndices.add(msg.index);
          }
        });
      }
    } else {
      // Normal toggle logic
      if (this.selection.selectedIndices.has(index)) {
        this.selection.selectedIndices.delete(index);
      } else {
        this.selection.selectedIndices.add(index);
      }

      // Optimization: If we just added the last missing message, clear the Set
      // to return to "all selected" state (empty Set)
      if (this.harvest && this.harvest.messages) {
        const totalMessages = this.harvest.messages.filter(m => !(m.isThinking || m.incomplete)).length;
        if (this.selection.selectedIndices.size === totalMessages) {
          this.selection.selectedIndices.clear();
        }
      }
    }

    this.selection.lastAnchor = index;
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  addToSelection(index) {
    this.selection.selectedIndices.add(index);
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  removeFromSelection(index) {
    this.selection.selectedIndices.delete(index);
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  setSelection(indices) {
    this.selection.selectedIndices = new Set(indices);
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  extendSelection(fromIndex, toIndex) {
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    // Get all message indices in range
    if (this.harvest && this.harvest.messages) {
      const indicesInRange = this.harvest.messages
        .filter(m => m.index >= start && m.index <= end && !(m.isThinking || m.incomplete))
        .map(m => m.index);

      indicesInRange.forEach(idx => this.selection.selectedIndices.add(idx));
    }

    this.selection.lastAnchor = toIndex;
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  clearSelection() {
    this.selection.selectedIndices.clear();
    this.selection.isSelecting = false;
    this.selection.lastAnchor = null;
    this.selection.dragMode = null;
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  hasSelection() {
    return this.selection.selectedIndices.size > 0;
  }

  isSelected(index) {
    // If no selection, everything is selected
    if (this.selection.selectedIndices.size === 0) {
      return true;
    }
    return this.selection.selectedIndices.has(index);
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

  isDark() {
    return this.getTheme() === 'dark';
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
        .btn:hover:not(.loading) {
          transform: scale(1.05);
          background: ${colors.exportButtonHover};
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .btn:active:not(.loading) {
          transform: scale(0.98);
        }
        .btn:focus-visible {
          outline: 3px solid ${colors.accentSecondary};
          outline-offset: 2px;
        }
        .btn.loading {
          cursor: wait;
          pointer-events: none;
        }
        .ico {
          width: 24px;
          height: 24px;
          transition: opacity 0.2s ease;
        }
        .btn.loading .ico {
          opacity: 0;
        }
        .spinner {
          position: absolute;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: ${colors.exportButtonText};
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .btn.loading .spinner {
          opacity: 1;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
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
        .btn:hover:not(.loading) .tooltip {
          opacity: 1;
        }
      </style>
      <div class="wrap">
        <button class="btn" type="button" aria-label="Export conversation" role="button">
          <span class="tooltip">Export conversation (Alt+E)</span>
          <div class="spinner" aria-hidden="true"></div>
          <svg class="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m0 0l-4-4m4 4l4-4"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    const btn = shadow.querySelector('button.btn');
    const tooltip = shadow.querySelector('.tooltip');

    // Add method to control loading state
    host.setLoading = (isLoading) => {
      if (isLoading) {
        btn.classList.add('loading');
        btn.setAttribute('aria-busy', 'true');
        tooltip.textContent = 'Processing conversation...';
      } else {
        btn.classList.remove('loading');
        btn.setAttribute('aria-busy', 'false');
        tooltip.textContent = 'Export conversation (Alt+E)';
      }
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!btn.classList.contains('loading')) {
        onClick();
      }
    });

    return host;
  }
};

/* ===========================
   Timeline Component (Enhanced)
   =========================== */
const Timeline = {
  documentListeners: new Map(), // Track document-level listeners for cleanup

  render(container, messages) {
    // Clean up any existing document listeners for this container
    this.cleanup(container);
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
    
    let scrollTimeout = null;
    let initialTimeout = null;

    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateHighlight, 50);
    };

    previewPanel.addEventListener('scroll', handleScroll, { passive: true });

    initialTimeout = setTimeout(updateHighlight, 100);

    globalState.scrollObserver = () => {
      previewPanel.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
      }
      if (initialTimeout) {
        clearTimeout(initialTimeout);
        initialTimeout = null;
      }
    };
  },

  attachHandlers(container) {
    const track = container.querySelector('.timeline-track');
    const selection = container.querySelector('.timeline-selection');
    const resizeHandles = container.querySelectorAll('.resize-handle');

    // Assign unique ID for tracking listeners
    const containerId = `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    container.dataset.timelineId = containerId;

    let isDragging = false;
    let isResizing = false;
    let resizeType = null;
    let startIndex = null;

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      globalState.clearSelection();
      this.updateSelection(container);
      return false;
    });

    track.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const segment = e.target.closest('.timeline-segment');

      if (segment) {
        const clickedIndex = parseInt(segment.dataset.index);
        const ctrlKey = e.ctrlKey || e.metaKey; // Support both Ctrl and Cmd (Mac)
        const shiftKey = e.shiftKey;

        if (ctrlKey && !shiftKey) {
          // Ctrl+click: Toggle selection
          globalState.toggleSelection(clickedIndex);

          // Set drag mode based on whether we added or removed
          globalState.selection.dragMode = globalState.isSelected(clickedIndex) ? 'add' : 'remove';
          globalState.selection.isDragging = true;
          isDragging = true;
          startIndex = clickedIndex;

        } else if (shiftKey && !ctrlKey) {
          // Shift+click: Extend selection from last anchor
          const anchor = globalState.selection.lastAnchor ?? clickedIndex;
          globalState.extendSelection(anchor, clickedIndex);

        } else if (ctrlKey && shiftKey) {
          // Ctrl+Shift+click: Add range to selection
          const anchor = globalState.selection.lastAnchor ?? clickedIndex;
          globalState.extendSelection(anchor, clickedIndex);

        } else {
          // Regular click: Start new drag selection (clear existing first)
          if (!globalState.isSelected(clickedIndex) || globalState.selection.selectedIndices.size > 1) {
            globalState.clearSelection();
          }

          isDragging = true;
          startIndex = clickedIndex;
          globalState.selection.isSelecting = true;
          globalState.selection.lastAnchor = clickedIndex;
          globalState.addToSelection(clickedIndex);
          globalState.selection.dragMode = 'add';
        }

        this.updateSelection(container);
      }
    });

    // Create named handlers so they can be removed later
    const handleMouseMove = (e) => {
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

        if (endIndex !== null && startIndex !== null) {
          const start = Math.min(startIndex, endIndex);
          const end = Math.max(startIndex, endIndex);

          // Get all indices in the drag range
          const messages = globalState.harvest?.messages || [];
          const indicesInRange = messages
            .filter(m => m.index >= start && m.index <= end && !(m.isThinking || m.incomplete))
            .map(m => m.index);

          // Apply based on drag mode
          if (globalState.selection.dragMode === 'remove') {
            // Remove all indices in range
            indicesInRange.forEach(idx => globalState.removeFromSelection(idx));
          } else {
            // Add all indices in range (default mode)
            indicesInRange.forEach(idx => globalState.addToSelection(idx));
          }

          this.updateSelection(container);
        }
      } else if (isResizing) {
        e.preventDefault();
        this.handleResize(e, container, resizeType);
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      isResizing = false;
      resizeType = null;
      globalState.selection.isSelecting = false;
      globalState.selection.isDragging = false;
    };

    // Add document-level listeners and track them
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store handlers for cleanup
    this.documentListeners.set(containerId, {
      mousemove: handleMouseMove,
      mouseup: handleMouseUp
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

    const hasSelection = globalState.hasSelection();

    if (hasSelection) {
      // Find contiguous ranges for visual overlay
      const selectedIndices = Array.from(globalState.selection.selectedIndices).sort((a, b) => a - b);

      if (selectedIndices.length > 0) {
        // Get first and last selected segments for visual overlay
        const firstIndex = selectedIndices[0];
        const lastIndex = selectedIndices[selectedIndices.length - 1];

        let firstSegment = null;
        let lastSegment = null;

        segments.forEach(seg => {
          const idx = parseInt(seg.getAttribute('data-index'), 10);
          if (idx === firstIndex) firstSegment = seg;
          if (idx === lastIndex) lastSegment = seg;
        });

        if (firstSegment && lastSegment) {
          const firstRect = firstSegment.getBoundingClientRect();
          const lastRect = lastSegment.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const top = firstRect.top - containerRect.top;
          const height = lastRect.bottom - firstRect.top;

          selection.style.display = 'block';
          selection.style.top = `${top}px`;
          selection.style.height = `${height}px`;

          handles[0].style.display = 'block';
          handles[0].style.top = `${top - 5}px`;
          handles[1].style.display = 'block';
          handles[1].style.top = `${top + height - 5}px`;
        }
      }

      // Update segment opacity based on selection
      segments.forEach((seg) => {
        const segIndex = parseInt(seg.getAttribute('data-index'), 10);
        const isSelected = this.isMessageInRange(segIndex);
        seg.style.opacity = isSelected ? '1' : '0.3';
      });
    } else {
      // No selection - show all as selected
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

    if (newIndex !== null && globalState.hasSelection()) {
      const selectedIndices = Array.from(globalState.selection.selectedIndices).sort((a, b) => a - b);
      const firstIndex = selectedIndices[0];
      const lastIndex = selectedIndices[selectedIndices.length - 1];

      if (type === 'top') {
        // Resize from top: extend/contract selection from the bottom up
        const anchor = lastIndex;
        globalState.clearSelection();
        globalState.extendSelection(anchor, newIndex);
      } else {
        // Resize from bottom: extend/contract selection from the top down
        const anchor = firstIndex;
        globalState.clearSelection();
        globalState.extendSelection(anchor, newIndex);
      }

      this.updateSelection(container);
    }
  },

  isMessageInRange(idx) {
    return globalState.isSelected(idx);
  },

  cleanup(container) {
    // Remove document-level listeners for this container
    const containerId = container?.dataset?.timelineId;
    if (containerId && this.documentListeners.has(containerId)) {
      const listeners = this.documentListeners.get(containerId);
      if (listeners.mousemove) {
        document.removeEventListener('mousemove', listeners.mousemove);
      }
      if (listeners.mouseup) {
        document.removeEventListener('mouseup', listeners.mouseup);
      }
      this.documentListeners.delete(containerId);
    }
  },

  cleanupAll() {
    // Clean up all document listeners
    this.documentListeners.forEach((listeners) => {
      if (listeners.mousemove) {
        document.removeEventListener('mousemove', listeners.mousemove);
      }
      if (listeners.mouseup) {
        document.removeEventListener('mouseup', listeners.mouseup);
      }
    });
    this.documentListeners.clear();
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

          <div class="setting-group">
            <h3>Integrations</h3>
            <p class="setting-description">Connect GitHub and Notion to export conversations directly to these platforms.</p>

            <!-- GitHub Integration -->
            <div class="integration-section">
              <div class="integration-header">
                <h4>GitHub</h4>
                <span class="integration-status" data-status="github">Not connected</span>
              </div>

              <div class="setting-item">
                <label>Personal Access Token:</label>
                <div class="token-input-group">
                  <input type="password" data-integration="github-token" placeholder="ghp_..." class="integration-token-input">
                  <button class="secondary-btn" data-action="toggle-token" data-target="github-token">Show</button>
                </div>
                <small class="setting-hint">
                  <a href="https://github.com/settings/tokens/new?scopes=gist&description=Capsula" target="_blank" rel="noopener">Create token</a>
                  with "gist" scope. For Issues, add "repo" or "public_repo" scope.
                </small>
              </div>

              <div class="integration-actions">
                <button class="secondary-btn" data-action="test-connection" data-service="github">Test Connection</button>
                <button class="secondary-btn" data-action="clear-token" data-service="github">Clear Token</button>
              </div>

              <div class="integration-result" data-result="github" style="display: none;"></div>
            </div>

            <!-- Notion Integration -->
            <div class="integration-section">
              <div class="integration-header">
                <h4>Notion</h4>
                <span class="integration-status" data-status="notion">Not connected</span>
              </div>

              <div class="setting-item">
                <label>Integration Token:</label>
                <div class="token-input-group">
                  <input type="password" data-integration="notion-token" placeholder="secret_..." class="integration-token-input">
                  <button class="secondary-btn" data-action="toggle-token" data-target="notion-token">Show</button>
                </div>
                <small class="setting-hint">
                  <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener">Create integration</a>
                  and share a parent page with it. Then paste the "Internal Integration Token" here.
                </small>
              </div>

              <div class="integration-actions">
                <button class="secondary-btn" data-action="test-connection" data-service="notion">Test Connection</button>
                <button class="secondary-btn" data-action="clear-token" data-service="notion">Clear Token</button>
              </div>

              <div class="integration-result" data-result="notion" style="display: none;"></div>
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

    // Integration handlers
    this.attachIntegrationHandlers(container);
  },

  async attachIntegrationHandlers(container) {
    // Toggle token visibility
    container.querySelectorAll('[data-action="toggle-token"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const input = container.querySelector(`[data-integration="${target}"]`);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = 'Hide';
          } else {
            input.type = 'password';
            btn.textContent = 'Show';
          }
        }
      });
    });

    // Test connection
    container.querySelectorAll('[data-action="test-connection"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const service = btn.dataset.service;
        await this.testIntegrationConnection(service, container);
      });
    });

    // Clear token
    container.querySelectorAll('[data-action="clear-token"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const service = btn.dataset.service;
        if (confirm(`Clear ${service} token?`)) {
          await IntegrationStorage.clearToken(service);
          const input = container.querySelector(`[data-integration="${service}-token"]`);
          if (input) input.value = '';
          this.updateIntegrationStatus(service, container, 'Not connected', false);
          NotificationManager.showToast(`${service} token cleared`);
        }
      });
    });

    // Load existing tokens and test connections
    await this.loadIntegrationStates(container);
  },

  async loadIntegrationStates(container) {
    // Check GitHub
    const githubToken = await IntegrationStorage.getToken('github');
    if (githubToken) {
      const input = container.querySelector('[data-integration="github-token"]');
      if (input) input.value = githubToken;
      await this.testIntegrationConnection('github', container, true);
    }

    // Check Notion
    const notionToken = await IntegrationStorage.getToken('notion');
    if (notionToken) {
      const input = container.querySelector('[data-integration="notion-token"]');
      if (input) input.value = notionToken;
      await this.testIntegrationConnection('notion', container, true);
    }
  },

  async testIntegrationConnection(service, container, silent = false) {
    const input = container.querySelector(`[data-integration="${service}-token"]`);
    const token = input?.value?.trim();

    if (!token) {
      this.updateIntegrationStatus(service, container, 'No token provided', false);
      return;
    }

    // Save token first
    await IntegrationStorage.setToken(service, token);

    // Test connection
    this.updateIntegrationStatus(service, container, 'Testing...', null);

    const exporter = service === 'github' ? GitHubExporter : NotionExporter;
    const result = await exporter.testConnection();

    if (result.ok) {
      this.updateIntegrationStatus(
        service,
        container,
        `Connected as ${result.identity}`,
        true
      );
      if (!silent) {
        NotificationManager.showToast(`${service} connected successfully`);
      }
    } else {
      this.updateIntegrationStatus(
        service,
        container,
        `Error: ${result.error}`,
        false
      );
      if (!silent) {
        NotificationManager.showToast(`${service} connection failed`, 'error');
      }
    }
  },

  updateIntegrationStatus(service, container, message, success) {
    const statusEl = container.querySelector(`[data-status="${service}"]`);
    const resultEl = container.querySelector(`[data-result="${service}"]`);

    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = success === true ? '#10b981' : success === false ? '#ef4444' : '#6b7280';
    }

    if (resultEl && message) {
      resultEl.textContent = message;
      resultEl.style.display = 'block';
      resultEl.style.color = success === true ? '#10b981' : success === false ? '#ef4444' : '#6b7280';
    }
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
   Dashboard View Component
   =========================== */
const DashboardView = {
  render(harvest) {
    const stats = DashboardGenerator.calculateStats(harvest.messages, harvest.meta);
    const colors = ThemeUtils.getColors();

    return `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <button class="back-btn" aria-label="Back to main view">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <h2 class="dashboard-title">📊 Conversation Dashboard</h2>
          <button class="export-dashboard-btn" data-action="export-dashboard">
            Export Dashboard
          </button>
        </div>

        <div class="dashboard-content">
          <!-- Overview Cards -->
          <div class="dashboard-section">
            <h3 class="dashboard-section-title">Conversation Overview</h3>
            <div class="dashboard-grid">
              <div class="dashboard-card">
                <div class="dashboard-card-label">Total Messages</div>
                <div class="dashboard-card-value">${stats.overview.totalMessages}</div>
              </div>
              <div class="dashboard-card">
                <div class="dashboard-card-label">User Messages</div>
                <div class="dashboard-card-value" style="color: #3b82f6">${stats.overview.userMessages}</div>
                <div class="dashboard-card-subtitle">${this.formatPercentage(stats.overview.userMessages, stats.overview.totalMessages)}%</div>
              </div>
              <div class="dashboard-card">
                <div class="dashboard-card-label">Assistant Messages</div>
                <div class="dashboard-card-value" style="color: #10b981">${stats.overview.assistantMessages}</div>
                <div class="dashboard-card-subtitle">${this.formatPercentage(stats.overview.assistantMessages, stats.overview.totalMessages)}%</div>
              </div>
            </div>
          </div>

          <!-- Content Statistics -->
          <div class="dashboard-section">
            <h3 class="dashboard-section-title">Content Statistics</h3>
            <div class="dashboard-stats-grid">
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Total Words</div>
                <div class="dashboard-stat-value">${stats.content.totalWords.toLocaleString()}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">User Words</div>
                <div class="dashboard-stat-value">${stats.content.userWords.toLocaleString()}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Assistant Words</div>
                <div class="dashboard-stat-value">${stats.content.assistantWords.toLocaleString()}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Avg Message Length</div>
                <div class="dashboard-stat-value">${stats.content.avgMessageLength} words</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Longest Message</div>
                <div class="dashboard-stat-value">${stats.messageLength.longest} words</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Code Blocks</div>
                <div class="dashboard-stat-value">${stats.content.codeBlocks}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Images</div>
                <div class="dashboard-stat-value">${stats.content.images}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Tables</div>
                <div class="dashboard-stat-value">${stats.content.tables}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Lists</div>
                <div class="dashboard-stat-value">${stats.content.lists}</div>
              </div>
              <div class="dashboard-stat-item">
                <div class="dashboard-stat-label">Links & Citations</div>
                <div class="dashboard-stat-value">${stats.content.links + stats.content.citations}</div>
              </div>
            </div>
          </div>

          ${stats.content.codeBlocks > 0 ? `
          <!-- Code Languages -->
          <div class="dashboard-section">
            <h3 class="dashboard-section-title">Code Languages</h3>
            <div class="dashboard-languages">
              ${Object.entries(stats.codeLanguages)
                .sort((a, b) => b[1] - a[1])
                .map(([lang, count]) => `
                  <div class="dashboard-language-tag">
                    <span>${Utils.escapeHTML(lang)}</span>
                    <span class="dashboard-language-count">${count}</span>
                  </div>
                `).join('')}
            </div>
          </div>
          ` : ''}

          ${stats.thinking.instances > 0 ? `
          <!-- Thinking Analysis -->
          <div class="dashboard-section">
            <h3 class="dashboard-section-title">Thinking State Analysis</h3>
            <div class="dashboard-grid">
              <div class="dashboard-card">
                <div class="dashboard-card-label">Thinking Instances</div>
                <div class="dashboard-card-value">${stats.thinking.instances}</div>
                <div class="dashboard-card-subtitle">${stats.thinking.percentageWithThinking}% of assistant messages</div>
              </div>
              <div class="dashboard-card">
                <div class="dashboard-card-label">Total Thinking Time</div>
                <div class="dashboard-card-value">${this.formatTime(stats.thinking.totalSeconds)}</div>
                <div class="dashboard-card-subtitle">${stats.thinking.totalSeconds} seconds</div>
              </div>
              <div class="dashboard-card">
                <div class="dashboard-card-label">Avg Thinking Time</div>
                <div class="dashboard-card-value">${this.formatTime(stats.thinking.avgSeconds)}</div>
                <div class="dashboard-card-subtitle">Per instance</div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Metadata -->
          <div class="dashboard-section">
            <h3 class="dashboard-section-title">Conversation Info</h3>
            <div class="dashboard-metadata">
              <div class="dashboard-metadata-item">
                <span class="dashboard-metadata-label">Model:</span>
                <span class="dashboard-metadata-value">${Utils.escapeHTML(stats.overview.model)}</span>
              </div>
              <div class="dashboard-metadata-item">
                <span class="dashboard-metadata-label">Exported:</span>
                <span class="dashboard-metadata-value">${Utils.escapeHTML(stats.overview.exportDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getStyles(colors) {
    return `
      .dashboard-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .dashboard-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.bgSecondary};
      }

      .dashboard-header .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: ${colors.text};
        cursor: pointer;
        transition: all 0.2s;
      }

      .dashboard-header .back-btn:hover {
        background: ${colors.bgTertiary || colors.bg};
        transform: translateX(-2px);
      }

      .dashboard-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: ${colors.text};
        flex: 1;
      }

      .export-dashboard-btn {
        padding: 8px 16px;
        background: ${colors.accent || '#3b82f6'};
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .export-dashboard-btn:hover {
        background: ${colors.accentHover || '#2563eb'};
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }

      .dashboard-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .dashboard-section {
        margin-bottom: 32px;
      }

      .dashboard-section-title {
        font-size: 16px;
        font-weight: 600;
        color: ${colors.text};
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .dashboard-card {
        background: ${colors.bgTertiary || colors.bgSecondary};
        border: 1px solid ${colors.border};
        border-radius: 12px;
        padding: 16px;
        transition: all 0.2s;
      }

      .dashboard-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .dashboard-card-label {
        font-size: 12px;
        color: ${colors.textSecondary};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .dashboard-card-value {
        font-size: 28px;
        font-weight: 700;
        color: ${colors.text};
        margin-bottom: 4px;
      }

      .dashboard-card-subtitle {
        font-size: 13px;
        color: ${colors.textSecondary};
      }

      .dashboard-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }

      .dashboard-stat-item {
        background: ${colors.bgTertiary || colors.bgSecondary};
        padding: 12px;
        border-radius: 8px;
        border-left: 3px solid ${colors.accent || '#3b82f6'};
      }

      .dashboard-stat-label {
        font-size: 11px;
        color: ${colors.textSecondary};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .dashboard-stat-value {
        font-size: 20px;
        font-weight: 700;
        color: ${colors.text};
      }

      .dashboard-languages {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .dashboard-language-tag {
        background: ${colors.bgTertiary || colors.bgSecondary};
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid ${colors.border};
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dashboard-language-count {
        background: ${colors.accent || '#3b82f6'};
        color: white;
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
      }

      .dashboard-metadata {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .dashboard-metadata-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .dashboard-metadata-label {
        color: ${colors.textSecondary};
        font-weight: 500;
      }

      .dashboard-metadata-value {
        color: ${colors.text};
      }
    `;
  },

  formatPercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  },

  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
};

/* ===========================
   Integration Export Modal
   =========================== */
/**
 * Modal for exporting to GitHub/Notion with progress tracking
 */
const IntegrationExportModal = {
  /**
   * Show export modal for a service
   * @param {'github'|'notion'} service
   * @param {Object} harvest
   * @param {ShadowRoot} parentShadow
   */
  async show(service, harvest, parentShadow) {
    // If modal is already open, don't create a new one (prevents duplicate modals)
    const existingModal = document.getElementById('capsula-integration-modal');
    if (existingModal) {
      console.log('[Capsula] Modal already open, ignoring duplicate show() call');
      return;
    }

    // Check if token exists
    const token = await IntegrationStorage.getToken(service);
    if (!token) {
      alert(`Please configure your ${service} token in Settings first.`);
      return;
    }

    // Request host permissions if needed
    const hasPermission = await this.requestPermissions(service);
    if (!hasPermission) {
      // Permission modal already shown by requestPermissions()
      return;
    }

    // Create and show modal
    // Append to document.body instead of parentShadow to avoid being destroyed
    // when ExportPanel content updates
    const modal = this.createModal(service, harvest);
    document.body.appendChild(modal);

    // Show simple tutorial (always shows for testing)
    this.showSimpleTutorial(service, modal);
  },

  /**
   * Show a simple tutorial tooltip
   */
  showSimpleTutorial(service, modalHost) {
    console.log('[Capsula Tutorial] Starting tutorial for:', service);

    // Wait for modal to render
    setTimeout(() => {
      const shadow = modalHost.shadowRoot;
      if (!shadow) {
        console.error('[Capsula Tutorial] No shadow root found');
        return;
      }

      const modalContainer = shadow.querySelector('.modal-container');
      if (!modalContainer) {
        console.error('[Capsula Tutorial] No modal-container found');
        return;
      }

      console.log('[Capsula Tutorial] Modal container found, creating tutorial');

      // Create tutorial element
      const tutorial = document.createElement('div');
      tutorial.id = 'capsula-simple-tutorial';
      tutorial.style.cssText = `
        position: fixed;
        background: #1e40af;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      `;

      const title = service === 'github' ? 'GitHub Export' : 'Notion Export';
      const steps = service === 'github'
        ? '1. Fill in filename and description<br>2. Click "Create Gist"'
        : '1. Enter page title<br>2. Select parent page<br>3. Click "Create Page"';

      tutorial.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 15px;">📚 ${title}</div>
        <div style="margin-bottom: 12px;">${steps}</div>
        <button id="tutorial-close" style="
          background: white;
          color: #1e40af;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
        ">Got it!</button>
      `;

      // Position tutorial
      const rect = modalContainer.getBoundingClientRect();
      tutorial.style.top = `${rect.bottom + 16}px`;
      tutorial.style.left = `${rect.left + (rect.width / 2) - 160}px`;

      console.log('[Capsula Tutorial] Positioning at:', tutorial.style.top, tutorial.style.left);

      // Add close handler
      document.body.appendChild(tutorial);
      console.log('[Capsula Tutorial] Tutorial appended to body');

      const closeBtn = tutorial.querySelector('#tutorial-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          console.log('[Capsula Tutorial] Close button clicked');
          tutorial.remove();
        });
      }
    }, 350); // Wait for modal animation
  },

  /**
   * Request optional host permissions via background broker
   * @private
   */
  async requestPermissions(service) {
    const url = service === 'github'
      ? 'https://api.github.com/*'
      : 'https://api.notion.com/*';

    try {
      // Check if permission already granted
      const checkResponse = await browser.runtime.sendMessage({
        type: 'PERMISSIONS_CHECK',
        origins: [url]
      });

      if (checkResponse.ok && checkResponse.data) {
        return true; // Already granted
      }

      // Request permission
      const requestResponse = await browser.runtime.sendMessage({
        type: 'PERMISSIONS_REQUEST',
        origins: [url]
      });

      if (requestResponse.ok) {
        return true;
      }

      // Permission request failed - show detailed instructions
      this.showPermissionInstructions(service);
      return false;
    } catch (err) {
      console.error('[Capsula] Permission request failed:', err);
      this.showPermissionInstructions(service);
      return false;
    }
  },

  /**
   * Show detailed permission setup instructions
   * @private
   */
  showPermissionInstructions(service) {
    const serviceName = service === 'github' ? 'GitHub' : 'Notion';
    const apiHost = service === 'github' ? 'api.github.com' : 'api.notion.com';

    // Create instruction modal
    const host = document.createElement('div');
    host.id = 'capsula-permission-modal';
    host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; display: flex; align-items: center; justify-content: center;';

    const shadow = host.attachShadow({ mode: 'open' });
    const colors = ThemeUtils.getColors();

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        .modal {
          position: relative;
          background: ${colors.bg};
          color: ${colors.text};
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          max-height: 80vh;
          overflow-y: auto;
        }
        h2 {
          font-size: 20px;
          margin-bottom: 16px;
          color: ${colors.text};
        }
        p {
          margin-bottom: 12px;
          line-height: 1.5;
          color: ${colors.text};
          opacity: 0.9;
        }
        .steps {
          background: ${colors.hover};
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }
        .step {
          margin-bottom: 12px;
          padding-left: 8px;
        }
        .step:last-child {
          margin-bottom: 0;
        }
        .step strong {
          color: ${colors.text};
        }
        .button-container {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 10px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        button:hover {
          opacity: 0.8;
        }
        .primary-btn {
          background: #3b82f6;
          color: white;
        }
        .secondary-btn {
          background: ${colors.hover};
          color: ${colors.text};
        }
        .code {
          background: ${colors.hover};
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
        }
        .warning {
          color: #f59e0b;
          font-weight: 500;
          margin-bottom: 16px;
        }
      </style>
      <div class="backdrop"></div>
      <div class="modal">
        <h2>⚠️ Permission Required</h2>
        <p class="warning">Capsula needs permission to access ${serviceName} API (${apiHost})</p>
        <p>To export to ${serviceName}, you need to grant permission. If the browser prompt didn't appear or you dismissed it, you can enable it manually:</p>

        <div class="steps">
          <div class="step"><strong>1.</strong> Right-click the Capsula icon in your browser toolbar</div>
          <div class="step"><strong>2.</strong> Select <span class="code">Manage Extension</span></div>
          <div class="step"><strong>3.</strong> Click the <span class="code">Permissions</span> tab</div>
          <div class="step"><strong>4.</strong> Toggle ON permission for <span class="code">${apiHost}</span></div>
          <div class="step"><strong>5.</strong> Return to this page and try exporting again</div>
        </div>

        <p style="font-size: 13px; opacity: 0.7; margin-top: 16px;">
          <strong>Why is this needed?</strong> Capsula needs permission to send your conversation to ${serviceName}'s servers. All requests are made directly from your browser with no intermediaries.
        </p>

        <div class="button-container">
          <button class="secondary-btn" data-action="close">Close</button>
          <button class="primary-btn" data-action="retry">Try Again</button>
        </div>
      </div>
    `;

    const closeModal = () => host.remove();

    shadow.querySelector('[data-action="close"]').addEventListener('click', closeModal);
    shadow.querySelector('[data-action="retry"]').addEventListener('click', async () => {
      closeModal();
      // Retry the permission request
      const hasPermission = await this.requestPermissions(service);
      if (hasPermission) {
        // Retry showing the export modal
        const existingExportModal = document.getElementById('capsula-integration-modal');
        if (!existingExportModal) {
          alert(`Permission granted! Please click the ${serviceName} button again to export.`);
        }
      }
    });
    shadow.querySelector('.backdrop').addEventListener('click', closeModal);

    document.body.appendChild(host);
  },

  /**
   * Create modal element
   * @private
   */
  createModal(service, harvest) {
    const host = document.createElement('div');
    host.id = 'capsula-integration-modal';
    host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; display: flex; align-items: center; justify-content: center;';

    const shadow = host.attachShadow({ mode: 'open' });
    const colors = ThemeUtils.getColors();

    shadow.innerHTML = `
      <style>
        ${this.getStyles(colors)}
      </style>
      <div class="modal-backdrop"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h3>Export to ${service === 'github' ? 'GitHub' : 'Notion'}</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          ${service === 'github' ? this.getGitHubForm(harvest) : this.getNotionForm(harvest)}
        </div>
        <div class="modal-footer">
          <div class="progress-container" style="display: none;">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-text"></div>
          </div>
          <div class="action-buttons">
            <button class="secondary-btn modal-cancel">Cancel</button>
            <button class="export-btn modal-submit">Create ${service === 'github' ? 'Gist' : 'Page'}</button>
          </div>
        </div>
      </div>
    `;

    this.attachModalHandlers(shadow, host, service, harvest);
    return host;
  },

  /**
   * Get GitHub form HTML
   * @private
   */
  getGitHubForm(harvest) {
    const defaultTitle = (harvest.meta?.title || 'conversation').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const date = new Date().toISOString().split('T')[0];

    return `
      <div class="form-group">
        <label>Gist Filename:</label>
        <input type="text" class="form-input" data-field="filename" value="${defaultTitle}-${date}.md" placeholder="conversation.md">
      </div>

      <div class="form-group">
        <label>Description (optional):</label>
        <input type="text" class="form-input" data-field="description" value="Capsula export: ${harvest.meta?.title || 'Conversation'}" placeholder="Brief description...">
      </div>

      <div class="form-group">
        <label>
          <input type="radio" name="visibility" value="private" checked>
          Private (only you can see it)
        </label>
        <label>
          <input type="radio" name="visibility" value="public">
          Public (anyone with the link can see it)
        </label>
      </div>

      <div class="form-group">
        <details class="advanced-options">
          <summary>Advanced Options</summary>
          <label>
            <input type="checkbox" data-field="create-issue">
            Create as GitHub Issue instead (requires repository)
          </label>
          <div class="issue-options" style="display: none; margin-top: 10px;">
            <input type="text" class="form-input" data-field="repo" placeholder="owner/repository">
            <small>Repository in format: owner/repo</small>
          </div>
        </details>
      </div>
    `;
  },

  /**
   * Get Notion form HTML
   * @private
   */
  getNotionForm(harvest) {
    return `
      <div class="form-group">
        <label>Page Title:</label>
        <input type="text" class="form-input" data-field="title" value="${harvest.meta?.title || 'ChatGPT Conversation'}" placeholder="Page title...">
      </div>

      <div class="form-group">
        <label>Parent Page:</label>
        <button class="secondary-btn" data-action="select-parent">Select Parent Page...</button>
        <div class="selected-parent" style="display: none; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          <strong>Selected:</strong> <span class="parent-name"></span>
        </div>
        <input type="hidden" data-field="parent-id">
        <input type="hidden" data-field="parent-type">
      </div>

      <div class="page-list" style="display: none; max-height: 200px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 8px; margin-top: 8px;">
        <!-- Pages will be loaded here -->
      </div>
    `;
  },

  /**
   * Attach modal event handlers
   * @private
   */
  attachModalHandlers(shadow, host, service, harvest) {
    const closeBtn = shadow.querySelector('.modal-close');
    const cancelBtn = shadow.querySelector('.modal-cancel');
    const submitBtn = shadow.querySelector('.modal-submit');
    const backdrop = shadow.querySelector('.modal-backdrop');
    const modalContainer = shadow.querySelector('.modal-container');

    const close = () => host.remove();

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);

    // Prevent keyboard events from bubbling out of modal to avoid interference
    // with global keyboard shortcuts or ChatGPT's event handlers
    if (modalContainer) {
      modalContainer.addEventListener('keydown', (e) => {
        e.stopPropagation();
      }, true);

      modalContainer.addEventListener('keyup', (e) => {
        e.stopPropagation();
      }, true);

      modalContainer.addEventListener('keypress', (e) => {
        e.stopPropagation();
      }, true);
    }

    // GitHub-specific handlers
    if (service === 'github') {
      const issueCheckbox = shadow.querySelector('[data-field="create-issue"]');
      const issueOptions = shadow.querySelector('.issue-options');

      issueCheckbox?.addEventListener('change', (e) => {
        if (issueOptions) {
          issueOptions.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }

    // Notion-specific handlers
    if (service === 'notion') {
      const selectParentBtn = shadow.querySelector('[data-action="select-parent"]');
      const pageList = shadow.querySelector('.page-list');

      selectParentBtn?.addEventListener('click', async () => {
        pageList.style.display = 'block';
        pageList.innerHTML = '<div style="text-align: center; padding: 20px;">Loading pages...</div>';

        const result = await NotionExporter.searchPages('');

        if (result.ok && result.pages) {
          if (result.pages.length === 0) {
            pageList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No pages found. Make sure you\'ve shared a page with your integration.</div>';
          } else {
            pageList.innerHTML = result.pages.map(page => {
              const title = page.properties?.title?.title?.[0]?.plain_text ||
                            page.properties?.Name?.title?.[0]?.plain_text ||
                            'Untitled';
              return `
                <div class="page-item" data-page-id="${page.id}" data-page-type="${page.object === 'database' ? 'database' : 'page'}" style="padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 4px;">
                  ${page.object === 'database' ? '🗂️' : '📄'} ${title}
                </div>
              `;
            }).join('');

            // Add click handlers to page items
            pageList.querySelectorAll('.page-item').forEach(item => {
              item.addEventListener('click', () => {
                const pageId = item.dataset.pageId;
                const pageType = item.dataset.pageType;
                const pageName = item.textContent.trim();

                shadow.querySelector('[data-field="parent-id"]').value = pageId;
                shadow.querySelector('[data-field="parent-type"]').value = pageType;
                shadow.querySelector('.parent-name').textContent = pageName;
                shadow.querySelector('.selected-parent').style.display = 'block';
                pageList.style.display = 'none';
              });
            });
          }
        } else {
          pageList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load pages: ${result.error?.message || 'Unknown error'}</div>`;
        }
      });
    }

    // Submit handler
    submitBtn?.addEventListener('click', async () => {
      await this.handleSubmit(shadow, submitBtn, service, harvest, host);
    });
  },

  /**
   * Handle form submission
   * @private
   */
  async handleSubmit(shadow, submitBtn, service, harvest, host) {
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Exporting...';

    // Show progress
    const progressContainer = shadow.querySelector('.progress-container');
    const actionButtons = shadow.querySelector('.action-buttons');
    progressContainer.style.display = 'block';
    actionButtons.style.display = 'none';

    try {
      if (service === 'github') {
        await this.handleGitHubExport(shadow, harvest, host);
      } else {
        await this.handleNotionExport(shadow, harvest, host);
      }
    } catch (err) {
      console.error('[Capsula] Export failed:', err);
      alert(`Export failed: ${err.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = `Create ${service === 'github' ? 'Gist' : 'Page'}`;
      progressContainer.style.display = 'none';
      actionButtons.style.display = 'flex';
    }
  },

  /**
   * Handle GitHub export
   * @private
   */
  async handleGitHubExport(shadow, harvest, host) {
    const visibility = shadow.querySelector('input[name="visibility"]:checked')?.value || 'private';
    const description = shadow.querySelector('[data-field="description"]')?.value || '';
    const createIssue = shadow.querySelector('[data-field="create-issue"]')?.checked || false;
    const repo = shadow.querySelector('[data-field="repo"]')?.value || '';

    const options = {
      visibility,
      description,
      createIssue,
      repo,
      onProgress: (progress) => {
        this.updateProgress(shadow, progress);
      }
    };

    // Apply message filtering (range selection + content filters)
    const filteredMessages = MessageFilter.apply(harvest.messages);
    const filteredHarvest = {
      ...harvest,
      messages: filteredMessages
    };

    const exporter = ExporterRegistry.get('github-gist');
    const result = await exporter.export(filteredHarvest, globalState.filters, options);

    if (result.ok) {
      this.showSuccess(shadow, result.url);
      // Copy URL to clipboard
      await navigator.clipboard.writeText(result.url);
      NotificationManager.showToast('Gist created and URL copied to clipboard!');
      setTimeout(() => host.remove(), 3000);
    } else {
      throw new Error(result.error.message);
    }
  },

  /**
   * Handle Notion export
   * @private
   */
  async handleNotionExport(shadow, harvest, host) {
    const title = shadow.querySelector('[data-field="title"]')?.value || harvest.meta?.title || 'Conversation';
    const parentId = shadow.querySelector('[data-field="parent-id"]')?.value;
    const parentType = shadow.querySelector('[data-field="parent-type"]')?.value;

    if (!parentId) {
      throw new Error('Please select a parent page');
    }

    const options = {
      title,
      parentId,
      parentType,
      onProgress: (progress) => {
        this.updateProgress(shadow, progress);
      }
    };

    // Apply message filtering (range selection + content filters)
    const filteredMessages = MessageFilter.apply(harvest.messages);
    const filteredHarvest = {
      ...harvest,
      messages: filteredMessages
    };

    const exporter = ExporterRegistry.get('notion');
    const result = await exporter.export(filteredHarvest, globalState.filters, options);

    if (result.ok) {
      this.showSuccess(shadow, result.url);
      // Copy URL to clipboard
      await navigator.clipboard.writeText(result.url);
      NotificationManager.showToast('Notion page created and URL copied to clipboard!');
      setTimeout(() => host.remove(), 3000);
    } else {
      throw new Error(result.error.message);
    }
  },

  /**
   * Update progress bar
   * @private
   */
  updateProgress(shadow, progress) {
    const progressFill = shadow.querySelector('.progress-fill');
    const progressText = shadow.querySelector('.progress-text');

    if (progressText) {
      progressText.textContent = progress.message || '';
    }

    // Calculate progress percentage
    let percentage = 0;
    if (progress.step === 'PREPARING') percentage = 10;
    else if (progress.step === 'VALIDATING') percentage = 20;
    else if (progress.step.startsWith('UPLOADING')) {
      // Parse "UPLOADING_X_OF_Y"
      const match = progress.step.match(/UPLOADING_(\d+)_OF_(\d+)/);
      if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);
        percentage = 20 + ((current / total) * 70);
      } else {
        percentage = 50;
      }
    }
    else if (progress.step === 'FINALIZING') percentage = 95;
    else if (progress.step === 'SUCCESS') percentage = 100;

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
  },

  /**
   * Show success message
   * @private
   */
  showSuccess(shadow, url) {
    const progressText = shadow.querySelector('.progress-text');
    if (progressText) {
      progressText.innerHTML = `
        <div style="color: #10b981; font-weight: bold; margin-bottom: 8px;">✓ Success!</div>
        <a href="${url}" target="_blank" rel="noopener" style="color: #3b82f6; text-decoration: underline;">${url}</a>
        <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">URL copied to clipboard</div>
      `;
    }
  },

  /**
   * Get modal styles
   * @private
   */
  getStyles(colors) {
    return `
      * { box-sizing: border-box; }

      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .modal-container {
        position: relative;
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        border-bottom: 1px solid ${colors.border};
      }

      .modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 28px;
        color: ${colors.textSecondary};
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .modal-close:hover {
        background: ${colors.hover};
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .form-group {
        margin-bottom: 16px;
      }

      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        font-size: 14px;
      }

      .form-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid ${colors.border};
        border-radius: 6px;
        background: ${colors.bgSecondary};
        color: ${colors.text};
        font-size: 14px;
        font-family: inherit;
      }

      .form-input:focus {
        outline: none;
        border-color: ${colors.accentPrimary};
      }

      .form-group label input[type="radio"] {
        margin-right: 8px;
      }

      .advanced-options summary {
        cursor: pointer;
        font-weight: 500;
        padding: 8px 0;
      }

      .page-item:hover {
        background: ${colors.hover};
      }

      .modal-footer {
        padding: 20px;
        border-top: 1px solid ${colors.border};
      }

      .action-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .secondary-btn, .export-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
      }

      .secondary-btn {
        background: transparent;
        border: 1px solid ${colors.border};
        color: ${colors.text};
      }

      .secondary-btn:hover {
        background: ${colors.hover};
      }

      .export-btn {
        background: ${colors.accentPrimary};
        border: none;
        color: white;
      }

      .export-btn:hover {
        opacity: 0.9;
      }

      .export-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .progress-container {
        margin-bottom: 16px;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: ${colors.hover};
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-fill {
        height: 100%;
        background: ${colors.accentPrimary};
        transition: width 0.3s ease;
        width: 0%;
      }

      .progress-text {
        font-size: 14px;
        color: ${colors.textSecondary};
        text-align: center;
      }

      small {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: ${colors.textSecondary};
      }
    `;
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
      } else if (mode === 'dashboard') {
        this.attachDashboardHandlers(shadow, harvest);
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
    const viewMode = globalState.viewMode;

    ChatRenderer.destroy();

    let content = '';
    if (viewMode === 'settings') {
      content = SettingsPanel.render();
    } else if (viewMode === 'dashboard') {
      content = DashboardView.render(harvest);
    } else {
      content = this.getMainContent();
    }

    shadow.innerHTML = `
      <style>
        ${this.getStyles(colors, effectiveColors, chatFont)}
        ${SettingsStyles.get(colors)}
        ${DashboardView.getStyles(colors)}
      </style>

      <div class="backdrop" role="presentation"></div>
      <div class="panel" role="dialog" aria-label="Export ChatGPT Conversation" aria-modal="true">
        ${content}
      </div>
    `;

    if (viewMode === 'main') {
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
        <button class="dashboard-btn" aria-label="Dashboard" title="View Dashboard">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
          </svg>
        </button>
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

        <button class="integration-btn github-btn" data-action="export-github" title="Export to GitHub Gist">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          🔧 TEST BUILD - GitHub
        </button>

        <button class="integration-btn notion-btn" data-action="export-notion" title="Export to Notion">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 1a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V3a2 2 0 00-2-2H3zm1.5 3h7a.5.5 0 010 1h-7a.5.5 0 010-1zm0 3h7a.5.5 0 010 1h-7a.5.5 0 010-1zm0 3h4a.5.5 0 010 1h-4a.5.5 0 010-1z"/>
          </svg>
          Notion
        </button>

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
      
      .dashboard-btn {
        position: absolute;
        right: 100px;
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

      .dashboard-btn:hover {
        background: ${colors.bgTertiary};
        transform: scale(1.05);
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

      /* Preserve alignment even when excluded/collapsed */
      .message.user.excluded,
      .message.user.collapsed {
        justify-content: flex-end;
      }

      .message.assistant.excluded,
      .message.assistant.collapsed {
        justify-content: flex-start;
      }

      /* Excluded message styles */
      .message.excluded {
        opacity: 0.5;
        position: relative;
        transition: opacity 0.2s ease;
        flex-direction: column; /* Allow ::after to be below content */
        align-items: stretch; /* Reset alignment for column direction */
      }

      .message.excluded:hover {
        opacity: 0.7;
      }

      .message.excluded::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(128, 128, 128, 0.05) 10px,
          rgba(128, 128, 128, 0.05) 20px
        );
        pointer-events: none;
        z-index: 1;
      }

      .message.excluded .bubble {
        filter: grayscale(0.4);
      }

      /* Wrapper for content to maintain flex alignment in excluded messages */
      .message.excluded .thinking-container {
        align-self: flex-start; /* Default to left for assistant */
      }

      .message.user.excluded .thinking-container {
        align-self: flex-end; /* Keep user messages on right */
      }

      /* Collapsed message styles */
      .message.collapsed .thinking-container {
        max-height: 60px;
        overflow: hidden;
        position: relative;
      }

      .message.collapsed .bubble {
        max-height: 60px;
        overflow: hidden;
        position: relative;
      }

      /* Expand/collapse hints positioned correctly for each role */
      .message.collapsed::after {
        content: '▶ Click to expand';
        display: block;
        font-size: 11px;
        color: ${colors.accentPrimary};
        margin-top: 4px;
        font-weight: 500;
        padding: 0 8px;
      }

      .message.user.collapsed::after {
        text-align: right;
        align-self: flex-end;
      }

      .message.assistant.collapsed::after {
        text-align: left;
        align-self: flex-start;
      }

      .message.collapsed:not(.excluded)::after {
        content: '';
      }

      .message.excluded:not(.collapsed)::after {
        content: '▼ Click to collapse';
        display: block;
        font-size: 11px;
        color: ${colors.accentPrimary};
        margin-top: 4px;
        font-weight: 500;
        padding: 0 8px;
      }

      .message.user.excluded:not(.collapsed)::after {
        text-align: right;
        align-self: flex-end;
      }

      .message.assistant.excluded:not(.collapsed)::after {
        text-align: left;
        align-self: flex-start;
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
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: ${colors.textSecondary};
        margin-bottom: 4px;
        font-weight: 500;
      }

      .message-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: ${colors.textSecondary};
        transition: all 0.2s ease;
        opacity: 0.7;
        flex-shrink: 0;
      }

      .message-toggle-btn:hover {
        opacity: 1;
        transform: scale(1.1);
      }

      .message-toggle-btn.selected {
        color: ${colors.accentSecondary};
        opacity: 1;
      }

      .message-toggle-btn svg {
        display: block;
      }

      .message-toggle-btn:focus-visible {
        outline: 2px solid ${colors.accentPrimary};
        outline-offset: 2px;
        border-radius: 2px;
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

      .integration-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: transparent;
        color: ${colors.text};
        border: 1px solid ${colors.border};
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: ${chatFont};
      }

      .integration-btn:hover {
        background: ${colors.hover};
        border-color: ${colors.accentPrimary};
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .github-btn:hover {
        background: #24292e;
        color: white;
        border-color: #24292e;
      }

      .notion-btn:hover {
        background: #000000;
        color: white;
        border-color: #000000;
      }

      .integration-btn svg {
        width: 16px;
        height: 16px;
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
    const dashboardBtn = shadow.querySelector('.dashboard-btn');
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

    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        globalState.setViewMode('dashboard');
      });
    }

    globalState.onSelectionChange = () => {
      ChatRenderer.refresh();
      const hasSelection = globalState.hasSelection();
      if (clearRangeBtn) {
        clearRangeBtn.style.display = hasSelection ? 'block' : 'none';
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
      globalState.clearSelection();
      Timeline.updateSelection(shadow.querySelector('.timeline-panel'));
    });

    exportBtn?.addEventListener('click', () => ExportManager.export(harvest));
    copyBtn?.addEventListener('click', () => ExportManager.copy(harvest));

    // Integration export buttons
    const githubBtn = shadow.querySelector('[data-action="export-github"]');
    const notionBtn = shadow.querySelector('[data-action="export-notion"]');

    githubBtn?.addEventListener('click', async () => {
      await IntegrationExportModal.show('github', harvest, shadow);
    });

    notionBtn?.addEventListener('click', async () => {
      await IntegrationExportModal.show('notion', harvest, shadow);
    });
  },

  attachDashboardHandlers(shadow, harvest) {
    const backdrop = shadow.querySelector('.backdrop');
    const backBtn = shadow.querySelector('.back-btn');
    const exportDashboardBtn = shadow.querySelector('[data-action="export-dashboard"]');

    backdrop?.addEventListener('click', () => PanelManager.close());

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        globalState.setViewMode('main');
      });
    }

    if (exportDashboardBtn) {
      exportDashboardBtn.addEventListener('click', () => {
        // Export the dashboard as HTML
        const content = DashboardGenerator.generate(harvest.messages, harvest.meta);
        const filename = ExportManager.generateFilename(harvest, 'dashboard');
        const mimeType = ExportManager.getMimeType('dashboard');

        Utils.downloadFile(filename, content, mimeType);
        NotificationManager.showToast('Dashboard exported successfully!');
      });
    }
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

      /* Integration Settings Styles */
      .setting-description {
        color: ${colors.textSecondary};
        font-size: 13px;
        margin-bottom: 16px;
      }

      .integration-section {
        margin-bottom: 24px;
        padding: 16px;
        border: 1px solid ${colors.border};
        border-radius: 8px;
        background: ${colors.bgSecondary};
      }

      .integration-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .integration-header h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: ${colors.text};
      }

      .integration-status {
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        background: ${colors.hover};
      }

      .token-input-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .integration-token-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid ${colors.border};
        background: ${colors.bg};
        color: ${colors.text};
        border-radius: 6px;
        font-size: 13px;
        font-family: monospace;
      }

      .setting-hint {
        display: block;
        margin-top: 6px;
        font-size: 12px;
        color: ${colors.textSecondary};
        line-height: 1.4;
      }

      .setting-hint a {
        color: ${colors.accentPrimary};
        text-decoration: none;
      }

      .setting-hint a:hover {
        text-decoration: underline;
      }

      .integration-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .integration-result {
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        background: ${colors.hover};
        font-size: 13px;
      }
    `;
  }
};

/* ===========================
   Message Filtering
   =========================== */
const MessageFilter = {
  apply(messages) {
    // Return all messages with metadata about whether they should be included
    return messages.map(msg => {
      let isIncluded = true;
      let filteredBlocks = msg.blocks;

      // Check selection filter
      if (!globalState.isSelected(msg.index)) {
        isIncluded = false;
      }

      // Check assistant-only filter
      if (isIncluded && globalState.filters.assistantOnly && msg.role !== 'assistant') {
        isIncluded = false;
      }

      // Check content filters
      const hasContentFilters = globalState.filters.code ||
                               globalState.filters.tables ||
                               globalState.filters.lists;

      if (isIncluded && hasContentFilters) {
        filteredBlocks = msg.blocks.filter(block => {
          if (globalState.filters.code && block.kind === 'code') return true;
          if (globalState.filters.tables && block.kind === 'table') return true;
          if (globalState.filters.lists && block.kind === 'list') return true;
          return false;
        });

        if (filteredBlocks.length === 0) {
          isIncluded = false;
        }
      }

      return {
        ...msg,
        blocks: filteredBlocks,
        isIncludedInExport: isIncluded,
        isCollapsed: !isIncluded // Auto-collapse excluded messages
      };
    });
  },

  // Get only messages that should be included in exports
  getExportMessages(messages) {
    let filtered = [...messages];

    // Selection filter
    if (globalState.hasSelection()) {
      filtered = filtered.filter(msg => globalState.isSelected(msg.index));
    }

    // Assistant-only filter
    if (globalState.filters.assistantOnly) {
      filtered = filtered.filter(msg => msg.role === 'assistant');
    }

    // Content filters
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

  // Bind requestAnimationFrame to window to preserve context
  const raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function(cb) { return setTimeout(cb, 16); };

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
      empty.textContent = 'No messages in conversation';
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
      const classes = ['message', msg.role];

      // Add classes for excluded and collapsed messages
      if (!msg.isIncludedInExport) {
        classes.push('excluded');
      }
      if (msg.isCollapsed) {
        classes.push('collapsed');
      }

      messageDiv.className = classes.join(' ');
      messageDiv.dataset.messageIndex = msg.index;

      // Add click handler for collapsible messages
      if (!msg.isIncludedInExport) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.title = 'Click to expand/collapse (excluded from export)';
        messageDiv.addEventListener('click', () => {
          messageDiv.classList.toggle('collapsed');
        });
      }

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

        thinkingContainer.appendChild(labelsWrapper);
      }

      if (hasBubbleContent) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';

        // Create role label container with toggle
        const roleLabelContent = document.createElement('span');
        roleLabelContent.textContent = msg.role === 'user' ? 'You' : 'ChatGPT';
        roleLabel.appendChild(roleLabelContent);

        // Add toggle checkbox
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'message-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-label', 'Toggle message in export');
        toggleBtn.title = globalState.isSelected(msg.index)
          ? 'Click to exclude from export'
          : 'Click to include in export';

        // Set visual state
        if (globalState.isSelected(msg.index)) {
          toggleBtn.classList.add('selected');
        }

        // Toggle icon (checkbox style)
        toggleBtn.innerHTML = globalState.isSelected(msg.index)
          ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect width="14" height="14" rx="2" fill="currentColor"/><path d="M4 7l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';

        // Click handler to toggle selection
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger message expand/collapse
          globalState.toggleSelection(msg.index);
          // Refresh will be triggered by onSelectionChange callback
        });

        roleLabel.appendChild(toggleBtn);

        // Add exclusion indicator
        if (!msg.isIncludedInExport) {
          const excludeIcon = document.createElement('span');
          excludeIcon.className = 'exclude-indicator';
          excludeIcon.textContent = '(Not in export)';
          excludeIcon.style.marginLeft = '8px';
          excludeIcon.style.fontSize = '0.85em';
          excludeIcon.style.opacity = '0.7';
          roleLabel.appendChild(excludeIcon);
        }

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
      empty.textContent = 'No messages in conversation';
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
   Integration Storage Module
   =========================== */
/**
 * Secure token storage via background broker.
 * Privacy-first: tokens handled by background script, never in page context.
 */
const IntegrationStorage = {
  /**
   * Get token for a service
   * @param {'github'|'notion'} service
   * @returns {Promise<string|null>}
   */
  async getToken(service) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_GET',
        service
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to get token:', response.error);
        return null;
      }

      return response.data || null;
    } catch (e) {
      console.error('[Capsula] Failed to get token:', e);
      return null;
    }
  },

  /**
   * Set token for a service
   * @param {'github'|'notion'} service
   * @param {string} token
   * @param {string} [passphrase] - Optional passphrase for encryption (reserved for future use)
   * @returns {Promise<boolean>}
   */
  async setToken(service, token, passphrase = null) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_SET',
        service,
        tokenPlain: token,
        tokenCiphertext: passphrase ? null : undefined // Reserved for encryption
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to set token:', response.error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[Capsula] Failed to set token:', e);
      return false;
    }
  },

  /**
   * Clear token for a service
   * @param {'github'|'notion'} service
   * @returns {Promise<boolean>}
   */
  async clearToken(service) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_CLEAR',
        service
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to clear token:', response.error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[Capsula] Failed to clear token:', e);
      return false;
    }
  },

  /**
   * Get configuration for a service (stored locally for non-sensitive data)
   * @param {'github'|'notion'} service
   * @returns {Promise<Object>}
   */
  async getConfig(service) {
    try {
      const key = `capsula_config_${service}`;
      const result = await browser.storage.local.get(key);
      return result[key] || {};
    } catch (e) {
      console.error('[Capsula] Failed to get config:', e);
      return {};
    }
  },

  /**
   * Set configuration for a service (stored locally for non-sensitive data)
   * @param {'github'|'notion'} service
   * @param {Object} config
   * @returns {Promise<boolean>}
   */
  async setConfig(service, config) {
    try {
      const key = `capsula_config_${service}`;
      await browser.storage.local.set({ [key]: config });
      return true;
    } catch (e) {
      console.error('[Capsula] Failed to set config:', e);
      return false;
    }
  }
};

/* ===========================
   HTTP Request Module
   =========================== */
/**
 * HTTP client with retry logic, rate limiting, and exponential backoff.
 * Handles GitHub and Notion API specifics.
 *
 * @typedef {Object} NormalizedError
 * @property {'AUTH'|'SCOPE'|'RATE_LIMIT'|'PAYLOAD_TOO_LARGE'|'NETWORK'|'VALIDATION'|'UNKNOWN'} code
 * @property {string} message
 * @property {string} [hint]
 * @property {*} [raw]
 */
/**
 * HttpClient - Proxy for all network requests via background broker
 *
 * All HTTP requests are routed through the background script to avoid CSP violations.
 * The background script handles retry logic, rate limiting, timeouts, and error normalization.
 */
const HttpClient = {
  TIMEOUT_MS: 30000,

  /**
   * Make HTTP request via background broker
   * @param {string} url - The URL to request
   * @param {Object} options - Request options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.headers={}] - Request headers
   * @param {Object} [options.body] - Request body (for POST/PATCH/PUT)
   * @param {number} [options.timeoutMs] - Custom timeout in ms
   * @returns {Promise<{ok: boolean, data?: any, headers?: Object, error?: NormalizedError}>}
   */
  async request(url, options = {}) {
    // Check if online (quick check before sending message)
    if (!navigator.onLine) {
      return {
        ok: false,
        error: {
          code: 'NETWORK',
          message: "You're offline",
          hint: 'Check your internet connection and try again.'
        }
      };
    }

    try {
      // Send request to background broker
      // Background handles: retries, rate limiting, timeouts, error normalization
      const response = await browser.runtime.sendMessage({
        type: 'HTTP_JSON',
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        timeoutMs: options.timeoutMs || this.TIMEOUT_MS
      });

      return response;

    } catch (err) {
      // Handle message passing errors (e.g., background script not responding)
      console.error('[Capsula] Failed to send request to background broker:', err);
      return {
        ok: false,
        error: {
          code: 'NETWORK',
          message: 'Failed to communicate with background script',
          hint: 'Please reload the extension and try again.',
          raw: err
        }
      };
    }
  }
};

/* ===========================
   Exporter Types & Registry
   =========================== */
/**
 * @typedef {Object} ExportFilters
 * @property {boolean} assistantOnly
 * @property {boolean} code
 * @property {boolean} tables
 * @property {boolean} lists
 */

/**
 * @typedef {Object} ExportResult
 * @property {boolean} ok
 * @property {string} [url]
 * @property {NormalizedError} [error]
 */

/**
 * @typedef {Object} Exporter
 * @property {function(): Promise<{ok: boolean, identity?: string, scopes?: string[], error?: string}>} testConnection
 * @property {function(Object, ExportFilters, Object): Promise<ExportResult>} export
 */

const ExporterRegistry = {
  _exporters: new Map(),

  /**
   * Register an exporter
   * @param {'github-gist'|'github-issue'|'notion'} service
   * @param {Exporter} exporter
   */
  register(service, exporter) {
    this._exporters.set(service, exporter);
  },

  /**
   * Get an exporter
   * @param {string} service
   * @returns {Exporter|null}
   */
  get(service) {
    return this._exporters.get(service) || null;
  },

  /**
   * Check if a service is registered
   * @param {string} service
   * @returns {boolean}
   */
  has(service) {
    return this._exporters.has(service);
  }
};

/* ===========================
   Integration Markdown Formatter
   =========================== */
/**
 * Enhanced markdown formatter for GitHub and Notion exports.
 * Handles large conversations with intelligent splitting.
 */
const IntegrationMarkdownFormatter = {
  GITHUB_MAX_GIST_SIZE: 1_000_000, // 1MB
  SPLIT_MARKER: '\n\n---\n\n',

  /**
   * Convert harvest to markdown with optional splitting for GitHub
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {boolean} [enableSplitting=false]
   * @returns {string|Object} - String if single file, Object with filenames as keys if split
   */
  toMarkdown(harvest, filters, enableSplitting = false) {
    const messages = this._filterMessages(harvest.messages, filters);
    const meta = harvest.meta || {};

    // Build header
    let markdown = this._buildHeader(meta, filters);

    // Build content
    const content = messages.map((msg, idx) => this._formatMessage(msg, idx)).join('\n\n');
    markdown += content;

    // Build footer with index
    markdown += this._buildFooter(messages);

    // Handle splitting if enabled
    if (enableSplitting && markdown.length > this.GITHUB_MAX_GIST_SIZE) {
      return this._splitMarkdown(markdown, meta.title || 'conversation');
    }

    return markdown;
  },

  /**
   * Build markdown header
   * @private
   */
  _buildHeader(meta, filters) {
    const title = meta.title || 'ChatGPT Conversation';
    const timestamp = new Date().toISOString();
    const model = meta.model || 'Unknown';

    let header = `# ${title}\n\n`;
    header += `_Exported with [Capsula](https://seveneves.ai/capsula) on ${timestamp}_\n\n`;
    header += `**Model**: ${model}\n\n`;

    // Show active filters
    const activeFilters = [];
    if (filters.assistantOnly) activeFilters.push('Assistant Only');
    if (filters.code) activeFilters.push('Code');
    if (filters.tables) activeFilters.push('Tables');
    if (filters.lists) activeFilters.push('Lists');

    if (activeFilters.length > 0) {
      header += `**Active Filters**: ${activeFilters.join(', ')}\n\n`;
    }

    header += '---\n\n';
    return header;
  },

  /**
   * Format a single message as markdown
   * @private
   */
  _formatMessage(message, index) {
    const role = message.role === 'user' ? 'User' : 'Assistant';
    let md = `## Message ${index + 1}: ${role}\n\n`;

    // Add thinking label if present
    if (message.thinking?.labels?.length) {
      md += `_${message.thinking.labels.join(', ')}_\n\n`;
    }

    // Add canvas marker
    if (message.isCanvas) {
      md += `📋 **Canvas**: ${message.canvasTitle || 'Untitled'} (${message.canvasType || 'document'})\n\n`;
    }

    // Add attachment marker
    if (message.hasAttachment && message.attachment) {
      md += `📎 **Attachment**: ${message.attachment.fileName}\n\n`;
    }

    // Format blocks
    if (message.blocks && message.blocks.length > 0) {
      md += message.blocks.map(block => this._formatBlock(block)).join('\n\n');
    } else if (message.plain?.text) {
      md += message.plain.text;
    }

    return md;
  },

  /**
   * Format a content block as markdown
   * @private
   */
  _formatBlock(block) {
    switch (block.kind) {
      case 'heading':
        const level = Math.min(6, Math.max(1, (block.level || 1) + 2)); // Offset by 2 since message is h2
        return `${'#'.repeat(level)} ${block.text || ''}`;

      case 'para':
        return block.md || '';

      case 'code':
        const lang = block.language || '';
        return `\`\`\`${lang}\n${block.text || ''}\n\`\`\``;

      case 'list':
        const items = (block.items || []).map((item, i) => {
          const prefix = block.ordered ? `${i + 1}. ` : '- ';
          return `${prefix}${item}`;
        }).join('\n');
        return items;

      case 'table':
        // Return HTML table as-is (markdown tables are complex)
        return block.html || '';

      case 'quote':
        return `> ${block.md || ''}`;

      case 'math':
        return `$$\n${block.latex || ''}\n$$`;

      case 'divider':
        return '---';

      default:
        return '';
    }
  },

  /**
   * Build footer with message index
   * @private
   */
  _buildFooter(messages) {
    let footer = '\n\n---\n\n## Message Index\n\n';
    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const preview = this._getMessagePreview(msg);
      footer += `- [Message ${idx + 1}](#message-${idx + 1}-${role.toLowerCase()}): ${role} - ${preview}\n`;
    });
    return footer;
  },

  /**
   * Get short preview of message content
   * @private
   */
  _getMessagePreview(message) {
    if (message.plain?.text) {
      return message.plain.text.slice(0, 60).replace(/\n/g, ' ') + '...';
    }
    if (message.blocks?.length) {
      const firstBlock = message.blocks[0];
      if (firstBlock.text) return firstBlock.text.slice(0, 60) + '...';
      if (firstBlock.md) return firstBlock.md.slice(0, 60) + '...';
    }
    return '(empty)';
  },

  /**
   * Split markdown into multiple files if too large
   * @private
   * @returns {Object} - { 'filename.md': content, ... }
   */
  _splitMarkdown(markdown, title) {
    const baseName = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const files = {};
    const maxSize = this.GITHUB_MAX_GIST_SIZE - 10000; // Leave buffer

    // Split by messages (using ## Message pattern)
    const parts = markdown.split(/(?=^## Message \d+)/m);
    const header = parts[0];
    const messages = parts.slice(1);

    let currentPart = 1;
    let currentContent = header;

    messages.forEach((msg, idx) => {
      if (currentContent.length + msg.length > maxSize) {
        // Save current part
        files[`${baseName}-part-${String(currentPart).padStart(3, '0')}.md`] = currentContent;
        currentPart++;
        currentContent = header + `\n\n_Continued from part ${currentPart - 1}_\n\n`;
      }
      currentContent += msg + '\n\n';
    });

    // Save final part
    files[`${baseName}-part-${String(currentPart).padStart(3, '0')}.md`] = currentContent;

    // Create index file
    const indexContent = this._buildSplitIndex(baseName, title, Object.keys(files));
    files[`${baseName}-index.md`] = indexContent;

    return files;
  },

  /**
   * Build index file for split conversations
   * @private
   */
  _buildSplitIndex(baseName, title, filenames) {
    let index = `# ${title}\n\n`;
    index += `_This conversation was split into multiple files due to size._\n\n`;
    index += `## Parts\n\n`;
    filenames.forEach((filename, idx) => {
      if (!filename.includes('index')) {
        index += `${idx + 1}. [${filename}](./${filename})\n`;
      }
    });
    return index;
  },

  /**
   * Filter messages based on filters and selection
   * @private
   */
  _filterMessages(messages, filters) {
    // Use MessageFilter.getExportMessages to respect selection
    return MessageFilter.getExportMessages(messages);
  },

  /**
   * Old filter logic preserved for reference (now handled by MessageFilter.getExportMessages)
   * @private
   * @deprecated
   */
  _filterMessagesLegacy(messages, filters) {
    let filtered = [...messages];

    if (filters.assistantOnly) {
      filtered = filtered.filter(m => m.role === 'assistant');
    }

    if (filters.code) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'code')
      );
    }

    if (filters.tables) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'table')
      );
    }

    if (filters.lists) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'list')
      );
    }

    return filtered;
  }
};

/* ===========================
   Notion Blocks Converter
   =========================== */
/**
 * Converts Capsula message format to Notion blocks API format.
 * Handles chunking for large content (max 1800 chars per block).
 */
const NotionBlocksConverter = {
  MAX_CHARS_PER_BLOCK: 1800,
  MAX_BLOCKS_PER_REQUEST: 100,

  /**
   * Convert harvest to Notion blocks
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @returns {Array} - Array of Notion block objects
   */
  toBlocks(harvest, filters) {
    const messages = IntegrationMarkdownFormatter._filterMessages(harvest.messages, filters);
    const blocks = [];

    // Add title and metadata as initial blocks
    blocks.push(...this._buildHeaderBlocks(harvest.meta, filters));

    // Convert each message to blocks
    messages.forEach((msg, idx) => {
      blocks.push(...this._messageToBlocks(msg, idx));
    });

    return blocks;
  },

  /**
   * Build header blocks for Notion page
   * @private
   */
  _buildHeaderBlocks(meta, filters) {
    const blocks = [];
    const timestamp = new Date().toISOString().split('T')[0];

    // Metadata paragraph
    let metaText = `Exported with Capsula on ${timestamp}`;
    if (meta.model) metaText += ` • Model: ${meta.model}`;

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: metaText },
          annotations: { italic: true, color: 'gray' }
        }]
      }
    });

    // Active filters (if any)
    const activeFilters = [];
    if (filters.assistantOnly) activeFilters.push('Assistant Only');
    if (filters.code) activeFilters.push('Code');
    if (filters.tables) activeFilters.push('Tables');
    if (filters.lists) activeFilters.push('Lists');

    if (activeFilters.length > 0) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Active Filters: ${activeFilters.join(', ')}` }
          }],
          icon: { emoji: '🔍' }
        }
      });
    }

    // Divider
    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });

    return blocks;
  },

  /**
   * Convert a single message to Notion blocks
   * @private
   */
  _messageToBlocks(message, index) {
    const blocks = [];
    const role = message.role === 'user' ? 'User' : 'Assistant';
    const emoji = message.role === 'user' ? '👤' : '🤖';

    // Message header as heading
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{
          type: 'text',
          text: { content: `${emoji} Message ${index + 1}: ${role}` },
          annotations: { bold: true }
        }]
      }
    });

    // Thinking label (if present)
    if (message.thinking?.labels?.length) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: message.thinking.labels.join(', ') },
            annotations: { italic: true, color: 'gray' }
          }]
        }
      });
    }

    // Canvas marker
    if (message.isCanvas) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Canvas: ${message.canvasTitle || 'Untitled'} (${message.canvasType || 'document'})` }
          }],
          icon: { emoji: '📋' }
        }
      });
    }

    // Attachment marker
    if (message.hasAttachment && message.attachment) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Attachment: ${message.attachment.fileName}` }
          }],
          icon: { emoji: '📎' }
        }
      });
    }

    // Convert message blocks
    if (message.blocks && message.blocks.length > 0) {
      message.blocks.forEach(block => {
        blocks.push(...this._blockToNotionBlocks(block));
      });
    } else if (message.plain?.text) {
      blocks.push(...this._textToParagraphBlocks(message.plain.text));
    }

    return blocks;
  },

  /**
   * Convert a content block to Notion blocks
   * @private
   */
  _blockToNotionBlocks(block) {
    switch (block.kind) {
      case 'heading':
        const level = Math.min(3, Math.max(1, (block.level || 1)));
        const headingType = `heading_${level}`;
        return [{
          object: 'block',
          type: headingType,
          [headingType]: {
            rich_text: this._chunkText(block.text || '', this.MAX_CHARS_PER_BLOCK)
          }
        }];

      case 'para':
        return this._textToParagraphBlocks(block.md || '');

      case 'code':
        return this._codeToBlocks(block.text || '', block.language);

      case 'list':
        return this._listToBlocks(block.items || [], block.ordered);

      case 'quote':
        return [{
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: this._chunkText(block.md || '', this.MAX_CHARS_PER_BLOCK)
          }
        }];

      case 'table':
        // Tables are complex in Notion - render as toggle with HTML
        return [{
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ type: 'text', text: { content: 'Table (HTML)' } }],
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: this._chunkText(block.html || '', this.MAX_CHARS_PER_BLOCK)
              }
            }]
          }
        }];

      case 'divider':
        return [{
          object: 'block',
          type: 'divider',
          divider: {}
        }];

      default:
        return [];
    }
  },

  /**
   * Convert text to paragraph blocks with chunking
   * @private
   */
  _textToParagraphBlocks(text) {
    const chunks = this._chunkText(text, this.MAX_CHARS_PER_BLOCK);
    return chunks.map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [chunk]
      }
    }));
  },

  /**
   * Convert code to Notion code blocks with chunking
   * @private
   */
  _codeToBlocks(code, language = 'plain text') {
    // Notion has specific language names
    const notionLang = this._mapLanguage(language);

    // Split code if too long
    if (code.length <= this.MAX_CHARS_PER_BLOCK) {
      return [{
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{
            type: 'text',
            text: { content: code }
          }],
          language: notionLang
        }
      }];
    }

    // Split into multiple code blocks
    const chunks = this._chunkCode(code, this.MAX_CHARS_PER_BLOCK);
    return chunks.map((chunk, idx) => ({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{
          type: 'text',
          text: { content: `// Part ${idx + 1}/${chunks.length}\n${chunk}` }
        }],
        language: notionLang
      }
    }));
  },

  /**
   * Convert list to Notion list blocks
   * @private
   */
  _listToBlocks(items, ordered = false) {
    const blockType = ordered ? 'numbered_list_item' : 'bulleted_list_item';
    return items.map(item => ({
      object: 'block',
      type: blockType,
      [blockType]: {
        rich_text: this._chunkText(item, this.MAX_CHARS_PER_BLOCK)
      }
    }));
  },

  /**
   * Chunk text into rich_text array (max chars per chunk)
   * @private
   */
  _chunkText(text, maxChars) {
    if (text.length <= maxChars) {
      return [{ type: 'text', text: { content: text } }];
    }

    const chunks = [];
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push({
        type: 'text',
        text: { content: text.slice(i, i + maxChars) }
      });
    }
    return chunks;
  },

  /**
   * Chunk code preserving line breaks
   * @private
   */
  _chunkCode(code, maxChars) {
    const lines = code.split('\n');
    const chunks = [];
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChars) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  },

  /**
   * Map common language names to Notion's supported languages
   * @private
   */
  _mapLanguage(lang) {
    const map = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'shell',
      'bash': 'shell',
      'yml': 'yaml',
      'md': 'markdown'
    };
    return map[lang.toLowerCase()] || lang.toLowerCase() || 'plain text';
  },

  /**
   * Batch blocks into chunks for API requests
   * @param {Array} blocks
   * @returns {Array<Array>} - Array of block batches
   */
  batchBlocks(blocks) {
    const batches = [];
    for (let i = 0; i < blocks.length; i += this.MAX_BLOCKS_PER_REQUEST) {
      batches.push(blocks.slice(i, i + this.MAX_BLOCKS_PER_REQUEST));
    }
    return batches;
  }
};

/* ===========================
   GitHub Exporter
   =========================== */
/**
 * GitHub integration for creating Gists and Issues.
 * Implements the Exporter interface.
 */
const GitHubExporter = {
  API_BASE: 'https://api.github.com',
  API_VERSION: '2022-11-28',

  /**
   * Test GitHub connection and get user info
   * @returns {Promise<{ok: boolean, identity?: string, scopes?: string[], error?: string}>}
   */
  async testConnection() {
    const token = await IntegrationStorage.getToken('github');
    if (!token) {
      return { ok: false, error: 'No token configured' };
    }

    // Test rate limit endpoint (doesn't require specific scopes)
    const result = await HttpClient.request(`${this.API_BASE}/rate_limit`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!result.ok) {
      return { ok: false, error: result.error.message };
    }

    // Get user info
    const userResult = await HttpClient.request(`${this.API_BASE}/user`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!userResult.ok) {
      return { ok: false, error: userResult.error.message };
    }

    // Parse scopes from X-OAuth-Scopes header (if available)
    const scopes = []; // GitHub doesn't always return scopes in response

    return {
      ok: true,
      identity: userResult.data.login,
      scopes
    };
  },

  /**
   * Export to GitHub Gist or Issue
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {Object} options
   * @param {string} options.visibility - 'public' or 'private'
   * @param {boolean} [options.createIssue=false]
   * @param {string} [options.repo] - Required if createIssue is true
   * @param {string} [options.description]
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<ExportResult>}
   */
  async export(harvest, filters, options = {}) {
    const token = await IntegrationStorage.getToken('github');
    if (!token) {
      return {
        ok: false,
        error: {
          code: 'AUTH',
          message: 'No GitHub token configured',
          hint: 'Please configure your GitHub token in settings.'
        }
      };
    }

    // Check if we should create an issue or gist
    if (options.createIssue) {
      return this._createIssue(harvest, filters, options, token);
    } else {
      return this._createGist(harvest, filters, options, token);
    }
  },

  /**
   * Create a GitHub Gist
   * @private
   */
  async _createGist(harvest, filters, options, token) {
    const { onProgress } = options;

    if (onProgress) onProgress({ step: 'PREPARING', message: 'Preparing markdown...' });

    // Generate markdown (with splitting if needed)
    const markdown = IntegrationMarkdownFormatter.toMarkdown(harvest, filters, true);

    // Build files object
    let files;
    if (typeof markdown === 'string') {
      // Single file
      const filename = this._generateFilename(harvest.meta?.title);
      files = {
        [filename]: { content: markdown }
      };
    } else {
      // Multiple files (already split)
      files = {};
      for (const [filename, content] of Object.entries(markdown)) {
        files[filename] = { content };
      }
    }

    if (onProgress) onProgress({ step: 'UPLOADING_1_OF_1', message: 'Creating gist...' });

    // Create gist
    const description = options.description || `Capsula export: ${harvest.meta?.title || 'Conversation'} (${new Date().toISOString().split('T')[0]})`;
    const isPublic = options.visibility === 'public';

    const result = await HttpClient.request(`${this.API_BASE}/gists`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        description,
        public: isPublic,
        files
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (onProgress) onProgress({ step: 'SUCCESS', message: 'Gist created successfully!' });

    return {
      ok: true,
      url: result.data.html_url
    };
  },

  /**
   * Create a GitHub Issue
   * @private
   */
  async _createIssue(harvest, filters, options, token) {
    const { repo, onProgress } = options;

    if (!repo) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Repository is required for issue creation',
          hint: 'Please provide a repository in the format owner/repo.'
        }
      };
    }

    if (onProgress) onProgress({ step: 'PREPARING', message: 'Preparing content...' });

    // Generate markdown (no splitting for issues)
    const markdown = IntegrationMarkdownFormatter.toMarkdown(harvest, filters, false);

    // Truncate if too long (GitHub issues have limits)
    const MAX_ISSUE_BODY = 65536;
    let body = markdown;
    if (body.length > MAX_ISSUE_BODY) {
      body = body.slice(0, MAX_ISSUE_BODY - 200) + '\n\n... (truncated due to length)';
    }

    if (onProgress) onProgress({ step: 'UPLOADING_1_OF_1', message: 'Creating issue...' });

    // Create issue
    const title = options.title || `Capsula Export: ${harvest.meta?.title || 'Conversation'}`;
    const labels = options.labels || [];

    const result = await HttpClient.request(`${this.API_BASE}/repos/${repo}/issues`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        title,
        body,
        labels
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (onProgress) onProgress({ step: 'SUCCESS', message: 'Issue created successfully!' });

    return {
      ok: true,
      url: result.data.html_url
    };
  },

  /**
   * Get request headers
   * @private
   */
  _getHeaders(token) {
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.API_VERSION,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Generate filename for gist
   * @private
   */
  _generateFilename(title) {
    const date = new Date().toISOString().split('T')[0];
    const safeName = (title || 'conversation')
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .slice(0, 50);
    return `${safeName}-${date}.md`;
  }
};

/* ===========================
   Notion Exporter
   =========================== */
/**
 * Notion integration for creating pages with blocks.
 * Implements the Exporter interface.
 */
const NotionExporter = {
  API_BASE: 'https://api.notion.com/v1',
  API_VERSION: '2022-06-28',

  /**
   * Test Notion connection and get bot info
   * @returns {Promise<{ok: boolean, identity?: string, error?: string}>}
   */
  async testConnection() {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return { ok: false, error: 'No token configured' };
    }

    // Test connection by getting bot info
    const result = await HttpClient.request(`${this.API_BASE}/users/me`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!result.ok) {
      return { ok: false, error: result.error.message };
    }

    const botName = result.data.bot?.owner?.user?.name || result.data.name || 'Notion Integration';

    return {
      ok: true,
      identity: botName
    };
  },

  /**
   * Search for pages accessible to the integration
   * @param {string} query - Search query (empty for all pages)
   * @returns {Promise<{ok: boolean, pages?: Array, error?: any}>}
   */
  async searchPages(query = '') {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return { ok: false, error: { message: 'No token configured' } };
    }

    const result = await HttpClient.request(`${this.API_BASE}/search`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        query,
        filter: { property: 'object', value: 'page' },
        page_size: 100
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      pages: result.data.results || []
    };
  },

  /**
   * Export to Notion page
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {Object} options
   * @param {string} options.parentId - Parent page or database ID
   * @param {string} options.parentType - 'page' or 'database'
   * @param {string} [options.title] - Page title (defaults to conversation title)
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<ExportResult>}
   */
  async export(harvest, filters, options = {}) {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return {
        ok: false,
        error: {
          code: 'AUTH',
          message: 'No Notion token configured',
          hint: 'Please configure your Notion integration token in settings.'
        }
      };
    }

    const { parentId, parentType, onProgress } = options;

    if (!parentId) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Parent page or database is required',
          hint: 'Please select a parent page or database for the export.'
        }
      };
    }

    try {
      // Step 1: Prepare blocks
      if (onProgress) onProgress({ step: 'PREPARING', message: 'Converting to Notion blocks...' });

      const blocks = NotionBlocksConverter.toBlocks(harvest, filters);
      const batches = NotionBlocksConverter.batchBlocks(blocks);

      // Step 2: Create page
      if (onProgress) onProgress({ step: 'VALIDATING', message: 'Creating Notion page...' });

      const pageResult = await this._createPage(harvest, parentId, parentType, options.title, token);

      if (!pageResult.ok) {
        return { ok: false, error: pageResult.error };
      }

      const pageId = pageResult.pageId;

      // Step 3: Append blocks in batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const step = `UPLOADING_${i + 1}_OF_${batches.length}`;
        const message = `Uploading batch ${i + 1} of ${batches.length}...`;

        if (onProgress) onProgress({ step, message });

        const appendResult = await this._appendBlocks(pageId, batch, token);

        if (!appendResult.ok) {
          return { ok: false, error: appendResult.error };
        }

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this._sleep(200);
        }
      }

      // Step 4: Success
      if (onProgress) onProgress({ step: 'FINALIZING', message: 'Finalizing...' });

      const pageUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;

      if (onProgress) onProgress({ step: 'SUCCESS', message: 'Page created successfully!' });

      return {
        ok: true,
        url: pageUrl
      };

    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN',
          message: err.message || 'An unexpected error occurred',
          raw: err
        }
      };
    }
  },

  /**
   * Create Notion page
   * @private
   */
  async _createPage(harvest, parentId, parentType, customTitle, token) {
    const title = customTitle || harvest.meta?.title || 'ChatGPT Conversation';

    const parent = parentType === 'database'
      ? { database_id: parentId }
      : { page_id: parentId };

    const properties = parentType === 'database'
      ? {
          Name: {
            title: [{ type: 'text', text: { content: title } }]
          }
        }
      : {};

    const children = parentType === 'page'
      ? [{
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: title } }]
          }
        }]
      : [];

    const result = await HttpClient.request(`${this.API_BASE}/pages`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        parent,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        children: children.length > 0 ? children : undefined
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      pageId: result.data.id
    };
  },

  /**
   * Append blocks to page
   * @private
   */
  async _appendBlocks(pageId, blocks, token) {
    const result = await HttpClient.request(`${this.API_BASE}/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: this._getHeaders(token),
      body: {
        children: blocks
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  },

  /**
   * Get request headers
   * @private
   */
  _getHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': this.API_VERSION,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Sleep helper
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Register exporters
ExporterRegistry.register('github-gist', GitHubExporter);
ExporterRegistry.register('github-issue', GitHubExporter);
ExporterRegistry.register('notion', NotionExporter);

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
    // Use getExportMessages to get only selected messages for export
    const filteredMessages = MessageFilter.getExportMessages(harvest.messages);

    switch (format) {
      case 'markdown':
        return this.toMarkdown(filteredMessages, harvest.meta);
      case 'html':
        return this.toHTML(filteredMessages, harvest.meta);
      case 'json':
        return this.toJSON(filteredMessages, harvest.meta);
      case 'dashboard':
        return DashboardGenerator.generate(filteredMessages, harvest.meta);
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

      const hasBlocks = Array.isArray(msg.blocks) && msg.blocks.length > 0;
      const hasPlain = !!(msg.plain && msg.plain.text && msg.plain.text.trim().length);
      const hasContent = hasBlocks || hasPlain;

      // TASK 6 FIX: Always add role header first, then thinking/metadata
      const hasThinking = msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0;
      const hasCanvas = msg.isCanvas;
      const hasAttachment = msg.hasAttachment;

      // Skip completely empty messages (no content, no thinking, no canvas, no attachment)
      if (!hasContent && !hasThinking && !hasCanvas && !hasAttachment) {
        return;
      }

      // Add role header
      md += `## ${roleLabel}\n\n`;

      // Add thinking labels (AFTER role header, only for assistant)
      if (hasThinking && msg.role === 'assistant') {
        if (msg.thinkingSequence && msg.thinkingSequence.length > 1) {
          // Multi-stage thinking: show all stages
          msg.thinkingSequence.forEach(think => {
            md += `*${think.text}*\n\n`;
          });
        } else {
          // Single thinking label
          msg.thinking.labels.forEach(label => {
            md += `*${label.text}*\n\n`;
          });
        }
        if (msg.thinking.expandable) {
          md += `*[Expandable content available]*\n\n`;
        }
      }

      // Add file attachment marker (before content, only for user)
      if (hasAttachment && msg.role === 'user') {
        md += `📎 **Attached**: ${msg.attachment.fileName}`;
        if (msg.attachment.fileType) {
          md += ` (${msg.attachment.fileType})`;
        }
        md += `\n\n`;
      }

      // Add canvas marker (before content, only for assistant)
      if (hasCanvas && msg.role === 'assistant') {
        md += `📋 **Canvas Artifact**: ${msg.canvasTitle}`;
        if (msg.canvasType && msg.canvasType !== 'unknown') {
          md += ` (${msg.canvasType})`;
        }
        md += `\n\n---\n\n`;
      }

      // Add message content
      if (hasContent && !msg.isThinking) {
        if (hasBlocks) {
          md += this.blocksToMarkdown(msg.blocks) + '\n';
        } else if (hasPlain) {
          md += msg.plain.text + '\n\n';
        }
      } else if (msg.isThinking) {
        // Thinking-only message (e.g., "Stopped thinking" with no response)
        md += `*[No response generated]*\n\n`;
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
    .thinking-sequence {
      margin-bottom: 8px;
    }
    .thinking-stage-1, .thinking-stage-2, .thinking-stage-3,
    .thinking-stage-4, .thinking-stage-5 {
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 2px;
      font-style: italic;
    }
    .canvas-marker {
      background: #dbeafe;
      border-left: 3px solid #3b82f6;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-size: 13px;
    }
    .file-attachment {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .file-type {
      color: #92400e;
      font-size: 12px;
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
      .canvas-marker { background: #1e3a8a; border-left-color: #60a5fa; }
      .file-attachment { background: #78350f; border-left-color: #fbbf24; }
      .file-type { color: #fde68a; }
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
    // TASK 6 FIX: Enhanced HTML generation with canvas and attachment markers
    let metadataHtml = '';

    // Thinking labels (multi-stage or single)
    if (msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0) {
      if (msg.thinkingSequence && msg.thinkingSequence.length > 1) {
        // Multi-stage thinking
        metadataHtml += '<div class="thinking-sequence">';
        msg.thinkingSequence.forEach((think, idx) => {
          metadataHtml += `<div class="thinking-label thinking-stage-${idx + 1}">🤔 ${Utils.escapeHtml(think.text)}</div>`;
        });
        metadataHtml += '</div>';
      } else {
        // Single thinking label
        metadataHtml += msg.thinking.labels.map(label =>
          `<div class="thinking-label">🤔 ${Utils.escapeHtml(label.text)}</div>`
        ).join('');
      }
      if (msg.thinking.expandable) {
        metadataHtml += '<div class="thinking-label">[Expandable content available]</div>';
      }
    }

    // File attachment marker (user messages only)
    if (msg.hasAttachment && msg.role === 'user') {
      const icons = {
        image: '🖼️',
        pdf: '📄',
        archive: '📦',
        document: '📝',
        code: '💻',
        file: '📎'
      };
      const icon = icons[msg.attachment.category] || '📎';
      metadataHtml += `<div class="file-attachment">
        <span>${icon}</span>
        <div>
          <strong>Attached:</strong> ${Utils.escapeHtml(msg.attachment.fileName)}
          ${msg.attachment.fileType ? `<span class="file-type">(${Utils.escapeHtml(msg.attachment.fileType)})</span>` : ''}
        </div>
      </div>`;
    }

    // Canvas artifact marker (assistant messages only)
    if (msg.isCanvas && msg.role === 'assistant') {
      metadataHtml += `<div class="canvas-marker">
        📋 <strong>Canvas Artifact:</strong> ${Utils.escapeHtml(msg.canvasTitle)}
        ${msg.canvasType && msg.canvasType !== 'unknown' ? `<span style="font-size: 12px; color: #1e40af;">(${msg.canvasType})</span>` : ''}
      </div>`;
    }

    const bubbleContent = MessageFormatter.format(msg);
    const hasBubbleContent = bubbleContent && bubbleContent.trim().length > 0;

    // Skip completely empty messages
    if (!hasBubbleContent && !metadataHtml) return '';

    return `
    <div class="message ${msg.role}">
      <div style="max-width: 70%;">
        ${metadataHtml}
        ${hasBubbleContent ? `
        <div class="bubble">
          <div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>
          ${bubbleContent}
        </div>` : msg.isThinking ? `
        <div class="bubble">
          <div class="role">ChatGPT</div>
          <em>[No response generated]</em>
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
    let ext = format;
    let suffix = '';

    if (format === 'markdown') {
      ext = 'md';
    } else if (format === 'dashboard') {
      ext = 'html';
      suffix = '_dashboard';
    }

    return `${title}${suffix}_${date}.${ext}`;
  },

  getMimeType(format) {
    const types = {
      markdown: 'text/markdown;charset=utf-8',
      html: 'text/html;charset=utf-8',
      json: 'application/json;charset=utf-8',
      dashboard: 'text/html;charset=utf-8'
    };
    return types[format] || 'text/plain;charset=utf-8';
  }
};

/* ===========================
   Dashboard Generator
   =========================== */
const DashboardGenerator = {
  generate(messages, meta) {
    const stats = this.calculateStats(messages, meta);
    return this.renderHTML(stats, meta);
  },

  calculateStats(messages, meta) {
    const stats = {
      overview: {
        totalMessages: messages.length,
        userMessages: 0,
        assistantMessages: 0,
        model: meta.model || 'Unknown',
        exportDate: new Date(meta.exported_at).toLocaleString()
      },
      content: {
        totalWords: 0,
        userWords: 0,
        assistantWords: 0,
        avgMessageLength: 0,
        codeBlocks: 0,
        images: 0,
        tables: 0,
        lists: 0,
        links: 0,
        citations: 0
      },
      thinking: {
        instances: 0,
        totalSeconds: 0,
        avgSeconds: 0,
        percentageWithThinking: 0,
        multiStage: 0,  // TASK 7: Multi-stage thinking count
        totalStages: 0  // TASK 7: Total thinking stages
      },
      // TASK 7: Canvas artifacts
      canvas: {
        total: 0,
        documents: 0,
        code: 0,
        unknown: 0
      },
      // TASK 7: File attachments
      attachments: {
        total: 0,
        byType: {
          image: 0,
          pdf: 0,
          archive: 0,
          document: 0,
          code: 0,
          file: 0
        }
      },
      codeLanguages: {},
      messageLength: {
        longest: 0,
        shortest: Infinity,
        longestRole: '',
        shortestRole: ''
      },
      timeline: []
    };

    messages.forEach((msg, idx) => {
      // Role counting
      if (msg.role === 'user') {
        stats.overview.userMessages++;
      } else if (msg.role === 'assistant') {
        stats.overview.assistantMessages++;
      }

      // Word counting
      const text = msg.plain?.text || '';
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      stats.content.totalWords += wordCount;

      if (msg.role === 'user') {
        stats.content.userWords += wordCount;
      } else if (msg.role === 'assistant') {
        stats.content.assistantWords += wordCount;
      }

      // Message length tracking
      if (wordCount > 0) {
        if (wordCount > stats.messageLength.longest) {
          stats.messageLength.longest = wordCount;
          stats.messageLength.longestRole = msg.role;
        }
        if (wordCount < stats.messageLength.shortest) {
          stats.messageLength.shortest = wordCount;
          stats.messageLength.shortestRole = msg.role;
        }
      }

      // Block analysis
      (msg.blocks || []).forEach(block => {
        switch (block.kind) {
          case 'code':
            stats.content.codeBlocks++;
            const lang = block.language || 'unknown';
            stats.codeLanguages[lang] = (stats.codeLanguages[lang] || 0) + 1;
            break;
          case 'image':
            stats.content.images++;
            break;
          case 'table':
            stats.content.tables++;
            break;
          case 'list':
            stats.content.lists++;
            break;
          case 'link':
            stats.content.links++;
            break;
          case 'citation':
            stats.content.citations++;
            break;
        }
      });

      // TASK 7: Thinking state analysis (improved)
      if (msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0) {
        stats.thinking.instances++;

        // Use pre-calculated totalSeconds from message (more reliable)
        if (msg.thinking.totalSeconds) {
          stats.thinking.totalSeconds += msg.thinking.totalSeconds;
        }

        // Count multi-stage thinking
        if (msg.thinkingSequence && msg.thinkingSequence.length > 1) {
          stats.thinking.multiStage++;
          stats.thinking.totalStages += msg.thinkingSequence.length;
        } else {
          stats.thinking.totalStages += msg.thinking.labels.length;
        }
      }

      // TASK 7: Canvas artifact analysis
      if (msg.isCanvas) {
        stats.canvas.total++;
        if (msg.canvasType === 'document') {
          stats.canvas.documents++;
        } else if (msg.canvasType === 'code') {
          stats.canvas.code++;
        } else {
          stats.canvas.unknown++;
        }
      }

      // TASK 7: File attachment analysis
      if (msg.hasAttachment && msg.attachment) {
        stats.attachments.total++;
        const category = msg.attachment.category || 'file';
        if (stats.attachments.byType[category] !== undefined) {
          stats.attachments.byType[category]++;
        }
      }

      // Timeline data
      stats.timeline.push({
        index: idx,
        role: msg.role,
        words: wordCount,
        hasCode: (msg.blocks || []).some(b => b.kind === 'code'),
        hasThinking: !!(msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0)
      });
    });

    // Calculate averages and percentages
    if (stats.overview.totalMessages > 0) {
      stats.content.avgMessageLength = Math.round(stats.content.totalWords / stats.overview.totalMessages);
    }

    if (stats.thinking.instances > 0) {
      stats.thinking.avgSeconds = Math.round(stats.thinking.totalSeconds / stats.thinking.instances);
      stats.thinking.percentageWithThinking = Math.round((stats.thinking.instances / stats.overview.assistantMessages) * 100);
    }

    // Handle edge case for shortest message
    if (stats.messageLength.shortest === Infinity) {
      stats.messageLength.shortest = 0;
    }

    return stats;
  },

  renderHTML(stats, meta) {
    const isDark = ThemeUtils.isDark();
    const colors = isDark ? {
      bg: '#1a1a1a',
      bgSecondary: '#2a2a2a',
      text: '#e8e8e8',
      textSecondary: '#a8a8a8',
      border: '#404040',
      accent: '#3b82f6',
      user: '#2563eb',
      assistant: '#059669',
      cardBg: '#2a2a2a',
      cardHover: '#333333'
    } : {
      bg: '#ffffff',
      bgSecondary: '#f9fafb',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      accent: '#3b82f6',
      user: '#3b82f6',
      assistant: '#10b981',
      cardBg: '#ffffff',
      cardHover: '#f3f4f6'
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Dashboard - ${Utils.escapeHTML(meta.title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: ${colors.bg};
      color: ${colors.text};
      line-height: 1.6;
      padding: 40px 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 2px solid ${colors.border};
    }

    .header h1 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 12px;
      color: ${colors.accent};
    }

    .header .subtitle {
      font-size: 18px;
      color: ${colors.textSecondary};
      margin-bottom: 8px;
    }

    .header .meta {
      font-size: 14px;
      color: ${colors.textSecondary};
    }

    .section {
      margin-bottom: 48px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .section-title .icon {
      font-size: 28px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .card {
      background: ${colors.cardBg};
      border: 1px solid ${colors.border};
      border-radius: 12px;
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      background: ${colors.cardHover};
    }

    .card-title {
      font-size: 14px;
      color: ${colors.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .card-value {
      font-size: 32px;
      font-weight: 700;
      color: ${colors.text};
      margin-bottom: 4px;
    }

    .card-subtitle {
      font-size: 14px;
      color: ${colors.textSecondary};
    }

    .chart-container {
      background: ${colors.cardBg};
      border: 1px solid ${colors.border};
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .chart-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: ${colors.text};
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bar-label {
      min-width: 120px;
      font-size: 14px;
      color: ${colors.text};
      font-weight: 500;
    }

    .bar-container {
      flex: 1;
      height: 32px;
      background: ${colors.bgSecondary};
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.8s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 12px;
      color: white;
      font-size: 13px;
      font-weight: 600;
    }

    .bar-value {
      min-width: 60px;
      text-align: right;
      font-size: 14px;
      color: ${colors.text};
      font-weight: 600;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .stat-item {
      background: ${colors.bgSecondary};
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid ${colors.accent};
    }

    .stat-item .label {
      font-size: 12px;
      color: ${colors.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .stat-item .value {
      font-size: 24px;
      font-weight: 700;
      color: ${colors.text};
    }

    .languages-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .language-tag {
      background: ${colors.bgSecondary};
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid ${colors.border};
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .language-tag .count {
      background: ${colors.accent};
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }

    .timeline-viz {
      height: 120px;
      background: ${colors.bgSecondary};
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: flex-end;
      gap: 2px;
      overflow-x: auto;
    }

    .timeline-bar {
      flex: 1;
      min-width: 8px;
      border-radius: 2px;
      transition: transform 0.2s;
      cursor: pointer;
    }

    .timeline-bar:hover {
      transform: scaleY(1.1);
      opacity: 0.8;
    }

    .timeline-bar.user {
      background: ${colors.user};
    }

    .timeline-bar.assistant {
      background: ${colors.assistant};
    }

    .legend {
      display: flex;
      gap: 24px;
      justify-content: center;
      margin-top: 16px;
      font-size: 14px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .footer {
      text-align: center;
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid ${colors.border};
      color: ${colors.textSecondary};
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .header h1 {
        font-size: 28px;
      }

      .section-title {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Conversation Dashboard</h1>
      <div class="subtitle">${Utils.escapeHTML(meta.title)}</div>
      <div class="meta">
        <strong>Model:</strong> ${Utils.escapeHTML(stats.overview.model)} |
        <strong>Exported:</strong> ${Utils.escapeHTML(stats.overview.exportDate)}
      </div>
    </div>

    <!-- Overview Section -->
    <div class="section">
      <h2 class="section-title"><span class="icon">💬</span> Conversation Overview</h2>
      <div class="grid">
        <div class="card">
          <div class="card-title">Total Messages</div>
          <div class="card-value">${stats.overview.totalMessages}</div>
          <div class="card-subtitle">Complete conversation</div>
        </div>
        <div class="card">
          <div class="card-title">User Messages</div>
          <div class="card-value" style="color: ${colors.user}">${stats.overview.userMessages}</div>
          <div class="card-subtitle">${this.formatPercentage(stats.overview.userMessages, stats.overview.totalMessages)}% of conversation</div>
        </div>
        <div class="card">
          <div class="card-title">Assistant Messages</div>
          <div class="card-value" style="color: ${colors.assistant}">${stats.overview.assistantMessages}</div>
          <div class="card-subtitle">${this.formatPercentage(stats.overview.assistantMessages, stats.overview.totalMessages)}% of conversation</div>
        </div>
      </div>
    </div>

    <!-- Content Statistics -->
    <div class="section">
      <h2 class="section-title"><span class="icon">📝</span> Content Statistics</h2>
      <div class="chart-container">
        <div class="chart-title">Word Count Comparison</div>
        <div class="bar-chart">
          <div class="bar-item">
            <div class="bar-label">User</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${this.formatPercentage(stats.content.userWords, stats.content.totalWords)}%; background: ${colors.user};">
                ${stats.content.userWords > 0 ? stats.content.userWords : ''}
              </div>
            </div>
            <div class="bar-value">${stats.content.userWords}</div>
          </div>
          <div class="bar-item">
            <div class="bar-label">Assistant</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${this.formatPercentage(stats.content.assistantWords, stats.content.totalWords)}%; background: ${colors.assistant};">
                ${stats.content.assistantWords > 0 ? stats.content.assistantWords : ''}
              </div>
            </div>
            <div class="bar-value">${stats.content.assistantWords}</div>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Total Words</div>
          <div class="value">${stats.content.totalWords.toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="label">Avg Message Length</div>
          <div class="value">${stats.content.avgMessageLength} words</div>
        </div>
        <div class="stat-item">
          <div class="label">Longest Message</div>
          <div class="value">${stats.messageLength.longest} words</div>
        </div>
        <div class="stat-item">
          <div class="label">Code Blocks</div>
          <div class="value">${stats.content.codeBlocks}</div>
        </div>
        <div class="stat-item">
          <div class="label">Images</div>
          <div class="value">${stats.content.images}</div>
        </div>
        <div class="stat-item">
          <div class="label">Tables</div>
          <div class="value">${stats.content.tables}</div>
        </div>
        <div class="stat-item">
          <div class="label">Lists</div>
          <div class="value">${stats.content.lists}</div>
        </div>
        <div class="stat-item">
          <div class="label">Links & Citations</div>
          <div class="value">${stats.content.links + stats.content.citations}</div>
        </div>
      </div>
    </div>

    ${stats.content.codeBlocks > 0 ? `
    <!-- Code Languages -->
    <div class="section">
      <h2 class="section-title"><span class="icon">💻</span> Code Languages</h2>
      <div class="chart-container">
        <div class="languages-list">
          ${Object.entries(stats.codeLanguages)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => `
              <div class="language-tag">
                <span>${Utils.escapeHTML(lang)}</span>
                <span class="count">${count}</span>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
    ` : ''}

    ${stats.thinking.instances > 0 ? `
    <!-- Thinking State Analysis -->
    <div class="section">
      <h2 class="section-title"><span class="icon">🧠</span> Thinking State Analysis</h2>
      <div class="grid">
        <div class="card">
          <div class="card-title">Thinking Instances</div>
          <div class="card-value">${stats.thinking.instances}</div>
          <div class="card-subtitle">${stats.thinking.percentageWithThinking}% of assistant messages</div>
        </div>
        <div class="card">
          <div class="card-title">Total Thinking Time</div>
          <div class="card-value">${this.formatTime(stats.thinking.totalSeconds)}</div>
          <div class="card-subtitle">${stats.thinking.totalSeconds} seconds</div>
        </div>
        <div class="card">
          <div class="card-title">Avg Thinking Time</div>
          <div class="card-value">${this.formatTime(stats.thinking.avgSeconds)}</div>
          <div class="card-subtitle">Per thinking instance</div>
        </div>
        ${stats.thinking.multiStage > 0 ? `
        <div class="card">
          <div class="card-title">Multi-Stage Thinking</div>
          <div class="card-value">${stats.thinking.multiStage}</div>
          <div class="card-subtitle">${stats.thinking.totalStages} total stages</div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    ${stats.canvas.total > 0 ? `
    <!-- Canvas Artifacts -->
    <div class="section">
      <h2 class="section-title"><span class="icon">📋</span> Canvas Artifacts</h2>
      <div class="grid">
        <div class="card">
          <div class="card-title">Total Artifacts</div>
          <div class="card-value">${stats.canvas.total}</div>
          <div class="card-subtitle">Generated canvases</div>
        </div>
        <div class="card">
          <div class="card-title">Documents</div>
          <div class="card-value">${stats.canvas.documents}</div>
          <div class="card-subtitle">Text documents</div>
        </div>
        <div class="card">
          <div class="card-title">Code Canvases</div>
          <div class="card-value">${stats.canvas.code}</div>
          <div class="card-subtitle">Code artifacts</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${stats.attachments.total > 0 ? `
    <!-- File Attachments -->
    <div class="section">
      <h2 class="section-title"><span class="icon">📎</span> File Attachments</h2>
      <div class="grid">
        <div class="card">
          <div class="card-title">Total Attachments</div>
          <div class="card-value">${stats.attachments.total}</div>
          <div class="card-subtitle">Files uploaded</div>
        </div>
        ${stats.attachments.byType.image > 0 ? `
        <div class="card">
          <div class="card-title">Images</div>
          <div class="card-value">🖼️ ${stats.attachments.byType.image}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.pdf > 0 ? `
        <div class="card">
          <div class="card-title">PDFs</div>
          <div class="card-value">📄 ${stats.attachments.byType.pdf}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.archive > 0 ? `
        <div class="card">
          <div class="card-title">Archives</div>
          <div class="card-value">📦 ${stats.attachments.byType.archive}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.document > 0 ? `
        <div class="card">
          <div class="card-title">Documents</div>
          <div class="card-value">📝 ${stats.attachments.byType.document}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.code > 0 ? `
        <div class="card">
          <div class="card-title">Code Files</div>
          <div class="card-value">💻 ${stats.attachments.byType.code}</div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Conversation Timeline -->
    <div class="section">
      <h2 class="section-title"><span class="icon">📈</span> Conversation Flow</h2>
      <div class="chart-container">
        <div class="chart-title">Message Timeline</div>
        <div class="timeline-viz">
          ${stats.timeline.map((item, idx) => {
            const maxWords = Math.max(...stats.timeline.map(t => t.words));
            const height = maxWords > 0 ? Math.max(20, (item.words / maxWords) * 100) : 20;
            const title = `Message ${idx + 1}: ${item.role} (${item.words} words)${item.hasCode ? ' 💻' : ''}${item.hasThinking ? ' 🧠' : ''}`;
            return `<div class="timeline-bar ${item.role}" style="height: ${height}%" title="${title}"></div>`;
          }).join('')}
        </div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-color" style="background: ${colors.user}"></div>
            <span>User</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: ${colors.assistant}"></div>
            <span>Assistant</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      Generated by <strong>Capsula v${CFG.version}</strong> |
      <a href="https://github.com/sevenevesai/capsula" style="color: ${colors.accent}; text-decoration: none;">GitHub</a>
    </div>
  </div>
</body>
</html>`;
  },

  formatPercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  },

  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
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
    // Find expandable elements, but exclude our extension's UI elements
    const expandCandidates = Array.from(document.querySelectorAll('button, [role="button"]'));
    const expandButtons = expandCandidates.filter(button => {
      // Skip if this is our export button or any element within our extension's UI
      if (button.closest('[data-cgpt-overlay-export]') ||
          button.closest('[data-cgpt-panel]') ||
          button.getRootNode() instanceof ShadowRoot) {
        return false;
      }

      const ariaExpanded = button.getAttribute('aria-expanded');
      if (ariaExpanded === 'false') return true;

      const id = button.id || '';
      if (id.startsWith('radix-')) return true;

      const text = (button.textContent || '').toLowerCase();
      return /show|expand|view|details|steps|more|analysis|reasoning|tools?/.test(text);
    });

    for (const button of expandButtons) {
      try {
        button.click();
        await new Promise(resolve => setTimeout(resolve, CFG.autoExpandDelay));
      } catch (err) {
        console.warn('[ChatGPT Export] Failed to click expand button:', err);
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
    // TASK 5: Updated message processing order
    // Proper sequence: role → canvas/attachment → thinking → content → metadata
    const messages = [];
    const processedElements = new Set();

    const turnContainers = this.findAllTurnContainers();

    turnContainers.forEach((container, index) => {
      if (processedElements.has(container)) return;
      processedElements.add(container);

      // STEP 1: Determine role FIRST (never depends on content)
      const role = this.detectRole(container);

      // STEP 2: Type-specific detection (depends on role)
      // Canvas artifacts only for assistant messages
      const canvasInfo = role === 'assistant' ? this.detectCanvasArtifact(container) : null;
      // File attachments only for user messages
      const fileAttachment = role === 'user' ? this.detectFileAttachment(container) : null;

      // STEP 3: Thinking detection (ONLY for assistant messages, uses structural selectors)
      const thinkingInfo = role === 'assistant'
        ? this.detectThinkingStates(container)
        : { labels: [], expandable: false };

      // STEP 4: Content validation
      const hasContent = this.hasActualContent(container);

      // STEP 5: Skip if no content, no thinking, no canvas, no attachment
      if (!hasContent && !canvasInfo && !fileAttachment && !thinkingInfo.labels.length) {
        console.debug('[ChatGPT Export] Skipping empty message', container);
        return;
      }

      // STEP 6: Extract content (use canvas content if present)
      const contentNode = canvasInfo
        ? canvasInfo.contentElement
        : (this.findContentNode(container) || container);

      const clone = contentNode.cloneNode(true);
      this.sanitizeClone(clone);

      const blocks = this.extractBlocks(clone);
      const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();

      // STEP 7: Build message object with all metadata
      const message = {
        id: container.id || `msg-${messages.length + 1}`,
        index: messages.length,
        role: role,

        // Thinking metadata (preserves multi-stage sequences)
        thinking: thinkingInfo.labels.length > 0 ? thinkingInfo : null,
        thinkingSequence: thinkingInfo.labels.length > 1 ? thinkingInfo.labels : null,
        isThinking: thinkingInfo.labels.length > 0 && !hasContent && !canvasInfo,
        incomplete: thinkingInfo.labels.some(l => /stopped|paused|failed/i.test(l.text)),

        // Canvas metadata
        canvas: canvasInfo || null,
        isCanvas: canvasInfo !== null,
        canvasTitle: canvasInfo?.title || null,
        canvasType: canvasInfo?.type || null,

        // File attachment metadata
        attachment: fileAttachment || null,
        hasAttachment: fileAttachment !== null,

        // Content
        blocks: blocks.length ? blocks : (plainText && !thinkingInfo.labels.length ?
          [{ kind: 'para', md: plainText }] : []),
        plain: { text: plainText || '' },

        // Metadata
        timestamp: new Date().toISOString(),
        model: role === 'assistant' ? this.detectModel() : null
      };

      // STEP 8: Final validation and add to messages
      if (message.plain.text || message.blocks.length > 0 || message.thinking ||
          message.canvas || message.attachment) {
        messages.push(message);
      } else {
        console.warn('[ChatGPT Export] Skipping message with no extractable content', container);
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

  parseThinkingTime(text) {
    // TASK 6: Parse thinking time from text patterns
    // Returns time in seconds, or 0 if no time found
    if (!text) return 0;

    // Pattern 1: "Xm Ys" or "X minutes Y seconds"
    const minSecMatch = text.match(/(\d+)\s*(?:m|min|minutes?)\s+(?:and\s+)?(\d+)\s*(?:s|sec|seconds?)/i);
    if (minSecMatch) {
      return parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2]);
    }

    // Pattern 2: "Xs" or "X seconds" (only)
    const secMatch = text.match(/(\d+)\s*(?:s|sec|seconds?)(?!\s*\d)/i);
    if (secMatch) {
      return parseInt(secMatch[1]);
    }

    // Pattern 3: "Xm" or "X minutes" (only)
    const minMatch = text.match(/(\d+)\s*(?:m|min|minutes?)(?!\s*\d)/i);
    if (minMatch) {
      return parseInt(minMatch[1]) * 60;
    }

    // Pattern 4: "a few seconds" / "a couple seconds" / "a moment" / "briefly"
    if (/few\s+seconds?|couple\s+(?:of\s+)?seconds?/i.test(text)) {
      return 3; // Estimate 3 seconds
    }

    // Pattern 5: "a moment" / "briefly"
    if (/\b(?:a\s+)?moment|brief(?:ly)?/i.test(text)) {
      return 2; // Estimate 2 seconds
    }

    return 0;
  },

  detectThinkingStates(container) {
    const labels = [];
    const expanderSelectors = [];
    const seenTexts = new Set();
    const processedDivs = new Set();

    // ENHANCED FIX: Use multiple strategies to catch ALL thinking indicators
    // ChatGPT thinking labels appear in divs ABOVE message content with specific patterns

    // Strategy 1: Primary selector - the typical thinking div structure
    const strategy1Divs = container.querySelectorAll('div.relative[class*="my-"][class*="min-h"]');

    // Strategy 2: Find divs that contain thinking-like text (catches variations)
    const allRelativeDivs = container.querySelectorAll('div.relative');
    const strategy2Divs = Array.from(allRelativeDivs).filter(div => {
      // Must be small divs (thinking indicators are compact)
      if (div.offsetHeight > 100) return false;

      // Check if it contains thinking text
      const text = div.textContent || '';
      const hasThinkingText = /Thought for|Thinking for|Processing for|Stopped thinking|Analyzing|Working on/i.test(text);

      // Exclude if it's inside message content
      if (div.hasAttribute('data-message-author-role')) return false;
      if (div.closest('[data-message-author-role]')?.contains(div)) return false;

      return hasThinkingText;
    });

    // Strategy 3: Explicit thinking markers (future-proof)
    const strategy3Divs = container.querySelectorAll('[class*="thinking"], [data-thinking]');

    // Combine all strategies, removing duplicates
    const allDivs = [...strategy1Divs, ...strategy2Divs, ...strategy3Divs];
    const uniqueDivs = allDivs.filter(div => {
      if (processedDivs.has(div)) return false;
      processedDivs.add(div);
      return true;
    });

    uniqueDivs.forEach((thinkingDiv) => {
      // Search ALL spans - be comprehensive
      const allSpans = thinkingDiv.querySelectorAll('span');

      allSpans.forEach(span => {
        let text = (span.textContent || '').trim();

        // Skip empty or already seen
        if (!text || seenTexts.has(text)) return;

        // Clean up text (remove SVG content markers, extra whitespace)
        text = text.replace(/<svg.*?<\/svg>/gi, '').trim();

        // Pattern matching - be comprehensive
        const isTimePattern = /Thought for|Thinking for|Processing for/i.test(text);
        const isStatePattern = /Stopped thinking|Stopped|Analyzing|Processing|Working|Calculating|Reading|Planning/i.test(text);

        // Filter out false positives
        // Skip if too long (thinking labels are short, < 50 chars typically)
        if (text.length > 100) return;

        // Skip if has multiple sentences
        if ((text.match(/\.\s+[A-Z]/g) || []).length > 0) return;

        // Skip common UI elements
        if (/^(You|ChatGPT|User|Assistant|Copy|Edit|Regenerate|Download|Good response|Bad response)$/i.test(text)) return;

        // Match!
        if (isTimePattern || isStatePattern) {
          const matchedType = isTimePattern ? 'time' : 'state';

          labels.push({
            text: text,
            order: labels.length,  // Preserve sequence for multi-stage thinking
            type: matchedType,
            seconds: this.parseThinkingTime(text)
          });
          seenTexts.add(text);
        }
      });

      // Check for expander button
      const button = thinkingDiv.querySelector('button[aria-expanded], button[role="button"]');

      if (button) {
        const ariaExpanded = button.getAttribute('aria-expanded');
        const hasRadixId = button.id && button.id.startsWith('radix-');
        const buttonText = (button.textContent || '').toLowerCase();

        if (ariaExpanded === 'false' || hasRadixId ||
            /show|expand|details|view|steps|more|analysis|reasoning|tools?/.test(buttonText)) {
          const selector = this.getElementSelector(button);
          if (selector && !expanderSelectors.includes(selector)) {
            expanderSelectors.push(selector);
          }
        }
      }
    });

    // TASK 6: Calculate total thinking time
    const totalSeconds = labels.reduce((sum, label) => sum + (label.seconds || 0), 0);

    return {
      labels: labels,  // Array preserving all thinking stages in order
      totalSeconds: totalSeconds,  // Total time in seconds
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
    // TASK 2 FIX: Never use thinking as role indicator
    // Priority 1: Check article-level data-turn attribute (most reliable)
    // This is the primary way ChatGPT marks message roles
    const article = el.closest('article[data-turn]');
    if (article) {
      const turn = article.getAttribute('data-turn');
      if (turn === 'user' || turn === 'assistant') {
        return turn;
      }
    }

    // Priority 2: Check message-level data-message-author-role on current element
    const attr = el.getAttribute('data-message-author-role');
    if (attr === 'user' || attr === 'assistant') return attr;

    // Priority 3: Check nested message div
    const nested = el.querySelector('[data-message-author-role]');
    if (nested) {
      const nestedRole = nested.getAttribute('data-message-author-role');
      if (nestedRole === 'user' || nestedRole === 'assistant') {
        return nestedRole;
      }
    }

    // Priority 4: Check parent message div
    const parent = el.closest('[data-message-author-role]');
    if (parent) {
      const parentRole = parent.getAttribute('data-message-author-role');
      if (parentRole === 'user' || parentRole === 'assistant') {
        return parentRole;
      }
    }

    // CRITICAL FIX: Removed thinking-based role detection
    // Thinking labels should NEVER determine role
    // This prevents user messages containing "Thought for" text from being misidentified

    // Priority 5: Content-based heuristics (least reliable, use only as last resort)
    const text = (el.textContent || '').toLowerCase();

    // Check for explicit role indicators in text
    if (text.startsWith('you said:') || text.startsWith('you:')) return 'user';
    if (text.startsWith('chatgpt said:') || text.startsWith('chatgpt:')) return 'assistant';

    // Check for user/assistant avatars or images
    if (el.querySelector('img[alt*="User" i]')) return 'user';
    if (el.querySelector('img[alt*="ChatGPT" i], img[alt*="Assistant" i]')) return 'assistant';

    // Check for user bubble styling (specific to user messages)
    if (el.querySelector('.user-message-bubble-color')) return 'user';

    // Check for layout alignment (user messages typically right-aligned)
    const style = window.getComputedStyle(el);
    if (style.textAlign === 'right' || style.justifyContent === 'flex-end') {
      // Double-check this isn't an assistant message with right-aligned content
      if (!el.querySelector('.markdown.prose')) {
        return 'user';
      }
    }

    // Default to assistant if uncertain (safer than defaulting to user)
    console.warn('[ChatGPT Export] Could not reliably detect role for element, defaulting to assistant', el);
    return 'assistant';
  },

  detectCanvasArtifact(container) {
    // TASK 3: Detect Canvas artifacts (documents, code blocks in canvas interface)
    // Canvas artifacts should be identified and marked with metadata
    // These are assistant-generated documents that appear in a special canvas UI

    // Method 1: Check for textdoc-message ID (document canvas)
    // Canvas documents have specific ID pattern: "textdoc-message-[hash]"
    const canvasDiv = container.querySelector('[id^="textdoc-message-"]');
    if (canvasDiv) {
      // Extract canvas metadata
      const titleEl = canvasDiv.querySelector('.truncate.text-token-text-primary.font-semibold');
      const title = titleEl?.textContent?.trim() || 'Untitled Canvas Document';

      // Canvas content is in ProseMirror editor
      const contentEl = canvasDiv.querySelector('.ProseMirror, [class*="_main_"]');

      return {
        isCanvas: true,
        type: 'document',
        title: title,
        contentElement: contentEl,
        id: canvasDiv.id
      };
    }

    // Method 2: Check for code canvas (different structure)
    // Code canvas has popover with rounded corners and code content
    const codeCanvas = container.querySelector('.popover.rounded-3xl [class*="code-"]');
    if (codeCanvas) {
      const titleEl = codeCanvas.closest('.popover').querySelector('.font-semibold');
      const title = titleEl?.textContent?.trim() || 'Code Canvas';

      return {
        isCanvas: true,
        type: 'code',
        title: title,
        contentElement: codeCanvas
      };
    }

    // Method 3: General canvas detection (fallback)
    // Looks for the general canvas popover structure with ProseMirror editor
    const popoverCanvas = container.querySelector('.popover.bg-token-bg-primary.rounded-3xl');
    if (popoverCanvas && popoverCanvas.querySelector('.ProseMirror')) {
      return {
        isCanvas: true,
        type: 'unknown',
        title: 'Canvas Artifact',
        contentElement: popoverCanvas
      };
    }

    // No canvas artifact found
    return null;
  },

  detectFileAttachment(container) {
    // TASK 4: Detect file attachments in user messages
    // Only user messages can have file attachments (images, PDFs, zips, etc.)

    // Only user messages can have file attachments
    const role = this.detectRole(container);
    if (role !== 'user') return null;

    // Look for file preview structure
    // File attachments have a specific bordered container with file info
    const filePreview = container.querySelector('.border-token-border-default.border.rounded-xl');
    if (!filePreview) return null;

    // Extract file metadata
    const fileNameEl = filePreview.querySelector('.truncate.font-semibold');
    const fileTypeEl = filePreview.querySelector('.text-token-text-secondary.truncate');

    const fileName = fileNameEl?.textContent?.trim();
    const fileType = fileTypeEl?.textContent?.trim();

    if (!fileName) return null;

    // Determine file category from type string or extension
    let category = 'file';
    const lowerType = (fileType || '').toLowerCase();
    const lowerName = (fileName || '').toLowerCase();

    if (lowerType.includes('image') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(lowerName)) {
      category = 'image';
    } else if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
      category = 'pdf';
    } else if (lowerType.includes('zip') || lowerType.includes('archive') || /\.(zip|rar|7z|tar|gz)$/i.test(lowerName)) {
      category = 'archive';
    } else if (lowerType.includes('text') || lowerType.includes('document') || /\.(txt|doc|docx|md)$/i.test(lowerName)) {
      category = 'document';
    } else if (lowerType.includes('code') || lowerType.includes('script') || /\.(js|py|java|cpp|cs|ts)$/i.test(lowerName)) {
      category = 'code';
    }

    return {
      fileName: fileName,
      fileType: fileType,
      category: category
    };
  },

  sanitizeClone(root) {
    const DROP = [
      'button',
      'svg[aria-hidden="true"]',
      '[data-testid="copy-turn-action-button"]',
      '[data-testid="copy-button"]',
      '.invisible',
      '.sr-only',
      // CRITICAL FIX: Remove thinking indicator divs from content
      // These should not be included in the exported content
      '.relative.my-1.min-h-6',  // Primary thinking indicator structure
      '[class*="thinking"]',      // Fallback for thinking indicators
      '[data-thinking]'           // Data attribute based thinking indicators
    ];

    root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());
    root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
    root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));
  },

  detectCodeLanguage(code) {
    // Smart language detection based on code patterns
    // Only returns a language when confident - better to return '' than misclassify

    if (!code || !code.trim()) return '';

    const trimmed = code.trim();
    const lines = trimmed.split('\n');
    const firstLine = lines[0].trim();
    const codeLength = trimmed.length;

    // Too short to reliably detect (unless it's JSON)
    if (codeLength < 15 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return '';
    }

    // JSON - Very distinct structure
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
        (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      // Check for JSON-like patterns: "key": value
      if (/"\w+"\s*:\s*[{\["\d]/.test(trimmed)) {
        return 'json';
      }
    }

    // XML/HTML - Very clear with tags
    if (/<\/?[\w-]+[^>]*>/i.test(trimmed)) {
      // Check if it's HTML specifically (has DOCTYPE, html, head, body, common HTML tags)
      if (/<!DOCTYPE html|<html|<head|<body|<div|<span|<p>|<a\s/i.test(trimmed)) {
        return 'html';
      }
      // Otherwise it's XML
      if (/<\?xml|<[\w-]+:[\w-]+/i.test(trimmed)) {
        return 'xml';
      }
      // Generic HTML if has common tags
      if (/<(div|span|p|a|img|ul|ol|li|h[1-6]|table|tr|td|form|input|button)[>\s]/i.test(trimmed)) {
        return 'html';
      }
      return 'xml';
    }

    // CSS - Selectors with properties
    if (/[.#]?[\w-]+\s*{[\s\S]*?[a-z-]+\s*:\s*[^}]+;/i.test(trimmed)) {
      // Confirm with multiple CSS patterns
      if (/[:{};]/.test(trimmed) && /[a-z-]+\s*:\s*[^}]+;/i.test(trimmed)) {
        return 'css';
      }
    }

    // PHP - Starts with <?php
    if (/^<\?php/i.test(trimmed)) {
      return 'php';
    }

    // SQL - Multiple SQL keywords
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|CREATE|DROP|ALTER|TABLE)\b/gi;
    const sqlMatches = (trimmed.match(sqlKeywords) || []).length;
    if (sqlMatches >= 2) {
      return 'sql';
    }

    // Shell/Bash - Shebang or common shell patterns
    if (/^#!\/bin\/(ba)?sh|^#!/.test(firstLine)) {
      return 'bash';
    }
    // Multiple shell commands
    const shellCommands = /\b(echo|cd|ls|grep|awk|sed|cat|mkdir|rm|cp|mv|chmod|export|source)\b/g;
    const shellMatches = (trimmed.match(shellCommands) || []).length;
    if (shellMatches >= 3 || /^(echo|cd|ls|export)\s+/m.test(trimmed)) {
      return 'bash';
    }

    // Python - Multiple Python-specific patterns
    const pythonPatterns = {
      defClass: /^(def|class)\s+\w+/m,
      imports: /^(from|import)\s+\w+/m,
      decorators: /^@\w+/m,
      selfParam: /\bdef\s+\w+\(self/,
      print: /\bprint\s*\(/,
      ifName: /if\s+__name__\s*==\s*['"]__main__['"]/,
      // No semicolons at end of lines (key differentiator from JS/Java/C#)
      noSemicolons: !/;\s*$/m.test(lines.slice(0, 10).join('\n'))
    };

    let pythonScore = 0;
    if (pythonPatterns.defClass.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.imports.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.decorators.test(trimmed)) pythonScore += 3;
    if (pythonPatterns.selfParam.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.print.test(trimmed)) pythonScore += 1;
    if (pythonPatterns.ifName.test(trimmed)) pythonScore += 3;
    if (pythonPatterns.noSemicolons && (pythonPatterns.defClass.test(trimmed) || pythonPatterns.imports.test(trimmed))) {
      pythonScore += 2;
    }

    if (pythonScore >= 4) {
      return 'python';
    }

    // TypeScript - Type annotations and TS-specific keywords
    const tsPatterns = {
      interface: /\b(interface|type)\s+\w+/,
      typeAnnotation: /:\s*(string|number|boolean|any|void|unknown|never)\b/,
      generics: /<[A-Z]\w*>/,
      asKeyword: /\bas\s+\w+/,
      typeAlias: /type\s+\w+\s*=/
    };

    let tsScore = 0;
    if (tsPatterns.interface.test(trimmed)) tsScore += 3;
    if (tsPatterns.typeAnnotation.test(trimmed)) tsScore += 2;
    if (tsPatterns.generics.test(trimmed)) tsScore += 1;
    if (tsPatterns.asKeyword.test(trimmed)) tsScore += 2;
    if (tsPatterns.typeAlias.test(trimmed)) tsScore += 3;

    // Also needs JS-like patterns
    const hasJsPatterns = /\b(const|let|var|function|=>|export|import)\b/.test(trimmed);

    if (tsScore >= 3 && hasJsPatterns) {
      return 'typescript';
    }

    // JavaScript - Multiple JS-specific patterns
    const jsPatterns = {
      varDecl: /\b(const|let|var)\s+\w+/,
      arrowFunc: /=>\s*[{(]/,
      functionKeyword: /\bfunction\s+\w+/,
      asyncAwait: /\b(async|await)\b/,
      consoleLog: /console\.(log|error|warn)/,
      requireImport: /\b(require\(|import\s+.*from)/,
      semicolons: /;$/m
    };

    let jsScore = 0;
    if (jsPatterns.varDecl.test(trimmed)) jsScore += 2;
    if (jsPatterns.arrowFunc.test(trimmed)) jsScore += 3;
    if (jsPatterns.functionKeyword.test(trimmed)) jsScore += 1;
    if (jsPatterns.asyncAwait.test(trimmed)) jsScore += 2;
    if (jsPatterns.consoleLog.test(trimmed)) jsScore += 2;
    if (jsPatterns.requireImport.test(trimmed)) jsScore += 2;
    if (jsPatterns.semicolons.test(trimmed)) jsScore += 1;

    if (jsScore >= 4) {
      return 'javascript';
    }

    // Java - Class-based with specific syntax
    const javaPatterns = {
      publicClass: /\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/,
      mainMethod: /public\s+static\s+void\s+main/,
      systemOut: /System\.(out|err)\.(println?|print)/,
      imports: /^import\s+[\w.]+;/m,
      semicolons: /;$/m,
      types: /\b(String|int|void|boolean|double|float|long|char)\s+\w+/
    };

    let javaScore = 0;
    if (javaPatterns.publicClass.test(trimmed)) javaScore += 3;
    if (javaPatterns.mainMethod.test(trimmed)) javaScore += 3;
    if (javaPatterns.systemOut.test(trimmed)) javaScore += 2;
    if (javaPatterns.imports.test(trimmed)) javaScore += 1;
    if (javaPatterns.types.test(trimmed)) javaScore += 1;
    if (javaPatterns.semicolons.test(trimmed)) javaScore += 1;

    if (javaScore >= 5) {
      return 'java';
    }

    // C# - Namespace and .NET patterns
    const csharpPatterns = {
      namespace: /\bnamespace\s+\w+/,
      usingSystem: /^using\s+(System|System\.)/m,
      publicClass: /\b(public|private|protected|internal)\s+(static\s+)?(class|interface|struct)\s+\w+/,
      properties: /\{\s*get;[\s\S]*?set;\s*\}/,
      linq: /\b(from\s+\w+\s+in\s+|select\s+\w+)/,
      async: /\basync\s+Task/
    };

    let csharpScore = 0;
    if (csharpPatterns.namespace.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.usingSystem.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.publicClass.test(trimmed)) csharpScore += 2;
    if (csharpPatterns.properties.test(trimmed)) csharpScore += 2;
    if (csharpPatterns.linq.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.async.test(trimmed)) csharpScore += 2;

    if (csharpScore >= 5) {
      return 'csharp';
    }

    // Go - Package and func keywords
    const goPatterns = {
      package: /^package\s+\w+/m,
      funcKeyword: /\bfunc\s+(\w+\s*)?\(/,
      imports: /^import\s+\(/m,
      goTypes: /\b(string|int|bool|byte|rune|error|interface\{\})\b/,
      defer: /\bdefer\s+\w+/,
      goroutine: /\bgo\s+\w+\(/
    };

    let goScore = 0;
    if (goPatterns.package.test(trimmed)) goScore += 3;
    if (goPatterns.funcKeyword.test(trimmed)) goScore += 2;
    if (goPatterns.imports.test(trimmed)) goScore += 2;
    if (goPatterns.goTypes.test(trimmed)) goScore += 1;
    if (goPatterns.defer.test(trimmed)) goScore += 2;
    if (goPatterns.goroutine.test(trimmed)) goScore += 3;

    if (goScore >= 5) {
      return 'go';
    }

    // Rust - fn, let, impl patterns
    const rustPatterns = {
      fnKeyword: /\bfn\s+\w+/,
      letMut: /\blet\s+(mut\s+)?\w+/,
      impl: /\bimpl\s+(\w+\s+for\s+)?\w+/,
      useKeyword: /^use\s+[\w:]+;/m,
      macro: /\w+!/,
      ownership: /&(mut\s+)?\w+|&str/
    };

    let rustScore = 0;
    if (rustPatterns.fnKeyword.test(trimmed)) rustScore += 2;
    if (rustPatterns.letMut.test(trimmed)) rustScore += 2;
    if (rustPatterns.impl.test(trimmed)) rustScore += 3;
    if (rustPatterns.useKeyword.test(trimmed)) rustScore += 2;
    if (rustPatterns.macro.test(trimmed)) rustScore += 2;
    if (rustPatterns.ownership.test(trimmed)) rustScore += 2;

    if (rustScore >= 5) {
      return 'rust';
    }

    // Ruby - def/end, specific syntax
    const rubyPatterns = {
      defEnd: /\bdef\s+\w+[\s\S]*?\bend\b/,
      symbols: /:\w+/,
      puts: /\bputs\s+/,
      instanceVar: /@\w+/,
      blocks: /\bdo\s+\|[\w,\s]+\||\{[\s\S]*?\|[\w,\s]+\|/,
      require: /^require\s+['"][\w\/]+['"]/m
    };

    let rubyScore = 0;
    if (rubyPatterns.defEnd.test(trimmed)) rubyScore += 3;
    if (rubyPatterns.symbols.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.puts.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.instanceVar.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.blocks.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.require.test(trimmed)) rubyScore += 1;

    if (rubyScore >= 5) {
      return 'ruby';
    }

    // Swift - func, var, let with Swift-specific patterns
    const swiftPatterns = {
      funcKeyword: /\bfunc\s+\w+/,
      varLet: /\b(var|let)\s+\w+/,
      importFoundation: /^import\s+(Foundation|UIKit|SwiftUI)/m,
      optionals: /\w+\?|\w+!/,
      guardLet: /\bguard\s+let\s+/,
      swiftPrint: /\bprint\(/
    };

    let swiftScore = 0;
    if (swiftPatterns.funcKeyword.test(trimmed)) swiftScore += 2;
    if (swiftPatterns.varLet.test(trimmed)) swiftScore += 1;
    if (swiftPatterns.importFoundation.test(trimmed)) swiftScore += 3;
    if (swiftPatterns.optionals.test(trimmed)) swiftScore += 2;
    if (swiftPatterns.guardLet.test(trimmed)) swiftScore += 3;
    if (swiftPatterns.swiftPrint.test(trimmed)) swiftScore += 1;

    if (swiftScore >= 5) {
      return 'swift';
    }

    // Kotlin - fun, val, var
    const kotlinPatterns = {
      funKeyword: /\bfun\s+\w+/,
      valVar: /\b(val|var)\s+\w+/,
      nullable: /\w+\?/,
      dataClass: /\bdata\s+class\s+\w+/,
      companionObject: /\bcompanion\s+object/,
      kotlinPrint: /\bprintln\(/
    };

    let kotlinScore = 0;
    if (kotlinPatterns.funKeyword.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.valVar.test(trimmed)) kotlinScore += 2;
    if (kotlinPatterns.nullable.test(trimmed)) kotlinScore += 1;
    if (kotlinPatterns.dataClass.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.companionObject.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.kotlinPrint.test(trimmed)) kotlinScore += 1;

    if (kotlinScore >= 5) {
      return 'kotlin';
    }

    // Markdown - Headers, lists, links
    if (/^#{1,6}\s+\w+/m.test(trimmed) ||
        /^\*\s+\w+/m.test(trimmed) ||
        /\[.+\]\(.+\)/.test(trimmed)) {
      return 'markdown';
    }

    // YAML - Key-value with colons, indentation-based
    if (/^\w+:\s*$/m.test(trimmed) && /^\s+\w+:/m.test(trimmed)) {
      return 'yaml';
    }

    // If we got here and it has semicolons, curly braces, and parentheses but didn't match specific languages
    // it might be C/C++ or generic code
    if (/[{};()]/.test(trimmed) && /\w+\s*\(/.test(trimmed)) {
      // Check for C/C++ specific patterns
      if (/#include\s+[<"]|int\s+main\s*\(|void\s+\w+\(|printf\(|std::/.test(trimmed)) {
        return /std::|\bcout\b|iostream/.test(trimmed) ? 'cpp' : 'c';
      }
    }

    // Unable to detect with confidence - return empty string
    // Better to show no language than misclassify
    return '';
  },

  extractBlocks(root, depth = 0) {
    const blocks = [];

    // Safety limit to prevent excessive recursion
    if (depth > 50) {
      console.warn('[ChatGPT Export] Maximum recursion depth reached in extractBlocks');
      return blocks;
    }

    const visit = (node) => {
      if (!node || node.nodeType !== 1) return;

      const tag = node.tagName.toLowerCase();

      // Code blocks - Handle both <pre><code> and ChatGPT's div-based structure
      if (tag === 'pre') {
        const code = node.querySelector('code') || node;
        let language = (code.className || '').match(/language-([a-z0-9+.-]+)/i)?.[1] || '';
        const text = code.textContent || '';

        // If no language from className, try smart detection
        if (!language && text.trim()) {
          language = this.detectCodeLanguage(text);
        }

        if (text.trim()) {
          blocks.push({ kind: 'code', language, text });
          return true;
        }
      }

      // ChatGPT's modern code block structure (div-based with header)
      // Structure: <div class="contain-inline-size..."><div class="flex...">language</div>...<code>...</code></div>
      if (tag === 'div' && node.classList.contains('contain-inline-size')) {
        // Look for code element (might or might not have language- class)
        const codeEl = node.querySelector('code');
        if (codeEl) {
          let language = '';

          // Priority 1: Check ChatGPT's header div for language label (most reliable)
          // This is what ChatGPT displays to users, so it's the ground truth
          const headerDiv = node.querySelector('div.flex.items-center[class*="rounded-t"]');
          if (headerDiv) {
            const labelText = headerDiv.textContent?.trim() || '';
            // Validate it looks like a language name (short, no spaces or only "Copy code")
            // Filter out UI text like "Copy code"
            const cleanLabel = labelText.replace(/copy code/gi, '').trim();
            if (cleanLabel && cleanLabel.length < 20 && /^[a-z0-9+#.-]+$/i.test(cleanLabel)) {
              language = cleanLabel.toLowerCase();
            }
          }

          // Priority 2: Check className if no header label found
          if (!language) {
            language = (codeEl.className || '').match(/language-([a-z0-9+.-]+)/i)?.[1] || '';
          }

          const text = codeEl.textContent || '';

          // Priority 3: Smart detection if still no language
          if (!language && text.trim()) {
            language = this.detectCodeLanguage(text);
          }

          if (text.trim()) {
            blocks.push({ kind: 'code', language, text });
            return true;
          }
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
        const subBlocks = this.extractBlocks(child, depth + 1);
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

  // Alias for consistency
  escapeHTML(s) {
    return this.escapeHtml(s);
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
      Timeline.cleanupAll();

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

    // Show processing notification
    NotificationManager.showToast('Processing conversation...', 'info');

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