/* ===========================
   Image Embedder
   =========================== */
// Swaps image URLs in a harvest for data URIs at export time. ChatGPT's image
// links are signed and expire, so an export that references them goes blank
// later. Same-origin images are fetched here; other hosts go through the
// background broker, which needs the optional host permission for that host.
const ImageEmbedder = {
  MAX_IMAGE_BYTES: 15 * 1024 * 1024,
  MAX_TOTAL_BYTES: 60 * 1024 * 1024,

  // Returns a copy of the harvest whose image blocks carry data URIs where the
  // fetch succeeded. Results are cached on the harvest so repeated exports of
  // the same panel do not refetch.
  async embed(harvest, onStart) {
    const urls = this.collectUrls(harvest);
    if (urls.length === 0) return { harvest, embedded: 0, failed: 0 };

    const cache = harvest.imageCache || (harvest.imageCache = new Map());
    const pending = urls.filter(url => !cache.has(url));
    if (pending.length && onStart) onStart(pending.length);

    let budget = this.MAX_TOTAL_BYTES;
    const viaBroker = [];
    await this.mapLimit(pending, 3, async url => {
      const direct = await this.fetchDirect(url);
      if (direct.ok && direct.bytes <= budget) {
        budget -= direct.bytes;
        cache.set(url, direct.dataUrl);
      } else if (direct.crossOrigin) {
        viaBroker.push(url);
      } else {
        cache.set(url, null);
      }
    });

    if (viaBroker.length) {
      const allowed = await this.ensurePermissions(viaBroker);
      await this.mapLimit(viaBroker, 3, async url => {
        if (!allowed.has(new URL(url).origin)) {
          cache.set(url, null);
          return;
        }
        const result = await this.fetchViaBroker(url);
        if (result.ok && result.bytes <= budget) {
          budget -= result.bytes;
          cache.set(url, result.dataUrl);
        } else {
          cache.set(url, null);
        }
      });
    }

    const embedded = urls.filter(url => cache.get(url)).length;
    return { harvest: this.apply(harvest, cache), embedded, failed: urls.length - embedded };
  },

  collectUrls(harvest) {
    const urls = new Set();
    (harvest.messages || []).forEach(message => (message.blocks || []).forEach(block => {
      if (block.kind === 'image' && typeof block.src === 'string' && /^https:\/\//.test(block.src)) {
        urls.add(block.src);
      }
    }));
    return Array.from(urls);
  },

  apply(harvest, cache) {
    return {
      ...harvest,
      messages: harvest.messages.map(message => ({
        ...message,
        blocks: (message.blocks || []).map(block => {
          const dataUrl = block.kind === 'image' ? cache.get(block.src) : null;
          return dataUrl ? { ...block, src: dataUrl, originalSrc: block.src } : block;
        })
      }))
    };
  },

  // Direct fetch works for same-origin images and any host that sends CORS
  // headers. A cross-origin host without them fails with a TypeError, which
  // is the signal to try the broker.
  async fetchDirect(url) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) return { ok: false };
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return { ok: false };
      if (blob.size > this.MAX_IMAGE_BYTES) return { ok: false };
      return { ok: true, dataUrl: await this.blobToDataUrl(blob), bytes: blob.size };
    } catch (err) {
      const crossOrigin = new URL(url).origin !== location.origin;
      if (!crossOrigin) console.warn('[ChatGPT Export] Image fetch failed', url, err);
      return { ok: false, crossOrigin };
    }
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  },

  // One permission prompt per host that still needs it. Hosts outside the
  // manifest's optional patterns cannot be granted and are reported as failed.
  async ensurePermissions(urls) {
    const origins = Array.from(new Set(urls.map(url => new URL(url).origin)));
    const allowed = new Set();
    for (const origin of origins) {
      const pattern = origin + '/*';
      try {
        const check = await browser.runtime.sendMessage({ type: 'PERMISSIONS_CHECK', origins: [pattern] });
        if (check && check.ok && check.data) {
          allowed.add(origin);
          continue;
        }
        const request = await browser.runtime.sendMessage({ type: 'PERMISSIONS_REQUEST', origins: [pattern] });
        if (request && request.ok) allowed.add(origin);
        else console.warn('[ChatGPT Export] Image host not permitted:', origin, request && request.error);
      } catch (err) {
        console.warn('[ChatGPT Export] Permission check failed for', origin, err);
      }
    }
    return allowed;
  },

  async fetchViaBroker(url) {
    try {
      const response = await browser.runtime.sendMessage({ type: 'HTTP_BLOB', url, maxBytes: this.MAX_IMAGE_BYTES });
      if (response && response.ok && response.data && response.data.dataUrl) {
        return { ok: true, dataUrl: response.data.dataUrl, bytes: response.data.bytes || 0 };
      }
      console.warn('[ChatGPT Export] Broker image fetch failed', url, response && response.error);
      return { ok: false };
    } catch (err) {
      console.warn('[ChatGPT Export] Broker image fetch failed', url, err);
      return { ok: false };
    }
  },

  async mapLimit(items, limit, fn) {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    });
    await Promise.all(workers);
  }
};
