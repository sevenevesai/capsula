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

