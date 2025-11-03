# ChatGPT DOM Research Checklist

**Quick reference for manual browser inspection**

This is a condensed checklist for performing the DOM structure research outlined in `chatgpt-dom-structure.md`.

---

## 🛠️ Setup (15 minutes)

- [ ] Open Firefox or Chrome with Developer Tools (F12)
- [ ] Navigate to https://chatgpt.com/
- [ ] Sign in to ChatGPT account (Plus recommended)
- [ ] Create folder `docs/research/` for documentation
- [ ] Create folder `docs/screenshots/` for images
- [ ] Open text editor for notes
- [ ] Clear browser cache (optional but recommended)

---

## 🧪 Test Scenarios (2-3 hours)

### Scenario 1: Basic User Message ✅
**Time:** 5 minutes

- [ ] Start new chat
- [ ] Type "Hello, how are you?" and send
- [ ] Right-click message → Inspect
- [ ] Copy outerHTML to `docs/research/scenario-1-user-message.md`
- [ ] Screenshot DevTools → `docs/screenshots/scenario-1-user-message.png`
- [ ] Note CSS classes and data attributes
- [ ] Test selector in console: `document.querySelectorAll('YOUR_SELECTOR')`

**Key Questions:**
- What is the container element? `<article>`, `<div>`, other?
- Is there `data-message-author-role="user"`?
- Is there `data-scroll-anchor`?
- What classes are present?

---

### Scenario 2: Basic Assistant Message ✅
**Time:** 5 minutes

- [ ] Continue same chat, get response
- [ ] Inspect assistant message
- [ ] Copy HTML to `docs/research/scenario-2-assistant-message.md`
- [ ] Screenshot → `docs/screenshots/scenario-2-assistant-message.png`
- [ ] Note differences from user message
- [ ] Check for `.markdown.prose` or similar

**Key Questions:**
- Same structure as user message?
- `data-message-author-role="assistant"`?
- Where is rendered markdown content?
- How are code blocks structured?

---

### Scenario 3: Thinking Indicator (o1) ⚠️ CRITICAL
**Time:** 15 minutes

- [ ] Start new chat with o1-mini model
- [ ] Ask complex question (e.g., "Explain quantum entanglement")
- [ ] **IMMEDIATELY** inspect DOM while showing "Thinking..."
- [ ] Screenshot thinking state → `scenario-3-thinking-active.png`
- [ ] Copy HTML of thinking indicator
- [ ] Wait for completion
- [ ] Inspect again after thinking completes
- [ ] Screenshot complete state → `scenario-3-thinking-complete.png`
- [ ] Copy final HTML
- [ ] Document → `docs/research/scenario-3-thinking-indicator.md`

**Critical Questions:**
- Is thinking indicator inside message container or separate?
- What CSS classes mark thinking? (e.g., `.thinking-indicator`)
- Are there data attributes? (e.g., `data-thinking`, `data-status`)
- Does indicator get removed or stay after completion?
- Where does content appear relative to thinking indicator?
- Is there a timer element? How is it structured?

---

### Scenario 4: Expanded Thinking Details ✅
**Time:** 10 minutes

- [ ] After o1 response, find "Thought for X seconds" text
- [ ] Inspect the expandable element
- [ ] Note `aria-expanded` attribute value
- [ ] Screenshot collapsed state → `scenario-4-thinking-collapsed.png`
- [ ] Click to expand
- [ ] Screenshot expanded state → `scenario-4-thinking-expanded.png`
- [ ] Copy HTML of both states
- [ ] Document → `docs/research/scenario-4-thinking-expanded.md`

**Key Questions:**
- Is it a `<details>` element or button-controlled?
- What's the `aria-expanded` value when collapsed/expanded?
- Is there `id.startsWith("radix-")`?
- What's inside expanded content?
- Are there multiple reasoning steps visible?

---

### Scenario 5: Canvas Artifact ⚠️ CRITICAL
**Time:** 15 minutes

