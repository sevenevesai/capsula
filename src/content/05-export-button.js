/* ===========================
   Export Button Component
   =========================== */
const ExportButton = {
  // onClick opens the panel. onMove(position) receives the anchored position
  // (see toAnchored) after a drag ends, for persistence.
  create(onClick, onMove) {
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
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
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
        .wrap.dragging .btn {
          cursor: grabbing;
          transform: none;
          transition: none;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
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
          line-height: 1.3;
          text-align: right;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .tooltip-hint {
          display: block;
          font-size: 10px;
          color: ${colors.textSecondary};
          margin-top: 2px;
        }
        .btn:hover:not(.loading) .tooltip {
          opacity: 1;
        }
        .wrap.dragging .tooltip {
          opacity: 0;
        }
        /* Flip the tooltip when the button sits where it would be clipped */
        .wrap.near-top .tooltip {
          bottom: auto;
          top: 100%;
          margin-bottom: 0;
          margin-top: 8px;
        }
        .wrap.near-left .tooltip {
          right: auto;
          left: 0;
          text-align: left;
        }
      </style>
      <div class="wrap">
        <button class="btn" type="button" aria-label="Export conversation" role="button">
          <span class="tooltip">
            <span class="tooltip-main">Export conversation (Alt+E)</span>
            <span class="tooltip-hint">Drag to move</span>
          </span>
          <div class="spinner" aria-hidden="true"></div>
          <svg class="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m0 0l-4-4m4 4l4-4"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    const wrap = shadow.querySelector('.wrap');
    const btn = shadow.querySelector('button.btn');
    const tooltipMain = shadow.querySelector('.tooltip-main');
    const tooltipHint = shadow.querySelector('.tooltip-hint');

    host.setLoading = (isLoading) => {
      btn.classList.toggle('loading', isLoading);
      btn.setAttribute('aria-busy', String(isLoading));
      tooltipMain.textContent = isLoading ? 'Processing conversation...' : 'Export conversation (Alt+E)';
      tooltipHint.style.display = isLoading ? 'none' : '';
    };

    // Position recomputes (resize, page mutations) must not fight the pointer
    host.isDragging = false;

    const drag = { pointerId: null, startX: 0, startY: 0, originLeft: 0, originTop: 0, moved: false };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || btn.classList.contains('loading')) return;
      const rect = host.getBoundingClientRect();
      drag.pointerId = e.pointerId;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.originLeft = rect.left;
      drag.originTop = rect.top;
      drag.moved = false;
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* capture is best-effort */ }
    });

    btn.addEventListener('pointermove', (e) => {
      if (drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < CFG.dragThresholdPx) return;
        drag.moved = true;
        host.isDragging = true;
        wrap.classList.add('dragging');
      }
      this.place(host, drag.originLeft + dx, drag.originTop + dy);
    });

    const endDrag = (e) => {
      if (drag.pointerId !== e.pointerId) return;
      drag.pointerId = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
      if (!drag.moved) return;
      wrap.classList.remove('dragging');
      host.isDragging = false;
      if (onMove) onMove(this.toAnchored(host.getBoundingClientRect()));
      // The click for this press fires synchronously after pointerup, so the
      // flag must outlive it and then clear for the next press
      setTimeout(() => { drag.moved = false; }, 0);
    };
    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', endDrag);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (drag.moved) return; // a drag just ended on this button, not a click
      if (!btn.classList.contains('loading')) {
        onClick();
      }
    });

    return host;
  },

  // Express a viewport rect as offsets from the nearest horizontal and
  // vertical edges. Resizing the window then keeps the button in the same
  // corner instead of pinning it to absolute coordinates.
  toAnchored(rect) {
    const vp = this.viewport();
    const anchorX = rect.left + rect.width / 2 < vp.width / 2 ? 'left' : 'right';
    const anchorY = rect.top + rect.height / 2 < vp.height / 2 ? 'top' : 'bottom';
    return {
      anchorX,
      anchorY,
      x: Math.round(anchorX === 'left' ? rect.left : vp.width - rect.right),
      y: Math.round(anchorY === 'top' ? rect.top : vp.height - rect.bottom)
    };
  },

  // null restores the default corner; the caller applies any composer nudge
  applyPosition(host, position) {
    const wrap = host.shadowRoot && host.shadowRoot.querySelector('.wrap');
    if (!position) {
      host.style.left = '';
      host.style.top = '';
      host.style.right = `${CFG.right}px`;
      host.style.bottom = `calc(${CFG.bottom}px + env(safe-area-inset-bottom))`;
      if (wrap) wrap.classList.remove('near-top', 'near-left');
      return;
    }
    const { width, height } = this.size(host);
    const vp = this.viewport();
    const left = position.anchorX === 'right' ? vp.width - position.x - width : position.x;
    const top = position.anchorY === 'bottom' ? vp.height - position.y - height : position.y;
    this.place(host, left, top);
  },

  // Pin the host at viewport coordinates, clamped so it never leaves the window
  place(host, left, top) {
    const { width, height } = this.size(host);
    const vp = this.viewport();
    const margin = CFG.edgeMarginPx;
    const maxLeft = Math.max(margin, vp.width - width - margin);
    const maxTop = Math.max(margin, vp.height - height - margin);
    left = Math.min(Math.max(left, margin), maxLeft);
    top = Math.min(Math.max(top, margin), maxTop);

    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;

    const wrap = host.shadowRoot && host.shadowRoot.querySelector('.wrap');
    if (wrap) {
      // Tooltip needs roughly its own height above and ~200px to the left
      wrap.classList.toggle('near-top', top < 56);
      wrap.classList.toggle('near-left', left < 200);
    }
  },

  size(host) {
    const rect = host.getBoundingClientRect();
    return { width: rect.width || CFG.minSize, height: rect.height || CFG.minSize };
  },

  // Fixed positioning is relative to the viewport minus scrollbars, which is
  // what the root's client size measures (innerWidth includes scrollbars)
  viewport() {
    const root = document.documentElement;
    return {
      width: root.clientWidth || window.innerWidth,
      height: root.clientHeight || window.innerHeight
    };
  }
};
