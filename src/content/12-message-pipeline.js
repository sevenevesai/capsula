/* ===========================
   Message Filtering
   =========================== */
const MessageFilter = {
  apply(messages) {
    // Return all messages with metadata about whether they should be included
    return messages.map(msg => {
      let isIncluded = true;
      let filteredBlocks = msg.blocks;

      // Check selection filter
      if (!globalState.isSelected(msg.index)) {
        isIncluded = false;
      }

      // Check assistant-only filter
      if (isIncluded && globalState.filters.assistantOnly && msg.role !== 'assistant') {
        isIncluded = false;
      }

      // Check content filters
      const hasContentFilters = globalState.filters.code ||
                               globalState.filters.tables ||
                               globalState.filters.lists;

      if (isIncluded && hasContentFilters) {
        filteredBlocks = msg.blocks.filter(block => {
          if (globalState.filters.code && block.kind === 'code') return true;
          if (globalState.filters.tables && block.kind === 'table') return true;
          if (globalState.filters.lists && block.kind === 'list') return true;
          return false;
        });

        if (filteredBlocks.length === 0) {
          isIncluded = false;
        }
      }

      return {
        ...msg,
        blocks: filteredBlocks,
        isIncludedInExport: isIncluded,
        isCollapsed: !isIncluded // Auto-collapse excluded messages
      };
    });
  },

  // Get only messages that should be included in exports
  getExportMessages(messages) {
    let filtered = [...messages];

    // Selection filter
    if (globalState.hasSelection()) {
      filtered = filtered.filter(msg => globalState.isSelected(msg.index));
    }

    // Assistant-only filter
    if (globalState.filters.assistantOnly) {
      filtered = filtered.filter(msg => msg.role === 'assistant');
    }

    // Content filters
    const hasContentFilters = globalState.filters.code ||
                             globalState.filters.tables ||
                             globalState.filters.lists;

    if (hasContentFilters) {
      filtered = filtered.map(msg => {
        const filteredBlocks = msg.blocks.filter(block => {
          if (globalState.filters.code && block.kind === 'code') return true;
          if (globalState.filters.tables && block.kind === 'table') return true;
          if (globalState.filters.lists && block.kind === 'list') return true;
          return false;
        });

        if (filteredBlocks.length > 0) {
          return { ...msg, blocks: filteredBlocks };
        }
        return null;
      }).filter(msg => msg !== null);
    }

    return filtered;
  }
};

/* ===========================
   Chat Preview Renderer
   =========================== */
