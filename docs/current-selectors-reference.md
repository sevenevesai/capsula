# Current Capsula Selectors Reference

**Version:** 3.3.0 (as of 2025-11-03)
**Source:** `/home/user/capsula/content.js`

This document catalogs all DOM selectors currently used by Capsula addon.

---

## Message Container Selectors

### Priority Strategy (content.js:3608-3650)

Capsula uses a 5-tier fallback strategy to locate message containers:

```javascript
const strategies = [
  // Tier 1: Most reliable (preferred)
  () => Array.from(document.querySelectorAll('article[data-scroll-anchor]')),

  // Tier 2: Test ID fallback
  () => Array.from(document.querySelectorAll('[data-testid="conversation-turn"]')),

  // Tier 3: Role-based
  () => Array.from(document.querySelectorAll('[data-message-author-role]')),

  // Tier 4: Message ID
  () => Array.from(document.querySelectorAll('div[data-message-id]')),

  // Tier 5: Class-based fallback
  () => Array.from(document.querySelectorAll('.group\\/conversation-turn, .agent-turn, .user-turn'))
];
```

**Implementation Notes:**
- Tries strategies in order until one returns elements
- Uses first successful strategy for entire conversation
- No mixing of strategies within a single harvest

**Code Location:** `content.js:3608`

---

## Role Detection

### Primary Method: Data Attribute

```javascript
const role = element.getAttribute('data-message-author-role');
// Expected values: "user" | "assistant"
```

**Code Location:** `content.js:3721-3723`

### Fallback: Class-based Detection

```javascript
if (!role) {
  if (element.classList.contains('user-turn') ||
      element.closest('.user-turn')) {
    role = 'user';
  } else if (element.classList.contains('agent-turn') ||
             element.closest('.agent-turn')) {
    role = 'assistant';
  }
}
```

**Code Location:** Implicit in message processing logic

---

## Content Extraction Selectors

### Priority Order (content.js:3750-3800)

```javascript
const contentSelectors = [
  '[data-message-content]',      // Priority 1: Explicit content marker
  '.markdown.prose',              // Priority 2: Rendered markdown
  '.text-message',                // Priority 3: Text message container
  '.prose',                       // Priority 4: Generic prose
  'article',                      // Priority 5: Article element itself
  'div.group\\/conversation-turn' // Priority 6: Conversation turn
];

// Try each selector until content is found
for (const selector of contentSelectors) {
  const contentEl = messageEl.querySelector(selector);
  if (contentEl && contentEl.textContent.trim()) {
    return contentEl;
  }
}
```

**Code Location:** `content.js:3750`

---

## Thinking State Detection

### Time-based Pattern Matching (content.js:3652-3690)

```javascript
const timePatterns = [
  // Matches: "Thought for 42 seconds"
  /\b(?:Thought|Thinking|Processing|Analyzing|Working)\s+for\s+(\d+)\s*(second|minute|hour)s?\b/i,

  // Matches: "1m 30s"
  /\b(\d+)m\s+(\d+)s\b/,

  // Matches: "0:45" (mm:ss)
  /\b(\d{1,2}):(\d{2})\b/
];
```

**Code Location:** `content.js:3652`

### State Indicator Pattern

```javascript
const thinkingStates = /\b(?:Analyzing|Processing|Reasoning|Computing|Evaluating|Using tools?)\b/i;
```

**Code Location:** `content.js:3670`

### Expandable Block Detection

```javascript
// Check for collapsible elements
const isExpandable = (element) => {
  return element.hasAttribute('aria-expanded') &&
         element.getAttribute('aria-expanded') === 'false';
};

// Radix UI components
const isRadixComponent = (element) => {
  return element.id && element.id.startsWith('radix-');
};

// Button text patterns
const expandButtonPattern = /\b(?:show|expand|view|details|steps|more|analysis|reasoning|tools?)\b/i;
```

**Code Location:** `content.js:3680-3695`

---

## Block Type Selectors

### Code Blocks (content.js:3850)

```javascript
const codeBlockSelector = 'pre > code';

// Language detection
const languageClass = codeElement.className.match(/language-(\w+)/);
const language = languageClass ? languageClass[1] : 'plaintext';
```

### Headings (content.js:3870)

```javascript
const headingSelector = 'h1, h2, h3, h4, h5, h6';

// Level extraction
const level = parseInt(element.tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
```

### Lists (content.js:3890)

```javascript
const orderedListSelector = 'ol';
const unorderedListSelector = 'ul';

// List items
const listItemSelector = 'li';
```

### Tables (content.js:3910)

```javascript
const tableSelector = 'table';

// Table parts
const theadSelector = 'thead';
const tbodySelector = 'tbody';
const rowSelector = 'tr';
const cellSelector = 'td, th';
```

### Images (content.js:3930)

```javascript
const imageSelector = 'img';

// Image attributes
const src = imgElement.getAttribute('src');
const alt = imgElement.getAttribute('alt') || '';
const title = imgElement.getAttribute('title') || '';
```

### Links (content.js:3950)

```javascript
const linkSelector = 'a[href]';

// Citation detection
const isCitation = linkElement.classList.contains('citation') ||
                   linkElement.hasAttribute('data-citation') ||
                   linkElement.closest('[data-citations]');
```

### Math (content.js:3970)

