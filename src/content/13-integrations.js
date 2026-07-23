/* ===========================
   Integration Storage Module
   =========================== */
/**
 * Secure token storage via background broker.
 * Privacy-first: tokens handled by background script, never in page context.
 */
const IntegrationStorage = {
  /**
   * Get token for a service
   * @param {'github'|'notion'} service
   * @returns {Promise<string|null>}
   */
  async getToken(service) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_GET',
        service
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to get token:', response.error);
        return null;
      }

      return response.data || null;
    } catch (e) {
      console.error('[Capsula] Failed to get token:', e);
      return null;
    }
  },

  /**
   * Set token for a service
   * @param {'github'|'notion'} service
   * @param {string} token
   * @param {string} [passphrase] - Optional passphrase for encryption (reserved for future use)
   * @returns {Promise<boolean>}
   */
  async setToken(service, token, passphrase = null) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_SET',
        service,
        tokenPlain: token,
        tokenCiphertext: passphrase ? null : undefined // Reserved for encryption
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to set token:', response.error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[Capsula] Failed to set token:', e);
      return false;
    }
  },

  /**
   * Clear token for a service
   * @param {'github'|'notion'} service
   * @returns {Promise<boolean>}
   */
  async clearToken(service) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TOKEN_CLEAR',
        service
      });

      if (!response.ok) {
        console.error('[Capsula] Failed to clear token:', response.error);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[Capsula] Failed to clear token:', e);
      return false;
    }
  },

  /**
   * Get configuration for a service (stored locally for non-sensitive data)
   * @param {'github'|'notion'} service
   * @returns {Promise<Object>}
   */
  async getConfig(service) {
    try {
      const key = `capsula_config_${service}`;
      const result = await browser.storage.local.get(key);
      return result[key] || {};
    } catch (e) {
      console.error('[Capsula] Failed to get config:', e);
      return {};
    }
  },

  /**
   * Set configuration for a service (stored locally for non-sensitive data)
   * @param {'github'|'notion'} service
   * @param {Object} config
   * @returns {Promise<boolean>}
   */
  async setConfig(service, config) {
    try {
      const key = `capsula_config_${service}`;
      await browser.storage.local.set({ [key]: config });
      return true;
    } catch (e) {
      console.error('[Capsula] Failed to set config:', e);
      return false;
    }
  }
};

/* ===========================
   HTTP Request Module
   =========================== */
/**
 * HTTP client with retry logic, rate limiting, and exponential backoff.
 * Handles GitHub and Notion API specifics.
 *
 * @typedef {Object} NormalizedError
 * @property {'AUTH'|'SCOPE'|'RATE_LIMIT'|'PAYLOAD_TOO_LARGE'|'NETWORK'|'VALIDATION'|'UNKNOWN'} code
 * @property {string} message
 * @property {string} [hint]
 * @property {*} [raw]
 */
/**
 * HttpClient - Proxy for all network requests via background broker
 *
 * All HTTP requests are routed through the background script to avoid CSP violations.
 * The background script handles retry logic, rate limiting, timeouts, and error normalization.
 */
const HttpClient = {
  TIMEOUT_MS: 30000,

  /**
   * Make HTTP request via background broker
   * @param {string} url - The URL to request
   * @param {Object} options - Request options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.headers={}] - Request headers
   * @param {Object} [options.body] - Request body (for POST/PATCH/PUT)
   * @param {number} [options.timeoutMs] - Custom timeout in ms
   * @returns {Promise<{ok: boolean, data?: any, headers?: Object, error?: NormalizedError}>}
   */
  async request(url, options = {}) {
    // Check if online (quick check before sending message)
    if (!navigator.onLine) {
      return {
        ok: false,
        error: {
          code: 'NETWORK',
          message: "You're offline",
          hint: 'Check your internet connection and try again.'
        }
      };
    }

    try {
      // Send request to background broker
      // Background handles: retries, rate limiting, timeouts, error normalization
      const response = await browser.runtime.sendMessage({
        type: 'HTTP_JSON',
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        timeoutMs: options.timeoutMs || this.TIMEOUT_MS
      });

      return response;

    } catch (err) {
      // Handle message passing errors (e.g., background script not responding)
      console.error('[Capsula] Failed to send request to background broker:', err);
      return {
        ok: false,
        error: {
          code: 'NETWORK',
          message: 'Failed to communicate with background script',
          hint: 'Please reload the extension and try again.',
          raw: err
        }
      };
    }
  }
};

