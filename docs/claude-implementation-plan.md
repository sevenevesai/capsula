# Capsula - Claude.ai Support Implementation Plan

**Target:** Add Claude.ai conversation export support to Capsula extension
**Current:** ChatGPT-only support (chat.openai.com, chatgpt.com)
**New:** Claude.ai support (claude.ai)

---

## Architecture Overview

### Current Structure (ChatGPT-only):
```
manifest.json
  → content_scripts: ["https://chat.openai.com/*", "https://chatgpt.com/*"]
  → content.js (single file, ChatGPT-specific)

content.js
  → Platform detection: assumes ChatGPT
  → Message extraction: ChatGPT selectors
  → Export logic: works with ChatGPT data
```

### Proposed Structure (Multi-platform):
```
manifest.json
  → content_scripts:
      - ChatGPT: content.js (existing)
      - Claude: content-claude.js (new)

Shared modules (extracted from content.js):
  → ui.js: Export panel, modals, buttons (platform-agnostic)
  → exporters.js: Markdown, HTML, JSON, Dashboard (format logic)
  → integrations.js: GitHub, Notion (API calls)
  → storage.js: Settings, tutorial state
  → utils.js: Common utilities

Platform-specific modules:
  → content.js: ChatGPT extraction + platform setup
  → content-claude.js: Claude extraction + platform setup
```

---

## Implementation Phases

### Phase 1: Platform Abstraction Layer (Foundation)
**Goal:** Refactor existing code to support multiple platforms

**Tasks:**
1. Create platform abstraction interface:
```javascript
class PlatformAdapter {
  // Required methods all platforms must implement
  detectPlatform()        // Returns 'chatgpt', 'claude', etc.
  getMessages()           // Returns array of message objects
  getConversationTitle()  // Returns conversation title
  getConversationMeta()   // Returns metadata (model, date, etc.)
  watchForChanges()       // Sets up mutation observers
}
```

2. Extract shared UI components:
   - Export button (floating)
   - Export panel (modal)
   - Settings panel
   - Integration modals (GitHub, Notion)
   - Tutorial system

3. Extract shared export logic:
   - Markdown formatter
   - HTML formatter
   - JSON formatter
   - Dashboard generator
   - GitHub exporter
   - Notion exporter

4. Create ChatGPT platform adapter:
```javascript
class ChatGPTPlatform extends PlatformAdapter {
  detectPlatform() {
    return window.location.hostname.includes('openai.com') ||
           window.location.hostname.includes('chatgpt.com');
  }

  getMessages() {
    // Existing ChatGPT extraction logic
    const articles = document.querySelectorAll('article[data-turn]');
    return this.extractChatGPTMessages(articles);
  }

  // ... other ChatGPT-specific methods
}
```

**Deliverables:**
- `src/platform-adapter.js` - Base class
- `src/platforms/chatgpt.js` - ChatGPT implementation
- `src/ui/` - Extracted UI components
- `src/exporters/` - Export format modules
- Updated `content.js` - Uses platform adapter

**Testing:**
- Verify existing ChatGPT functionality still works
- No regressions in export features
- All integrations still functional

---

### Phase 2: Claude Platform Adapter (Core Feature)
**Goal:** Implement Claude.ai message extraction

