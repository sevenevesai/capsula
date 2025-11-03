# ChatGPT DOM Structure Research Guide

**Version:** 1.0
**Date:** 2025-11-03
**Purpose:** Document actual ChatGPT UI DOM structure for Capsula addon improvements

---

## 🎯 Research Objective

This document guides manual browser inspection of ChatGPT's DOM structure to identify:
- Actual CSS selectors and data attributes used by ChatGPT
- Gaps in current Capsula implementation
- Edge cases not currently handled
- Canvas artifact structure
- File attachment representation
- Thinking indicator timing and structure

---

## 📋 Current Implementation (Baseline)

### Message Detection Strategy (5-tier priority)

The Capsula addon currently uses these selectors in order:

```javascript
// Tier 1 (Most Reliable)
article[data-scroll-anchor]

// Tier 2
[data-testid="conversation-turn"]

// Tier 3
[data-message-author-role]

// Tier 4
div[data-message-id]

// Tier 5 (Fallback)
.group\/conversation-turn
.agent-turn
.user-turn
```

### Role Detection

```javascript
// Current method: data-message-author-role attribute
// Expected values: "user" or "assistant"
element.getAttribute('data-message-author-role')
```

### Content Extraction (Priority Order)

```javascript
1. [data-message-content]
2. .markdown.prose
3. .text-message
4. .prose
5. article
6. div.group\/conversation-turn
```

### Thinking State Detection

Current regex patterns:
```javascript
// Time patterns
/\b(?:Thought|Thinking|Processing|Analyzing|Working)\s+for\s+(\d+)\s*(second|minute|hour)s?/i

// State indicators
/\b(?:Analyzing|Processing|Reasoning|Computing|Evaluating|Using tools?)\b/i

// Expandable blocks
aria-expanded="false"
id.startsWith("radix-")
```

---

## 🔍 Research Methodology

### Prerequisites

1. **Browser Setup**
   - Firefox or Chrome with Developer Tools
   - ChatGPT Plus account (for o1/o1-mini testing)
   - Clean browser cache
   - Network throttling disabled

2. **Test Account**
   - Create fresh test conversations
   - Use multiple models: GPT-4, o1, o1-mini
   - Test canvas features (requires Plus)

3. **Tools**
   - Browser DevTools (F12)
   - Screenshot tool
   - Text editor for HTML capture

### Research Process

For **each scenario** below:

1. **Create Test Conversation**
   - Start new chat
   - Execute test scenario
   - Let response complete fully

2. **DOM Inspection**
   ```
   Right-click message → Inspect Element
   ├─ Note parent container selector
   ├─ Copy outerHTML to file
   ├─ Document all attributes (data-*, aria-*, class, id)
   ├─ Screenshot DevTools view
   └─ Test selectors in Console
   ```

3. **Selector Validation**
   ```javascript
   // Test in browser console
   document.querySelectorAll('YOUR_SELECTOR')
   // Should return expected elements only
   ```

4. **Documentation**
   - Save HTML snippet
   - List all CSS classes
   - Note data attributes
   - Document parent-child relationships
   - Describe visual appearance

---

## 🧪 Test Scenarios

### Scenario 1: Basic User Message

**Test:** Type "Hello, how are you?" and send

**Research Questions:**
- [ ] What is the outermost container element?
- [ ] What CSS classes are present?
- [ ] Is there a `data-message-id` attribute?
- [ ] Is there a `data-message-author-role` attribute?
- [ ] Is there a `data-scroll-anchor` attribute?
- [ ] What selector uniquely identifies user messages?
- [ ] Where is the text content stored?
- [ ] Are there nested divs? How many layers?

**Expected Documentation:**
```html
<!-- PASTE ACTUAL HTML HERE -->
<article ???>
  <!-- Document full structure -->
</article>
```

**Screenshot Location:** `docs/screenshots/scenario-1-user-message.png`

---

### Scenario 2: Basic Assistant Message (GPT-4)

**Test:** Receive response from GPT-4 (not o1)

