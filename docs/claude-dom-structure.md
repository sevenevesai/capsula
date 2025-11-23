# Claude.ai DOM Structure Analysis

**Source:** Claude conversation HTML (claude-conv-example-1.htm)
**Date:** November 22, 2025
**Purpose:** Enable Capsula extension support for Claude.ai conversations

---

## Page Metadata

**HTML Element:**
```html
<html class="h-screen antialiased scroll-smooth..."
      data-theme="claude"
      data-mode="dark"
      data-build-id="68407126dd">
```

**Key Indicators:**
- `data-theme="claude"` - Confirms Claude.ai page
- `data-mode="dark"` or `"light"` - Theme detection
- CSS variables: `--font-user-message`, `--font-claude-response`

---

## Message Structure Overview

### Counts from Example File:
- `data-testid="user-message"`: **9 instances** (user messages)
- `font-claude-response`: **209 instances** (assistant content blocks)
- `standard-markdown`: **21 instances** (formatted content sections)

---

## User Messages

### Container Structure:
```html
<div class="group relative inline-flex gap-2 bg-bg-300 rounded-xl pl-2.5 py-2.5
            break-words text-text-100 transition-all max-w-[75ch] flex-col pr-6">

  <!-- Avatar -->
  <div class="flex flex-row gap-2 relative">
    <div class="shrink-0 transition-all duration-300 self-start">
      <div class="flex shrink-0 items-center justify-center rounded-full
                  font-bold select-none h-7 w-7 text-[12px] bg-text-200 text-bg-100">
        M  <!-- User initial -->
      </div>
    </div>

    <!-- Message Content -->
    <div class="flex-1">
      <div data-testid="user-message"
           class="font-large !font-user-message grid grid-cols-1 gap-2 py-0.5 relative">
        <p class="whitespace-pre-wrap break-words">
          [User message text here]
        </p>
      </div>
    </div>
  </div>
</div>
```

**Key Selectors:**
- **Primary identifier:** `[data-testid="user-message"]`
- **Container:** `.bg-bg-300.rounded-xl` (user message bubble)
- **Content:** `.whitespace-pre-wrap.break-words` (inside user-message)
- **Avatar:** `.bg-text-200.text-bg-100` with user initial

**Detection Strategy:**
```javascript
// Find all user messages
const userMessages = document.querySelectorAll('[data-testid="user-message"]');

// Get user message container (parent)
const messageContainer = userMessage.closest('.bg-bg-300.rounded-xl');

// Extract content
const paragraphs = userMessage.querySelectorAll('p.whitespace-pre-wrap');
```

---

## Assistant Messages

### Container Structure:
```html
<div data-is-streaming="false" class="group relative pb-8">
  <div class="font-claude-response relative leading-[1.65rem]
              [&_pre>div]:bg-bg-000/50 [&_pre>div]:border-0.5...">

    <!-- Content varies: standard-markdown or progressive-markdown -->
    <div class="grid-cols-1 grid gap-2.5 [&_>_*]:min-w-0 standard-markdown">
      <p class="font-claude-response-body whitespace-normal break-words">
        [Assistant response text here]
      </p>
    </div>

  </div>
</div>
```

**Key Selectors:**
- **Primary identifier:** `[data-is-streaming]` attribute (false when complete)
- **Font class:** `.font-claude-response` (all assistant content)
- **Content wrapper:** `.standard-markdown` or `.progressive-markdown`
- **Text paragraphs:** `.font-claude-response-body`

**Detection Strategy:**
```javascript
// Find all assistant message containers
const assistantMessages = document.querySelectorAll('[data-is-streaming]');

// Get markdown content
const content = assistantMessage.querySelector('.standard-markdown, .progressive-markdown');

// Extract paragraphs
const paragraphs = content.querySelectorAll('p.font-claude-response-body');
```

---

## Extended Thinking / Tool Use

### Collapsible Thinking Blocks:
```html
<div class="transition-all duration-400 ease-out rounded-lg border-0.5
            flex flex-col font-ui leading-normal my-3 border-border-300...">

  <!-- Collapse button -->
  <button type="button" class="group/collapse-indicator flex flex-row...">
    <div class="flex items-center px-3 py-2 flex-1 text-sm pointer-events-none">
      <span class="text-text-500">70 steps</span>  <!-- Step count! -->
    </span>
  </button>

  <!-- Expanded content (hidden when collapsed) -->
  <div class="overflow-hidden shrink-0">
    <!-- Individual thinking steps -->
  </div>
</div>
```

**Key Features:**
- Shows step count (e.g., "70 steps", "12 steps")
- Collapsible sections with rotate indicator
- Each step can have substeps

