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
  <title>Dashboard - ${Utils.escapeHtml(meta.title)}</title>
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
      <h1>Conversation Dashboard</h1>
      <div class="subtitle">${Utils.escapeHtml(meta.title)}</div>
      <div class="meta">
        <strong>Model:</strong> ${Utils.escapeHtml(stats.overview.model)} |
        <strong>Exported:</strong> ${Utils.escapeHtml(stats.overview.exportDate)}
      </div>
    </div>

    <!-- Overview Section -->
    <div class="section">
      <h2 class="section-title">Conversation Overview</h2>
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
      <h2 class="section-title">Content Statistics</h2>
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
      <h2 class="section-title">Code Languages</h2>
      <div class="chart-container">
        <div class="languages-list">
          ${Object.entries(stats.codeLanguages)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => `
              <div class="language-tag">
                <span>${Utils.escapeHtml(lang)}</span>
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
      <h2 class="section-title">Thinking State Analysis</h2>
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
      <h2 class="section-title">Canvas Artifacts</h2>
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
          <div class="card-value">${stats.attachments.byType.image}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.pdf > 0 ? `
        <div class="card">
          <div class="card-title">PDFs</div>
          <div class="card-value">${stats.attachments.byType.pdf}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.archive > 0 ? `
        <div class="card">
          <div class="card-title">Archives</div>
          <div class="card-value">${stats.attachments.byType.archive}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.document > 0 ? `
        <div class="card">
          <div class="card-title">Documents</div>
          <div class="card-value">${stats.attachments.byType.document}</div>
        </div>
        ` : ''}
        ${stats.attachments.byType.code > 0 ? `
        <div class="card">
          <div class="card-title">Code Files</div>
          <div class="card-value">${stats.attachments.byType.code}</div>
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
            const title = `Message ${idx + 1}: ${item.role} (${item.words} words)${item.hasCode ? ' [code]' : ''}${item.hasThinking ? ' [thinking]' : ''}`;
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