/* ===========================
   Exporter Types & Registry
   =========================== */
/**
 * @typedef {Object} ExportFilters
 * @property {boolean} assistantOnly
 * @property {boolean} code
 * @property {boolean} tables
 * @property {boolean} lists
 */

/**
 * @typedef {Object} ExportResult
 * @property {boolean} ok
 * @property {string} [url]
 * @property {NormalizedError} [error]
 */

/**
 * @typedef {Object} Exporter
 * @property {function(): Promise<{ok: boolean, identity?: string, scopes?: string[], error?: string}>} testConnection
 * @property {function(Object, ExportFilters, Object): Promise<ExportResult>} export
 */

const ExporterRegistry = {
  _exporters: new Map(),

  /**
   * Register an exporter
   * @param {'github-gist'|'github-issue'|'notion'} service
   * @param {Exporter} exporter
   */
  register(service, exporter) {
    this._exporters.set(service, exporter);
  },

  /**
   * Get an exporter
   * @param {string} service
   * @returns {Exporter|null}
   */
  get(service) {
    return this._exporters.get(service) || null;
  },

  /**
   * Check if a service is registered
   * @param {string} service
   * @returns {boolean}
   */
  has(service) {
    return this._exporters.has(service);
  }
};

/* ===========================
   Integration Markdown Formatter
   =========================== */
/**
 * Enhanced markdown formatter for GitHub and Notion exports.
 * Handles large conversations with intelligent splitting.
 */
