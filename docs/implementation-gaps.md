# Capsula Implementation Gaps & Required Fixes

**Status:** Identified based on code analysis
**Version:** 3.3.0
**Date:** 2025-11-03

This document identifies gaps between current Capsula implementation and required functionality for complete ChatGPT conversation export.

---

## 🎯 Critical Gaps (Blocks Core Functionality)

### 1. Canvas Artifact Support ❌

**Current State:** No canvas extraction implemented

**Impact:** HIGH - Canvas responses are completely missing from exports

**Evidence:**
- No canvas-specific selectors in code
- No artifact detection logic
- No iframe/shadow DOM handling
- Canvas content appears as blank in exports

**Required Research:**
- [ ] Identify canvas container structure
- [ ] Determine if canvas uses iframe or shadow DOM
- [ ] Find canvas content access method
- [ ] Identify canvas metadata (type, title, version)

**Code Location:** Need to add to `content.js:3836-4014` (block extraction)

**Proposed Solution:**
```javascript
// Add to block type detection
if (element.classList.contains('canvas-container') ||
    element.hasAttribute('data-canvas-artifact')) {
  return extractCanvasArtifact(element);
}

function extractCanvasArtifact(element) {
  // Research needed:
  // - How to access canvas content?
  // - Is it in iframe.contentDocument?
  // - Is there a data attribute with content?
  // - Can we export as HTML/screenshot?

  return {
    type: 'canvas',
    content: extractCanvasContent(element),
    metadata: {
      title: element.getAttribute('data-canvas-title'),
      canvasType: element.getAttribute('data-canvas-type')
    }
  };
}
```

---

### 2. File Attachment Handling ❌

**Current State:** No file upload/attachment detection

**Impact:** HIGH - User messages with files lose context

**Evidence:**
- No attachment selectors
- No file metadata extraction
- No thumbnail handling
- Files invisible in exports

**Required Research:**
- [ ] How are uploaded files represented in user messages?
- [ ] Where are thumbnails stored?
- [ ] What attributes contain file metadata (name, type, size)?
- [ ] How are multiple files handled?
- [ ] Are file contents accessible or just references?

**Code Location:** Need to add to message parsing `content.js:3720-3835`

**Proposed Solution:**
```javascript
function extractAttachments(messageElement) {
  const attachments = [];

  // Research needed: actual selector
  const attachmentElements = messageElement.querySelectorAll('.attachment, [data-attachment]');

  attachmentElements.forEach(el => {
    attachments.push({
      type: 'attachment',
      filename: el.getAttribute('data-filename'),
      filetype: el.getAttribute('data-filetype'),
      thumbnail: el.querySelector('img')?.src,
      size: el.getAttribute('data-filesize')
    });
  });

  return attachments;
}
```

---

### 3. Thinking State Detection (Fragile) ⚠️

**Current State:** Uses text pattern matching (fragile)

**Impact:** MEDIUM - Thinking indicators may be missed or incorrectly detected

**Evidence:**
```javascript
// Current implementation relies on text patterns
const timePatterns = /\b(?:Thought|Thinking|Processing)\s+for\s+(\d+)\s*seconds?\b/i;
```

**Problems:**
- Language-dependent (only English)
- Breaks if UI text changes
- No DOM-based detection
- May match user text accidentally

**Required Research:**
- [ ] Is there a `data-thinking` attribute?
- [ ] Is there a `data-status="thinking"` indicator?
- [ ] Are there CSS classes specifically for thinking state?
- [ ] How does thinking indicator relate to message container?

**Code Location:** `content.js:3652-3690`

**Proposed Solution:**
```javascript
function detectThinkingState(messageElement) {
  // Prefer DOM attributes over text patterns
  if (messageElement.hasAttribute('data-thinking') ||
      messageElement.hasAttribute('data-status') &&
      messageElement.getAttribute('data-status') === 'thinking') {
    return {
      isThinking: true,
      duration: messageElement.getAttribute('data-thinking-duration'),
      details: extractThinkingDetails(messageElement)
    };
  }

  // Fallback to pattern matching
  return detectThinkingByPattern(messageElement);
}
```

---

## ⚠️ Medium Priority Gaps

