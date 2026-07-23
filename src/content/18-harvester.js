/* ===========================
   Harvester Module (Enhanced)
   =========================== */
const Harvester = {
  async harvest() {
    // Auto-expand if enabled
    if (globalState.settings.current.autoExpandThinking) {
      await this.autoExpandThinking();
    }

    const meta = {
      title: this.detectTitle() || 'ChatGPT Conversation',
      url: location.href,
      model: this.detectModel(),
      exported_at: new Date().toISOString()
    };

    const messages = await this.collectMessagesWithScrollSweep();
    return { meta, messages };
  },

  findConversationScroller() {
    // The scrollable ancestor of the conversation turns. Falls back to the
    // page scroller when the layout has no dedicated overflow container.
    const turn = this.findAllTurnContainers()[0];
    let el = turn ? turn.parentElement : null;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (el.scrollHeight > el.clientHeight + 10 && /auto|scroll|overlay/.test(style.overflowY)) {
        return el;
      }
      el = el.parentElement;
    }
    return document.scrollingElement || null;
  },

  waitForRender() {
    return new Promise(resolve => {
      requestAnimationFrame(() => setTimeout(resolve, CFG.scrollSweepDelayMs));
    });
  },

  async collectMessagesWithScrollSweep() {
    // ChatGPT virtualizes the conversation: turns outside the viewport are
    // not mounted, so a single collect from the bottom silently drops the
    // earliest messages. Sweep top-to-bottom, collecting as turns mount.
    const scroller = this.findConversationScroller();
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1) {
      return this.collectAllMessages();
    }

    const originalTop = scroller.scrollTop;
    const byKey = new Map();
    const merge = (msgs) => msgs.forEach(m => {
      // Synthetic msg-N ids are positional and unstable across sweep steps —
      // key those by content instead
      const key = /^msg-\d+$/.test(m.id)
        ? `${m.role}:${(m.plain.text || '').slice(0, 200)}`
        : m.id;
      if (!byKey.has(key)) byKey.set(key, m);
    });

    try {
      scroller.scrollTop = 0;
      await this.waitForRender();
      merge(this.collectAllMessages());

      const step = Math.max(200, Math.floor(scroller.clientHeight * 0.85));
      let guard = 0;
      while (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2 &&
             guard++ < CFG.scrollSweepMaxSteps) {
        const before = scroller.scrollTop;
        scroller.scrollTop = before + step;
        await this.waitForRender();
        if (scroller.scrollTop === before) break; // cannot scroll further
        merge(this.collectAllMessages());
      }
    } finally {
      scroller.scrollTop = originalTop;
    }

    // Sweep runs top-to-bottom, so map insertion order is conversation order
    const messages = Array.from(byKey.values());
    messages.forEach((m, i) => { m.index = i; });
    return messages;
  },

  async autoExpandThinking() {
    // Only look inside conversation turns — a page-wide sweep would click
    // sidebar menus, the model switcher, and other chrome
    const expandCandidates = this.findAllTurnContainers().flatMap(container =>
      Array.from(container.querySelectorAll('button, [role="button"]'))
    );
    const expandButtons = expandCandidates.filter(button => {
      // Skip if this is our export button or any element within our extension's UI
      if (button.closest('[data-cgpt-overlay-export]') ||
          button.closest('[data-cgpt-panel]') ||
          button.getRootNode() instanceof ShadowRoot) {
        return false;
      }

      const ariaExpanded = button.getAttribute('aria-expanded');
      if (ariaExpanded === 'false') return true;

      const id = button.id || '';
      if (id.startsWith('radix-')) return true;

      const text = (button.textContent || '').toLowerCase();
      return /show|expand|view|details|steps|more|analysis|reasoning|tools?/.test(text);
    });

    for (const button of expandButtons) {
      try {
        button.click();
        await new Promise(resolve => setTimeout(resolve, CFG.autoExpandDelay));
      } catch (err) {
        console.warn('[ChatGPT Export] Failed to click expand button:', err);
      }
    }
  },

  detectModel() {
    // Tier 1: Per-message attribute (most reliable)
    const msgAttr = document.querySelector(
      '[data-message-model-slug], [data-model], [data-model-slug]'
    );
    if (msgAttr) {
      return msgAttr.getAttribute('data-message-model-slug') ||
             msgAttr.getAttribute('data-model') ||
             msgAttr.getAttribute('data-model-slug');
    }

    // Tier 2: UI chip/button text
    const chip = Array.from(document.querySelectorAll('button, [role="button"]'))
      .map(n => (n.textContent || '').trim())
      .find(t => {
        const modelPattern = CFG.knownModels.map(m => 
          m.replace(/[.-]/g, '[.-]?')
        ).join('|');
        return new RegExp(`\\b(${modelPattern})\\b`, 'i').test(t);
      });
    if (chip) {
      // Extract just the model name
      const modelPattern = CFG.knownModels.map(m => 
        m.replace(/[.-]/g, '[.-]?')
      ).join('|');
      const match = chip.match(new RegExp(`\\b(${modelPattern})\\b`, 'i'));
      return match ? match[1] : chip;
    }

    // Tier 3: Small region search (header/toolbar only)
    const smallRegions = document.querySelectorAll('header, [data-testid*="header"], nav, [role="navigation"]');
    for (const region of smallRegions) {
      const txt = (region.innerText || '').trim();
      const modelPattern = CFG.knownModels.map(m => 
        m.replace(/[.-]/g, '[.-]?')
      ).join('|');
      const match = txt.match(new RegExp(`\\b(${modelPattern})\\b`, 'i'));
      if (match) return match[1];
    }

    return null;
  },

  collectAllMessages() {
    // TASK 5: Updated message processing order
    // Proper sequence: role → canvas/attachment → thinking → content → metadata
    const messages = [];
    const processedElements = new Set();

    const turnContainers = this.findAllTurnContainers();

    turnContainers.forEach((container, index) => {
      if (processedElements.has(container)) return;
      processedElements.add(container);

      // STEP 1: Determine role FIRST (never depends on content)
      const role = this.detectRole(container);

      // STEP 2: Type-specific detection (depends on role)
      // Canvas artifacts only for assistant messages
      const canvasInfo = role === 'assistant' ? this.detectCanvasArtifact(container) : null;
      // File attachments only for user messages
      const fileAttachment = role === 'user' ? this.detectFileAttachment(container) : null;

      // STEP 3: Thinking detection (ONLY for assistant messages, uses structural selectors)
      const thinkingInfo = role === 'assistant'
        ? this.detectThinkingStates(container)
        : { labels: [], expandable: false };

      // STEP 4: Content validation
      const hasContent = this.hasActualContent(container);

      // STEP 5: Skip if no content, no thinking, no canvas, no attachment
      if (!hasContent && !canvasInfo && !fileAttachment && !thinkingInfo.labels.length) {
        return;
      }

      // STEP 6: Extract content (use canvas content if present)
      const contentNode = canvasInfo
        ? canvasInfo.contentElement
        : (this.findContentNode(container) || container);

      const clone = contentNode.cloneNode(true);
      this.sanitizeClone(clone);

      const blocks = this.extractBlocks(clone);
      const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();

      // STEP 7: Build message object with all metadata
      const message = {
        id: container.getAttribute('data-turn-id-container') ||
            container.getAttribute('data-message-id') ||
            container.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
            container.id || `msg-${messages.length + 1}`,
        index: messages.length,
        role: role,

        // Thinking metadata (preserves multi-stage sequences)
        thinking: thinkingInfo.labels.length > 0 ? thinkingInfo : null,
        thinkingSequence: thinkingInfo.labels.length > 1 ? thinkingInfo.labels : null,
        isThinking: thinkingInfo.labels.length > 0 && !hasContent && !canvasInfo,
        incomplete: thinkingInfo.labels.some(l => /stopped|paused|failed/i.test(l.text)),

        // Canvas metadata
        canvas: canvasInfo || null,
        isCanvas: canvasInfo !== null,
        canvasTitle: canvasInfo?.title || null,
        canvasType: canvasInfo?.type || null,

        // File attachment metadata
        attachment: fileAttachment || null,
        hasAttachment: fileAttachment !== null,

        // Content
        blocks: blocks.length ? blocks : (plainText && !thinkingInfo.labels.length ?
          [{ kind: 'para', md: plainText }] : []),
        plain: { text: plainText || '' },

        // Metadata
        timestamp: new Date().toISOString(),
        model: role === 'assistant' ? this.detectModel() : null
      };

      // STEP 8: Final validation and add to messages
      if (message.plain.text || message.blocks.length > 0 || message.thinking ||
          message.canvas || message.attachment) {
        messages.push(message);
      } else {
        console.warn('[ChatGPT Export] Skipping message with no extractable content', container);
      }
    });

    return messages;
  },

  findAllTurnContainers() {
    const containers = [];
    const seen = new Set();
    
    // Priority order for finding containers
    const strategies = [
      // Most reliable: article with data-scroll-anchor
      () => document.querySelectorAll('article[data-scroll-anchor]'),
      
      // Turn wrappers: data-testid="conversation-turn-N" (current UI) or the
      // older exact "conversation-turn"
      () => document.querySelectorAll('[data-testid^="conversation-turn"]'),

      // Turn wrappers marked with data-turn="user|assistant"
      () => document.querySelectorAll('[data-turn]'),
      
      // Message author role
      () => document.querySelectorAll('[data-message-author-role]'),
      
      // Message IDs
      () => document.querySelectorAll('div[data-message-id]'),
      
      // Structural patterns
      () => document.querySelectorAll('.group\\/conversation-turn, .agent-turn, .user-turn')
    ];
    
    strategies.forEach(strategy => {
      const found = strategy();
      found.forEach(el => {
        if (Array.from(seen).some(existing => existing.contains(el) || el.contains(existing))) {
          return;
        }
        
        if (!seen.has(el)) {
          containers.push(el);
          seen.add(el);
        }
      });
    });
    
    return containers.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  },

  parseThinkingTime(text) {
    // TASK 6: Parse thinking time from text patterns
    // Returns time in seconds, or 0 if no time found
    if (!text) return 0;

    // Pattern 1: "Xm Ys" or "X minutes Y seconds"
    const minSecMatch = text.match(/(\d+)\s*(?:m|min|minutes?)\s+(?:and\s+)?(\d+)\s*(?:s|sec|seconds?)/i);
    if (minSecMatch) {
      return parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2]);
    }

    // Pattern 2: "Xs" or "X seconds" (only)
    const secMatch = text.match(/(\d+)\s*(?:s|sec|seconds?)(?!\s*\d)/i);
    if (secMatch) {
      return parseInt(secMatch[1]);
    }

    // Pattern 3: "Xm" or "X minutes" (only)
    const minMatch = text.match(/(\d+)\s*(?:m|min|minutes?)(?!\s*\d)/i);
    if (minMatch) {
      return parseInt(minMatch[1]) * 60;
    }

    // Pattern 4: "a few seconds" / "a couple seconds" / "a moment" / "briefly"
    if (/few\s+seconds?|couple\s+(?:of\s+)?seconds?/i.test(text)) {
      return 3; // Estimate 3 seconds
    }

    // Pattern 5: "a moment" / "briefly"
    if (/\b(?:a\s+)?moment|brief(?:ly)?/i.test(text)) {
      return 2; // Estimate 2 seconds
    }

    return 0;
  },

  detectThinkingStates(container) {
    const labels = [];
    const expanderSelectors = [];
    const seenTexts = new Set();
    const processedDivs = new Set();

    // ENHANCED FIX: Use multiple strategies to catch ALL thinking indicators
    // ChatGPT thinking labels appear in divs ABOVE message content with specific patterns

    // Strategy 1: Primary selector - the typical thinking div structure
    const strategy1Divs = container.querySelectorAll('div.relative[class*="my-"][class*="min-h"]');

    // Strategy 2: Find divs that contain thinking-like text (catches variations)
    const allRelativeDivs = container.querySelectorAll('div.relative');
    const strategy2Divs = Array.from(allRelativeDivs).filter(div => {
      // Must be small divs (thinking indicators are compact)
      if (div.offsetHeight > 100) return false;

      // Check if it contains thinking text
      const text = div.textContent || '';
      const hasThinkingText = /Thought for|Thinking for|Processing for|Stopped thinking|Analyzing|Working on/i.test(text);

      // Exclude if it's inside message content
      if (div.hasAttribute('data-message-author-role')) return false;
      if (div.closest('[data-message-author-role]')?.contains(div)) return false;

      return hasThinkingText;
    });

    // Strategy 3: Explicit thinking markers (future-proof)
    const strategy3Divs = container.querySelectorAll('[class*="thinking"], [data-thinking]');

    // Combine all strategies, removing duplicates
    const allDivs = [...strategy1Divs, ...strategy2Divs, ...strategy3Divs];
    const uniqueDivs = allDivs.filter(div => {
      if (processedDivs.has(div)) return false;
      processedDivs.add(div);
      return true;
    });

    uniqueDivs.forEach((thinkingDiv) => {
      // Search ALL spans - be comprehensive
      const allSpans = thinkingDiv.querySelectorAll('span');

      allSpans.forEach(span => {
        let text = (span.textContent || '').trim();

        // Skip empty or already seen
        if (!text || seenTexts.has(text)) return;

        // Clean up text (remove SVG content markers, extra whitespace)
        text = text.replace(/<svg.*?<\/svg>/gi, '').trim();

        // Pattern matching - be comprehensive
        const isTimePattern = /Thought for|Thinking for|Processing for/i.test(text);
        const isStatePattern = /Stopped thinking|Stopped|Analyzing|Processing|Working|Calculating|Reading|Planning/i.test(text);

        // Filter out false positives
        // Skip if too long (thinking labels are short, < 50 chars typically)
        if (text.length > 100) return;

        // Skip if has multiple sentences
        if ((text.match(/\.\s+[A-Z]/g) || []).length > 0) return;

        // Skip common UI elements
        if (/^(You|ChatGPT|User|Assistant|Copy|Edit|Regenerate|Download|Good response|Bad response)$/i.test(text)) return;

        // Match!
        if (isTimePattern || isStatePattern) {
          const matchedType = isTimePattern ? 'time' : 'state';

          labels.push({
            text: text,
            order: labels.length,  // Preserve sequence for multi-stage thinking
            type: matchedType,
            seconds: this.parseThinkingTime(text)
          });
          seenTexts.add(text);
        }
      });

      // Check for expander button
      const button = thinkingDiv.querySelector('button[aria-expanded], button[role="button"]');

      if (button) {
        const ariaExpanded = button.getAttribute('aria-expanded');
        const hasRadixId = button.id && button.id.startsWith('radix-');
        const buttonText = (button.textContent || '').toLowerCase();

        if (ariaExpanded === 'false' || hasRadixId ||
            /show|expand|details|view|steps|more|analysis|reasoning|tools?/.test(buttonText)) {
          const selector = this.getElementSelector(button);
          if (selector && !expanderSelectors.includes(selector)) {
            expanderSelectors.push(selector);
          }
        }
      }
    });

    // TASK 6: Calculate total thinking time
    const totalSeconds = labels.reduce((sum, label) => sum + (label.seconds || 0), 0);

    return {
      labels: labels,  // Array preserving all thinking stages in order
      totalSeconds: totalSeconds,  // Total time in seconds
      expandable: expanderSelectors.length > 0,
      expanderSelectors: expanderSelectors.length > 0 ? expanderSelectors : undefined
    };
  },

  getElementSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      
      if (element.className) {
        const classes = element.className.split(/\s+/).filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }
      
      path.unshift(selector);
      if (path.length >= 3) break;
      
      element = element.parentElement;
    }
    
    return path.join(' > ');
  },

  findContentNode(el) {
    // Priority order for content nodes
    const candidates = [
      '[data-message-content]',
      '.markdown.prose',
      '.text-message',
      '.prose',
      'article',
      'div.group\\/conversation-turn'
    ];
    
    for (const sel of candidates) {
      const n = el.querySelector(sel);
      if (n && (n.textContent || '').trim().length) return n;
    }
    return el;
  },

  hasActualContent(el) {
    const clone = el.cloneNode(true);
    
    const uiSelectors = [
      'button',
      'svg',
      '[role="button"]',
      '[aria-label]',
      '.invisible',
      '.sr-only'
    ];
    
    uiSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(elem => elem.remove());
    });
    
    const text = (clone.textContent || '').trim();
    return text.length > 0;
  },

  detectTitle() {
    // Explicit conversation title element, if the UI provides one
    const titleEl = document.querySelector('[data-testid="conversation-title"]');
    const fromTestId = (titleEl?.textContent || '').trim();
    if (fromTestId && fromTestId !== 'ChatGPT') return fromTestId;

    // document.title tracks the conversation name on chatgpt.com
    const fromDoc = (document.title || '').replace(/\s*[|\-–—]\s*ChatGPT.*$/i, '').trim();
    if (fromDoc && fromDoc !== 'ChatGPT') return fromDoc;

    // Last resort: a page h1 that is NOT message content
    const h1 = Array.from(document.querySelectorAll('h1')).find(el =>
      !el.closest('[data-turn], [data-message-author-role], [data-testid^="conversation-turn"], article'));
    const fromH1 = (h1?.textContent || '').trim();
    if (fromH1 && fromH1 !== 'ChatGPT' && !fromH1.includes('|')) return fromH1;

    return '';
  },

  detectRole(el) {
    // TASK 2 FIX: Never use thinking as role indicator
    // Priority 1: Check turn-level data-turn attribute (most reliable).
    // Current UI puts it on a plain div; older UI used article.
    const turnEl = el.closest('[data-turn]');
    if (turnEl) {
      const turn = turnEl.getAttribute('data-turn');
      if (turn === 'user' || turn === 'assistant') {
        return turn;
      }
    }

    // Priority 2: Check message-level data-message-author-role on current element
    const attr = el.getAttribute('data-message-author-role');
    if (attr === 'user' || attr === 'assistant') return attr;

    // Priority 3: Check nested message div
    const nested = el.querySelector('[data-message-author-role]');
    if (nested) {
      const nestedRole = nested.getAttribute('data-message-author-role');
      if (nestedRole === 'user' || nestedRole === 'assistant') {
        return nestedRole;
      }
    }

    // Priority 4: Check parent message div
    const parent = el.closest('[data-message-author-role]');
    if (parent) {
      const parentRole = parent.getAttribute('data-message-author-role');
      if (parentRole === 'user' || parentRole === 'assistant') {
        return parentRole;
      }
    }

    // CRITICAL FIX: Removed thinking-based role detection
    // Thinking labels should NEVER determine role
    // This prevents user messages containing "Thought for" text from being misidentified

    // Priority 5: Content-based heuristics (least reliable, use only as last resort)
    const text = (el.textContent || '').toLowerCase();

    // Check for explicit role indicators in text
    if (text.startsWith('you said:') || text.startsWith('you:')) return 'user';
    if (text.startsWith('chatgpt said:') || text.startsWith('chatgpt:')) return 'assistant';

    // Check for user/assistant avatars or images
    if (el.querySelector('img[alt*="User" i]')) return 'user';
    if (el.querySelector('img[alt*="ChatGPT" i], img[alt*="Assistant" i]')) return 'assistant';

    // Check for user bubble styling (specific to user messages)
    if (el.querySelector('.user-message-bubble-color')) return 'user';

    // Check for layout alignment (user messages typically right-aligned)
    const style = window.getComputedStyle(el);
    if (style.textAlign === 'right' || style.justifyContent === 'flex-end') {
      // Double-check this isn't an assistant message with right-aligned content
      if (!el.querySelector('.markdown.prose')) {
        return 'user';
      }
    }

    // Default to assistant if uncertain (safer than defaulting to user)
    console.warn('[ChatGPT Export] Could not reliably detect role for element, defaulting to assistant', el);
    return 'assistant';
  },

  detectCanvasArtifact(container) {
    // TASK 3: Detect Canvas artifacts (documents, code blocks in canvas interface)
    // Canvas artifacts should be identified and marked with metadata
    // These are assistant-generated documents that appear in a special canvas UI

    // Method 1: Check for textdoc-message ID (document canvas)
    // Canvas documents have specific ID pattern: "textdoc-message-[hash]"
    const canvasDiv = container.querySelector('[id^="textdoc-message-"]');
    if (canvasDiv) {
      // Extract canvas metadata
      const titleEl = canvasDiv.querySelector('.truncate.text-token-text-primary.font-semibold');
      const title = titleEl?.textContent?.trim() || 'Untitled Canvas Document';

      // Canvas content is in ProseMirror editor
      const contentEl = canvasDiv.querySelector('.ProseMirror, [class*="_main_"]');

      return {
        isCanvas: true,
        type: 'document',
        title: title,
        contentElement: contentEl,
        id: canvasDiv.id
      };
    }

    // Method 2: Check for code canvas (different structure)
    // Code canvas has popover with rounded corners and code content
    const codeCanvas = container.querySelector('.popover.rounded-3xl [class*="code-"]');
    if (codeCanvas) {
      const titleEl = codeCanvas.closest('.popover').querySelector('.font-semibold');
      const title = titleEl?.textContent?.trim() || 'Code Canvas';

      return {
        isCanvas: true,
        type: 'code',
        title: title,
        contentElement: codeCanvas
      };
    }

    // Method 3: General canvas detection (fallback)
    // Looks for the general canvas popover structure with ProseMirror editor
    const popoverCanvas = container.querySelector('.popover.bg-token-bg-primary.rounded-3xl');
    if (popoverCanvas && popoverCanvas.querySelector('.ProseMirror')) {
      return {
        isCanvas: true,
        type: 'unknown',
        title: 'Canvas Artifact',
        contentElement: popoverCanvas
      };
    }

    // No canvas artifact found
    return null;
  },

  detectFileAttachment(container) {
    // TASK 4: Detect file attachments in user messages
    // Only user messages can have file attachments (images, PDFs, zips, etc.)

    // Only user messages can have file attachments
    const role = this.detectRole(container);
    if (role !== 'user') return null;

    // Look for file preview structure
    // File attachments have a specific bordered container with file info
    const filePreview = container.querySelector('.border-token-border-default.border.rounded-xl');
    if (!filePreview) return null;

    // Extract file metadata
    const fileNameEl = filePreview.querySelector('.truncate.font-semibold');
    const fileTypeEl = filePreview.querySelector('.text-token-text-secondary.truncate');

    const fileName = fileNameEl?.textContent?.trim();
    const fileType = fileTypeEl?.textContent?.trim();

    if (!fileName) return null;

    // Determine file category from type string or extension
    let category = 'file';
    const lowerType = (fileType || '').toLowerCase();
    const lowerName = (fileName || '').toLowerCase();

    if (lowerType.includes('image') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(lowerName)) {
      category = 'image';
    } else if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
      category = 'pdf';
    } else if (lowerType.includes('zip') || lowerType.includes('archive') || /\.(zip|rar|7z|tar|gz)$/i.test(lowerName)) {
      category = 'archive';
    } else if (lowerType.includes('text') || lowerType.includes('document') || /\.(txt|doc|docx|md)$/i.test(lowerName)) {
      category = 'document';
    } else if (lowerType.includes('code') || lowerType.includes('script') || /\.(js|py|java|cpp|cs|ts)$/i.test(lowerName)) {
      category = 'code';
    }

    return {
      fileName: fileName,
      fileType: fileType,
      category: category
    };
  },

  sanitizeClone(root) {
    const DROP = [
      'button',
      'svg[aria-hidden="true"]',
      '[data-testid="copy-turn-action-button"]',
      '[data-testid="copy-button"]',
      '.invisible',
      '.sr-only',
      // CRITICAL FIX: Remove thinking indicator divs from content
      // These should not be included in the exported content
      '.relative.my-1.min-h-6',  // Primary thinking indicator structure
      '[class*="thinking"]',      // Fallback for thinking indicators
      '[data-thinking]'           // Data attribute based thinking indicators
    ];

    root.querySelectorAll?.(DROP.join(',')).forEach(n => n.remove());

    // Preserve signals that class stripping below would destroy:
    // 1) Code language from highlighter classes
    root.querySelectorAll?.('code[class*="language-"]').forEach(code => {
      const m = (code.className || '').match(/language-([a-z0-9+.-]+)/i);
      if (m) code.setAttribute('data-code-lang', m[1].toLowerCase());
    });

    // 2) KaTeX math: the rendered markup duplicates content (MathML + visual
    //    spans), so swap it for the original LaTeX source from the annotation.
    //    A sanitized copy of the MathML rides along so HTML rendering can show
    //    real math (browsers render <math> natively) while markdown keeps LaTeX.
    root.querySelectorAll?.('.katex-display, .katex').forEach(el => {
      if (!root.contains(el)) return; // nested .katex already replaced with its .katex-display
      const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '';
      if (!tex.trim()) return;
      const isBlock = el.classList.contains('katex-display');
      const marker = el.ownerDocument.createElement(isBlock ? 'div' : 'span');
      marker.setAttribute('data-math', isBlock ? 'block' : 'inline');
      const mathml = this.sanitizeMathML(el.querySelector('math'), isBlock);
      if (mathml) marker.setAttribute('data-mathml', mathml);
      marker.textContent = isBlock ? tex : `$${tex}$`;
      el.replaceWith(marker);
    });

    root.querySelectorAll?.('[class]').forEach(n => n.removeAttribute('class'));
    root.querySelectorAll?.('[style]').forEach(n => n.removeAttribute('style'));

    // Strip event handler attributes from all elements
    root.querySelectorAll?.('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      }
    });

    // Restrict table element attributes to safe structural ones only
    const TABLE_ATTR_ALLOW = new Set(['colspan', 'rowspan', 'scope', 'headers']);
    root.querySelectorAll?.('table, table *').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (!TABLE_ATTR_ALLOW.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }
    });
  },

  // MathML elements/attributes KaTeX emits. annotation and annotation-xml are
  // deliberately excluded — annotation-xml can embed arbitrary XHTML, and the
  // annotation LaTeX source is already captured separately.
  MATHML_TAGS: new Set([
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mspace',
    'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mstyle', 'merror',
    'mpadded', 'mphantom', 'munder', 'mover', 'munderover', 'mmultiscripts',
    'mprescripts', 'mtable', 'mtr', 'mtd', 'menclose', 'mfenced'
  ]),
  MATHML_ATTRS: new Set([
    'xmlns', 'display', 'displaystyle', 'mathvariant', 'mathsize', 'scriptlevel',
    'stretchy', 'symmetric', 'largeop', 'movablelimits', 'accent', 'accentunder',
    'fence', 'separator', 'form', 'lspace', 'rspace', 'minsize', 'maxsize',
    'width', 'height', 'depth', 'voffset', 'linethickness', 'notation',
    'columnalign', 'rowalign', 'columnspacing', 'rowspacing', 'columnlines',
    'rowlines', 'frame', 'align'
  ]),

  sanitizeMathML(mathEl, isBlock) {
    if (!mathEl) return '';
    const math = mathEl.cloneNode(true);
    const scrub = (el) => {
      for (const child of [...el.children]) {
        if (this.MATHML_TAGS.has(child.tagName.toLowerCase())) {
          scrub(child);
        } else {
          child.remove();
        }
      }
      for (const attr of [...el.attributes]) {
        if (!this.MATHML_ATTRS.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      }
    };
    scrub(math);
    for (const attr of [...math.attributes]) {
      if (!this.MATHML_ATTRS.has(attr.name.toLowerCase())) {
        math.removeAttribute(attr.name);
      }
    }
    if (isBlock) {
      math.setAttribute('display', 'block');
    } else {
      math.removeAttribute('display');
    }
    return math.outerHTML;
  },

  inlineMathMap(node) {
    // Map inline LaTeX ($tex$) back to the MathML captured by sanitizeClone,
    // keyed by the LaTeX source so renderers can swap $tex$ for real math
    let map = null;
    node.querySelectorAll?.('span[data-math="inline"][data-mathml]').forEach(el => {
      const tex = (el.textContent || '').replace(/^\$/, '').replace(/\$$/, '');
      if (tex) {
        if (!map) map = {};
        map[tex] = el.getAttribute('data-mathml');
      }
    });
    return map;
  },

  detectCodeLanguage(code) {
    // Smart language detection based on code patterns
    // Only returns a language when confident - better to return '' than misclassify

    if (!code || !code.trim()) return '';

    const trimmed = code.trim();
    const lines = trimmed.split('\n');
    const firstLine = lines[0].trim();
    const codeLength = trimmed.length;

    // Too short to reliably detect (unless it's JSON)
    if (codeLength < 15 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return '';
    }

    // JSON - Very distinct structure
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
        (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      // Check for JSON-like patterns: "key": value
      if (/"\w+"\s*:\s*[{\["\d]/.test(trimmed)) {
        return 'json';
      }
    }

    // XML/HTML - Very clear with tags
    if (/<\/?[\w-]+[^>]*>/i.test(trimmed)) {
      // Check if it's HTML specifically (has DOCTYPE, html, head, body, common HTML tags)
      if (/<!DOCTYPE html|<html|<head|<body|<div|<span|<p>|<a\s/i.test(trimmed)) {
        return 'html';
      }
      // Otherwise it's XML
      if (/<\?xml|<[\w-]+:[\w-]+/i.test(trimmed)) {
        return 'xml';
      }
      // Generic HTML if has common tags
      if (/<(div|span|p|a|img|ul|ol|li|h[1-6]|table|tr|td|form|input|button)[>\s]/i.test(trimmed)) {
        return 'html';
      }
      return 'xml';
    }

    // CSS - Selectors with properties
    if (/[.#]?[\w-]+\s*{[\s\S]*?[a-z-]+\s*:\s*[^}]+;/i.test(trimmed)) {
      // Confirm with multiple CSS patterns
      if (/[:{};]/.test(trimmed) && /[a-z-]+\s*:\s*[^}]+;/i.test(trimmed)) {
        return 'css';
      }
    }

    // PHP - Starts with <?php
    if (/^<\?php/i.test(trimmed)) {
      return 'php';
    }

    // SQL - Multiple SQL keywords
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|CREATE|DROP|ALTER|TABLE)\b/gi;
    const sqlMatches = (trimmed.match(sqlKeywords) || []).length;
    if (sqlMatches >= 2) {
      return 'sql';
    }

    // Shell/Bash - Shebang or common shell patterns
    if (/^#!\/bin\/(ba)?sh|^#!/.test(firstLine)) {
      return 'bash';
    }
    // Multiple shell commands
    const shellCommands = /\b(echo|cd|ls|grep|awk|sed|cat|mkdir|rm|cp|mv|chmod|export|source)\b/g;
    const shellMatches = (trimmed.match(shellCommands) || []).length;
    if (shellMatches >= 3 || /^(echo|cd|ls|export)\s+/m.test(trimmed)) {
      return 'bash';
    }

    // Python - Multiple Python-specific patterns
    const pythonPatterns = {
      defClass: /^(def|class)\s+\w+/m,
      imports: /^(from|import)\s+\w+/m,
      decorators: /^@\w+/m,
      selfParam: /\bdef\s+\w+\(self/,
      print: /\bprint\s*\(/,
      ifName: /if\s+__name__\s*==\s*['"]__main__['"]/,
      // No semicolons at end of lines (key differentiator from JS/Java/C#)
      noSemicolons: !/;\s*$/m.test(lines.slice(0, 10).join('\n'))
    };

    let pythonScore = 0;
    if (pythonPatterns.defClass.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.imports.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.decorators.test(trimmed)) pythonScore += 3;
    if (pythonPatterns.selfParam.test(trimmed)) pythonScore += 2;
    if (pythonPatterns.print.test(trimmed)) pythonScore += 1;
    if (pythonPatterns.ifName.test(trimmed)) pythonScore += 3;
    if (pythonPatterns.noSemicolons && (pythonPatterns.defClass.test(trimmed) || pythonPatterns.imports.test(trimmed))) {
      pythonScore += 2;
    }

    if (pythonScore >= 4) {
      return 'python';
    }

    // TypeScript - Type annotations and TS-specific keywords
    const tsPatterns = {
      interface: /\b(interface|type)\s+\w+/,
      typeAnnotation: /:\s*(string|number|boolean|any|void|unknown|never)\b/,
      generics: /<[A-Z]\w*>/,
      asKeyword: /\bas\s+\w+/,
      typeAlias: /type\s+\w+\s*=/
    };

    let tsScore = 0;
    if (tsPatterns.interface.test(trimmed)) tsScore += 3;
    if (tsPatterns.typeAnnotation.test(trimmed)) tsScore += 2;
    if (tsPatterns.generics.test(trimmed)) tsScore += 1;
    if (tsPatterns.asKeyword.test(trimmed)) tsScore += 2;
    if (tsPatterns.typeAlias.test(trimmed)) tsScore += 3;

    // Also needs JS-like patterns
    const hasJsPatterns = /\b(const|let|var|function|=>|export|import)\b/.test(trimmed);

    if (tsScore >= 3 && hasJsPatterns) {
      return 'typescript';
    }

    // JavaScript - Multiple JS-specific patterns
    const jsPatterns = {
      varDecl: /\b(const|let|var)\s+\w+/,
      arrowFunc: /=>\s*[{(]/,
      functionKeyword: /\bfunction\s+\w+/,
      asyncAwait: /\b(async|await)\b/,
      consoleLog: /console\.(log|error|warn)/,
      requireImport: /\b(require\(|import\s+.*from)/,
      semicolons: /;$/m
    };

    let jsScore = 0;
    if (jsPatterns.varDecl.test(trimmed)) jsScore += 2;
    if (jsPatterns.arrowFunc.test(trimmed)) jsScore += 3;
    if (jsPatterns.functionKeyword.test(trimmed)) jsScore += 1;
    if (jsPatterns.asyncAwait.test(trimmed)) jsScore += 2;
    if (jsPatterns.consoleLog.test(trimmed)) jsScore += 2;
    if (jsPatterns.requireImport.test(trimmed)) jsScore += 2;
    if (jsPatterns.semicolons.test(trimmed)) jsScore += 1;

    if (jsScore >= 4) {
      return 'javascript';
    }

    // Java - Class-based with specific syntax
    const javaPatterns = {
      publicClass: /\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/,
      mainMethod: /public\s+static\s+void\s+main/,
      systemOut: /System\.(out|err)\.(println?|print)/,
      imports: /^import\s+[\w.]+;/m,
      semicolons: /;$/m,
      types: /\b(String|int|void|boolean|double|float|long|char)\s+\w+/
    };

    let javaScore = 0;
    if (javaPatterns.publicClass.test(trimmed)) javaScore += 3;
    if (javaPatterns.mainMethod.test(trimmed)) javaScore += 3;
    if (javaPatterns.systemOut.test(trimmed)) javaScore += 2;
    if (javaPatterns.imports.test(trimmed)) javaScore += 1;
    if (javaPatterns.types.test(trimmed)) javaScore += 1;
    if (javaPatterns.semicolons.test(trimmed)) javaScore += 1;

    if (javaScore >= 5) {
      return 'java';
    }

    // C# - Namespace and .NET patterns
    const csharpPatterns = {
      namespace: /\bnamespace\s+\w+/,
      usingSystem: /^using\s+(System|System\.)/m,
      publicClass: /\b(public|private|protected|internal)\s+(static\s+)?(class|interface|struct)\s+\w+/,
      properties: /\{\s*get;[\s\S]*?set;\s*\}/,
      linq: /\b(from\s+\w+\s+in\s+|select\s+\w+)/,
      async: /\basync\s+Task/
    };

    let csharpScore = 0;
    if (csharpPatterns.namespace.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.usingSystem.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.publicClass.test(trimmed)) csharpScore += 2;
    if (csharpPatterns.properties.test(trimmed)) csharpScore += 2;
    if (csharpPatterns.linq.test(trimmed)) csharpScore += 3;
    if (csharpPatterns.async.test(trimmed)) csharpScore += 2;

    if (csharpScore >= 5) {
      return 'csharp';
    }

    // Go - Package and func keywords
    const goPatterns = {
      package: /^package\s+\w+/m,
      funcKeyword: /\bfunc\s+(\w+\s*)?\(/,
      imports: /^import\s+\(/m,
      goTypes: /\b(string|int|bool|byte|rune|error|interface\{\})\b/,
      defer: /\bdefer\s+\w+/,
      goroutine: /\bgo\s+\w+\(/
    };

    let goScore = 0;
    if (goPatterns.package.test(trimmed)) goScore += 3;
    if (goPatterns.funcKeyword.test(trimmed)) goScore += 2;
    if (goPatterns.imports.test(trimmed)) goScore += 2;
    if (goPatterns.goTypes.test(trimmed)) goScore += 1;
    if (goPatterns.defer.test(trimmed)) goScore += 2;
    if (goPatterns.goroutine.test(trimmed)) goScore += 3;

    if (goScore >= 5) {
      return 'go';
    }

    // Rust - fn, let, impl patterns
    const rustPatterns = {
      fnKeyword: /\bfn\s+\w+/,
      letMut: /\blet\s+(mut\s+)?\w+/,
      impl: /\bimpl\s+(\w+\s+for\s+)?\w+/,
      useKeyword: /^use\s+[\w:]+;/m,
      macro: /\w+!/,
      ownership: /&(mut\s+)?\w+|&str/
    };

    let rustScore = 0;
    if (rustPatterns.fnKeyword.test(trimmed)) rustScore += 2;
    if (rustPatterns.letMut.test(trimmed)) rustScore += 2;
    if (rustPatterns.impl.test(trimmed)) rustScore += 3;
    if (rustPatterns.useKeyword.test(trimmed)) rustScore += 2;
    if (rustPatterns.macro.test(trimmed)) rustScore += 2;
    if (rustPatterns.ownership.test(trimmed)) rustScore += 2;

    if (rustScore >= 5) {
      return 'rust';
    }

    // Ruby - def/end, specific syntax
    const rubyPatterns = {
      defEnd: /\bdef\s+\w+[\s\S]*?\bend\b/,
      symbols: /:\w+/,
      puts: /\bputs\s+/,
      instanceVar: /@\w+/,
      blocks: /\bdo\s+\|[\w,\s]+\||\{[\s\S]*?\|[\w,\s]+\|/,
      require: /^require\s+['"][\w\/]+['"]/m
    };

    let rubyScore = 0;
    if (rubyPatterns.defEnd.test(trimmed)) rubyScore += 3;
    if (rubyPatterns.symbols.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.puts.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.instanceVar.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.blocks.test(trimmed)) rubyScore += 2;
    if (rubyPatterns.require.test(trimmed)) rubyScore += 1;

    if (rubyScore >= 5) {
      return 'ruby';
    }

    // Swift - func, var, let with Swift-specific patterns
    const swiftPatterns = {
      funcKeyword: /\bfunc\s+\w+/,
      varLet: /\b(var|let)\s+\w+/,
      importFoundation: /^import\s+(Foundation|UIKit|SwiftUI)/m,
      optionals: /\w+\?|\w+!/,
      guardLet: /\bguard\s+let\s+/,
      swiftPrint: /\bprint\(/
    };

    let swiftScore = 0;
    if (swiftPatterns.funcKeyword.test(trimmed)) swiftScore += 2;
    if (swiftPatterns.varLet.test(trimmed)) swiftScore += 1;
    if (swiftPatterns.importFoundation.test(trimmed)) swiftScore += 3;
    if (swiftPatterns.optionals.test(trimmed)) swiftScore += 2;
    if (swiftPatterns.guardLet.test(trimmed)) swiftScore += 3;
    if (swiftPatterns.swiftPrint.test(trimmed)) swiftScore += 1;

    if (swiftScore >= 5) {
      return 'swift';
    }

    // Kotlin - fun, val, var
    const kotlinPatterns = {
      funKeyword: /\bfun\s+\w+/,
      valVar: /\b(val|var)\s+\w+/,
      nullable: /\w+\?/,
      dataClass: /\bdata\s+class\s+\w+/,
      companionObject: /\bcompanion\s+object/,
      kotlinPrint: /\bprintln\(/
    };

    let kotlinScore = 0;
    if (kotlinPatterns.funKeyword.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.valVar.test(trimmed)) kotlinScore += 2;
    if (kotlinPatterns.nullable.test(trimmed)) kotlinScore += 1;
    if (kotlinPatterns.dataClass.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.companionObject.test(trimmed)) kotlinScore += 3;
    if (kotlinPatterns.kotlinPrint.test(trimmed)) kotlinScore += 1;

    if (kotlinScore >= 5) {
      return 'kotlin';
    }

    // Markdown - Headers, lists, links
    if (/^#{1,6}\s+\w+/m.test(trimmed) ||
        /^\*\s+\w+/m.test(trimmed) ||
        /\[.+\]\(.+\)/.test(trimmed)) {
      return 'markdown';
    }

    // YAML - Key-value with colons, indentation-based
    if (/^\w+:\s*$/m.test(trimmed) && /^\s+\w+:/m.test(trimmed)) {
      return 'yaml';
    }

    // If we got here and it has semicolons, curly braces, and parentheses but didn't match specific languages
    // it might be C/C++ or generic code
    if (/[{};()]/.test(trimmed) && /\w+\s*\(/.test(trimmed)) {
      // Check for C/C++ specific patterns
      if (/#include\s+[<"]|int\s+main\s*\(|void\s+\w+\(|printf\(|std::/.test(trimmed)) {
        return /std::|\bcout\b|iostream/.test(trimmed) ? 'cpp' : 'c';
      }
    }

    // Unable to detect with confidence - return empty string
    // Better to show no language than misclassify
    return '';
  },

  getCodeCardLabel(preNode, codeEl) {
    // Modern code cards show the language as the first text in a header row
    // above the code. sanitizeClone strips classes, so walk text nodes instead
    // of relying on header class names.
    const doc = preNode.ownerDocument;
    if (!doc || !doc.createTreeWalker) return '';

    const walker = doc.createTreeWalker(preNode, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      if (codeEl && codeEl.contains(textNode)) return '';
      const text = (textNode.textContent || '').trim();
      if (!text) continue;
      const clean = text.replace(/copy code|copy|run/gi, '').trim();
      if (clean && clean.length < 20 && /^[a-z0-9+#.-]+$/i.test(clean)) {
        return clean.toLowerCase();
      }
      // First non-empty text is not a language label — this pre has no header
      return '';
    }
    return '';
  },

  inlineMarkdown(node) {
    // Serialize inline formatting (bold/italic/strikethrough/code/links) that
    // textContent would flatten. Block-level children are handled by
    // extractBlocks; this only runs on paragraph-like content.
    const wrap = (text, marker) => {
      const core = text.trim();
      if (!core) return text;
      const lead = text.match(/^\s*/)[0];
      const trail = text.match(/\s*$/)[0];
      return `${lead}${marker}${core}${marker}${trail}`;
    };

    let out = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName.toLowerCase();
      switch (tag) {
        case 'strong':
        case 'b':
          out += wrap(this.inlineMarkdown(child), '**');
          break;
        case 'em':
        case 'i':
          out += wrap(this.inlineMarkdown(child), '*');
          break;
        case 'del':
        case 's':
        case 'strike':
          out += wrap(this.inlineMarkdown(child), '~~');
          break;
        case 'code': {
          const text = child.textContent || '';
          out += text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
          break;
        }
        case 'a': {
          const href = child.getAttribute('href') || '';
          const label = this.inlineMarkdown(child).trim();
          out += href ? `[${label || href}](${href})` : label;
          break;
        }
        case 'br':
          out += '\n';
          break;
        default: {
          const inner = this.inlineMarkdown(child);
          // Separate paragraph-like children instead of running them together
          if ((tag === 'p' || tag === 'div') && out.trim() && inner.trim()) {
            out += '\n' + inner;
          } else {
            out += inner;
          }
        }
      }
    });
    return out;
  },

  extractListTree(listEl) {
    // Preserve list nesting: each item carries its inline-markdown text plus
    // any nested list as children
    return Array.from(listEl.querySelectorAll(':scope > li')).map(li => {
      const nestedLists = Array.from(li.querySelectorAll('ul, ol'))
        .filter(l => l.closest('li') === li);

      const textClone = li.cloneNode(true);
      textClone.querySelectorAll('ul, ol').forEach(n => n.remove());
      const md = this.inlineMarkdown(textClone).replace(/\s+/g, ' ').trim();

      const item = { md };
      const math = this.inlineMathMap(textClone);
      if (math) item.math = math;
      if (nestedLists.length) {
        item.ordered = nestedLists[0].tagName.toLowerCase() === 'ol';
        item.children = nestedLists.flatMap(l => this.extractListTree(l));
      }
      return item;
    }).filter(item => item.md || (item.children && item.children.length));
  },

  extractBlocks(root, depth = 0) {
    const blocks = [];

    // Safety limit to prevent excessive recursion
    if (depth > 50) {
      console.warn('[ChatGPT Export] Maximum recursion depth reached in extractBlocks');
      return blocks;
    }

    const visit = (node) => {
      if (!node || node.nodeType !== 1) return;

      const tag = node.tagName.toLowerCase();

      // Code blocks — modern cards are <pre> wrappers containing a header row
      // (language label + buttons) and a CodeMirror viewer with the real <code>
      if (tag === 'pre') {
        const code = node.querySelector('code');

        // Cards without a <code> element render non-text content (e.g. mermaid
        // diagrams as inline SVG images) — export the image instead
        if (!code) {
          const img = node.querySelector('img');
          const imgSrc = img ? (img.getAttribute('src') || img.src || '') : '';
          if (imgSrc) {
            blocks.push({
              kind: 'image',
              src: imgSrc,
              alt: img.alt || this.getCodeCardLabel(node, null) || ''
            });
            return true;
          }
        }

        const codeEl = code || node;
        const text = codeEl.textContent || '';
        let language = codeEl.getAttribute('data-code-lang') ||
                       (codeEl.className || '').match(/language-([a-z0-9+.-]+)/i)?.[1] || '';
        if (!language && code) {
          language = this.getCodeCardLabel(node, code);
        }
        if (!language && text.trim()) {
          language = this.detectCodeLanguage(text);
        }

        if (text.trim()) {
          blocks.push({ kind: 'code', language, text });
          return true;
        }
      }
      
      // Math blocks (KaTeX converted to LaTeX markers by sanitizeClone)
      if (node.getAttribute && node.getAttribute('data-math') === 'block') {
        const latex = (node.textContent || '').trim();
        if (latex) {
          const block = { kind: 'math', latex };
          const mathml = node.getAttribute('data-mathml');
          if (mathml) block.mathml = mathml;
          blocks.push(block);
        }
        return true;
      }

      // Headings
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const text = this.inlineMarkdown(node).trim();
        if (text) {
          const block = { kind: 'heading', level, text };
          const math = this.inlineMathMap(node);
          if (math) block.math = math;
          blocks.push(block);
        }
        return true;
      }

      // Lists (tree preserves nesting; items stays flat for integrations)
      if (tag === 'ul' || tag === 'ol') {
        const tree = this.extractListTree(node);
        const items = tree.map(item => item.md).filter(Boolean);
        if (tree.length) {
          blocks.push({ kind: 'list', ordered: tag === 'ol', items, tree });
        }
        return true;
      }

      // Tables (rows enable pipe-table markdown; html is the fallback)
      if (tag === 'table') {
        const rows = Array.from(node.querySelectorAll('tr')).map(tr =>
          Array.from(tr.querySelectorAll('th, td'))
            .map(cell => this.inlineMarkdown(cell).replace(/\s+/g, ' ').trim())
        );
        const complex = !!node.querySelector('[colspan], [rowspan]');
        blocks.push({ kind: 'table', html: node.outerHTML, rows, complex });
        return true;
      }
      
      // Figure with image
      if (tag === 'figure') {
        const img = node.querySelector('img');
        if (img) {
          const src = img.src || img.getAttribute('src') || '';
          const alt = img.alt || img.getAttribute('alt') || '';
          if (src) {
            blocks.push({ kind: 'image', src, alt });
            
            // Check if figure also contains a link (citation pattern)
            const link = node.querySelector('a[href]');
            if (link) {
              const href = link.href || link.getAttribute('href');
              const title = (link.textContent || '').trim() || Utils.extractHostname(href);
              blocks.push({ 
                kind: 'citation', 
                url: href, 
                title: title,
                thumb: src 
              });
            }
          }
        }
        return true;
      }
      
      // Images (including those in links)
      if (tag === 'img') {
        const src = node.src || node.getAttribute('src') || '';
        const alt = node.alt || node.getAttribute('alt') || '';
        
        // Check if image is inside a link
        const parentLink = node.closest('a[href]');
        if (parentLink) {
          const href = parentLink.href || parentLink.getAttribute('href');
          const linkText = (parentLink.textContent || '').trim();
          
          // This is likely a citation card
          blocks.push({
            kind: 'citation',
            url: href,
            title: linkText || Utils.extractHostname(href),
            thumb: src
          });
        } else if (src) {
          blocks.push({ kind: 'image', src, alt });
        }
        return true;
      }
      
      // Links (standalone, not containing images)
      if (tag === 'a' && node.href && !node.querySelector('img')) {
        const href = node.href;
        const text = (node.textContent || '').trim();
        
        // Check for background image (common in link cards)
        const bgUrl = Utils.getComputedBackgroundUrl(node);
        if (bgUrl) {
          blocks.push({
            kind: 'citation',
            url: href,
            title: text || Utils.extractHostname(href),
            thumb: bgUrl
          });
        } else if (href && text) {
          blocks.push({ kind: 'link', href, text });
        }
        return true;
      }
      
      // Check for elements with background images
      if (tag === 'div' || tag === 'span') {
        const bgUrl = Utils.getComputedBackgroundUrl(node);
        if (bgUrl) {
          // Check if this is part of a citation card structure
          const nearbyLink = node.closest('a[href]') || node.querySelector('a[href]');
          if (nearbyLink) {
            const href = nearbyLink.href || nearbyLink.getAttribute('href');
            const linkText = (nearbyLink.textContent || '').trim();
            blocks.push({
              kind: 'citation',
              url: href,
              title: linkText || Utils.extractHostname(href),
              thumb: bgUrl
            });
          } else {
            blocks.push({ kind: 'image', src: bgUrl, alt: '' });
          }
          return true;
        }
      }
      
      // Blockquotes
      if (tag === 'blockquote') {
        const md = this.inlineMarkdown(node).trim();
        if (md) {
          const block = { kind: 'quote', md };
          const math = this.inlineMathMap(node);
          if (math) block.math = math;
          blocks.push(block);
        }
        return true;
      }
      
      // Dividers
      if (tag === 'hr') {
        blocks.push({ kind: 'divider' });
        return true;
      }
      
      // Paragraphs and text
      if ((tag === 'p' || tag === 'div') && !node.querySelector('h1,h2,h3,h4,h5,h6,pre,ul,ol,table,img,figure,[data-math="block"]')) {
        const text = this.inlineMarkdown(node).trim();
        if (text) {
          const block = { kind: 'para', md: text };
          const math = this.inlineMathMap(node);
          if (math) block.math = math;
          blocks.push(block);
        }
        return true;
      }
    }

    // Process all child nodes recursively
    Array.from(root.childNodes).forEach(child => {
      if (!visit(child) && child.nodeType === 1) {
        const subBlocks = this.extractBlocks(child, depth + 1);
        blocks.push(...subBlocks);
      }
    });
    
    // Fallback to plain text if no blocks found
    if (!blocks.length) {
      const text = (root.textContent || '').trim();
      if (text) blocks.push({ kind: 'para', md: text });
    }
    
    return blocks;
  }
};