**Research Questions:**
- [ ] Same container type as user message?
- [ ] How does `data-message-author-role` differ?
- [ ] Where is markdown rendered content?
- [ ] What class indicates "assistant" role?
- [ ] Are code blocks in `<pre><code>`?
- [ ] How are inline code snippets marked?
- [ ] Are there `[data-message-content]` attributes?

**Expected Documentation:**
```html
<!-- PASTE ACTUAL HTML HERE -->
<article ???>
  <div class="markdown prose">
    <!-- Document structure -->
  </div>
</article>
```

**Screenshot Location:** `docs/screenshots/scenario-2-assistant-message.png`

---

### Scenario 3: Thinking Indicator (o1/o1-mini)

**Test:** Ask o1-mini a complex question, observe during "thinking"

**Research Questions:**
- [ ] **CRITICAL:** Where does thinking indicator appear in DOM?
- [ ] Is it a separate message container or inside assistant message?
- [ ] What CSS classes mark thinking state?
- [ ] Is there a `data-thinking` or similar attribute?
- [ ] Does it show elapsed time? How is that rendered?
- [ ] Is there an expandable/collapsible control?
- [ ] What happens when thinking completes?
  - [ ] Does indicator get removed?
  - [ ] Does it stay but content appears below?
  - [ ] Does it get replaced entirely?
- [ ] What if user refreshes during thinking?

**Expected Documentation:**
```html
<!-- DURING THINKING -->
<article ???>
  <!-- Document thinking indicator structure -->
</article>

<!-- AFTER THINKING COMPLETE -->
<article ???>
  <!-- Document final structure -->
</article>
```

**Screenshot Locations:**
- `docs/screenshots/scenario-3-thinking-active.png`
- `docs/screenshots/scenario-3-thinking-complete.png`

---

### Scenario 4: Thinking with Expanded Details

**Test:** After o1 response, click "Thought for X seconds" to expand

**Research Questions:**
- [ ] What element becomes expandable?
- [ ] Is it a `<details>` element?
- [ ] What are the `aria-*` attributes?
- [ ] Is there an `id` starting with "radix-"?
- [ ] What's inside the expanded content?
- [ ] Are there multiple thinking steps visible?
- [ ] How are individual reasoning steps structured?
- [ ] Can you copy text from expanded thinking?

**Expected Documentation:**
```html
<!-- COLLAPSED STATE -->
<div aria-expanded="false" ???>
  <!-- Button or summary -->
</div>

<!-- EXPANDED STATE -->
<div aria-expanded="true" ???>
  <!-- Expanded content structure -->
</div>
```

**Screenshot Locations:**
- `docs/screenshots/scenario-4-expanded-thinking.png`

---

### Scenario 5: Canvas Artifact

**Test:** Ask "Create a simple HTML page with a button"

**Research Questions:**
- [ ] **CRITICAL:** Where does canvas appear in message structure?
- [ ] Is it inside the message container or adjacent?
- [ ] What CSS classes identify canvas?
- [ ] Is there a `data-canvas` or `data-artifact` attribute?
- [ ] How is canvas content stored? (iframe? shadow DOM?)
- [ ] Is there a download/copy button for canvas?
- [ ] What happens if response has text + canvas?
- [ ] Can there be multiple canvases in one message?
- [ ] Is there a canvas title/description element?

**Expected Documentation:**
```html
<article ??? data-message-author-role="assistant">
  <div class="markdown prose">
    <!-- Text content -->
  </div>
  <div class="canvas-container" ???>
    <!-- Canvas artifact structure -->
  </div>
</article>
```

**Screenshot Location:** `docs/screenshots/scenario-5-canvas-artifact.png`

---

### Scenario 6: File Upload (User Message)

**Test:** Upload an image, PDF, or zip file

**Research Questions:**
- [ ] How are file attachments represented in user message?
- [ ] Is there a thumbnail preview element?
- [ ] What attributes store filename/filetype?
- [ ] Is file content embedded or referenced?
- [ ] Are there multiple file upload slots?
- [ ] What CSS classes identify file attachments?
- [ ] Is there a `data-attachment` attribute?