**Detection Strategy:**
```javascript
// Find thinking blocks
const thinkingBlocks = document.querySelectorAll('.group\\/collapse-indicator');

// Extract step count
const stepText = thinkingBlock.querySelector('span.text-text-500').textContent;
const stepCount = parseInt(stepText.match(/(\d+) steps?/)?.[1] || '0');

// Check if expanded or collapsed
const contentDiv = thinkingBlock.nextElementSibling;
const isExpanded = contentDiv.style.height !== '0px';
```

---

## Code Blocks

### Inline Code:
```html
<code class="bg-text-200/5 border border-0.5 border-border-300 text-danger-000
             whitespace-pre-wrap rounded-[0.4rem] px-1 py-px text-[0.9rem]">
  [code here]
</code>
```

### Multi-line Code Blocks:
**Complete Structure:**
```html
<!-- Code block wrapper with copy button -->
<div class="relative group/copy bg-bg-000/50 border-0.5 border-border-400 rounded-lg">

  <!-- Copy button (appears on hover) -->
  <div class="sticky opacity-0 group-hover/copy:opacity-100 top-2 py-2 h-12 w-0 float-right">
    <div class="absolute right-0 h-8 px-2 items-center inline-flex z-10">
      <button class="inline-flex items-center justify-center ... Button_ghost__Ywhj1"
              type="button" aria-label="Copy to clipboard" data-state="closed">
        <!-- SVG icons for copy/check states -->
      </button>
    </div>
  </div>

  <!-- Language label -->
  <div class="text-text-500 font-small p-3.5 pb-0">python</div>

  <!-- Code content -->
  <div>
    <pre class="code-block__code !my-0 !rounded-lg !text-sm !leading-relaxed"
         style="background: transparent; color: rgb(171, 178, 191); ...">
      <code class="language-python" style="...">
        <!-- Syntax-highlighted content with <span class="token"> elements -->
        <span>
          <span>def</span><span> </span><span class="token" style="color: rgb(97, 175, 239);">my_function</span>
          <span class="token" style="color: rgb(171, 178, 191);">(</span>
          <span class="token" style="color: rgb(171, 178, 191);">)</span>
          <span class="token" style="color: rgb(171, 178, 191);">:</span>
        </span>
      </code>
    </pre>
  </div>
</div>
```

**Key Selectors:**
- **Container:** `.relative.group\\/copy.bg-bg-000\\/50.border-border-400`
- **Language label:** `.text-text-500.font-small.p-3\\.5` (first div inside container)
- **Pre/Code:** `pre.code-block__code > code[class^="language-"]`
- **Syntax tokens:** `span.token` (with inline color styles)

**Supported Languages:**
Common language classes found:
- `language-python`
- `language-javascript`
- `language-bash`
- `language-html`
- `language-css`
- Language detection via: `code[class^="language-"]` attribute

**Detection Strategy:**
```javascript
// Find all code blocks
const codeBlocks = document.querySelectorAll('.group\\/copy.bg-bg-000\\/50 pre.code-block__code');

codeBlocks.forEach(block => {
  // Get language
  const langLabel = block.closest('.group\\/copy').querySelector('.text-text-500.font-small');
  const language = langLabel?.textContent.trim() || 'text';

  // Get code element
  const codeElement = block.querySelector('code[class^="language-"]');
  const languageClass = codeElement?.className.match(/language-(\w+)/)?.[1];

  // Extract plain text (strips HTML tokens)
  const code = codeElement?.textContent || '';
});
```

---

## File Attachments

### File Thumbnail Structure:
```html
<div class="group/thumbnail" data-testid="file-thumbnail">
  <button style="width: 120px; height: 120px; min-width: 120px;"
          class="rounded-lg text-left block cursor-pointer...">

    <!-- File name -->
    <h3 class="text-[12px] break-words text-text-100 line-clamp-4">
      Mosaic Claude Code Prompt Framework...2025-11-03_09-38-36.md
    </h3>

    <!-- File type badge -->
    <div class="min-w-0 h-[18px] flex flex-row items-center justify-center gap-0.5
                px-1 border-0.5 border-border-300/25 shadow-sm rounded bg-bg-000/70...">
      <p class="uppercase truncate font-ui text-text-300 text-[11px] leading-[13px]">
        md  <!-- File extension -->
      </p>
    </div>

    <!-- Optional: File metadata (lines, size, etc.) -->
    <p class="text-[10px] line-clamp-1 break-words text-text-500">
      470 lines
    </p>
  </button>
</div>
```

