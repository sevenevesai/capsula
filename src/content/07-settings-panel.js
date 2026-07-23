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

          <div class="setting-group">
            <h3>Tutorial</h3>
            <p class="setting-description">Need a refresher on Capsula's features?</p>

            <div class="setting-item">
              <button class="secondary-btn tutorial-restart-btn" data-action="restart-tutorial">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px;">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                </svg>
                Restart Tutorial
              </button>
              <small class="setting-hint">
                This will show the 10-step walkthrough that introduces Capsula's features.
              </small>
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

    // Restart tutorial button
    const tutorialBtn = container.querySelector('[data-action="restart-tutorial"]');
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        // Reset tutorial state so it shows again
        tutorialManager.state.resetAll();

        // Switch back to main view
        globalState.setViewMode('main');

        // Start tutorial after a short delay to let view settle
        setTimeout(() => {
          tutorialManager.startFlow('welcome');
        }, 300);
      });
    }

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