const ChatRenderer = (() => {
  let container = null;
  let harvestRef = null;
  let scheduled = false;

  // Bind requestAnimationFrame to window to preserve context
  const raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function(cb) { return setTimeout(cb, 16); };

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    raf(() => {
      scheduled = false;
      renderNow();
    });
  }

  function renderNow() {
    if (!container || !container.isConnected) return;

    const harvest = harvestRef || globalState.harvest;
    if (!harvest || !Array.isArray(harvest.messages)) {
      container.replaceChildren();
      return;
    }

    const filteredMessages = MessageFilter.apply(harvest.messages);

    if (!filteredMessages.length) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.padding = '40px';
      empty.textContent = 'No messages in conversation';
      container.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredMessages.forEach(msg => {
      const bubbleContent = MessageFormatter.format(msg);
      const hasBubbleContent = bubbleContent && bubbleContent.trim().length > 0;
      const hasThinking = msg.thinking && msg.thinking.labels && msg.thinking.labels.length > 0;

      if (!hasBubbleContent && !hasThinking) {
        return;
      }

      const messageDiv = document.createElement('div');
      const classes = ['message', msg.role];

      // Add classes for excluded and collapsed messages
      if (!msg.isIncludedInExport) {
        classes.push('excluded');
      }
      if (msg.isCollapsed) {
        classes.push('collapsed');
      }

      messageDiv.className = classes.join(' ');
      messageDiv.dataset.messageIndex = msg.index;

      // Add click handler for collapsible messages
      if (!msg.isIncludedInExport) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.title = 'Click to expand/collapse (excluded from export)';
        messageDiv.addEventListener('click', () => {
          messageDiv.classList.toggle('collapsed');
        });
      }

      const thinkingContainer = document.createElement('div');
      thinkingContainer.className = 'thinking-container';

      if (hasThinking) {
        const labelsWrapper = document.createElement('div');
        labelsWrapper.className = 'thinking-labels';

        msg.thinking.labels.forEach(label => {
          const labelEl = document.createElement('div');
          labelEl.className = 'thinking-label';
          labelEl.textContent = label.text || '';
          labelsWrapper.appendChild(labelEl);
        });

        thinkingContainer.appendChild(labelsWrapper);
      }

      if (hasBubbleContent) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';

        // Create role label container with toggle
        const roleLabelContent = document.createElement('span');
        roleLabelContent.textContent = msg.role === 'user' ? 'You' : 'ChatGPT';
        roleLabel.appendChild(roleLabelContent);

        // Add toggle checkbox
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'message-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-label', 'Toggle message in export');
        toggleBtn.title = globalState.isSelected(msg.index)
          ? 'Click to exclude from export'
          : 'Click to include in export';

        // Set visual state
        if (globalState.isSelected(msg.index)) {
          toggleBtn.classList.add('selected');
        }

        // Toggle icon (checkbox style)
        toggleBtn.innerHTML = globalState.isSelected(msg.index)
          ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect width="14" height="14" rx="2" fill="currentColor"/><path d="M4 7l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';

        // Click handler to toggle selection
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger message expand/collapse
          globalState.toggleSelection(msg.index);
          // Refresh will be triggered by onSelectionChange callback
        });

        roleLabel.appendChild(toggleBtn);

        // Add exclusion indicator
        if (!msg.isIncludedInExport) {
          const excludeIcon = document.createElement('span');
          excludeIcon.className = 'exclude-indicator';
          excludeIcon.textContent = '(Not in export)';
          excludeIcon.style.marginLeft = '8px';
          excludeIcon.style.fontSize = '0.85em';
          excludeIcon.style.opacity = '0.7';
          roleLabel.appendChild(excludeIcon);
        }

        bubble.appendChild(roleLabel);
        bubble.insertAdjacentHTML('beforeend', bubbleContent);
        thinkingContainer.appendChild(bubble);
      }

      messageDiv.appendChild(thinkingContainer);
      fragment.appendChild(messageDiv);
    });

    if (!fragment.childNodes.length) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.padding = '40px';
      empty.textContent = 'No messages in conversation';
      container.replaceChildren(empty);
      return;
    }

    container.replaceChildren(fragment);
  }

  return {
    mount(target, harvest) {
      if (!target) return;

      if (container && container !== target) {
        this.destroy();
      }

      container = target;
      harvestRef = harvest || globalState.harvest || null;
      scheduleRender();
    },

    refresh() {
      if (!container) return;
      harvestRef = harvestRef || globalState.harvest || null;
      scheduleRender();
    },

    updateHarvest(harvest) {
      harvestRef = harvest;
      scheduleRender();
    },

    destroy() {
      scheduled = false;
      harvestRef = null;

      if (container) {
        if (container.isConnected) {
          container.replaceChildren();
        }
        container = null;
      }
    }
  };
})();

/* ===========================
   Message Formatting (Enhanced)
   =========================== */
