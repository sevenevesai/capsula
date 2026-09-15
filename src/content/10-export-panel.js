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
            <svg class="icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 12.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 004.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 01-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 013 9.219V8.062zm4.542-.827a.25.25 0 00-.217.068l-.92.9a24.767 24.767 0 01-1.871-.183.25.25 0 00-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 00.189-.071l.754-.736.847 1.71a.25.25 0 00.404.062l.932-.97a25.286 25.286 0 001.922-.188.25.25 0 00-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 00-.166.076l-.754.785-.842-1.7a.25.25 0 00-.182-.135z"/>
              <path d="M8.5 1.866a1 1 0 10-1 0V3h-2A4.5 4.5 0 001 7.5V8a1 1 0 00-1 1v2a1 1 0 001 1v1a2 2 0 002 2h10a2 2 0 002-2v-1a1 1 0 001-1V9a1 1 0 00-1-1v-.5A4.5 4.5 0 0010.5 3h-2V1.866zM14 7.5V13a1 1 0 01-1 1H3a1 1 0 01-1-1V7.5A3.5 3.5 0 015.5 4h5A3.5 3.5 0 0114 7.5z"/>
            </svg>
            Assistant Only
          </button>
          <button class="filter-btn" data-filter="code" title="Show only code blocks">
            <svg class="icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
            </svg>
            Code
          </button>
          <button class="filter-btn" data-filter="tables" title="Show only tables">
            <svg class="icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 001-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 001 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
            </svg>
            Tables
          </button>
          <button class="filter-btn" data-filter="lists" title="Show only lists">
            <svg class="icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd" d="M5 11.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zm-3 1a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            Lists
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
          GitHub
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

      .bubble .math {
        text-align: center;
        margin: 8px 0;
        overflow-x: auto;
      }

      .bubble math {
        font-size: 1.15em;
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

      .secondary-btn:disabled {
        opacity: 0.5;
        cursor: default;
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