```javascript
const inlineMathSelector = 'span.math-inline, span[data-math-inline]';
const blockMathSelector = 'div.math-display, div[data-math-display]';

// LaTeX extraction
const latex = mathElement.getAttribute('data-latex') ||
              mathElement.textContent;
```

### Quotes (content.js:3990)

```javascript
const quoteSelector = 'blockquote';
```

### Dividers (content.js:4000)

```javascript
const dividerSelector = 'hr';
```

---

## Model Detection

### Per-Message Attributes (content.js:3730-3740)

```javascript
const modelIndicators = [
  'data-model',
  'data-model-slug',
  'data-model-name'
];

// Check each message for model indicator
for (const attr of modelIndicators) {
  const model = element.getAttribute(attr);
  if (model) return model;
}
```

### UI Text Pattern Matching

```javascript
// Search for model name in visible UI
const modelPatterns = [
  /\b(gpt-4[o]?(?:-\w+)?)\b/i,        // GPT-4, GPT-4o, etc.
  /\b(o1(?:-mini|-preview)?)\b/i,     // o1, o1-mini, o1-preview
  /\b(claude-\d+(?:\.\d+)?)\b/i,      // Claude models
  /\b(chatgpt-\d+(?:\.\d+)?)\b/i      // Generic ChatGPT
];
```

**Code Location:** `content.js:3730`

---

## Metadata Selectors

### Message ID

```javascript
const messageId = element.getAttribute('data-message-id') ||
                  element.getAttribute('data-scroll-anchor') ||
                  element.id ||
                  generateFallbackId();
```

**Code Location:** `content.js:3725`

### Timestamp

```javascript
// Look for timestamp element
const timeSelectors = [
  'time[datetime]',
  '[data-timestamp]',
  '.message-timestamp',
  '.timestamp'
];

for (const selector of timeSelectors) {
  const timeEl = element.querySelector(selector);
  if (timeEl) {
    return timeEl.getAttribute('datetime') ||
           timeEl.getAttribute('data-timestamp') ||
           timeEl.textContent;
  }
}
```

**Code Location:** `content.js:3745`

---

## Auto-Expand Feature

### Button Detection (content.js:3695-3717)

```javascript
// Find all expandable buttons
const expandButtons = Array.from(document.querySelectorAll('button[aria-expanded="false"]'));

// Filter by context (inside message containers)
const relevantButtons = expandButtons.filter(btn => {
  const messageContainer = btn.closest('article[data-scroll-anchor]');
  return messageContainer !== null;
});

// Click with delay
relevantButtons.forEach((btn, index) => {
  setTimeout(() => {
    btn.click();
  }, index * 50); // 50ms between clicks
});
```

**Code Location:** `content.js:3695`

---

## Known Gaps & Limitations

### ❌ Not Currently Handled

1. **Canvas Artifacts**
   - No specific selector for canvas elements
   - No extraction of canvas content
   - No differentiation between text and canvas

2. **File Attachments**
   - No detection of uploaded files
   - No thumbnail extraction
   - No file metadata capture

3. **Error States**
   - No explicit error state detection
   - No failed generation indicators
   - No retry button identification

4. **Streaming States**
   - No live update during generation
   - No cursor/typing indicators
   - No partial content handling

5. **Conversation Metadata**
   - No conversation title extraction
   - No conversation ID detection
   - No shared conversation indicators

### ⚠️ Fragile Implementations

1. **Thinking Detection**
   - Relies on text pattern matching (fragile)
   - No DOM-based state detection
   - May miss non-English thinking indicators

2. **Model Detection**
   - Falls back to UI text scanning
   - No reliable per-message model tracking
   - Assumes same model for entire conversation

3. **Timestamp Extraction**
   - Multiple fallback strategies suggest unreliability
   - No guaranteed timestamp source

---

## Selector Stability Assessment

### 🟢 Highly Stable (Recommended)

- `article[data-scroll-anchor]` - Core message container
- `data-message-author-role` - Role indicator
- `.markdown.prose` - Rendered content

### 🟡 Moderately Stable

- `[data-testid="conversation-turn"]` - Test ID (may change)
- `data-message-id` - Sometimes present
- `pre > code` - Code blocks

### 🔴 Fragile (Likely to Break)

- `.group\/conversation-turn` - Escaped class name (Tailwind)
- `.agent-turn`, `.user-turn` - Class-based detection
- Text pattern matching for thinking/model detection

---

## Recommendations for DOM Research

When performing browser inspection, focus on:

1. **Verifying Tier 1 selectors still work**
   - `article[data-scroll-anchor]`
   - `data-message-author-role`

2. **Finding missing features**
   - Canvas artifact selectors
   - File attachment structure
   - Actual thinking state indicators (not text)

3. **Testing stability**
   - Do selectors work across different models?
   - Do they survive page refresh?
   - Do they work in shared conversations?

4. **Discovering new attributes**
   - Are there new `data-*` attributes?
   - Are there official state indicators we're missing?
   - Are there better alternatives to pattern matching?

---

## Update History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-03 | 1.0 | Initial documentation from content.js v3.3.0 |

---

## References

- **Source Code:** `/home/user/capsula/content.js`
- **Research Guide:** `/home/user/capsula/docs/chatgpt-dom-structure.md`
- **Key Functions:**
  - `harvest()` - Main extraction: lines 3470-3550
  - `detectMessages()` - Strategy implementation: lines 3608-3650
  - `parseMessage()` - Content extraction: lines 3720-3835
  - `extractBlocks()` - Block parsing: lines 3836-4014
