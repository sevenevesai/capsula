# Implementation Tasks: ChatGPT Export Fixes

## Implementation Status (Updated: 2025-11-03)

### ✅ COMPLETED TASKS

- **Task 1**: Fix Thinking Detection - Use Structural Selectors ✓
  - Status: COMPLETE (was already done previously, enhanced 2025-11-03)
  - File: `/home/user/capsula/content.js` lines 3969-4083
  - Implementation: Multi-strategy detection with 3 approaches, preserves multi-stage thinking
  - Note: Enhanced from basic selector to comprehensive detection (see Enhancement below)

- **Task 2**: Fix Role Detection - Never Use Thinking as Fallback ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - File: `/home/user/capsula/content.js` lines 3822-3886
  - Implementation: Checks `article[data-turn]` first, removed thinking-based detection

- **Task 3**: Add Canvas Artifact Detection ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - File: `/home/user/capsula/content.js` lines 3888-3942
  - Implementation: New `detectCanvasArtifact()` method with 3 detection strategies

- **Task 4**: Add File Attachment Detection ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - File: `/home/user/capsula/content.js` lines 3944-3988
  - Implementation: New `detectFileAttachment()` method with category detection

- **Task 5**: Update Message Processing Order ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - File: `/home/user/capsula/content.js` lines 3562-3650
  - Implementation: Proper sequence with role → canvas/attachment → thinking → content

### ✅ ADDITIONAL COMPLETED TASKS

- **Task 6**: Update Export Formats with New Metadata ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - Location: `content.js` lines 2506-2870
  - Changes:
    * CRITICAL FIX: Thinking labels now appear AFTER role header
    * Added file attachment markers (📎)
    * Added canvas artifact markers (📋)
    * Multi-stage thinking properly displayed
    * Added parseThinkingTime() method for accurate time tracking
    * Enhanced HTML with styled markers and dark mode support

- **Task 7**: Update Dashboard Metrics ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - Location: `content.js` lines 2928-3652
  - Changes:
    * Fixed thinking time calculation (was 0s, now accurate)
    * Added multi-stage thinking metrics
    * Added canvas artifacts section (total, documents, code)
    * Added file attachments section (total + breakdown by type)
    * Enhanced thinking section with multi-stage stats

- **Enhancement**: Robust Thinking Detection (Multi-Strategy) ✓
  - Status: COMPLETE (implemented 2025-11-03)
  - Location: `content.js` lines 3933-4083
  - Problem: Original selector `.relative.my-1.min-h-6` was too strict, missing:
    * Canvas-only responses with thinking labels
    * Multi-stage thinking sequences (5+ stages)
    * Text patterns like "couple of seconds"
  - Solution: Implemented multi-strategy detection:
    * Strategy 1: Flexible class-based selector `div.relative[class*="my-"][class*="min-h"]`
    * Strategy 2: Content-based detection searching for thinking text patterns
    * Strategy 3: Future-proof explicit marker detection
    * Enhanced `parseThinkingTime()` to handle "few seconds", "couple seconds", "moment"
    * Added comprehensive false-positive filters
    * Added console logging for debugging

### 🔄 PENDING TASKS

- **Testing**: Verify all fixes work with actual ChatGPT exports
- **Code Block Count Investigation**: Debug why code blocks may be undercounted

### 📝 Testing Status

- Manual testing with sample HTML files: PENDING
- Integration testing: PENDING
- Export validation: PENDING

---

## Overview

Based on analysis of actual ChatGPT DOM structure and the current extraction code, this document provides **exact code changes** to fix all identified issues. Each task includes:
- Problem description
- Current code (with line numbers)
- Fixed code
- Testing requirements

All tasks reference the current extraction code in `/home/user/capsula/content.js`.

---

## Task 1: Fix Thinking Detection - Use Structural Selectors