**Key Selectors:**
- **Primary:** `[data-testid="file-thumbnail"]`
- **File name:** `.text-text-100.line-clamp-4` (h3 element)
- **File type:** `.uppercase.truncate` (shows extension)
- **Metadata:** `.text-text-500` (optional lines/size info)

**Detection Strategy:**
```javascript
// Find all file attachments
const fileThumbnails = document.querySelectorAll('[data-testid="file-thumbnail"]');

// Extract file info
fileThumbnails.forEach(thumb => {
  const fileName = thumb.querySelector('h3.text-text-100').textContent.trim();
  const fileType = thumb.querySelector('p.uppercase').textContent.trim();
  const metadata = thumb.querySelector('p.text-text-500')?.textContent.trim();
});
```

---

## Markdown Content Types

### Headings:
```html
<h2 class="font-claude-response-heading text-text-100 mt-1 -mb-0.5">
  Critical Issues (Wrong Data)
</h2>

<h3 class="font-claude-response-subheading text-text-100 mt-1 -mb-1.5">
  Subheading Text
</h3>
```

### Lists:
```html
<!-- Ordered List -->
<ol class="[&:not(:last-child)_ul]:pb-1 [&:not(:last-child)_ol]:pb-1
           list-decimal space-y-2.5 pl-7">
  <li class="whitespace-normal break-words">
    List item text
  </li>
</ol>

<!-- Unordered List -->
<ul class="[&:not(:last-child)_ul]:pb-1 [&:not(:last-child)_ol]:pb-1
           list-disc space-y-2.5 pl-7">
  <li class="whitespace-normal break-words">
    List item text
  </li>
</ul>
```

### Strong/Bold:
```html
<strong>Bold text</strong>
```

### Links:
```html
<a class="underline" href="computer:///path/to/file">Link text</a>
```

---

## Conversation Flow Detection

### Message Ordering:
Claude messages appear to use:
- `data-test-render-count` attribute on message wrappers
- Sequential DOM order (top to bottom = chronological)

**Strategy:**
```javascript
// Get all messages in order
const allMessages = document.querySelectorAll('[data-testid="user-message"], [data-is-streaming]');

// Process in DOM order (chronological)
allMessages.forEach((msg, index) => {
  // Determine if user or assistant based on attributes
  const isUser = msg.hasAttribute('data-testid') && msg.getAttribute('data-testid') === 'user-message';
  const isAssistant = msg.hasAttribute('data-is-streaming');
});
```

---

## Key Differences from ChatGPT

| Feature | ChatGPT | Claude |
|---------|---------|--------|
| **User Message ID** | `data-message-author-role="user"` | `data-testid="user-message"` |
| **Assistant Message ID** | `data-message-author-role="assistant"` | `data-is-streaming` attribute |
| **Message Container** | `<article data-turn="user\|assistant">` | No article tag, div-based |
| **User Bubble Color** | `.user-message-bubble-color` | `.bg-bg-300.rounded-xl` |
| **Assistant Font** | Various classes | `.font-claude-response` |
| **Thinking Detection** | Specific thinking labels | Collapsible "X steps" blocks |
| **Code Blocks** | `<pre><code>` with language classes | Need more examples |
| **File Attachments** | Different structure | `data-testid="file-thumbnail"` |

---

## Implementation Priority

### Phase 1: Basic Message Extraction
1. ✅ Detect page is Claude.ai (`data-theme="claude"`)
2. ✅ Extract user messages (`data-testid="user-message"`)
3. ✅ Extract assistant messages (`data-is-streaming`)
4. ✅ Extract basic markdown content (paragraphs, headings, lists)

### Phase 2: Rich Content
5. ⏳ Code block extraction (need examples)
6. ✅ File attachment detection
7. ✅ Extended thinking/tool use blocks
8. ⏳ Artifacts (if any - need examples)

### Phase 3: Advanced Features
9. ⏳ Export formats (Markdown, HTML, JSON)
10. ⏳ Timeline visualization
11. ⏳ Filtering options
12. ⏳ Dashboard analytics

---

## Long Messages & Message Continuation

### Message Split Indicators:
When messages exceed Claude's response length limit, they are split across multiple assistant responses. The pattern observed:

**Continuation Indicators:**
```html
<h2 class="font-claude-response-heading text-text-100 mt-1 -mb-0.5">
  <strong>filename.py</strong> (Continued in next message due to length)
</h2>
```

**Common Patterns:**
- "(Continued in next message due to length)"
- "Let me continue with..."
- "Due to length, I'll provide..."

**Detection Strategy:**
- Look for phrases like "continued", "continue", "due to length" in message content
- These appear within standard message blocks (not special UI elements)
- The continuation happens in the next `[data-is-streaming]` element

