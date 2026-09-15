/* ===========================
   Conversation API
   =========================== */
// ChatGPT's own conversation JSON, fetched from the same same-origin endpoint
// the page uses to load a thread. It is complete regardless of DOM
// virtualization and carries per-message timestamps, model slugs and reasoning
// summaries the DOM never exposes. The endpoint is unofficial: every failure
// surfaces as null or a thrown error and Harvester falls back to the DOM sweep.
const ConversationApi = {
  // /c/<uuid> and /g/<gpt-id>/c/<uuid>. Shared links (/share/...) use a
  // different endpoint and stay on the DOM path.
  conversationIdFromUrl(href) {
    let pathname;
    try {
      pathname = new URL(href).pathname;
    } catch (_) {
      return null;
    }
    const match = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(pathname);
    return match ? match[1] : null;
  },

  // onProgress(fraction, detail) feeds the harvest curtain
  async load(href, onProgress) {
    const progress = (fraction, detail) => { if (onProgress) onProgress(fraction, detail); };
    const id = this.conversationIdFromUrl(href);
    if (!id) return null;
    progress(0.1, 'Connecting');
    const token = await this.accessToken();
    progress(0.25, 'Fetching conversation');
    const conv = await this.fetchConversation(id, token);
    const messages = this.messagesFromConversation(conv);
    const count = `${messages.length} message${messages.length === 1 ? '' : 's'}`;
    progress(0.6, count);
    await this.resolveImages(messages, token, id, (done, total) => {
      progress(0.6 + 0.35 * (done / total), `Resolving images ${done}/${total}`);
    });
    progress(0.95, count);
    const lastWithModel = messages.slice().reverse().find(m => m.model);
    return {
      id,
      title: typeof conv.title === 'string' ? conv.title.trim() : '',
      model: (lastWithModel && lastWithModel.model) || conv.default_model_slug || null,
      createdAt: this.isoFromSeconds(conv.create_time),
      updatedAt: this.isoFromSeconds(conv.update_time),
      messages
    };
  },

  async accessToken() {
    const response = await fetch(location.origin + '/api/auth/session', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
    if (!response.ok) throw new Error('session endpoint returned ' + response.status);
    const session = await response.json();
    if (!session || typeof session.accessToken !== 'string' || !session.accessToken) {
      throw new Error('session has no access token');
    }
    return session.accessToken;
  },

  async fetchConversation(id, token) {
    const response = await fetch(location.origin + '/backend-api/conversation/' + encodeURIComponent(id), {
      credentials: 'include',
      headers: { accept: 'application/json', authorization: 'Bearer ' + token }
    });
    if (!response.ok) throw new Error('conversation endpoint returned ' + response.status);
    const conv = await response.json();
    if (!conv || typeof conv.mapping !== 'object' || conv.mapping === null) {
      throw new Error('conversation payload has no mapping');
    }
    return conv;
  },

  // Pure: conversation JSON in, harvest-shaped messages out. The fixture
  // tests call this directly.
  messagesFromConversation(conv) {
    const turns = this.groupTurns(this.linearPath(conv));
    const messages = turns
      .map(turn => this.toMessage(turn, conv))
      .filter(m => m.blocks.length || m.plain.text || m.thinking || m.attachment);
    messages.forEach((m, i) => { m.index = i; });
    return messages;
  },

  // The displayed branch: follow parent links from current_node to the root.
  // Without a current_node, the most recently created leaf stands in for it.
  linearPath(conv) {
    const mapping = conv.mapping;
    let id = conv.current_node;
    if (!id || !mapping[id]) {
      const leaves = Object.entries(mapping)
        .filter(([, node]) => !(node.children && node.children.length))
        .map(([key, node]) => ({ key, time: (node.message && node.message.create_time) || 0 }))
        .sort((a, b) => b.time - a.time);
      id = leaves.length ? leaves[0].key : null;
    }
    const path = [];
    const seen = new Set();
    while (id && mapping[id] && !seen.has(id)) {
      seen.add(id);
      path.push(mapping[id]);
      id = mapping[id].parent;
    }
    return path.reverse();
  },

  parts(message) {
    const parts = message.content && message.content.parts;
    return Array.isArray(parts) ? parts : [];
  },

  isVisible(message) {
    if (!message || !message.author || !message.content) return false;
    const meta = message.metadata || {};
    if (meta.is_visually_hidden_from_conversation) return false;
    // Messages addressed to a tool (python, browser, bio...) are not chat text
    if (message.recipient && message.recipient !== 'all') return false;
    const role = message.author.role;
    const type = message.content.content_type;
    if (role === 'user') return type === 'text' || type === 'multimodal_text';
    if (role === 'assistant') {
      return type === 'text' || type === 'multimodal_text' || type === 'thoughts' || type === 'reasoning_recap';
    }
    // Generated images arrive as tool messages and render inside the assistant turn
    if (role === 'tool') {
      return type === 'multimodal_text' &&
        this.parts(message).some(p => p && p.content_type === 'image_asset_pointer');
    }
    return false;
  },

  // Consecutive assistant-side messages (thoughts, recap, text, image results)
  // form one turn, the way the page renders them
  groupTurns(nodes) {
    const turns = [];
    nodes.forEach(node => {
      const message = node.message;
      if (!this.isVisible(message)) return;
      const role = message.author.role === 'user' ? 'user' : 'assistant';
      const last = turns[turns.length - 1];
      if (last && role === 'assistant' && last.role === 'assistant') {
        last.messages.push(message);
        return;
      }
      turns.push({ role, messages: [message] });
    });
    return turns;
  },

  toMessage(turn, conv) {
    const blocks = [];
    const texts = [];
    const thoughtLabels = [];
    const thoughtTexts = [];
    let recap = null;
    let model = null;
    let attachment = null;
    let incomplete = false;
    let firstTime = null;
    let contentId = null;

    turn.messages.forEach(message => {
      const type = message.content.content_type;
      const meta = message.metadata || {};
      if (firstTime === null && typeof message.create_time === 'number') firstTime = message.create_time;
      if (meta.model_slug) model = meta.model_slug;
      if (message.status && message.status !== 'finished_successfully') incomplete = true;
      if (!attachment) attachment = this.attachmentFromMetadata(meta);

      if (type === 'thoughts') {
        (message.content.thoughts || []).forEach(thought => {
          if (!thought) return;
          if (thought.summary) thoughtLabels.push(String(thought.summary));
          if (thought.content) thoughtTexts.push(String(thought.content));
        });
        return;
      }
      if (type === 'reasoning_recap') {
        if (message.content.content) recap = String(message.content.content);
        return;
      }

      if (!contentId) contentId = message.id;
      this.parts(message).forEach(part => {
        if (typeof part === 'string') {
          if (part.trim()) {
            texts.push(part);
            blocks.push(...MarkdownBlocks.parse(part));
          }
          return;
        }
        if (!part || typeof part !== 'object') return;
        if (part.content_type === 'image_asset_pointer' && typeof part.asset_pointer === 'string') {
          blocks.push({
            kind: 'image',
            src: '',
            alt: part.metadata && part.metadata.dalle ? 'Generated image' : 'Image',
            assetPointer: part.asset_pointer,
            width: part.width,
            height: part.height
          });
          return;
        }
        if (part.content_type === 'audio_transcription' && typeof part.text === 'string' && part.text.trim()) {
          texts.push(part.text);
          blocks.push({ kind: 'para', md: part.text.trim() });
        }
      });
    });

    const labels = thoughtLabels.map((text, order) => ({ text, order, type: 'state', seconds: null }));
    const seconds = recap ? this.parseDuration(recap) : null;
    if (recap) labels.push({ text: recap, order: labels.length, type: 'time', seconds });
    const thinking = labels.length
      ? { labels, totalSeconds: seconds || 0, expandable: false, text: thoughtTexts.join('\n\n') }
      : null;

    return {
      id: contentId || turn.messages[0].id,
      messageIds: turn.messages.map(m => m.id).filter(Boolean),
      index: 0,
      role: turn.role,
      thinking,
      thinkingSequence: labels.length > 1 ? labels : null,
      isThinking: !!thinking && blocks.length === 0,
      incomplete,
      canvas: null,
      isCanvas: false,
      canvasTitle: null,
      canvasType: null,
      attachment,
      hasAttachment: !!attachment,
      blocks,
      plain: { text: MarkdownBlocks.normalize(texts.join('\n\n')).trim() },
      timestamp: this.isoFromSeconds(firstTime) || new Date().toISOString(),
      model: turn.role === 'assistant' ? (model || conv.default_model_slug || null) : null,
      source: 'api'
    };
  },

  attachmentFromMetadata(meta) {
    const list = Array.isArray(meta.attachments) ? meta.attachments : [];
    const first = list.find(a => a && typeof a.name === 'string' && a.name);
    if (!first) return null;
    const ext = (first.name.includes('.') ? first.name.split('.').pop() : '').toLowerCase();
    return { fileName: first.name, fileType: ext, category: this.attachmentCategory(ext, first.mime_type || '') };
  },

  attachmentCategory(ext, mime) {
    if (mime.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|bmp|heic)$/.test(ext)) return 'image';
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (/^(zip|tar|gz|tgz|rar|7z)$/.test(ext)) return 'archive';
    if (/^(docx?|txt|md|rtf|odt|xlsx?|csv|pptx?)$/.test(ext)) return 'document';
    if (/^(js|ts|jsx|tsx|py|java|c|h|cpp|cs|go|rs|rb|php|html|css|json|ya?ml|sh|sql|swift|kt)$/.test(ext)) return 'code';
    return 'file';
  },

  // "Thought for 1m 5s", "Thought for 12 seconds", "Reasoned for 2 minutes"
  parseDuration(text) {
    const minutes = /(\d+)\s*(?:m\b|min\b|minutes?\b)/i.exec(text);
    const seconds = /(\d+)\s*(?:s\b|sec\b|seconds?\b)/i.exec(text);
    if (!minutes && !seconds) return null;
    return (minutes ? Number(minutes[1]) * 60 : 0) + (seconds ? Number(seconds[1]) : 0);
  },

  isoFromSeconds(value) {
    return typeof value === 'number' && isFinite(value) ? new Date(value * 1000).toISOString() : null;
  },

  async resolveImages(messages, token, conversationId, onProgress) {
    const pending = [];
    messages.forEach(m => (m.blocks || []).forEach(block => {
      if (block.kind === 'image' && block.assetPointer && !block.src) pending.push(block);
    }));
    let done = 0;
    await this.mapLimit(pending, 4, async block => {
      try {
        block.src = await this.downloadUrl(block.assetPointer, token, conversationId);
      } catch (err) {
        console.warn('[ChatGPT Export] Could not resolve image', block.assetPointer, err);
        block.alt = block.alt + ' (unavailable)';
      }
      done++;
      if (onProgress) onProgress(done, pending.length);
    });
  },

  // file-service://file-XXX and sediment://file_XXX both resolve through the
  // files endpoint to a short-lived signed URL. Both spellings of that
  // endpoint seen in the wild are tried; neither is documented.
  async downloadUrl(assetPointer, token, conversationId) {
    const fileId = assetPointer.replace(/^[a-z-]+:\/\//i, '');
    if (!/^[\w-]+$/.test(fileId)) throw new Error('unexpected asset pointer');
    const query = '?conversation_id=' + encodeURIComponent(conversationId);
    const candidates = [
      '/backend-api/files/' + encodeURIComponent(fileId) + '/download' + query,
      '/backend-api/files/download/' + encodeURIComponent(fileId) + query
    ];
    let lastError = null;
    for (const path of candidates) {
      try {
        const response = await fetch(location.origin + path, {
          credentials: 'include',
          headers: { accept: 'application/json', authorization: 'Bearer ' + token }
        });
        if (!response.ok) {
          lastError = new Error('HTTP ' + response.status + ' from ' + path);
          continue;
        }
        const data = await response.json();
        if (data && typeof data.download_url === 'string' && /^https:\/\//.test(data.download_url)) {
          return data.download_url;
        }
        lastError = new Error('no download_url from ' + path);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('unresolved asset pointer');
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

/* ===========================
   Markdown to Blocks
   =========================== */
// Turns the raw markdown ChatGPT stores per message into the block shape the
// DOM harvester produces, so every exporter and the preview work unchanged.
// Inline formatting stays as markdown inside md/text, exactly as the DOM path
// emits it. Inline math becomes $tex$ and display math a math block; there is
// no MathML on this path, so HTML exports show the LaTeX source.
const MarkdownBlocks = {
  parse(source) {
    const lines = this.normalize(source).split('\n');
    const blocks = [];
    const para = [];
    const flush = () => {
      if (para.length) {
        blocks.push({ kind: 'para', md: para.join('\n') });
        para.length = 0;
      }
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      const fence = /^\s{0,3}(`{3,}|~{3,})\s*([^`\s]*)\s*$/.exec(line);
      if (fence) {
        flush();
        const marker = fence[1];
        const closing = new RegExp('^\\s{0,3}' + marker[0] + '{' + marker.length + ',}\\s*$');
        const buf = [];
        i++;
        while (i < lines.length && !closing.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++;
        blocks.push({ kind: 'code', language: fence[2].toLowerCase(), text: buf.join('\n') });
        continue;
      }

      if (!line.trim()) {
        flush();
        i++;
        continue;
      }

      const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        flush();
        blocks.push({ kind: 'heading', level: heading[1].length, text: this.inline(heading[2]) });
        i++;
        continue;
      }

      if (/^\s{0,3}(?:[-*_]\s*){3,}$/.test(line)) {
        flush();
        blocks.push({ kind: 'divider' });
        i++;
        continue;
      }

      const math = this.parseMath(lines, i);
      if (math) {
        flush();
        blocks.push(math.block);
        i = math.next;
        continue;
      }

      const image = /^\s*!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)\s*$/.exec(line);
      if (image) {
        flush();
        blocks.push({ kind: 'image', src: image[2], alt: image[1] });
        i++;
        continue;
      }

      if (/^\s{0,3}>/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
          buf.push(this.inline(lines[i].replace(/^\s{0,3}>\s?/, '')));
          i++;
        }
        blocks.push({ kind: 'quote', md: buf.join('\n') });
        continue;
      }

      const table = this.parseTable(lines, i);
      if (table) {
        flush();
        blocks.push(table.block);
        i = table.next;
        continue;
      }

      if (this.listItem(line)) {
        flush();
        const list = this.parseList(lines, i);
        blocks.push(list.block);
        i = list.next;
        continue;
      }

      para.push(this.inline(line.trim()));
      i++;
    }
    flush();
    return blocks;
  },

  // Citation markers are private-use glyph sequences and legacy 【12†source】
  // tokens; both are noise outside the ChatGPT renderer
  normalize(source) {
    return String(source || '')
      .replace(/\r\n?/g, '\n')
      .replace(/ ?\uE200[\s\S]*?\uE201/g, '')
      .replace(/ ?【\d+†[^】]*】/g, '')
      .replace(/[\uE000-\uF8FF]/g, '');
  },

  // \( \) and \[ \] delimiters become the $ forms the DOM path emits
  inline(text) {
    return text
      .replace(/\\\[([\s\S]+?)\\\]/g, (m, tex) => '$$' + tex.trim() + '$$')
      .replace(/\\\((.+?)\\\)/g, (m, tex) => '$' + tex.trim() + '$');
  },

  parseMath(lines, start) {
    const open = /^\s*(\$\$|\\\[)\s*(.*)$/.exec(lines[start]);
    if (!open) return null;
    const closer = open[1] === '$$' ? /\$\$\s*$/ : /\\\]\s*$/;
    const rest = open[2];
    if (closer.test(rest)) {
      return { block: { kind: 'math', latex: rest.replace(closer, '').trim() }, next: start + 1 };
    }
    const buf = rest ? [rest] : [];
    let i = start + 1;
    while (i < lines.length) {
      if (closer.test(lines[i])) {
        const tail = lines[i].replace(closer, '').trim();
        if (tail) buf.push(tail);
        return { block: { kind: 'math', latex: buf.join('\n').trim() }, next: i + 1 };
      }
      buf.push(lines[i]);
      i++;
    }
    return null;
  },

  parseTable(lines, start) {
    if (start + 1 >= lines.length) return null;
    const header = lines[start];
    const delimiter = lines[start + 1];
    if (!header.includes('|')) return null;
    if (!/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(delimiter) || !delimiter.includes('|')) return null;
    const rows = [this.splitRow(header)];
    let i = start + 2;
    while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
      rows.push(this.splitRow(lines[i]));
      i++;
    }
    const width = rows[0].length;
    const squared = rows.map(row => {
      const cells = row.slice(0, width);
      while (cells.length < width) cells.push('');
      return cells;
    });
    return { block: { kind: 'table', rows: squared, complex: false, html: this.tableHtml(squared) }, next: i };
  },

  splitRow(line) {
    return line.trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map(cell => this.inline(cell.replace(/\\\|/g, '|').trim()));
  },

  tableHtml(rows) {
    const cell = (tag, md) => '<' + tag + '>' + MessageFormatter.formatInlineMarkdown(md, null) + '</' + tag + '>';
    const head = '<thead><tr>' + rows[0].map(c => cell('th', c)).join('') + '</tr></thead>';
    const body = rows.slice(1).map(row => '<tr>' + row.map(c => cell('td', c)).join('') + '</tr>').join('');
    return '<table>' + head + (body ? '<tbody>' + body + '</tbody>' : '') + '</table>';
  },

  listItem(line) {
    return /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
  },

  // Nesting by indentation. tree items match the DOM harvester's shape:
  // { md, ordered?, children? }, where ordered describes the item's children
  parseList(lines, start) {
    const root = {};
    const stack = [{ indent: -1, node: root }];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        const next = lines[i + 1];
        if (next !== undefined && (this.listItem(next) || /^\s{2,}\S/.test(next))) {
          i++;
          continue;
        }
        break;
      }
      const item = this.listItem(line);
      if (item) {
        const indent = item[1].replace(/\t/g, '    ').length;
        const isOrdered = /^\d/.test(item[2]);
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const node = { md: this.inline(item[3].trim()) };
        const parent = stack[stack.length - 1].node;
        if (parent.ordered === undefined) parent.ordered = isOrdered;
        (parent.children || (parent.children = [])).push(node);
        stack.push({ indent, node });
        i++;
        continue;
      }
      if (/^\s+\S/.test(line) && stack.length > 1) {
        stack[stack.length - 1].node.md += '\n' + this.inline(line.trim());
        i++;
        continue;
      }
      break;
    }
    const tree = root.children || [];
    return { block: { kind: 'list', ordered: !!root.ordered, items: tree.map(n => n.md), tree }, next: i };
  }
};
