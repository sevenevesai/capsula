/* ===========================
   Notion Exporter
   =========================== */
/**
 * Notion integration for creating pages with blocks.
 * Implements the Exporter interface.
 */
const NotionExporter = {
  API_BASE: 'https://api.notion.com/v1',
  API_VERSION: '2022-06-28',

  /**
   * Test Notion connection and get bot info
   * @returns {Promise<{ok: boolean, identity?: string, error?: string}>}
   */
  async testConnection() {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return { ok: false, error: 'No token configured' };
    }

    // Test connection by getting bot info
    const result = await HttpClient.request(`${this.API_BASE}/users/me`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!result.ok) {
      return { ok: false, error: result.error.message };
    }

    const botName = result.data.bot?.owner?.user?.name || result.data.name || 'Notion Integration';

    return {
      ok: true,
      identity: botName
    };
  },

  /**
   * Search for pages accessible to the integration
   * @param {string} query - Search query (empty for all pages)
   * @returns {Promise<{ok: boolean, pages?: Array, error?: any}>}
   */
  async searchPages(query = '') {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return { ok: false, error: { message: 'No token configured' } };
    }

    const result = await HttpClient.request(`${this.API_BASE}/search`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        query,
        filter: { property: 'object', value: 'page' },
        page_size: 100
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      pages: result.data.results || []
    };
  },

  /**
   * Export to Notion page
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {Object} options
   * @param {string} options.parentId - Parent page or database ID
   * @param {string} options.parentType - 'page' or 'database'
   * @param {string} [options.title] - Page title (defaults to conversation title)
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<ExportResult>}
   */
  async export(harvest, filters, options = {}) {
    const token = await IntegrationStorage.getToken('notion');
    if (!token) {
      return {
        ok: false,
        error: {
          code: 'AUTH',
          message: 'No Notion token configured',
          hint: 'Please configure your Notion integration token in settings.'
        }
      };
    }

    const { parentId, parentType, onProgress } = options;

    if (!parentId) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Parent page or database is required',
          hint: 'Please select a parent page or database for the export.'
        }
      };
    }

    try {
      // Step 1: Prepare blocks
      if (onProgress) onProgress({ step: 'PREPARING', message: 'Converting to Notion blocks...' });

      const blocks = NotionBlocksConverter.toBlocks(harvest, filters);
      const batches = NotionBlocksConverter.batchBlocks(blocks);

      // Step 2: Create page
      if (onProgress) onProgress({ step: 'VALIDATING', message: 'Creating Notion page...' });

      const pageResult = await this._createPage(harvest, parentId, parentType, options.title, token);

      if (!pageResult.ok) {
        return { ok: false, error: pageResult.error };
      }

      const pageId = pageResult.pageId;

      // Step 3: Append blocks in batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const step = `UPLOADING_${i + 1}_OF_${batches.length}`;
        const message = `Uploading batch ${i + 1} of ${batches.length}...`;

        if (onProgress) onProgress({ step, message });

        const appendResult = await this._appendBlocks(pageId, batch, token);

        if (!appendResult.ok) {
          return { ok: false, error: appendResult.error };
        }

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this._sleep(200);
        }
      }

      // Step 4: Success
      if (onProgress) onProgress({ step: 'FINALIZING', message: 'Finalizing...' });

      const pageUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;

      if (onProgress) onProgress({ step: 'SUCCESS', message: 'Page created successfully!' });

      return {
        ok: true,
        url: pageUrl
      };

    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN',
          message: err.message || 'An unexpected error occurred',
          raw: err
        }
      };
    }
  },

  /**
   * Create Notion page
   * @private
   */
  async _createPage(harvest, parentId, parentType, customTitle, token) {
    const title = customTitle || harvest.meta?.title || 'ChatGPT Conversation';

    const parent = parentType === 'database'
      ? { database_id: parentId }
      : { page_id: parentId };

    const properties = parentType === 'database'
      ? {
          Name: {
            title: [{ type: 'text', text: { content: title } }]
          }
        }
      : {};

    const children = parentType === 'page'
      ? [{
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: title } }]
          }
        }]
      : [];

    const result = await HttpClient.request(`${this.API_BASE}/pages`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        parent,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        children: children.length > 0 ? children : undefined
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      pageId: result.data.id
    };
  },

  /**
   * Append blocks to page
   * @private
   */
  async _appendBlocks(pageId, blocks, token) {
    const result = await HttpClient.request(`${this.API_BASE}/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: this._getHeaders(token),
      body: {
        children: blocks
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  },

  /**
   * Get request headers
   * @private
   */
  _getHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': this.API_VERSION,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Sleep helper
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Register exporters
ExporterRegistry.register('github-gist', GitHubExporter);
ExporterRegistry.register('github-issue', GitHubExporter);
ExporterRegistry.register('notion', NotionExporter);