### ✅ STATUS: COMPLETE (Previously Implemented)
**Location**: `content.js` lines 3652-3741
**Result**: Method now uses structural selectors only, preventing false positives

---

### Problem
**Lines 3652-3717**: `detectThinkingStates()` recursively searches ALL text nodes in the container, which causes:
- User messages to get thinking labels if they contain "Thought for" in their actual content
- Wrong attribution of thinking labels
- Missing multi-stage thinking sequences

### Current Code (Lines 3652-3705)
```javascript
detectThinkingStates(container) {
  const timeLabels = [];
  const stateLabels = [];
  const seenTexts = new Set();

  // Search for thinking patterns in descendants
  const searchNodes = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (!text) return;

      // Check time patterns
      for (const pattern of CFG.thinkingPatterns.timePatterns) {
        const match = text.match(pattern);
        if (match && !seenTexts.has(match[0])) {
          timeLabels.push({ text: match[0] });
          seenTexts.add(match[0]);
        }
      }

      // Check state patterns only if we haven't found time patterns yet
      if (timeLabels.length === 0) {
        for (const pattern of CFG.thinkingPatterns.statePatterns) {
          const match = text.match(pattern);
          if (match && !seenTexts.has(match[0])) {
            stateLabels.push({ text: match[0] });
            seenTexts.add(match[0]);
          }
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Check for expander buttons
      // ... button detection code ...
      
      // Recurse into children
      for (const child of node.childNodes) {
        searchNodes(child);
      }
    }
  };

  searchNodes(container);

  // Prefer time labels, fall back to state labels only if no time info found
  const labels = timeLabels.length > 0 ? timeLabels : stateLabels.slice(0, 1);

  return {
    labels: labels,
    expandable: expanderSelectors.length > 0,
    expanderSelectors: expanderSelectors.length > 0 ? expanderSelectors : undefined
  };
}
```

### Fixed Code
Replace lines 3652-3717 with:

```javascript
detectThinkingStates(container) {
  const labels = [];
  const expanderSelectors = [];

  // CRITICAL FIX: Only look in STRUCTURAL thinking div locations
  // These are specific divs that ChatGPT uses for thinking indicators
  // Located ABOVE the message content, not within it
  const thinkingDivs = container.querySelectorAll('.relative.my-1.min-h-6');

  thinkingDivs.forEach((thinkingDiv, index) => {
    // Look for the thinking text span within this specific div
    const thinkingSpan = thinkingDiv.querySelector('span.text-token-text-secondary, span[class*="text-token-text"]');
    
    if (!thinkingSpan) return;

    const text = thinkingSpan.textContent?.trim();
    if (!text) return;

    // Check if this matches thinking patterns
    const isTimePattern = /Thought for|Thinking for|Processing for/i.test(text);
    const isStatePattern = /Stopped|Analyzing|Processing|Working|Calculating|Reading|Planning/i.test(text);

    if (isTimePattern || isStatePattern) {
      labels.push({
        text: text,
        order: index,  // Preserve sequence for multi-stage thinking
        type: isTimePattern ? 'time' : 'state'
      });

      // Check for expander button in this thinking div
      const button = thinkingDiv.querySelector('button[aria-expanded], button[role="button"]');
      if (button && button.getAttribute('aria-expanded') === 'false') {
        const selector = this.getElementSelector(button);
        if (selector && expanderSelectors.length < 3) {
          expanderSelectors.push(selector);
        }
      }
    }
  });

  return {
    labels: labels,  // Array preserving all thinking stages in order
    expandable: expanderSelectors.length > 0,
    expanderSelectors: expanderSelectors.length > 0 ? expanderSelectors : undefined
  };
}
```