**Expected Documentation:**
```html
<article ??? data-message-author-role="user">
  <div class="attachment" ???>
    <img ??? /> <!-- thumbnail? -->
    <span class="filename">???</span>
  </div>
  <div class="message-content">
    <!-- User's text with the upload -->
  </div>
</article>
```

**Screenshot Location:** `docs/screenshots/scenario-6-file-upload.png`

---

### Scenario 7: File Analysis (Assistant Response)

**Test:** After uploading image, ask "Describe this image"

**Research Questions:**
- [ ] Does assistant message reference the uploaded file?
- [ ] Is there a file preview in assistant's response?
- [ ] How is the file reference structured?
- [ ] Can you distinguish between file analysis vs. regular response?

**Expected Documentation:**
```html
<!-- Document how assistant references user's upload -->
```

**Screenshot Location:** `docs/screenshots/scenario-7-file-analysis.png`

---

### Scenario 8: Error/Retry State

**Test:** Trigger an error (disconnect network, cancel generation)

**Research Questions:**
- [ ] What CSS classes indicate error state?
- [ ] Is there a "Regenerate" button? How is it structured?
- [ ] Does error message have special container?
- [ ] What happens to incomplete message DOM?
- [ ] Are there `data-error` or `data-status` attributes?

**Expected Documentation:**
```html
<article ??? data-status="error" ???>
  <!-- Error state structure -->
  <button class="regenerate" ???>Regenerate</button>
</article>
```

**Screenshot Location:** `docs/screenshots/scenario-8-error-state.png`

---

### Scenario 9: Empty Response (Thinking Only)

**Test:** Ask question that o1 thinks about but can't answer

**Research Questions:**
- [ ] Is there a message container even with no text content?
- [ ] Does thinking indicator persist?
- [ ] What distinguishes this from error state?
- [ ] Is there a "no response" indicator?

**Expected Documentation:**
```html
<!-- Message with thinking but no content -->
```

**Screenshot Location:** `docs/screenshots/scenario-9-empty-response.png`

---

### Scenario 10: Multi-turn with Mixed Features

**Test:** Conversation with:
1. User text
2. Assistant text
3. User uploads image
4. Assistant analyzes (o1-mini with thinking)
5. User asks for canvas
6. Assistant creates canvas

**Research Questions:**
- [ ] How are messages ordered in DOM?
- [ ] Is there a conversation container?
- [ ] Are there separator elements between messages?
- [ ] What identifies the "active" (streaming) message?
- [ ] Are message IDs sequential?

**Expected Documentation:**
```html
<main id="conversation" ???>
  <article data-message-id="1" data-scroll-anchor="msg-1">...</article>
  <article data-message-id="2" data-scroll-anchor="msg-2">...</article>
  <!-- etc -->
</main>
```

**Screenshot Location:** `docs/screenshots/scenario-10-multi-turn.png`

---

## 📊 Timing & State Transitions

Document the lifecycle of an assistant message from start to finish:

```
┌─────────────────────────────────────────────────────────┐
│ Timeline of Assistant Message DOM                       │
└─────────────────────────────────────────────────────────┘

T=0s:    User presses Enter
         [ ] DOM state: ???
         [ ] Selectors that match: ???

T=0.5s:  Thinking indicator appears (o1 only)
         [ ] DOM state: ???
         [ ] New elements created: ???
         [ ] Selectors that match: ???

T=3s:    Still thinking...
         [ ] Has anything changed in DOM?
         [ ] Is timer updating?

T=10s:   Content starts streaming
         [ ] Does thinking indicator remain?
         [ ] Where does content appear?
         [ ] Is it a new element or replacement?

T=15s:   Content still streaming
         [ ] How does DOM change during streaming?
         [ ] Are paragraphs added incrementally?

T=20s:   Generation complete
         [ ] Final DOM state: ???
         [ ] What changed from streaming state?
         [ ] Are there "done" indicators?
```

**Instructions:**
1. Screen-record the browser DevTools during a full response cycle
2. Pause at each stage and document DOM state
3. Use browser console to query selectors at each stage
4. Note which selectors work at which stages

