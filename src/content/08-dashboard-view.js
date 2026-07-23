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
          <h2 class="dashboard-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            Conversation Dashboard
          </h2>
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
                    <span>${Utils.escapeHtml(lang)}</span>
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
                <span class="dashboard-metadata-value">${Utils.escapeHtml(stats.overview.model)}</span>
              </div>
              <div class="dashboard-metadata-item">
                <span class="dashboard-metadata-label">Exported:</span>
                <span class="dashboard-metadata-value">${Utils.escapeHtml(stats.overview.exportDate)}</span>
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

