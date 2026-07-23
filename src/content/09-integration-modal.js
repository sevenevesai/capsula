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

    // Show tutorial for first-time users
    this.showSimpleTutorial(service, modal);
  },

  /**
   * Show a simple tutorial tooltip
   */
  showSimpleTutorial(service, modalHost) {
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

      // Add close handler and auto-cleanup
      document.body.appendChild(tutorial);

      // Remove tutorial when modal is removed from DOM
      const cleanupObserver = new MutationObserver(() => {
        if (!document.contains(modalHost)) {
          if (tutorial.parentNode) tutorial.remove();
          cleanupObserver.disconnect();
        }
      });
      cleanupObserver.observe(document.body, { childList: true });

      const closeBtn = tutorial.querySelector('#tutorial-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          tutorial.remove();
          cleanupObserver.disconnect();
        });
      }

      // Auto-dismiss after 15 seconds
      setTimeout(() => {
        if (tutorial.parentNode) tutorial.remove();
        cleanupObserver.disconnect();
      }, 15000);
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
        <h2>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle; margin-right: 8px; color: #f59e0b;">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          Permission Required
        </h2>
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
              const icon = page.object === 'database'
                ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: middle; margin-right: 6px;"><path d="M3 2.5a2.5 2.5 0 015 0 2.5 2.5 0 015 0v.006c0 .07 0 .27-.038.494H15a1 1 0 011 1v2a1 1 0 01-1 1v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 14.5V7a1 1 0 01-1-1V4a1 1 0 011-1h2.038A2.968 2.968 0 013 2.506V2.5zm1.068.5H7v-.5a1.5 1.5 0 10-3 0c0 .085.002.274.045.43a.522.522 0 00.023.07zM9 3h2.932a.56.56 0 00.023-.07c.043-.156.045-.345.045-.43a1.5 1.5 0 00-3 0V3zM1 4v2h6V4H1zm8 0v2h6V4H9zm5 3H9v8h4.5a.5.5 0 00.5-.5V7zm-7 8V7H2v7.5a.5.5 0 00.5.5H7z"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: middle; margin-right: 6px;"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0H4zm0 1h5v2A1.5 1.5 0 0010.5 4.5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"/></svg>';
              return `
                <div class="page-item" data-page-id="${page.id}" data-page-type="${page.object === 'database' ? 'database' : 'page'}" style="padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 4px;">
                  ${icon} ${title}
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
          pageList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load pages: ${Utils.escapeHtml(result.error?.message || 'Unknown error')}</div>`;
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