const IntegrationMarkdownFormatter = {
  GITHUB_MAX_GIST_SIZE: 1_000_000, // 1MB
  SPLIT_MARKER: '\n\n---\n\n',

  /**
   * Convert harvest to markdown with optional splitting for GitHub
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {boolean} [enableSplitting=false]
   * @returns {string|Object} - String if single file, Object with filenames as keys if split
   */
  toMarkdown(harvest, filters, enableSplitting = false) {
    const messages = this._filterMessages(harvest.messages, filters);
    const meta = harvest.meta || {};

    // Build header
    let markdown = this._buildHeader(meta, filters);

    // Build content
    const content = messages.map((msg, idx) => this._formatMessage(msg, idx)).join('\n\n');
    markdown += content;

    // Build footer with index
    markdown += this._buildFooter(messages);

    // Handle splitting if enabled
    if (enableSplitting && markdown.length > this.GITHUB_MAX_GIST_SIZE) {
      return this._splitMarkdown(markdown, meta.title || 'conversation');
    }

    return markdown;
  },

  /**
   * Build markdown header
   * @private
   */
  _buildHeader(meta, filters) {
    const title = meta.title || 'ChatGPT Conversation';
    const timestamp = new Date().toISOString();
    const model = meta.model || 'Unknown';

    let header = `# ${title}\n\n`;
    header += `_Exported with [Capsula](https://seveneves.ai/capsula) on ${timestamp}_\n\n`;
    header += `**Model**: ${model}\n\n`;

    // Show active filters
    const activeFilters = [];
    if (filters.assistantOnly) activeFilters.push('Assistant Only');
    if (filters.code) activeFilters.push('Code');
    if (filters.tables) activeFilters.push('Tables');
    if (filters.lists) activeFilters.push('Lists');

    if (activeFilters.length > 0) {
      header += `**Active Filters**: ${activeFilters.join(', ')}\n\n`;
    }

    header += '---\n\n';
    return header;
  },

  /**
   * Format a single message as markdown
   * @private
   */
  _formatMessage(message, index) {
    const role = message.role === 'user' ? 'User' : 'Assistant';
    let md = `## Message ${index + 1}: ${role}\n\n`;

    // Add thinking label if present
    if (message.thinking?.labels?.length) {
      md += `_${message.thinking.labels.join(', ')}_\n\n`;
    }

    // Add canvas marker
    if (message.isCanvas) {
      md += `**Canvas**: ${message.canvasTitle || 'Untitled'} (${message.canvasType || 'document'})\n\n`;
    }

    // Add attachment marker
    if (message.hasAttachment && message.attachment) {
      md += `📎 **Attachment**: ${message.attachment.fileName}\n\n`;
    }

    // Format blocks
    if (message.blocks && message.blocks.length > 0) {
      md += message.blocks.map(block => this._formatBlock(block)).join('\n\n');
    } else if (message.plain?.text) {
      md += message.plain.text;
    }

    return md;
  },

  /**
   * Format a content block as markdown
   * @private
   */
  _formatBlock(block) {
    switch (block.kind) {
      case 'heading':
        const level = Math.min(6, Math.max(1, (block.level || 1) + 2)); // Offset by 2 since message is h2
        return `${'#'.repeat(level)} ${block.text || ''}`;

      case 'para':
        return block.md || '';

      case 'code':
        const lang = block.language || '';
        return `\`\`\`${lang}\n${block.text || ''}\n\`\`\``;

      case 'list':
        const items = (block.items || []).map((item, i) => {
          const prefix = block.ordered ? `${i + 1}. ` : '- ';
          return `${prefix}${item}`;
        }).join('\n');
        return items;

      case 'table':
        // Return HTML table as-is (markdown tables are complex)
        return block.html || '';

      case 'quote':
        return `> ${block.md || ''}`;

      case 'math':
        return `$$\n${block.latex || ''}\n$$`;

      case 'divider':
        return '---';

      default:
        return '';
    }
  },

  /**
   * Build footer with message index
   * @private
   */
  _buildFooter(messages) {
    let footer = '\n\n---\n\n## Message Index\n\n';
    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const preview = this._getMessagePreview(msg);
      footer += `- [Message ${idx + 1}](#message-${idx + 1}-${role.toLowerCase()}): ${role} - ${preview}\n`;
    });
    return footer;
  },

  /**
   * Get short preview of message content
   * @private
   */
  _getMessagePreview(message) {
    if (message.plain?.text) {
      return message.plain.text.slice(0, 60).replace(/\n/g, ' ') + '...';
    }
    if (message.blocks?.length) {
      const firstBlock = message.blocks[0];
      if (firstBlock.text) return firstBlock.text.slice(0, 60) + '...';
      if (firstBlock.md) return firstBlock.md.slice(0, 60) + '...';
    }
    return '(empty)';
  },

  /**
   * Split markdown into multiple files if too large
   * @private
   * @returns {Object} - { 'filename.md': content, ... }
   */
  _splitMarkdown(markdown, title) {
    const baseName = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const files = {};
    const maxSize = this.GITHUB_MAX_GIST_SIZE - 10000; // Leave buffer

    // Split by messages (using ## Message pattern)
    const parts = markdown.split(/(?=^## Message \d+)/m);
    const header = parts[0];
    const messages = parts.slice(1);

    let currentPart = 1;
    let currentContent = header;

    messages.forEach((msg, idx) => {
      if (currentContent.length + msg.length > maxSize) {
        // Save current part
        files[`${baseName}-part-${String(currentPart).padStart(3, '0')}.md`] = currentContent;
        currentPart++;
        currentContent = header + `\n\n_Continued from part ${currentPart - 1}_\n\n`;
      }
      currentContent += msg + '\n\n';
    });

    // Save final part
    files[`${baseName}-part-${String(currentPart).padStart(3, '0')}.md`] = currentContent;

    // Create index file
    const indexContent = this._buildSplitIndex(baseName, title, Object.keys(files));
    files[`${baseName}-index.md`] = indexContent;

    return files;
  },

  /**
   * Build index file for split conversations
   * @private
   */
  _buildSplitIndex(baseName, title, filenames) {
    let index = `# ${title}\n\n`;
    index += `_This conversation was split into multiple files due to size._\n\n`;
    index += `## Parts\n\n`;
    filenames.forEach((filename, idx) => {
      if (!filename.includes('index')) {
        index += `${idx + 1}. [${filename}](./${filename})\n`;
      }
    });
    return index;
  },

  /**
   * Filter messages based on filters and selection
   * @private
   */
  _filterMessages(messages, filters) {
    // Use MessageFilter.getExportMessages to respect selection
    return MessageFilter.getExportMessages(messages);
  },

  /**
   * Old filter logic preserved for reference (now handled by MessageFilter.getExportMessages)
   * @private
   * @deprecated
   */
  _filterMessagesLegacy(messages, filters) {
    let filtered = [...messages];

    if (filters.assistantOnly) {
      filtered = filtered.filter(m => m.role === 'assistant');
    }

    if (filters.code) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'code')
      );
    }

    if (filters.tables) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'table')
      );
    }

    if (filters.lists) {
      filtered = filtered.filter(m =>
        m.blocks?.some(b => b.kind === 'list')
      );
    }

    return filtered;
  }
};