---

## 🔬 Advanced Analysis

### Data Attributes Catalog

For each scenario, create a table:

| Attribute Name | Found On Element | Possible Values | Purpose |
|----------------|------------------|-----------------|---------|
| `data-message-id` | `<article>` | UUID or numeric | Message identifier |
| `data-scroll-anchor` | `<article>` | String ID | Scroll targeting |
| `data-message-author-role` | `<article>` | "user" or "assistant" | Role indicator |
| `data-testid` | Various | String | Test automation |
| ??? | ??? | ??? | ??? |

### CSS Class Patterns

Look for patterns in class names:
```
Examples from inspection:
- User messages: group/conversation-turn user-turn ???
- Assistant messages: agent-turn assistant-message ???
- Thinking: thinking-indicator o1-thinking ???
- Canvas: canvas-artifact canvas-container ???
```

### Shadow DOM Investigation

Check if any elements use Shadow DOM:
```javascript
// Test in console
document.querySelectorAll('*').forEach(el => {
  if (el.shadowRoot) {
    console.log('Shadow DOM found:', el, el.shadowRoot);
  }
});
```

### Dynamic Content Observers

Test if ChatGPT uses visible observers:
```javascript
// Check for mutation observers hints
document.querySelectorAll('[data-radix-collection-item]')
document.querySelectorAll('[data-orientation]')
```

---

## 📝 Documentation Template for Each Scenario

For each scenario, create a file: `docs/research/scenario-N-name.md`

```markdown
# Scenario N: [Name]

## Test Description
[What you did]

## Visual Screenshot
![Screenshot](../screenshots/scenario-N-name.png)

## Full HTML Structure
```html
<!-- Paste outerHTML here -->
```

## CSS Selectors

### Unique Selector
```css
/* Most specific selector that matches this element only */
article[data-message-id="xxx"]
```

### General Selector
```css
/* Selector that matches all similar elements */
article[data-message-author-role="assistant"]
```

### Tested in Console
```javascript
// Test results
document.querySelectorAll('selector') // => NodeList(X)
```

## Data Attributes List
- `data-message-id`: "abc123"
- `data-message-author-role`: "assistant"
- `data-scroll-anchor`: "msg-abc123"
- (etc.)

## CSS Classes List
- `group/conversation-turn`
- `agent-turn`
- `markdown`
- `prose`
- (etc.)

## Parent Structure
```
main#conversation-root
  └─ div.conversation-container
      └─ article[data-scroll-anchor]  ← THIS ELEMENT
          └─ div.message-content
              └─ div.markdown.prose
```

## Child Elements
- `.markdown.prose` - Contains rendered markdown
- `pre > code` - Code blocks
- `p` - Paragraphs
- (etc.)

## Observations
- [Any notable findings]
- [Unusual behavior]
- [Inconsistencies]

## Capsula Compatibility
- [ ] Current selectors work
- [ ] Current selectors need adjustment
- [ ] New feature not handled
- [ ] Edge case discovered

## Recommended Selectors
```javascript
// For Capsula implementation
const messageSelector = 'article[data-scroll-anchor]';
const contentSelector = '.markdown.prose';
```
```

---

## ✅ Research Validation Checklist

Before considering research complete:

### Coverage
- [ ] Documented at least 10 different scenarios
- [ ] Each scenario has HTML, screenshot, and analysis
- [ ] Tested on both GPT-4 and o1 models
- [ ] Tested canvas artifacts
- [ ] Tested file uploads
- [ ] Tested error states
- [ ] Tested empty/edge cases

### Selector Testing
- [ ] All selectors tested in browser console
- [ ] Confirmed selectors are unique where needed
- [ ] Documented selector priority/fallbacks
- [ ] Tested selectors across multiple conversations
- [ ] Verified selectors work after page refresh

### Timing Analysis
- [ ] Documented DOM state during streaming
- [ ] Captured thinking indicator lifecycle
- [ ] Observed canvas artifact appearance timing
- [ ] Tested what happens on refresh/reload