### Testing
```javascript
// Test Case 1: User message with "Thought for" in content
// HTML: <div data-turn="user">I thought for a while about this</div>
// Expected: labels = []

// Test Case 2: Assistant with single thinking
// HTML: <div data-turn="assistant">
//         <div class="relative my-1 min-h-6">
//           <span>Thought for 18s</span>
//         </div>
// Expected: labels = [{ text: 'Thought for 18s', order: 0 }]

// Test Case 3: Assistant with 5-stage thinking
// Expected: labels.length = 5, with order 0-4
```

---

## Task 2: Fix Role Detection - Never Use Thinking as Fallback

### ✅ STATUS: COMPLETE (Implemented 2025-11-03)
**Location**: `content.js` lines 3822-3886
**Changes**:
- Added `article[data-turn]` as Priority 1 check
- Removed lines 3832-3833 (thinking-based role detection)
- Added `.user-message-bubble-color` detection
- Improved content-based heuristics
- Added warning logging for uncertain cases

---

### Problem
**Lines 3798-3818**: `detectRole()` uses thinking detection as a fallback to determine role, which can cause user messages to be misidentified as assistant if they happen to contain thinking-like text.

### Current Code (Lines 3798-3818)
```javascript
detectRole(el) {
  const attr = el.getAttribute('data-message-author-role');
  if (attr) return attr;

  const nested = el.querySelector('[data-message-author-role]');
  if (nested) return nested.getAttribute('data-message-author-role');

  const parent = el.closest('[data-message-author-role]');
  if (parent) return parent.getAttribute('data-message-author-role');

  const thinkingInfo = this.detectThinkingStates(el);  // ← PROBLEM
  if (thinkingInfo.labels.length > 0) return 'assistant';  // ← PROBLEM

  const text = (el.textContent || '').toLowerCase();
  if (text.startsWith('you:') || el.querySelector('img[alt*="User"]')) return 'user';
  if (text.includes('chatgpt') || el.querySelector('img[alt*="ChatGPT"]')) return 'assistant';

  const style = window.getComputedStyle(el);
  if (style.textAlign === 'right' || style.justifyContent === 'flex-end') return 'user';

  return 'assistant';
}
```

### Fixed Code
Replace lines 3798-3818 with:

```javascript
detectRole(el) {
  // Priority 1: Check article-level data-turn attribute (most reliable)
  const article = el.closest('article[data-turn]');
  if (article) {
    const turn = article.getAttribute('data-turn');
    if (turn === 'user' || turn === 'assistant') {
      return turn;
    }
  }

  // Priority 2: Check message-level data-message-author-role
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

  // REMOVED: No longer use thinking as role indicator
  // Thinking should be detected AFTER role is determined

  // Priority 5: Content-based heuristics (least reliable, use only as last resort)
  const text = (el.textContent || '').toLowerCase();
  
  // Check for explicit role indicators
  if (text.startsWith('you said:') || text.startsWith('you:')) return 'user';
  if (text.startsWith('chatgpt said:') || text.startsWith('chatgpt:')) return 'assistant';
  
  // Check for user/assistant avatars or images
  if (el.querySelector('img[alt*="User" i]')) return 'user';
  if (el.querySelector('img[alt*="ChatGPT" i], img[alt*="Assistant" i]')) return 'assistant';

  // Check for user bubble styling
  if (el.querySelector('.user-message-bubble-color')) return 'user';

  // Check for layout alignment (user messages typically right-aligned)
  const style = window.getComputedStyle(el);
  if (style.textAlign === 'right' || style.justifyContent === 'flex-end') {
    // Double-check this isn't an assistant message with right-aligned content
    if (!el.querySelector('.markdown.prose')) {
      return 'user';
    }
  }

  // Default to assistant if uncertain (safer than user)
  console.warn('[ChatGPT Export] Could not reliably detect role for element, defaulting to assistant', el);
  return 'assistant';
}
```

