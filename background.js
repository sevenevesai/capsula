/* Browser API compatibility: Firefox uses `browser`, Chrome uses `chrome` */
const browser = globalThis.browser || globalThis.chrome;

/**
 * Capsula Background Request Broker
 *
 * Acts as a proxy for all external API calls to avoid CSP issues in content scripts.
 * Handles token storage, permissions, and network requests with retry logic.
 *
 * @author Mark T. Short (seveneves.ai)
 * @license MIT
 * @copyright 2025
 */

/* ===========================
   Request Broker
   =========================== */

/**
 * Normalize API errors to standard format
 */
function normalizeError(status, body, headers, url) {
  const isGitHub = url.includes('api.github.com');
  const isNotion = url.includes('api.notion.com');

  switch (status) {
    case 401:
      return {
        code: 'AUTH',
        message: 'Invalid or expired token',
        hint: 'Please check your token and try again.'
      };

    case 403:
      if (isGitHub && body?.message?.includes('scope')) {
        return {
          code: 'SCOPE',
          message: 'Insufficient token permissions',
          hint: 'Your token needs additional scopes. For Gists, use "gist" scope. For Issues, add "repo" or "public_repo" scope.'
        };
      }
      return {
        code: 'AUTH',
        message: 'Access forbidden',
        hint: 'Your token may not have the required permissions.'
      };

    case 404:
      return {
        code: 'VALIDATION',
        message: 'Resource not found',
        hint: isGitHub
          ? 'Check that the repository exists and you have access.'
          : 'Check that the parent page exists and is shared with your integration.'
      };

    case 400:
    case 422:
      if (isNotion && body?.message?.includes('parent')) {
        return {
          code: 'VALIDATION',
          message: 'Invalid parent page or database',
          hint: 'Make sure the parent page/database is shared with your Notion integration.'
        };
      }
      if (isGitHub && (body?.message?.includes('too large') || body?.message?.includes('size'))) {
        return {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Content is too large',
          hint: 'The conversation will be split into multiple files automatically.'
        };
      }
      return {
        code: 'VALIDATION',
        message: body?.message || 'Invalid request',
        hint: 'Please check your input and try again.',
        raw: body
      };

    case 429:
      const retryAfter = headers['retry-after'];
      return {
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        hint: retryAfter
          ? `Please wait ${retryAfter} seconds and try again.`
          : 'Please wait a few minutes and try again.',
        raw: { retryAfter }
      };

    case 413:
      return {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Payload too large',
        hint: 'Try reducing the size of your export.'
      };

    default:
      if (status >= 500) {
        return {
          code: 'SERVER',
          message: `Server error ${status}`,
          hint: 'The service is experiencing issues. Please try again later.',
          raw: body
        };
      }
      return {
        code: 'UNKNOWN',
        message: body?.message || `Request failed with status ${status}`,
        hint: 'An unexpected error occurred. Please try again.',
        raw: body
      };
  }
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt) {
  const baseMs = 2000;
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, 16000);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with retry and rate limit handling
 */
async function makeHttpRequest(url, options = {}, attempt = 0) {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = options.timeoutMs || 30000;

  // Check if permission is granted
  const origin = new URL(url).origin + '/*';
  const hasPerm = await browser.permissions.contains({ origins: [origin] });

  if (!hasPerm) {
    const serviceName = origin.includes('github') ? 'GitHub' :
                       origin.includes('notion') ? 'Notion' : 'this service';
    return {
      ok: false,
      error: {
        code: 'PERMISSION',
        message: `Permission required for ${serviceName}`,
        hint: `To enable: Right-click Capsula icon → Manage Extension → Permissions tab → Toggle ON permission for ${origin}`
      }
    };
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Collect response headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = headers['retry-after'];
      const waitMs = Math.min(retryAfter ? parseInt(retryAfter) * 1000 : calculateBackoff(attempt), 60000);

      if (attempt < MAX_RETRIES) {
        await sleep(waitMs);
        return makeHttpRequest(url, options, attempt + 1);
      }

      return {
        ok: false,
        error: normalizeError(response.status, null, headers, url)
      };
    }

    // Handle server errors with retry
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const waitMs = calculateBackoff(attempt);
      await sleep(waitMs);
      return makeHttpRequest(url, options, attempt + 1);
    }

    // Parse response body
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    // Handle successful response
    if (response.ok) {
      return { ok: true, data, headers };
    }

    // Handle error responses
    return {
      ok: false,
      error: normalizeError(response.status, data, headers, url)
    };

  } catch (err) {
    // Handle timeout
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: {
          code: 'NETWORK',
          message: 'Request timed out',
          hint: 'The request took too long. Please try again.'
        }
      };
    }

    // Retry on network error
    if (attempt < MAX_RETRIES) {
      const waitMs = calculateBackoff(attempt);
      await sleep(waitMs);
      return makeHttpRequest(url, options, attempt + 1);
    }

    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: err.message || 'Network error',
        hint: 'Check your internet connection and try again.',
        raw: err
      }
    };
  }
}

/**
 * Message handler for all broker requests
 */
browser.runtime.onMessage.addListener(async (msg, sender) => {
  try {
    switch (msg.type) {
      // Permission request
      case 'PERMISSIONS_REQUEST': {
        try {
          const granted = await browser.permissions.request({ origins: msg.origins });
          return { ok: granted };
        } catch (err) {
          return { ok: false, error: { code: 'PERMISSION', message: err.message } };
        }
      }

      // Permission check
      case 'PERMISSIONS_CHECK': {
        try {
          const has = await browser.permissions.contains({ origins: msg.origins });
          return { ok: true, data: has };
        } catch (err) {
          return { ok: false, error: { code: 'PERMISSION', message: err.message } };
        }
      }

      // Token operations
      case 'TOKEN_SET': {
        if (!['github', 'notion'].includes(msg.service)) {
          return { ok: false, error: { code: 'VALIDATION', message: 'Invalid service name' } };
        }
        try {
          const key = `capsula_token_${msg.service}`;
          const value = msg.tokenCiphertext || msg.tokenPlain || '';
          await browser.storage.local.set({ [key]: value });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: { code: 'STORAGE', message: err.message } };
        }
      }

      case 'TOKEN_GET': {
        if (!['github', 'notion'].includes(msg.service)) {
          return { ok: false, error: { code: 'VALIDATION', message: 'Invalid service name' } };
        }
        try {
          const key = `capsula_token_${msg.service}`;
          const result = await browser.storage.local.get(key);
          return { ok: true, data: result[key] || '' };
        } catch (err) {
          return { ok: false, error: { code: 'STORAGE', message: err.message } };
        }
      }

      case 'TOKEN_CLEAR': {
        if (!['github', 'notion'].includes(msg.service)) {
          return { ok: false, error: { code: 'VALIDATION', message: 'Invalid service name' } };
        }
        try {
          const key = `capsula_token_${msg.service}`;
          await browser.storage.local.remove(key);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: { code: 'STORAGE', message: err.message } };
        }
      }

      // HTTP JSON request
      case 'HTTP_JSON': {
        const { url, method = 'GET', headers = {}, body, timeoutMs } = msg;

        const fetchOptions = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          timeoutMs
        };

        if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
          fetchOptions.body = JSON.stringify(body);
        }

        return await makeHttpRequest(url, fetchOptions);
      }

      default:
        return {
          ok: false,
          error: {
            code: 'UNKNOWN',
            message: `Unsupported broker request type: ${msg.type}`
          }
        };
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: err.message || String(err),
        raw: err
      }
    };
  }
});