- [ ] Start new chat (GPT-4 or o1)
- [ ] Ask "Create a simple HTML page with a button"
- [ ] Wait for canvas to appear
- [ ] Inspect canvas element
- [ ] Screenshot → `scenario-5-canvas-artifact.png`
- [ ] Copy full HTML including canvas container
- [ ] Document → `docs/research/scenario-5-canvas-artifact.md`
- [ ] Try to identify canvas preview vs. code

**Critical Questions:**
- Where is canvas in relation to message container?
- What CSS classes identify canvas? (`.canvas-container`?)
- Is canvas in `<iframe>`, shadow DOM, or direct DOM?
- Are there data attributes? (`data-canvas`, `data-artifact`?)
- Can you access canvas content programmatically?
- Is there a download/copy button? How is it structured?

---

### Scenario 6: File Upload (User) ✅
**Time:** 10 minutes

- [ ] Start new chat
- [ ] Click attachment icon
- [ ] Upload an image or PDF
- [ ] Type "Analyze this file" and send
- [ ] Inspect user message with attachment
- [ ] Screenshot → `scenario-6-file-upload.png`
- [ ] Copy HTML
- [ ] Document → `docs/research/scenario-6-file-upload.md`

**Key Questions:**
- How is file attachment represented?
- Is there thumbnail/preview element?
- What attributes store filename/type?
- What CSS classes mark attachments?
- Is there `data-attachment` or similar?

---

### Scenario 7: File Analysis Response ✅
**Time:** 5 minutes

- [ ] Get response from scenario 6
- [ ] Inspect assistant message
- [ ] Check if it references uploaded file
- [ ] Screenshot → `scenario-7-file-analysis.png`
- [ ] Document differences

---

### Scenario 8: Error/Retry State ✅
**Time:** 10 minutes

- [ ] Start generation
- [ ] Quickly click "Stop generating" button
- [ ] Inspect incomplete message
- [ ] Screenshot → `scenario-8-error-state.png`
- [ ] Look for "Regenerate" button
- [ ] Copy HTML of error state
- [ ] Document → `docs/research/scenario-8-error-state.md`

**Key Questions:**
- What classes indicate error/stopped state?
- Is there `data-status="error"` or similar?
- How is "Regenerate" button structured?
- What happens to incomplete content?

---

### Scenario 9: Empty Response ✅
**Time:** 5 minutes

- [ ] Try to trigger thinking-only response (ask impossible question to o1)
- [ ] Or observe any empty/failed response
- [ ] Document structure
- [ ] Screenshot → `scenario-9-empty-response.png`

---

### Scenario 10: Multi-turn Conversation ✅
**Time:** 10 minutes

- [ ] Create conversation with 5+ messages
- [ ] Mix user/assistant, thinking, canvas
- [ ] Inspect conversation container
- [ ] Screenshot full view → `scenario-10-multi-turn.png`
- [ ] Document message ordering/structure
- [ ] Check for conversation-level attributes

**Key Questions:**
- What wraps all messages? `<main>`, `<div>`?
- Are messages in a list? `<ul>`, sequential `<article>`s?
- Are there separators between messages?
- How are message IDs ordered?

---

## 📊 Timing Analysis (30 minutes)

### Live Generation Observation

- [ ] Open DevTools before starting generation
- [ ] Ask o1-mini a question
- [ ] **Screen record** the DevTools Elements tab
- [ ] Observe DOM changes frame-by-frame
- [ ] Pause at each stage and document:
  - [ ] T=0s: Before generation starts
  - [ ] T=0.5s: Thinking indicator appears
  - [ ] T=5s: During thinking
  - [ ] T=10s: Content starts streaming
  - [ ] T=15s: During streaming
  - [ ] T=20s: Complete

- [ ] Create timeline diagram in `docs/research/timing-analysis.md`

---

## 🔬 Advanced Analysis (30 minutes)

### Data Attributes Catalog

- [ ] Review all collected HTML snippets
- [ ] Create table in `docs/research/data-attributes.md`:

```markdown
| Attribute | Element | Values | Purpose |
|-----------|---------|--------|---------|
| data-message-id | <article> | UUID | Message ID |
| ... | ... | ... | ... |
```

