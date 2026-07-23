/* ===========================
   GitHub Exporter
   =========================== */
/**
 * GitHub integration for creating Gists and Issues.
 * Implements the Exporter interface.
 */
const GitHubExporter = {
  API_BASE: 'https://api.github.com',
  API_VERSION: '2022-11-28',

  /**
   * Test GitHub connection and get user info
   * @returns {Promise<{ok: boolean, identity?: string, scopes?: string[], error?: string}>}
   */
  async testConnection() {
    const token = await IntegrationStorage.getToken('github');
    if (!token) {
      return { ok: false, error: 'No token configured' };
    }

    // Test rate limit endpoint (doesn't require specific scopes)
    const result = await HttpClient.request(`${this.API_BASE}/rate_limit`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!result.ok) {
      return { ok: false, error: result.error.message };
    }

    // Get user info
    const userResult = await HttpClient.request(`${this.API_BASE}/user`, {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!userResult.ok) {
      return { ok: false, error: userResult.error.message };
    }

    // Parse scopes from X-OAuth-Scopes header (if available)
    const scopes = []; // GitHub doesn't always return scopes in response

    return {
      ok: true,
      identity: userResult.data.login,
      scopes
    };
  },

  /**
   * Export to GitHub Gist or Issue
   * @param {Object} harvest
   * @param {ExportFilters} filters
   * @param {Object} options
   * @param {string} options.visibility - 'public' or 'private'
   * @param {boolean} [options.createIssue=false]
   * @param {string} [options.repo] - Required if createIssue is true
   * @param {string} [options.description]
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<ExportResult>}
   */
  async export(harvest, filters, options = {}) {
    const token = await IntegrationStorage.getToken('github');
    if (!token) {
      return {
        ok: false,
        error: {
          code: 'AUTH',
          message: 'No GitHub token configured',
          hint: 'Please configure your GitHub token in settings.'
        }
      };
    }

    // Check if we should create an issue or gist
    if (options.createIssue) {
      return this._createIssue(harvest, filters, options, token);
    } else {
      return this._createGist(harvest, filters, options, token);
    }
  },

  /**
   * Create a GitHub Gist
   * @private
   */
  async _createGist(harvest, filters, options, token) {
    const { onProgress } = options;

    if (onProgress) onProgress({ step: 'PREPARING', message: 'Preparing markdown...' });

    // Generate markdown (with splitting if needed)
    const markdown = IntegrationMarkdownFormatter.toMarkdown(harvest, filters, true);

    // Build files object
    let files;
    if (typeof markdown === 'string') {
      // Single file
      const filename = this._generateFilename(harvest.meta?.title);
      files = {
        [filename]: { content: markdown }
      };
    } else {
      // Multiple files (already split)
      files = {};
      for (const [filename, content] of Object.entries(markdown)) {
        files[filename] = { content };
      }
    }

    if (onProgress) onProgress({ step: 'UPLOADING_1_OF_1', message: 'Creating gist...' });

    // Create gist
    const description = options.description || `Capsula export: ${harvest.meta?.title || 'Conversation'} (${new Date().toISOString().split('T')[0]})`;
    const isPublic = options.visibility === 'public';

    const result = await HttpClient.request(`${this.API_BASE}/gists`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        description,
        public: isPublic,
        files
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (onProgress) onProgress({ step: 'SUCCESS', message: 'Gist created successfully!' });

    return {
      ok: true,
      url: result.data.html_url
    };
  },

  /**
   * Create a GitHub Issue
   * @private
   */
  async _createIssue(harvest, filters, options, token) {
    const { repo, onProgress } = options;

    if (!repo) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Repository is required for issue creation',
          hint: 'Please provide a repository in the format owner/repo.'
        }
      };
    }

    if (onProgress) onProgress({ step: 'PREPARING', message: 'Preparing content...' });

    // Generate markdown (no splitting for issues)
    const markdown = IntegrationMarkdownFormatter.toMarkdown(harvest, filters, false);

    // Truncate if too long (GitHub issues have limits)
    const MAX_ISSUE_BODY = 65536;
    let body = markdown;
    if (body.length > MAX_ISSUE_BODY) {
      body = body.slice(0, MAX_ISSUE_BODY - 200) + '\n\n... (truncated due to length)';
    }

    if (onProgress) onProgress({ step: 'UPLOADING_1_OF_1', message: 'Creating issue...' });

    // Create issue
    const title = options.title || `Capsula Export: ${harvest.meta?.title || 'Conversation'}`;
    const labels = options.labels || [];

    const result = await HttpClient.request(`${this.API_BASE}/repos/${repo}/issues`, {
      method: 'POST',
      headers: this._getHeaders(token),
      body: {
        title,
        body,
        labels
      }
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (onProgress) onProgress({ step: 'SUCCESS', message: 'Issue created successfully!' });

    return {
      ok: true,
      url: result.data.html_url
    };
  },

  /**
   * Get request headers
   * @private
   */
  _getHeaders(token) {
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.API_VERSION,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Generate filename for gist
   * @private
   */
  _generateFilename(title) {
    const date = new Date().toISOString().split('T')[0];
    const safeName = (title || 'conversation')
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .slice(0, 50);
    return `${safeName}-${date}.md`;
  }
};