### Testing
```javascript
// Test Case 1: Article with data-turn
// HTML: <article data-turn="user"><div>Message</div></article>
// Expected: 'user' (regardless of content)

// Test Case 2: User message with thinking-like content
// HTML: <article data-turn="user">I thought for 5 minutes</article>
// Expected: 'user' (not 'assistant')

// Test Case 3: Missing attributes, use heuristics
// HTML: <div style="text-align: right">Message</div>
// Expected: 'user'
```

---

## Task 3: Add Canvas Artifact Detection

### ✅ STATUS: COMPLETE (Implemented 2025-11-03)
**Location**: `content.js` lines 3888-3942
**Changes**:
- Added new `detectCanvasArtifact()` method
- Implements 3 detection strategies (textdoc ID, code canvas, general popover)
- Extracts title, type, and content element
- Returns metadata object or null

---

### Problem
The current code doesn't detect or mark Canvas artifacts (documents, code blocks generated in canvas interface). These should be identified and marked with metadata.

### Location
Add new method after `detectRole()` (around line 3819):

```javascript
detectCanvasArtifact(container) {
  // Check for Canvas document/code artifact
  // Canvas artifacts have specific ID pattern and structure
  
  // Method 1: Check for textdoc-message ID (document canvas)
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
  const popoverCanvas = container.querySelector('.popover.bg-token-bg-primary.rounded-3xl');
  if (popoverCanvas && popoverCanvas.querySelector('.ProseMirror')) {
    return {
      isCanvas: true,
      type: 'unknown',
      title: 'Canvas Artifact',
      contentElement: popoverCanvas
    };
  }

  return null;
}
```

### Integration
Update `collectAllMessages()` around line 3568 to use canvas detection:

```javascript
// Around line 3568-3605, update the message collection loop:

turnContainers.forEach((container, index) => {
  if (processedElements.has(container)) return;
  processedElements.add(container);
  
  const role = this.detectRole(container);
  
  // NEW: Check for canvas artifact FIRST (before thinking detection)
  const canvasInfo = this.detectCanvasArtifact(container);
  
  // Only detect thinking for assistant messages
  const thinkingInfo = role === 'assistant' ? this.detectThinkingStates(container) : { labels: [], expandable: false };
  
  const hasContent = this.hasActualContent(container);
  
  // Canvas artifacts count as having content
  if (!hasContent && !canvasInfo && !thinkingInfo.labels.length) return;
  
  // For canvas, use the canvas content element
  const contentNode = canvasInfo 
    ? canvasInfo.contentElement 
    : (this.findContentNode(container) || container);
    
  const clone = contentNode.cloneNode(true);
  this.sanitizeClone(clone);
  
  const blocks = this.extractBlocks(clone);
  const plainText = (clone.textContent || '').replace(/\s+\n/g, '\n').trim();
  
  const message = {
    id: container.id || `msg-${messages.length + 1}`,
    index: messages.length,
    role: role,
    thinking: thinkingInfo.labels.length > 0 ? thinkingInfo : null,
    isThinking: thinkingInfo.labels.length > 0 && !hasContent && !canvasInfo,
    incomplete: thinkingInfo.labels.some(l => 
      /stopped|paused|failed/i.test(l.text)
    ),
    // NEW: Canvas metadata
    canvas: canvasInfo || null,
    isCanvas: canvasInfo !== null,
    canvasTitle: canvasInfo?.title || null,
    // ... rest of message object
  };
  
  // ... rest of collection logic
});
```

### Testing
```javascript
// Test Case 1: Canvas document detected
// HTML: <div id="textdoc-message-abc123">...</div>
// Expected: message.isCanvas = true, message.canvasTitle = "Document Title"

// Test Case 2: Regular message not marked as canvas
// HTML: <div class="markdown prose">Regular text</div>
// Expected: message.isCanvas = false
```

---

## Task 4: Add File Attachment Detection

### ✅ STATUS: COMPLETE (Implemented 2025-11-03)
**Location**: `content.js` lines 3944-3988
**Changes**:
- Added new `detectFileAttachment()` method
- Only processes user messages
- Detects file preview structure with border styling
- Extracts fileName, fileType, and categorizes by type
- Returns metadata object or null