**Tasks:**
1. Create Claude platform adapter:
```javascript
class ClaudePlatform extends PlatformAdapter {
  detectPlatform() {
    return document.documentElement.getAttribute('data-theme') === 'claude';
  }

  getMessages() {
    const messages = [];

    // Get all user and assistant messages in DOM order
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
    const assistantMsgs = document.querySelectorAll('[data-is-streaming]');

    // Merge and sort by DOM position
    return this.extractClaudeMessages([...userMsgs, ...assistantMsgs]);
  }

  extractClaudeMessages(elements) {
    return elements.map(el => {
      const isUser = el.hasAttribute('data-testid');
      return {
        role: isUser ? 'user' : 'assistant',
        content: this.extractContent(el),
        attachments: this.extractAttachments(el),
        thinking: isUser ? null : this.extractThinking(el),
        timestamp: null, // Claude doesn't show timestamps in DOM
      };
    });
  }

  extractContent(element) {
    if (element.hasAttribute('data-testid')) {
      // User message
      const paragraphs = element.querySelectorAll('p.whitespace-pre-wrap');
      return Array.from(paragraphs).map(p => p.textContent).join('\n\n');
    } else {
      // Assistant message
      const content = element.querySelector('.standard-markdown, .progressive-markdown');
      return this.parseMarkdown(content);
    }
  }

  extractAttachments(element) {
    const thumbnails = element.querySelectorAll('[data-testid="file-thumbnail"]');
    return Array.from(thumbnails).map(thumb => ({
      name: thumb.querySelector('h3.text-text-100').textContent.trim(),
      type: thumb.querySelector('p.uppercase').textContent.trim(),
      metadata: thumb.querySelector('p.text-text-500')?.textContent.trim(),
    }));
  }

  extractThinking(element) {
    const thinkingBlock = element.querySelector('.group\\/collapse-indicator');
    if (!thinkingBlock) return null;

    const stepText = thinkingBlock.querySelector('span.text-text-500')?.textContent;
    const stepCount = parseInt(stepText?.match(/(\d+) steps?/)?.[1] || '0');

    return {
      type: 'extended_thinking',
      stepCount,
      // Could expand to extract individual steps if needed
    };
  }

  parseMarkdown(contentEl) {
    if (!contentEl) return '';

    const parts = [];
    contentEl.childNodes.forEach(node => {
      if (node.nodeName === 'P') {
        parts.push(node.textContent);
      } else if (node.nodeName === 'H2') {
        parts.push(`## ${node.textContent}`);
      } else if (node.nodeName === 'H3') {
        parts.push(`### ${node.textContent}`);
      } else if (node.nodeName === 'OL') {
        const items = Array.from(node.querySelectorAll('li'))
          .map((li, i) => `${i + 1}. ${li.textContent}`);
        parts.push(items.join('\n'));
      } else if (node.nodeName === 'UL') {
        const items = Array.from(node.querySelectorAll('li'))
          .map(li => `- ${li.textContent}`);
        parts.push(items.join('\n'));
      } else if (node.nodeName === 'CODE') {
        parts.push(`\`${node.textContent}\``);
      }
      // Add more as needed
    });

    return parts.join('\n\n');
  }

  getConversationTitle() {
    const titleButton = document.querySelector('[data-testid="chat-title-button"]');
    return titleButton?.textContent.trim() || 'Claude Conversation';
  }

  getConversationMeta() {
    return {
      platform: 'Claude',
      model: 'Claude', // Could detect from UI if available
      date: new Date().toISOString(),
      url: window.location.href,
    };
  }

  watchForChanges(callback) {
    const observer = new MutationObserver(() => {
      // Watch for new messages being added
      callback();
    });

    const container = document.querySelector('.overflow-y-scroll');
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true,
      });
    }

    return observer;
  }
}
```

2. Update manifest.json:
```json
{
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://claude.ai/*"
      ],
      "js": ["content-claude.js"],
      "run_at": "document_idle"
    }
  ]
}
```

3. Create `content-claude.js`:
```javascript
// Import shared modules
import { UIManager } from './ui/ui-manager.js';
import { ExportManager } from './exporters/export-manager.js';
import { ClaudePlatform } from './platforms/claude.js';

// Initialize Claude-specific content script
const platform = new ClaudePlatform();
const ui = new UIManager(platform);
const exporter = new ExportManager(platform);

// Set up UI when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  if (platform.detectPlatform()) {
    ui.initialize();
    exporter.initialize();

    // Watch for conversation updates
    platform.watchForChanges(() => {
      ui.refresh();
    });
  }
}
```

**Deliverables:**
- `src/platforms/claude.js` - Claude platform adapter
- `content-claude.js` - Claude content script entry point
- Updated `manifest.json` - Includes Claude URLs

**Testing:**
- Test on Claude.ai conversations
- Verify message extraction works
- Check user vs assistant detection
- Test file attachment detection
- Verify extended thinking extraction

---

### Phase 3: Claude-Specific Features (Enhancement)
**Goal:** Add Claude-specific export enhancements

**Tasks:**
1. Code block detection (need more examples):
   - Find multi-line code blocks
   - Detect language if available
   - Extract syntax-highlighted code

2. Extended thinking formatting:
   - Format step counts in exports
   - Optionally expand/export individual steps
   - Add thinking metadata to dashboard

3. Artifact detection (if Claude has them):
   - Similar to ChatGPT canvas
   - Extract artifact metadata
   - Mark in exports

4. Claude-specific dashboard metrics:
   - Extended thinking step counts
   - Tool use statistics (if detectable)
   - File attachment breakdown

**Deliverables:**
- Enhanced Claude platform adapter
- Claude-specific dashboard sections
- Updated export formats with Claude features

**Testing:**
- Test with various Claude conversation types
- Verify all special content is captured
- Check dashboard metrics accuracy

---

### Phase 4: UI/UX Polish (Refinement)
**Goal:** Ensure seamless experience across platforms

**Tasks:**
1. Platform indicator in UI:
   - Show "ChatGPT" or "Claude" badge in export panel
   - Update export file naming (add platform prefix)

2. Platform-specific tutorials:
   - Claude-specific onboarding
   - Explain Claude-specific features

3. Settings updates:
   - Platform-specific settings if needed
   - Unified settings UI

4. Export file naming:
```
ChatGPT: chatgpt_conversation_2025-11-22.md
Claude:  claude_conversation_2025-11-22.md
```

**Deliverables:**
- Updated UI components
- Claude tutorials
- Platform badges/indicators

**Testing:**
- Test UI on both platforms
- Verify tutorials work
- Check file naming

---

## Code Organization (Final Structure)

```
capsula/
├── manifest.json (updated with Claude URLs)
├── content.js (ChatGPT entry point)
├── content-claude.js (Claude entry point)
├── background.js (unchanged - API broker)
├── src/
│   ├── platform-adapter.js (base class)
│   ├── platforms/
│   │   ├── chatgpt.js (ChatGPT implementation)
│   │   └── claude.js (Claude implementation)
│   ├── ui/
│   │   ├── ui-manager.js (shared UI logic)
│   │   ├── export-panel.js
│   │   ├── settings-panel.js
│   │   ├── tutorial-system.js
│   │   └── ... (other UI components)
│   ├── exporters/
│   │   ├── export-manager.js
│   │   ├── markdown.js
│   │   ├── html.js
│   │   ├── json.js
│   │   ├── dashboard.js
│   │   ├── github.js
│   │   └── notion.js
│   └── utils/
│       ├── storage.js
│       ├── crypto.js
│       └── ... (utilities)
├── icons/ (unchanged)
└── docs/
    ├── claude-dom-structure.md
    ├── claude-implementation-plan.md (this file)
    └── ... (other docs)