### 4. Model Detection (Unreliable) ⚠️

**Current State:** Falls back to UI text scanning

**Impact:** MEDIUM - Wrong model attribution in exports

**Evidence:**
```javascript
// Scans visible UI text for model names
const modelPatterns = [
  /\b(gpt-4[o]?(?:-\w+)?)\b/i,
  /\b(o1(?:-mini|-preview)?)\b/i
];
```

**Problems:**
- No per-message model tracking
- Assumes entire conversation uses same model
- UI scanning is fragile

**Required Research:**
- [ ] Is there `data-model` per message?
- [ ] Is there `data-model-slug` attribute?
- [ ] Can different messages in same conversation use different models?

**Code Location:** `content.js:3730-3740`

**Proposed Solution:**
```javascript
function detectMessageModel(messageElement) {
  // Check message-level attributes first
  const modelAttrs = ['data-model', 'data-model-slug', 'data-model-name'];

  for (const attr of modelAttrs) {
    const model = messageElement.getAttribute(attr);
    if (model) return model;
  }

  // Check conversation-level metadata
  const conversationModel = document.querySelector('[data-conversation-model]');
  if (conversationModel) {
    return conversationModel.getAttribute('data-conversation-model');
  }

  // Fallback to UI scanning (current method)
  return detectModelFromUI();
}
```

---

### 5. Timestamp Extraction (Inconsistent) ⚠️

**Current State:** Multiple fallback strategies

**Impact:** MEDIUM - Some messages may lack timestamps

**Evidence:**
```javascript
const timeSelectors = [
  'time[datetime]',
  '[data-timestamp]',
  '.message-timestamp',
  '.timestamp'
];
```

**Problems:**
- No guaranteed timestamp source
- May return display time instead of ISO timestamp

**Required Research:**
- [ ] Which selector is most reliable?
- [ ] Is there a hidden timestamp attribute?
- [ ] What format is used? (ISO 8601?)
- [ ] Are timestamps always present?

---

### 6. Error State Handling ❌

**Current State:** No error state detection

**Impact:** MEDIUM - Failed generations not marked in exports

**Evidence:**
- No error state selectors
- No failed generation detection
- No retry button identification

**Required Research:**
- [ ] How are errors indicated in DOM?
- [ ] Is there `data-status="error"`?
- [ ] What CSS classes mark errors?
- [ ] How are incomplete messages marked?

**Proposed Solution:**
```javascript
function detectMessageState(messageElement) {
  // Check for error state
  if (messageElement.hasAttribute('data-status')) {
    const status = messageElement.getAttribute('data-status');

    return {
      state: status, // 'complete', 'error', 'generating', etc.
      hasError: status === 'error',
      canRegenerate: !!messageElement.querySelector('[data-regenerate-button]')
    };
  }

  return { state: 'unknown' };
}
```

---

## 📉 Low Priority Gaps

### 7. Live Updates (MutationObserver) ❌

**Current State:** No live updates during streaming

**Impact:** LOW - User must manually trigger export after generation completes

**Evidence:**
- No MutationObserver implementation
- harvest() must be called manually
- No auto-refresh during streaming

**Proposed Solution:**
```javascript
function setupLiveUpdates() {
  const observer = new MutationObserver((mutations) => {
    // Detect when new messages appear or content updates
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        // Auto-refresh export panel
        debounceHarvest();
      }
    }
  });

  const conversationContainer = document.querySelector('main');
  if (conversationContainer) {
    observer.observe(conversationContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}
```

---

### 8. Conversation Metadata ❌

**Current State:** No conversation-level metadata extraction

**Impact:** LOW - Missing conversation title, ID, creation date

**Required Research:**
- [ ] Where is conversation title stored?
- [ ] Is there a conversation ID?
- [ ] Is there conversation creation timestamp?
- [ ] How are shared conversations marked?

**Code Location:** Add to `content.js:3470` (harvest function)

---

### 9. Regenerated Messages ❓

**Current State:** Unknown if handled

**Impact:** LOW - May miss that message was regenerated

**Required Research:**
- [ ] How are multiple attempts at same message stored?
- [ ] Is there a version number?
- [ ] Are old versions kept in DOM?

