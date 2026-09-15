
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
      mdSuffix: '',
      // null = default corner. Otherwise { anchorX, anchorY, x, y }: offsets from
      // the nearest viewport edges, so the button keeps its corner on resize.
      buttonPosition: null,
      // Replace image URLs with data URIs in HTML/Markdown downloads and copies
      embedImages: true
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

