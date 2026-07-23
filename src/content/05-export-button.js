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