const MessageFormatter = {
  format(message) {
    if (message.isThinking && !message.blocks?.length) {
      return '';
    }
    
    if (!message.blocks || message.blocks.length === 0) {
      return Utils.escapeHtml(message.plain?.text || '');
    }
    
    return message.blocks.map(block => {
      switch (block.kind) {
        case 'heading':
          const level = Math.max(1, Math.min(6, block.level || 1));
          return `<h${level}>${this.formatInlineMarkdown(block.text || '', block.math)}</h${level}>`;

        case 'para':
          return `<p>${this.formatInlineMarkdown(block.md || '', block.math)}</p>`;

        case 'code': {
          const langClass = block.language
            ? ` class="language-${Utils.escapeHtml(block.language)}"`
            : '';
          return `<pre><code${langClass}>${Utils.escapeHtml(block.text || '')}</code></pre>`;
        }

        case 'list':
          return this.listTreeToHtml(
            block.tree || (block.items || []).map(t => ({ md: t })),
            block.ordered === true
          );
          
        case 'table':
          return block.html || '<p>[Table]</p>';
          
        case 'image':
          const src = block.src || '';
          const alt = block.alt || '';
          if (src) {
            const safeSrc = Utils.safeUrl(src);
            return `<img src="${Utils.escapeHtml(safeSrc)}" alt="${Utils.escapeHtml(alt)}" style="max-width: 100%;">`;
          }
          return '';
          
        case 'link':
          const href = block.href || '';
          const text = block.text || href;
          if (href) {
            const safeHref = Utils.safeUrl(href);
            return `<p><a href="${Utils.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(text)}</a></p>`;
          }
          return '';
          
        case 'citation':
          const citationHtml = block.thumb ? 
            `<div class="citation">
              <img src="${Utils.escapeHtml(Utils.safeUrl(block.thumb))}" alt="">
              <a href="${Utils.escapeHtml(Utils.safeUrl(block.url))}" target="_blank" rel="noopener noreferrer">
                ${Utils.escapeHtml(block.title || block.url)}
              </a>
            </div>` :
            `<p><a href="${Utils.escapeHtml(Utils.safeUrl(block.url))}" target="_blank" rel="noopener noreferrer">
              ${Utils.escapeHtml(block.title || block.url)}
            </a></p>`;
          return citationHtml;
          
        case 'quote':
          return `<blockquote>${this.formatInlineMarkdown(block.md || '', block.math)}</blockquote>`;

        case 'math':
          // MathML captured from the page's KaTeX markup renders natively like
          // the chat window; fall back to LaTeX source when it wasn't captured
          return block.mathml
            ? `<div class="math">${block.mathml}</div>`
            : `<div class="math">$$${Utils.escapeHtml(block.latex || '')}$$</div>`;
          
        case 'divider':
          return '<hr>';
          
        default:
          return '';
      }
    }).join('');
  },

  formatInlineMarkdown(md, mathMap) {
    // Escape first for XSS safety, then apply structural markdown patterns.
    // Captured groups from regex are already escaped — don't re-escape them.
    let html = Utils.escapeHtml(md);

    const decodeEntities = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    // Inline math: swap $tex$ for the MathML captured from the page's KaTeX
    // markup. Placeholder indirection keeps the markdown regexes below from
    // touching MathML internals; $...$ with no captured MathML is left as-is.
    const mathml = [];
    if (mathMap) {
      html = html.replace(/\$([^$\n]+)\$/g, (match, texEsc) => {
        const captured = mathMap[decodeEntities(texEsc)];
        if (!captured) return match;
        mathml.push(captured);
        return `\uE000${mathml.length - 1}\uE001`;
      });
    }

    if (globalState.settings.current.inlineCode) {
      // URLs: decode captured URL for safeUrl validation, keep captured text as-is
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        const safeUrl = Utils.safeUrl(decodeEntities(url));
        return `<a href="${Utils.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      });

      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    }

    if (mathml.length) {
      html = html.replace(/\uE000(\d+)\uE001/g, (match, i) => mathml[Number(i)] || '');
    }

    return html;
  },

  listTreeToHtml(items, ordered) {
    const inner = items.map(item => {
      const children = (item.children && item.children.length)
        ? this.listTreeToHtml(item.children, item.ordered === true)
        : '';
      return `<li>${this.formatInlineMarkdown(item.md || '', item.math)}${children}</li>`;
    }).join('');
    return ordered ? `<ol>${inner}</ol>` : `<ul>${inner}</ul>`;
  }
};