---

### CSS Classes Catalog

- [ ] List all unique CSS classes found
- [ ] Group by purpose (role, state, content type)
- [ ] Create reference in `docs/research/css-classes.md`

---

### Shadow DOM Check

- [ ] Open console
- [ ] Run:
```javascript
document.querySelectorAll('*').forEach(el => {
  if (el.shadowRoot) {
    console.log('Shadow DOM:', el);
  }
});
```
- [ ] Document any shadow DOM usage

---

### Selector Validation

For each selector found, test in console:

```javascript
// Example tests
document.querySelectorAll('article[data-scroll-anchor]').length
document.querySelectorAll('[data-message-author-role="user"]').length
document.querySelectorAll('.markdown.prose').length
```

- [ ] Create `docs/research/selector-tests.md` with results

---

## ✅ Final Validation

Before concluding research:

- [ ] Documented at least 10 scenarios
- [ ] Each scenario has HTML + screenshot + analysis
- [ ] Tested selectors in console (all work)
- [ ] Captured timing/lifecycle of generation
- [ ] Identified canvas artifact structure
- [ ] Identified file attachment structure
- [ ] Found thinking indicator attributes (if any)
- [ ] Cataloged all data-* attributes
- [ ] Cataloged all relevant CSS classes
- [ ] Tested edge cases (errors, empty responses)

---

## 📤 Deliverables Summary

When complete, you should have:

```
docs/
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
│   ├─ timing-analysis.md
│   ├─ data-attributes.md
│   ├─ css-classes.md
│   └─ selector-tests.md
│
└─ screenshots/
    ├─ scenario-1-user-message.png
    ├─ scenario-2-assistant-message.png
    ├─ scenario-3-thinking-active.png
    ├─ scenario-3-thinking-complete.png
    ├─ scenario-4-thinking-collapsed.png
    ├─ scenario-4-thinking-expanded.png
    ├─ scenario-5-canvas-artifact.png
    ├─ scenario-6-file-upload.png
    ├─ scenario-7-file-analysis.png
    ├─ scenario-8-error-state.png
    ├─ scenario-9-empty-response.png
    └─ scenario-10-multi-turn.png
```

---

## 🚀 Quick Tips

### Fast Console Tests

```javascript
// Find all message containers
$$('article[data-scroll-anchor]')

// Find user messages
$$('[data-message-author-role="user"]')

// Find assistant messages
$$('[data-message-author-role="assistant"]')

// Check for thinking indicators
$$('[class*="thinking"]')

// Check for canvas
$$('[class*="canvas"]')

// Find all data attributes on an element
Array.from($0.attributes).filter(a => a.name.startsWith('data-'))
```

### Efficient Workflow

1. **Batch screenshot**: Take all screenshots in one session
2. **Copy HTML immediately**: Don't navigate away before copying
3. **Test selectors as you go**: Validate in console before moving on
4. **Use video recording**: Capture live generation once, review later
5. **Organize files**: Name files consistently for easy reference

---

## 💡 Common Issues

### Issue: Can't find element in DevTools
**Solution:** Try "Select an element" tool (arrow icon) and click directly on message

### Issue: HTML too large to copy
**Solution:** Copy outerHTML of specific sections, not entire page

### Issue: Dynamic content changes
**Solution:** Pause DOM updates: DevTools → Elements → Break on → Subtree modifications

### Issue: o1 model not available
**Solution:** Requires ChatGPT Plus subscription

### Issue: Canvas doesn't appear
**Solution:** Try different prompts: "Create HTML game", "Make a chart", "Build a calculator"

---

## 📞 Questions or Issues?

If stuck:
1. Document what you found so far
2. Note specific blockers
3. Capture screenshots of unexpected behavior
4. Over-document rather than under-document

---

**Estimated Total Time:** 2-4 hours

**Priority:** CRITICAL (blocks all other addon fixes)

**Difficulty:** Moderate (requires basic HTML/CSS knowledge)

**Output:** 10+ markdown files, 12+ screenshots, comprehensive selector reference