### Data Completeness
- [ ] Catalogued all `data-*` attributes found
- [ ] Listed all relevant CSS classes
- [ ] Documented all aria-* attributes
- [ ] Noted any Shadow DOM usage
- [ ] Identified all interactive elements (buttons, expand/collapse)

### Edge Cases
- [ ] What happens when ChatGPT stops mid-response?
- [ ] What happens when user edits their message?
- [ ] What happens when message is regenerated?
- [ ] What happens with very long responses (pagination)?
- [ ] What happens with rate limit errors?
- [ ] What happens in shared conversations?

---

## 🎯 Gaps in Current Capsula Implementation

Based on research, document what's missing:

### Known Limitations
1. **Canvas Artifacts**: Current code doesn't explicitly handle canvas
2. **File Attachments**: No special handling for uploads
3. **Thinking State**: Relies on text patterns, not DOM attributes
4. **Live Updates**: No MutationObserver, requires manual refresh

### Research Should Reveal
- [ ] Proper canvas selectors
- [ ] File attachment structure
- [ ] Actual thinking state indicators
- [ ] Timing of DOM mutations
- [ ] New features not documented
- [ ] Official data attributes we're missing

---

## 📤 Deliverables

When research is complete, you should have:

```
docs/
├─ chatgpt-dom-structure.md (this file)
├─ research/
│   ├─ scenario-1-user-message.md
│   ├─ scenario-2-assistant-message.md
│   ├─ scenario-3-thinking-indicator.md
│   ├─ scenario-4-thinking-expanded.md
│   ├─ scenario-5-canvas-artifact.md
│   ├─ scenario-6-file-upload.md
│   ├─ scenario-7-file-analysis.md
│   ├─ scenario-8-error-state.md
│   ├─ scenario-9-empty-response.md
│   ├─ scenario-10-multi-turn.md
│   └─ timing-analysis.md
├─ screenshots/
│   ├─ scenario-1-user-message.png
│   ├─ scenario-2-assistant-message.png
│   └─ (etc. for all scenarios)
└─ selectors-reference.md (summary of all selectors)
```

---

## 🔄 Next Steps After Research

Once DOM structure is fully documented:

1. **Update content.js** - Revise selectors based on findings
2. **Add canvas support** - Implement canvas artifact extraction
3. **Add file handling** - Handle uploaded files properly
4. **Improve thinking detection** - Use DOM attributes instead of regex
5. **Add MutationObserver** - Enable live updates during streaming
6. **Write tests** - Create test cases for each scenario
7. **Update documentation** - Reflect changes in README

---

## 📚 Reference Resources

- **ChatGPT URL**: https://chatgpt.com/
- **ChatGPT Dev Tools**: F12 in browser
- **Current Implementation**: `/home/user/capsula/content.js` lines 3470-4015
- **Addon Analysis**: `/tmp/capsula_dom_analysis.md`

---

## 🚨 Important Notes

### Limitations of This Research Task

**I (Claude Code CLI) cannot perform this research directly** because:
- I don't have browser access
- I can't open ChatGPT in a browser
- I can't interact with web UIs
- I can't take screenshots

**This document serves as:**
- ✅ A comprehensive research methodology
- ✅ A structured template for documentation
- ✅ A checklist for manual inspection
- ✅ A guide for someone who CAN access a browser

### Who Should Perform This Research?

This research requires a human with:
1. ChatGPT account (Plus recommended for o1 and canvas)
2. Browser with DevTools (Firefox or Chrome)
3. Basic HTML/CSS knowledge
4. Ability to inspect DOM elements
5. 2-4 hours of focused time

### Alternative: Existing Documentation

If OpenAI has published official DOM documentation or if there are:
- ChatGPT API docs describing web UI structure
- GitHub repositories with ChatGPT selectors
- Existing reverse-engineering documentation

...those could supplement or replace this manual research.

---

## 📞 Questions?

If you're performing this research and have questions:
1. Document what you found so far
2. Note specific questions or uncertainties
3. Capture screenshots even if you're unsure
4. It's better to over-document than under-document

Good luck with the research! 🔬