/* ===========================
   Notion Blocks Converter
   =========================== */
/**
 * Converts Capsula message format to Notion blocks API format.
 * Handles chunking for large content (max 1800 chars per block).
 */
const NotionBlocksConverter = {
  MAX_CHARS_PER_BLOCK: 1800,
  MAX_BLOCKS_PER_REQUEST: 100,

  /**
   * Convert harvest to Notion blocks
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @returns {Array} - Array of Notion block objects
   */
  toBlocks(harvest, filters) {
    const messages = IntegrationMarkdownFormatter._filterMessages(harvest.messages, filters);
    const blocks = [];

    // Add title and metadata as initial blocks
    blocks.push(...this._buildHeaderBlocks(harvest.meta, filters));

    // Convert each message to blocks
    messages.forEach((msg, idx) => {
      blocks.push(...this._messageToBlocks(msg, idx));
    });

    return blocks;
  },

  /**
   * Build header blocks for Notion page
   * @private
   */
  _buildHeaderBlocks(meta, filters) {
    const blocks = [];
    const timestamp = new Date().toISOString().split('T')[0];

    // Metadata paragraph
    let metaText = `Exported with Capsula on ${timestamp}`;
    if (meta.model) metaText += ` • Model: ${meta.model}`;

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: metaText },
          annotations: { italic: true, color: 'gray' }
        }]
      }
    });

    // Active filters (if any)
    const activeFilters = [];
    if (filters.assistantOnly) activeFilters.push('Assistant Only');
    if (filters.code) activeFilters.push('Code');
    if (filters.tables) activeFilters.push('Tables');
    if (filters.lists) activeFilters.push('Lists');

    if (activeFilters.length > 0) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Active Filters: ${activeFilters.join(', ')}` }
          }],
          icon: { emoji: '🔍' }
        }
      });
    }

    // Divider
    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });

    return blocks;
  },

  /**
   * Convert a single message to Notion blocks
   * @private
   */
  _messageToBlocks(message, index) {
    const blocks = [];
    const role = message.role === 'user' ? 'User' : 'Assistant';

    // Message header as heading
    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{
          type: 'text',
          text: { content: `Message ${index + 1}: ${role}` },
          annotations: { bold: true }
        }]
      }
    });

    // Thinking label (if present)
    if (message.thinking?.labels?.length) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: message.thinking.labels.join(', ') },
            annotations: { italic: true, color: 'gray' }
          }]
        }
      });
    }

    // Canvas marker
    if (message.isCanvas) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Canvas: ${message.canvasTitle || 'Untitled'} (${message.canvasType || 'document'})` }
          }],
          color: 'blue_background'
        }
      });
    }

    // Attachment marker
    if (message.hasAttachment && message.attachment) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `Attachment: ${message.attachment.fileName}` }
          }],
          icon: { emoji: '📎' }
        }
      });
    }

    // Convert message blocks
    if (message.blocks && message.blocks.length > 0) {
      message.blocks.forEach(block => {
        blocks.push(...this._blockToNotionBlocks(block));
      });
    } else if (message.plain?.text) {
      blocks.push(...this._textToParagraphBlocks(message.plain.text));
    }

    return blocks;
  },

  /**
   * Convert a content block to Notion blocks
   * @private
   */
  _blockToNotionBlocks(block) {
    switch (block.kind) {
      case 'heading':
        const level = Math.min(3, Math.max(1, (block.level || 1)));
        const headingType = `heading_${level}`;
        return [{
          object: 'block',
          type: headingType,
          [headingType]: {
            rich_text: this._chunkText(block.text || '', this.MAX_CHARS_PER_BLOCK)
          }
        }];

      case 'para':
        return this._textToParagraphBlocks(block.md || '');

      case 'code':
        return this._codeToBlocks(block.text || '', block.language);

      case 'list':
        return this._listToBlocks(block.items || [], block.ordered);

      case 'quote':
        return [{
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: this._chunkText(block.md || '', this.MAX_CHARS_PER_BLOCK)
          }
        }];

      case 'table':
        // Tables are complex in Notion - render as toggle with HTML
        return [{
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ type: 'text', text: { content: 'Table (HTML)' } }],
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: this._chunkText(block.html || '', this.MAX_CHARS_PER_BLOCK)
              }
            }]
          }
        }];

      case 'divider':
        return [{
          object: 'block',
          type: 'divider',
          divider: {}
        }];

      default:
        return [];
    }
  },

  /**
   * Convert text to paragraph blocks with chunking
   * @private
   */
  _textToParagraphBlocks(text) {
    const chunks = this._chunkText(text, this.MAX_CHARS_PER_BLOCK);
    return chunks.map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [chunk]
      }
    }));
  },

  /**
   * Convert code to Notion code blocks with chunking
   * @private
   */
  _codeToBlocks(code, language = 'plain text') {
    // Notion has specific language names
    const notionLang = this._mapLanguage(language);

    // Split code if too long
    if (code.length <= this.MAX_CHARS_PER_BLOCK) {
      return [{
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{
            type: 'text',
            text: { content: code }
          }],
          language: notionLang
        }
      }];
    }

    // Split into multiple code blocks
    const chunks = this._chunkCode(code, this.MAX_CHARS_PER_BLOCK);
    return chunks.map((chunk, idx) => ({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{
          type: 'text',
          text: { content: `// Part ${idx + 1}/${chunks.length}\n${chunk}` }
        }],
        language: notionLang
      }
    }));
  },

  /**
   * Convert list to Notion list blocks
   * @private
   */
  _listToBlocks(items, ordered = false) {
    const blockType = ordered ? 'numbered_list_item' : 'bulleted_list_item';
    return items.map(item => ({
      object: 'block',
      type: blockType,
      [blockType]: {
        rich_text: this._chunkText(item, this.MAX_CHARS_PER_BLOCK)
      }
    }));
  },

  /**
   * Chunk text into rich_text array (max chars per chunk)
   * @private
   */
  _chunkText(text, maxChars) {
    if (text.length <= maxChars) {
      return [{ type: 'text', text: { content: text } }];
    }

    const chunks = [];
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push({
        type: 'text',
        text: { content: text.slice(i, i + maxChars) }
      });
    }
    return chunks;
  },

  /**
   * Chunk code preserving line breaks
   * @private
   */
  _chunkCode(code, maxChars) {
    const lines = code.split('\n');
    const chunks = [];
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChars) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  },

  /**
   * Map common language names to Notion's supported languages
   * @private
   */
  _mapLanguage(lang) {
    const map = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'shell',
      'bash': 'shell',
      'yml': 'yaml',
      'md': 'markdown'
    };
    return map[lang.toLowerCase()] || lang.toLowerCase() || 'plain text';
  },

  /**
   * Batch blocks into chunks for API requests
   * @param {Array} blocks
   * @returns {Array<Array>} - Array of block batches
   */
  batchBlocks(blocks) {
    const batches = [];
    for (let i = 0; i < blocks.length; i += this.MAX_BLOCKS_PER_REQUEST) {
      batches.push(blocks.slice(i, i + this.MAX_BLOCKS_PER_REQUEST));
    }
    return batches;
  }
};