---

### Problem
User messages with file attachments (images, PDFs, zips) are not detected or marked with metadata about the attached file.

### Location
Add new method after `detectCanvasArtifact()`:

```javascript
detectFileAttachment(container) {
  // Only user messages can have file attachments
  const role = this.detectRole(container);
  if (role !== 'user') return null;

  // Look for file preview structure
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
}
```

### Integration
Update `collectAllMessages()` to use file attachment detection:

```javascript
// In the message collection loop, after canvas detection:

const role = this.detectRole(container);
const canvasInfo = this.detectCanvasArtifact(container);
const thinkingInfo = role === 'assistant' ? this.detectThinkingStates(container) : { labels: [], expandable: false };

// NEW: Detect file attachments
const fileAttachment = this.detectFileAttachment(container);

// ... rest of processing ...

const message = {
  id: container.id || `msg-${messages.length + 1}`,
  index: messages.length,
  role: role,
  thinking: thinkingInfo.labels.length > 0 ? thinkingInfo : null,
  canvas: canvasInfo || null,
  // NEW: File attachment metadata
  attachment: fileAttachment || null,
  hasAttachment: fileAttachment !== null,
  // ... rest of message object
};
```

### Update Export Generation
In HTML export (around lines 2000-2200), add file attachment display:

```javascript
// When generating HTML for a message:
if (msg.hasAttachment) {
  html += `<div class="file-attachment">
    <div class="file-icon">📎</div>
    <div class="file-info">
      <div class="file-name">${escapeHtml(msg.attachment.fileName)}</div>
      <div class="file-type">${escapeHtml(msg.attachment.fileType)}</div>
    </div>
  </div>`;
}
```

In Markdown export (around lines 2400-2600), add file attachment notation:

```javascript
// When generating Markdown for a message:
if (msg.hasAttachment) {
  md += `\n📎 **Attached**: ${msg.attachment.fileName} (${msg.attachment.fileType})\n\n`;
}
```

### Testing
```javascript
// Test Case 1: User message with zip file
// HTML: <div data-turn="user">
//         <div class="border-token-border-default border rounded-xl">
//           <div class="truncate font-semibold">Project.zip</div>
//           <div class="text-token-text-secondary truncate">Zip Archive</div>
//         </div>
//       </div>
// Expected: message.hasAttachment = true, message.attachment.fileName = "Project.zip"

// Test Case 2: Assistant message (no attachments possible)
// Expected: message.hasAttachment = false

// Test Case 3: User message without attachment
// Expected: message.hasAttachment = false
```

---

## Task 5: Update Message Processing Order

### ✅ STATUS: COMPLETE (Implemented 2025-11-03)
**Location**: `content.js` lines 3562-3650
**Changes**:
- Updated `collectAllMessages()` method with proper detection sequence
- Role detection runs FIRST (not dependent on content)
- Canvas/attachment detection based on role (assistant/user)
- Thinking detection ONLY for assistant messages
- Added all new metadata fields to message object
- Improved validation logic

**New Message Metadata Fields**:
- `thinkingSequence`: Array for multi-stage thinking
- `canvas`, `isCanvas`, `canvasTitle`, `canvasType`: Canvas artifact metadata
- `attachment`, `hasAttachment`: File attachment metadata
- `model`: Assistant model information

---

### Problem
The current order of detection can cause issues. Need to ensure role is determined first, then type-specific features.

### Current Flow (Lines 3568-3605)
```javascript
turnContainers.forEach((container, index) => {
  const role = this.detectRole(container);
  const thinkingInfo = this.detectThinkingStates(container);
  const hasContent = this.hasActualContent(container);
  // ... process message
});
```

### Fixed Flow
Replace the message collection loop with this updated order:

```javascript
turnContainers.forEach((container, index) => {
  if (processedElements.has(container)) return;
  processedElements.add(container);
  
  // STEP 1: Determine role FIRST (never depends on content)
  const role = this.detectRole(container);
  
  // STEP 2: Type-specific detection (depends on role)
  const canvasInfo = role === 'assistant' ? this.detectCanvasArtifact(container) : null;
  const fileAttachment = role === 'user' ? this.detectFileAttachment(container) : null;
  
  // STEP 3: Thinking detection (ONLY for assistant messages, uses structural selectors)
  const thinkingInfo = role === 'assistant' 
    ? this.detectThinkingStates(container)
    : { labels: [], expandable: false };
  
  // STEP 4: Content validation
  const hasContent = this.hasActualContent(container);
  
  // STEP 5: Skip if no content, no thinking, no canvas, no attachment
  if (!hasContent && !canvasInfo && !fileAttachment && !thinkingInfo.labels.length) {
    console.debug('[ChatGPT Export] Skipping empty message', container);
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
    id: container.id || `msg-${messages.length + 1}`,
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
  if (message.plain.text || message.blocks.length > 0 || message.thinking || message.canvas || message.attachment) {
    messages.push(message);
  } else {
    console.warn('[ChatGPT Export] Skipping message with no extractable content', container);
  }
});
```

### Testing
Run full integration test with mixed conversation:
1. User message (simple)
2. Assistant with single thinking + response
3. Assistant with canvas artifact
4. User with file attachment
5. Assistant with 5-stage thinking
6. Assistant with "Stopped thinking" (no content)

Verify:
- All roles correct
- No user messages with thinking
- All canvas artifacts marked
- All file attachments detected
- Multi-stage thinking preserved

---

## Task 6: Update Export Formats with New Metadata

### Problem
HTML and Markdown exports need to display the new metadata (canvas, attachments, multi-stage thinking).

### HTML Export Updates

Around line 2000, update message rendering to include new metadata:

