/* ===========================
   Export Manager (Enhanced)
   =========================== */
const ExportManager = {
  async export(harvest, format = null) {
    const exportFormat = format || globalState.exportFormat;
    const source = await this.withEmbeddedImages(harvest, exportFormat);
    const content = this.generateContent(source, exportFormat);
    const filename = this.generateFilename(harvest, exportFormat);
    
    Utils.downloadFile(filename, content, this.getMimeType(exportFormat));
    NotificationManager.showToast(`Exported as ${filename}`);
    
    if (!format) {
      PanelManager.close();
    }
  },

  async copy(harvest, format = null) {
    const exportFormat = format || globalState.exportFormat;
    const source = await this.withEmbeddedImages(harvest, exportFormat);
    const content = this.generateContent(source, exportFormat);
    
    try {
      await navigator.clipboard.writeText(content);
      NotificationManager.showToast('Copied to clipboard');
    } catch (err) {
      console.error('[ChatGPT Export] Copy failed:', err);
      NotificationManager.showToast('Failed to copy', 'error');
    }
  },

  // HTML and Markdown downloads and copies embed images when the setting is
  // on. JSON keeps URLs, and the integrations are untouched: GitHub strips
  // data URIs from rendered markdown and Notion only accepts external URLs.
  async withEmbeddedImages(harvest, format) {
    if (!globalState.settings.current.embedImages) return harvest;
    if (format !== 'html' && format !== 'markdown') return harvest;
    try {
      const result = await ImageEmbedder.embed(harvest, count => {
        NotificationManager.showToast(`Embedding ${count} image${count === 1 ? '' : 's'}...`, 'info');
      });
      if (result.failed) {
        NotificationManager.showToast(
          `${result.failed} image${result.failed === 1 ? '' : 's'} could not be embedded and keep${result.failed === 1 ? 's' : ''} the original link`,
          'error'
        );
      }
      return result.harvest;
    } catch (err) {
      console.error('[ChatGPT Export] Image embedding failed:', err);
      return harvest;
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
        md += `**Canvas Artifact**: ${msg.canvasTitle}`;
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
          out.push('\n' + this.listTreeToMarkdown(
            b.tree || (b.items || []).map(t => ({ md: t })),
            b.ordered === true, 0
          ) + '\n');
          break;
        case 'code': {
          const text = b.text || '';
          // Fence must be longer than any backtick run inside the code
          const runs = text.match(/`{3,}/g) || [];
          const fence = '`'.repeat(Math.max(3, ...runs.map(r => r.length + 1)));
          const lang = (b.language || '').replace(/[`\s]/g, '');
          out.push(`\n\n${fence}${lang}\n${text}\n${fence}\n`);
          break;
        }
        case 'table': {
          const pipe = !b.complex && Array.isArray(b.rows) && b.rows.length
            ? this.tableRowsToMarkdown(b.rows)
            : '';
          out.push(`\n\n${pipe || b.html || ''}\n`);
          break;
        }
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
    // Join blocks with exactly one blank line without collapsing newlines
    // inside code blocks
    return out
      .map(part => part.replace(/^\n+|\n+$/g, ''))
      .filter(Boolean)
      .join('\n\n') + '\n';
  },

  listTreeToMarkdown(items, ordered, depth) {
    const indent = '  '.repeat(depth);
    return items.map((item, i) => {
      const marker = ordered ? `${i + 1}.` : '-';
      let line = `${indent}${marker} ${item.md || ''}`;
      if (item.children && item.children.length) {
        line += '\n' + this.listTreeToMarkdown(item.children, item.ordered === true, depth + 1);
      }
      return line;
    }).join('\n');
  },

  tableRowsToMarkdown(rows) {
    const width = Math.max(...rows.map(r => r.length));
    if (!isFinite(width) || width < 1) return '';
    const esc = cell => String(cell || '').replace(/\|/g, '\\|');
    const line = row => `| ${Array.from({ length: width }, (_, i) => esc(row[i])).join(' | ')} |`;
    const [head, ...body] = rows;
    return [
      line(head),
      `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
      ...body.map(line)
    ].join('\n');
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
    .math {
      text-align: center;
      margin: 12px 0;
      overflow-x: auto;
    }
    math {
      font-size: 1.15em;
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
        image: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/><path d="M2.002 1a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V3a2 2 0 00-2-2h-12zm12 1a1 1 0 011 1v6.5l-3.777-1.947a.5.5 0 00-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 00-.63.062L1.002 12V3a1 1 0 011-1h12z"/></svg>',
        pdf: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0H4z"/><path d="M5.5 7a.5.5 0 000 1h1a.5.5 0 000-1h-1zM5 9.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5z"/></svg>',
        archive: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1v7.5a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 011 12.5V5a1 1 0 01-1-1V2zm2 3v7.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V5H2zm13-3H1v2h14V2zM5 7.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z"/></svg>',
        document: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0H4zm0 1h5v2A1.5 1.5 0 0010.5 4.5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"/></svg>',
        code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/></svg>',
        file: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3a2.5 2.5 0 015 0v9a1.5 1.5 0 01-3 0V5a.5.5 0 011 0v7a.5.5 0 001 0V3a1.5 1.5 0 10-3 0v9a2.5 2.5 0 005 0V5a.5.5 0 011 0v7a3.5 3.5 0 11-7 0V3z"/></svg>'
      };
      const icon = icons[msg.attachment.category] || icons.file;
      metadataHtml += `<div class="file-attachment">
        <span style="vertical-align: middle;">${icon}</span>
        <div>
          <strong>Attached:</strong> ${Utils.escapeHtml(msg.attachment.fileName)}
          ${msg.attachment.fileType ? `<span class="file-type">(${Utils.escapeHtml(msg.attachment.fileType)})</span>` : ''}
        </div>
      </div>`;
    }

    // Canvas artifact marker (assistant messages only)
    if (msg.isCanvas && msg.role === 'assistant') {
      metadataHtml += `<div class="canvas-marker">
        <strong>Canvas Artifact:</strong> ${Utils.escapeHtml(msg.canvasTitle)}
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