```

---

## Build System Considerations

**Current:** Single `content.js` file (self-contained)

**Options:**

### Option A: Keep Single Files (No Build Step)
- Duplicate shared code in both `content.js` and `content-claude.js`
- Pros: No build tooling needed, simpler deployment
- Cons: Code duplication, harder to maintain

### Option B: Build System with Bundler
- Use Webpack/Rollup/esbuild to bundle modules
- Pros: Clean code organization, no duplication
- Cons: Requires build step, larger file size

**Recommendation:** Start with Option A for quick iteration, migrate to Option B when stable.

---

## Data Model Normalization

**Unified Message Object:**
```javascript
{
  role: 'user' | 'assistant',
  content: {
    text: string,
    markdown: string,      // Parsed markdown structure
    code: [],              // Code blocks
    lists: [],             // List items
    tables: [],            // Tables
    links: [],             // Links
  },
  metadata: {
    platform: 'chatgpt' | 'claude',
    timestamp: string | null,
    model: string | null,
    thinking: {
      type: 'o1' | 'extended_thinking' | null,
      duration: string | null,    // ChatGPT: "5s"
      stepCount: number | null,   // Claude: 70
      stages: [],                 // Multi-stage thinking
    },
    attachments: [
      {
        name: string,
        type: string,
        metadata: string,
      }
    ],
    artifacts: {
      // ChatGPT canvas or Claude artifacts
      type: string,
      title: string,
      content: string,
    } | null,
  }
}
```

This normalized format allows all exporters to work with both platforms.

---

## Testing Strategy

### Manual Testing Checklist:

**Claude.ai:**
- [ ] Extension loads on claude.ai
- [ ] Export button appears
- [ ] Can open export panel
- [ ] Messages extract correctly (user & assistant)
- [ ] File attachments detected
- [ ] Extended thinking extracted
- [ ] Markdown export works
- [ ] HTML export works
- [ ] JSON export works
- [ ] Dashboard export works
- [ ] GitHub integration works
- [ ] Notion integration works
- [ ] Timeline visualization works
- [ ] Message filtering works
- [ ] Selection features work
- [ ] Tutorials appear

**ChatGPT (Regression Testing):**
- [ ] All existing features still work
- [ ] No performance degradation
- [ ] No visual regressions

### Automated Testing (Future):
- Unit tests for platform adapters
- Integration tests for exporters
- E2E tests for UI interactions

---

## Rollout Plan

### v1.4.0 - Claude Beta Support
- Phase 1 complete (platform abstraction)
- Phase 2 complete (basic Claude extraction)
- Limited release for testing

### v1.5.0 - Claude Full Support
- Phase 3 complete (Claude-specific features)
- Phase 4 complete (UI/UX polish)
- Full release with Claude support

### v1.6.0+ - Additional Platforms
- Use same architecture to add:
  - Gemini (gemini.google.com)
  - Copilot (copilot.microsoft.com)
  - Perplexity (perplexity.ai)
  - etc.

---

## Challenges & Considerations

### 1. Code Block Detection (Claude) ✅ RESOLVED
**Issue:** ~~Example conversation didn't have code blocks~~
**Solution:** Analyzed example-3 with extensive code blocks (Python, HTML, CSS, Bash)
**Status:** Full documentation complete with language detection and syntax highlighting
**Implementation:** Use `.group\\/copy.bg-bg-000\\/50 pre.code-block__code` selector

### 2. Model Detection (Claude)
**Issue:** Model name not obvious in DOM
**Solution:** May need to check UI or API calls, or parse from page title/metadata
**Workaround:** Default to "Claude" for now, can enhance later
**Status:** Low priority - doesn't affect core export functionality

### 3. Timestamp Detection (Claude)
**Issue:** Timestamps not visible in shared conversations
**Solution:** May only work in logged-in sessions
**Workaround:** Use current export time or omit from metadata
**Status:** Acceptable limitation for shared conversations

### 4. Extended Thinking Extraction ✅ RESOLVED
**Issue:** ~~Need to understand extended thinking structure~~
**Solution:** Documented collapsible thinking blocks with step counts
**Status:** Full documentation complete
**Implementation:** Use `.group\\/collapse-indicator` selector with step count extraction

### 5. Message Continuation Handling ✅ DOCUMENTED
**Issue:** Long messages split across multiple responses
**Solution:** Detect continuation indicators in content ("Continued in next message due to length")
**Status:** Documented pattern, needs implementation logic
**Implementation:** Check message content for continuation patterns and concatenate sequential messages

### 6. Dynamic Content Loading
**Issue:** Both platforms use SPA navigation
**Solution:** Mutation observers to detect changes
**Implementation:** Already working for ChatGPT, adapt for Claude
**Status:** Standard implementation needed

### 7. File Size (Bundle)
**Issue:** Duplicating code increases extension size
**Solution:** Refactor to shared modules with build step
**Timeline:** Phase 1 addresses this
**Status:** Architectural decision made

---

## Open Questions

1. **Does Claude have artifacts like ChatGPT canvas?**
   - Not observed in current examples (may not exist or require live session)
   - Decision: Defer until reported by users or observed in live sessions

2. **Can we detect Claude model (Sonnet vs Opus)?**
   - May be visible in UI when logged in, not in shared conversations
   - Decision: Default to "Claude" for initial release, enhance later if needed

3. **Should we support Claude shared conversations?**
   - Current examples ARE shared conversations (claude.ai/share/...)
   - Decision: YES - shared conversations will be primary target
   - Live logged-in sessions may work automatically with same selectors

4. **Image/screenshot handling?**
   - Not observed in current examples
   - Decision: Defer until examples are available or reported by users

---

## Success Metrics

- [ ] Claude extraction accuracy: 95%+ of content captured
  - ✅ User messages: Fully documented
  - ✅ Assistant messages: Fully documented
  - ✅ Code blocks: Fully documented
  - ✅ File attachments: Fully documented
  - ✅ Extended thinking: Fully documented
  - ✅ Markdown formatting: Fully documented
  - ⏳ Images: Not yet observed

- [ ] No regressions in ChatGPT functionality
- [ ] User-reported bugs < 5 in first month
- [ ] Export features work on both platforms
- [ ] Extension file size increase < 50%

---

## Next Immediate Steps

**Analysis Phase:** ✅ COMPLETE
- ✅ Gathered Claude conversation examples with:
  - ✅ Code blocks (Python, JavaScript, HTML, CSS, Bash)
  - ✅ Extended thinking (documented "steps" structure)
  - ✅ File attachments with metadata
  - ✅ Very long conversations (10,877 lines)
  - ✅ Message continuation patterns

**Ready to Begin Implementation:**

1. **Create proof-of-concept:** (Next immediate task)
   - Simple Claude message extractor
   - Test basic export (Markdown only)
   - Validate selectors work on live Claude.ai

2. **Begin Phase 1 refactoring:**
   - Extract shared UI components from content.js
   - Create platform adapter interface
   - Refactor ChatGPT code to use adapter

3. **Implement Phase 2 - Claude Platform Adapter:**
   - Create ClaudePlatform class
   - Implement all documented selectors
   - Handle message continuation logic
   - Extract code blocks with language preservation
   - Extract extended thinking with step counts

4. **Design unified data model:**
   - Ensure it represents both platforms
   - Include all documented features
   - Plan for future platforms

---

**Status:** ✅ **Analysis complete. All core features documented. Ready to begin implementation.**

**Estimated Timeline:**
- Phase 1: 2-3 days (refactoring)
- Phase 2: 2-3 days (Claude adapter)
- Phase 3: 1-2 days (Claude features)
- Phase 4: 1 day (polish)
- **Total: ~1 week** of focused development

---

**Document Version:** 1.0
**Last Updated:** November 22, 2025
**Author:** Capsula Development Team