---

## 🔍 Selector Stability Issues

### Fragile Selectors (Likely to Break)

| Selector | Issue | Priority |
|----------|-------|----------|
| `.group\/conversation-turn` | Tailwind class with escape | MEDIUM |
| `.agent-turn`, `.user-turn` | Generic class names | MEDIUM |
| Text patterns for thinking | Language-dependent | HIGH |
| UI scanning for model | Fragile | MEDIUM |

### Recommendations

1. **Prefer data attributes over classes**
   - Classes change with redesigns
   - Data attributes are more stable

2. **Use multiple fallback strategies**
   - Already implemented well
   - Continue 5-tier approach

3. **Avoid text pattern matching**
   - Replace with DOM attribute checks
   - Keep patterns as last resort only

---

## 📊 Gap Priority Matrix

| Gap | Impact | Frequency | Implementation Difficulty | Priority |
|-----|--------|-----------|--------------------------|----------|
| Canvas artifacts | HIGH | HIGH | MEDIUM | **CRITICAL** |
| File attachments | HIGH | MEDIUM | LOW | **CRITICAL** |
| Thinking detection | MEDIUM | HIGH | LOW | **HIGH** |
| Model detection | MEDIUM | HIGH | LOW | **HIGH** |
| Error states | MEDIUM | LOW | LOW | **MEDIUM** |
| Timestamps | LOW | HIGH | LOW | **MEDIUM** |
| Live updates | LOW | HIGH | MEDIUM | **LOW** |
| Conversation metadata | LOW | LOW | LOW | **LOW** |

---

## 🚀 Recommended Implementation Order

### Phase 1: DOM Research (Task 1)
- Complete browser inspection
- Document actual selectors
- Validate current implementation
- Identify all gaps definitively

### Phase 2: Critical Features (Task 2)
1. Canvas artifact extraction
2. File attachment handling
3. Improve thinking detection

### Phase 3: Reliability (Task 3)
1. Better model detection
2. Error state handling
3. Timestamp consistency

### Phase 4: Polish (Task 4)
1. Live updates (MutationObserver)
2. Conversation metadata
3. UI improvements

---

## 📋 Research Questions Summary

**Must Answer in Task 1:**

1. **Canvas Artifacts:**
   - What is the DOM structure?
   - How to access content programmatically?
   - What selectors uniquely identify canvas?

2. **File Attachments:**
   - How are uploads represented?
   - What attributes store file metadata?
   - Where are thumbnails?

3. **Thinking Indicators:**
   - Is there a `data-thinking` or `data-status` attribute?
   - What CSS classes mark thinking state?
   - How does it relate to message container?

4. **State Indicators:**
   - How are error states marked?
   - Is there a `data-status` attribute?
   - What values can it have?

5. **Model Attribution:**
   - Is there per-message model data?
   - What attribute names are used?
   - Can messages in same conversation use different models?

---

## 📝 Code Locations for Updates

| Feature | File | Line Range | Function |
|---------|------|------------|----------|
| Message detection | content.js | 3608-3650 | strategies array |
| Content extraction | content.js | 3750-3800 | content selectors |
| Thinking detection | content.js | 3652-3690 | detectThinking |
| Block extraction | content.js | 3836-4014 | extractBlocks |
| Model detection | content.js | 3730-3740 | detectModel |
| Main harvest | content.js | 3470-3550 | harvest() |

---

## ✅ Success Criteria

After implementing fixes:

- [ ] Canvas artifacts appear in exports with full content
- [ ] File attachments are identified and referenced
- [ ] Thinking states detected reliably across languages
- [ ] Model attribution accurate per message
- [ ] Error states clearly marked
- [ ] All exports include timestamps
- [ ] No false positives in any detection
- [ ] Tests pass for all edge cases

---

## 🔗 Related Documents

- **Research Guide:** `docs/chatgpt-dom-structure.md`
- **Current Selectors:** `docs/current-selectors-reference.md`
- **Research Checklist:** `docs/research-checklist.md`
- **Source Code:** `content.js:3470-4015`

---

**Next Step:** Complete Task 1 (DOM Research) to fill in unknowns and validate assumptions.