**Notes:**
- No special DOM structure for continuations
- Just regular text within message content
- Important for export: should concatenate continued messages

---

## Conversation Length Limits

### Maximum Length Alert:
When a conversation reaches maximum length, Claude may display an alert or banner. This appears to be conversation-specific behavior.

**Observed Behavior:**
- Very long conversations (10,000+ lines of HTML)
- May show "Conversation hit maximum length" message
- Continue in current examples did not contain a specific UI element for this
  (may vary by conversation state or user login status)

**Note:** This alert structure needs verification with live logged-in Claude sessions, as shared conversations may not show all UI elements.

---

## Research Artifacts & Deep Thinking

### Extended Research Output:
Example conversation showed deep research features with citations/sources:

**Observed Patterns:**
- Research-focused conversations
- References to "405 sources" in content
- May use extended thinking blocks (collapsed by default)
- Content about "deep research", "systematic information gathering"

**Note:** The research artifacts appear to use the same extended thinking structure documented above, not a separate UI component. The depth of research is reflected in:
- Number of thinking steps
- Collapsed thinking blocks
- Content complexity
- Multiple stages of analysis

---

## Next Steps

**Completed Analysis:**
- ✅ Code blocks (multiple languages detected)
- ✅ Extended thinking structure
- ✅ File attachments
- ✅ Basic message structure
- ✅ Long message continuation patterns

**Remaining Items to Verify:**
1. **Test on live Claude.ai:**
   - Verify selectors work on current version
   - Check for dynamic content loading
   - Test with streaming vs completed messages
   - Verify maximum length alert structure (in logged-in sessions)

2. **Additional features to explore:**
   - Artifacts (if Claude has them - need confirmation)
   - Image attachments (screenshots, uploaded images)
   - Model detection in UI
   - Timestamp extraction from live sessions

---

## Selector Reference (Quick Copy)

```javascript
// Page detection
const isClaude = document.documentElement.getAttribute('data-theme') === 'claude';

// User messages
const userMessages = document.querySelectorAll('[data-testid="user-message"]');

// Assistant messages
const assistantMessages = document.querySelectorAll('[data-is-streaming]');

// File attachments
const files = document.querySelectorAll('[data-testid="file-thumbnail"]');

// Extended thinking blocks
const thinkingBlocks = document.querySelectorAll('.group\\/collapse-indicator');

// Markdown content
const markdownContent = document.querySelectorAll('.standard-markdown, .progressive-markdown');

// All text paragraphs (both user and assistant)
const allParagraphs = document.querySelectorAll('p.whitespace-pre-wrap, p.font-claude-response-body');

// Code blocks
const codeBlocks = document.querySelectorAll('.group\\/copy.bg-bg-000\\/50 pre.code-block__code');

// Code block languages
codeBlocks.forEach(block => {
  const langLabel = block.closest('.group\\/copy').querySelector('.text-text-500.font-small');
  const language = langLabel?.textContent.trim() || 'text';
  const codeElement = block.querySelector('code[class^="language-"]');
  const code = codeElement?.textContent || '';
});

// Inline code
const inlineCode = document.querySelectorAll('code.bg-text-200\\/5.border-border-300');
```

---

## Summary of Findings

**Analysis Sources:**
- Example 1: Basic conversation with thinking, file attachments
- Example 2: Deep research conversation with 405 sources, extended thinking
- Example 3: Very long conversation (10,877 lines) with extensive code blocks (Python, HTML, CSS, Bash)

**Key Discoveries:**
- ✅ Code blocks fully documented (syntax highlighting, language detection, copy button)
- ✅ Extended thinking structure ("X steps" collapsible blocks)
- ✅ File attachments with metadata
- ✅ Message continuation patterns for long responses
- ✅ Basic user/assistant message detection
- ✅ Markdown content structure (headings, lists, links, bold)

**Implementation-Ready Selectors:**
- Page detection via `data-theme="claude"`
- User messages via `[data-testid="user-message"]`
- Assistant messages via `[data-is-streaming]`
- Code blocks with language and syntax preservation
- File attachments with type and metadata
- Extended thinking with step counts

---

## Notes

- Claude uses Tailwind CSS heavily (utility-first approach)
- Class names may be subject to change with updates
- Extended thinking uses "steps" count, not time duration
- File thumbnails show nicely formatted preview cards
- Syntax highlighting uses inline styles with `<span class="token">` elements
- Code blocks support multiple languages (Python, JavaScript, Bash, HTML, CSS, etc.)
- Long messages split across responses with continuation indicators in content
- No special DOM structure for artifacts detected (may not exist or need live session)

---

**Status:** Comprehensive analysis complete. All core features documented. Ready for implementation.