```javascript
function renderMessageHTML(msg, theme) {
  let html = '';
  
  // Message container with role-specific class
  html += `<div class="message ${msg.role}" data-message-id="${msg.id}">`;
  
  // Thinking sequence (if present)
  if (msg.thinkingSequence && msg.thinkingSequence.length > 1) {
    html += `<div class="thinking-sequence">`;
    msg.thinkingSequence.forEach((think, idx) => {
      html += `<div class="thinking-label thinking-stage-${idx + 1}">`;
      html += `<span class="thinking-icon">🤔</span>`;
      html += `<span class="thinking-text">${escapeHtml(think.text)}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  } else if (msg.thinking && msg.thinking.labels.length > 0) {
    // Single thinking label
    html += `<div class="thinking-label">`;
    html += `<span class="thinking-icon">🤔</span>`;
    html += `<span class="thinking-text">${escapeHtml(msg.thinking.labels[0].text)}</span>`;
    html += `</div>`;
  }
  
  // File attachment (if present)
  if (msg.hasAttachment) {
    const iconMap = {
      'image': '🖼️',
      'pdf': '📄',
      'archive': '📦',
      'document': '📝',
      'code': '💻',
      'file': '📎'
    };
    const icon = iconMap[msg.attachment.category] || '📎';
    
    html += `<div class="file-attachment">`;
    html += `<span class="file-icon">${icon}</span>`;
    html += `<div class="file-info">`;
    html += `<div class="file-name">${escapeHtml(msg.attachment.fileName)}</div>`;
    html += `<div class="file-type">${escapeHtml(msg.attachment.fileType)}</div>`;
    html += `</div>`;
    html += `</div>`;
  }
  
  // Canvas artifact marker (if present)
  if (msg.isCanvas) {
    html += `<div class="canvas-artifact-marker">`;
    html += `<span class="canvas-icon">📋</span>`;
    html += `<span class="canvas-title">${escapeHtml(msg.canvasTitle)}</span>`;
    html += `<span class="canvas-type">${msg.canvasType || 'artifact'}</span>`;
    html += `</div>`;
  }
  
  // Message bubble
  html += `<div class="bubble">`;
  html += `<div class="role">${msg.role === 'user' ? 'You' : 'ChatGPT'}</div>`;
  
  // Content
  if (msg.blocks && msg.blocks.length > 0) {
    html += renderBlocks(msg.blocks);
  } else if (msg.plain.text) {
    html += `<p>${escapeHtml(msg.plain.text)}</p>`;
  } else if (msg.isThinking) {
    html += `<p class="no-content"><em>Thinking process (no response generated)</em></p>`;
  }
  
  html += `</div>`; // Close bubble
  html += `</div>`; // Close message
  
  return html;
}
```

### Markdown Export Updates

Around line 2400, update Markdown generation:

```javascript
function renderMessageMarkdown(msg) {
  let md = '';
  
  // Header
  md += `\n## ${msg.role === 'user' ? 'You' : 'ChatGPT'}\n\n`;
  
  // Multi-stage thinking sequence
  if (msg.thinkingSequence && msg.thinkingSequence.length > 1) {
    md += `*Thinking sequence (${msg.thinkingSequence.length} stages):*\n`;
    msg.thinkingSequence.forEach((think, idx) => {
      md += `  ${idx + 1}. ${think.text}\n`;
    });
    md += `\n`;
  } else if (msg.thinking && msg.thinking.labels.length > 0) {
    // Single thinking label
    md += `*${msg.thinking.labels[0].text}*\n\n`;
  }
  
  // File attachment
  if (msg.hasAttachment) {
    md += `📎 **Attached**: ${msg.attachment.fileName}`;
    if (msg.attachment.fileType) {
      md += ` (${msg.attachment.fileType})`;
    }
    md += `\n\n`;
  }
  
  // Canvas artifact
  if (msg.isCanvas) {
    md += `📋 **Canvas Artifact**: ${msg.canvasTitle}`;
    if (msg.canvasType && msg.canvasType !== 'unknown') {
      md += ` (${msg.canvasType})`;
    }
    md += `\n\n---\n\n`;
  }
  
  // Content
  if (msg.blocks && msg.blocks.length > 0) {
    md += renderBlocksMarkdown(msg.blocks);
  } else if (msg.plain.text) {
    md += msg.plain.text + '\n';
  } else if (msg.isThinking) {
    md += `*Thinking process (no response generated)*\n`;
  }
  
  md += '\n';
  
  return md;
}
```

---

## Task 7: Update Dashboard Metrics

### Problem
Dashboard metrics need to reflect new metadata correctly.

### Dashboard Metric Updates

Add new metrics to dashboard generation (around line 1500):

```javascript
function calculateMetrics(messages) {
  const metrics = {
    // Existing metrics
    totalMessages: messages.length,
    userMessages: messages.filter(m => m.role === 'user').length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    
    // NEW: Thinking metrics (fixed)
    thinkingMessages: messages.filter(m => m.thinking && m.thinking.labels.length > 0).length,
    thinkingOnlyMessages: messages.filter(m => m.isThinking).length,
    multiStageThinking: messages.filter(m => m.thinkingSequence && m.thinkingSequence.length > 1).length,
    totalThinkingStages: messages.reduce((sum, m) => 
      sum + (m.thinkingSequence ? m.thinkingSequence.length : (m.thinking ? m.thinking.labels.length : 0)), 
      0
    ),
    
    // NEW: Canvas metrics
    canvasArtifacts: messages.filter(m => m.isCanvas).length,
    canvasDocuments: messages.filter(m => m.isCanvas && m.canvasType === 'document').length,
    canvasCode: messages.filter(m => m.isCanvas && m.canvasType === 'code').length,
    
    // NEW: Attachment metrics
    messagesWithAttachments: messages.filter(m => m.hasAttachment).length,
    attachmentsByType: {
      image: messages.filter(m => m.attachment && m.attachment.category === 'image').length,
      pdf: messages.filter(m => m.attachment && m.attachment.category === 'pdf').length,
      archive: messages.filter(m => m.attachment && m.attachment.category === 'archive').length,
      document: messages.filter(m => m.attachment && m.attachment.category === 'document').length,
      code: messages.filter(m => m.attachment && m.attachment.category === 'code').length,
      other: messages.filter(m => m.attachment && m.attachment.category === 'file').length
    },
    
    // Word counts (unchanged)
    totalWords: messages.reduce((sum, m) => sum + (m.plain.text?.split(/\s+/).length || 0), 0),
    // ... rest of metrics
  };
  
  // Calculate thinking percentage correctly
  if (metrics.assistantMessages > 0) {
    metrics.thinkingPercentage = Math.round(
      (metrics.thinkingMessages / metrics.assistantMessages) * 100
    );
  } else {
    metrics.thinkingPercentage = 0;
  }
  
  return metrics;
}
```

---

## Testing Checklist

After implementing all tasks, verify with this test conversation:

```
Message 1: User sends simple text
Message 2: Assistant responds (no thinking)
Message 3: User uploads Project.zip with message
Message 4: Assistant thinks for 18s, generates Canvas document
Message 5: User sends another message
Message 6: Assistant has 5-stage thinking (5s, 29s, 9s, few seconds, 35s), then responds
Message 7: Assistant shows "Stopped thinking" with no response
Message 8: User sends final message
```

**Expected results**:
- ✅ 8 messages total
- ✅ 3 user, 5 assistant (including thinking-only)
- ✅ Message 1: role='user', no thinking
- ✅ Message 3: hasAttachment=true, fileName='Project.zip'
- ✅ Message 4: thinking.labels.length=1, isCanvas=true
- ✅ Message 6: thinkingSequence.length=5, all in correct order
- ✅ Message 7: isThinking=true, incomplete=true, empty content
- ✅ NO user messages with thinking labels
- ✅ All canvas artifacts marked
- ✅ Dashboard metrics all correct

---

## File Locations Summary

All changes are in: `/mnt/user-data/uploads/contentjs.txt`

**Methods to update**:
- Line 3652-3717: `detectThinkingStates()` → Task 1
- Line 3798-3818: `detectRole()` → Task 2
- After 3818: Add `detectCanvasArtifact()` → Task 3
- After new method: Add `detectFileAttachment()` → Task 4
- Line 3568-3605: `collectAllMessages()` loop → Task 5
- Line ~2000: HTML export → Task 6
- Line ~2400: Markdown export → Task 6
- Line ~1500: Dashboard metrics → Task 7

**Total lines affected**: ~500 lines
**Total new code**: ~300 lines
**Estimated time**: 4-6 hours for careful implementation and testing

---

## Validation Commands

After changes, test the exports:

```javascript
// In browser console on ChatGPT page:
// Check role detection
document.querySelectorAll('article[data-turn]').forEach(article => {
  const role = article.getAttribute('data-turn');
  const thinking = article.querySelectorAll('.relative.my-1.min-h-6');
  console.log(`Role: ${role}, Thinking divs: ${thinking.length}`);
});

// Check canvas detection
document.querySelectorAll('[id^="textdoc-message-"]').forEach(canvas => {
  console.log('Canvas found:', canvas.id);
});

// Check file attachments
document.querySelectorAll('.border-token-border-default.border.rounded-xl').forEach(file => {
  const name = file.querySelector('.truncate.font-semibold')?.textContent;
  console.log('File attachment:', name);
});
```

Then export and verify:
1. Message count matches UI
2. No user messages with thinking
3. All canvas artifacts marked
4. All file attachments detected
5. Multi-stage thinking preserved
