# Capsula

**Capsula** is a Firefox extension that lets you **save and export AI conversations** into multiple formats.  
It works directly inside ChatGPT (and later, other AI platforms) with advanced filtering, range selection, and privacy-focused design.

---

## Features

### Core Export Options
- **Multiple formats**
  - **Markdown (.md):** clean, readable, ideal for notes
  - **HTML (.html):** styled web page with CSP headers
  - **JSON (.json):** structured data with full metadata
  - **Dashboard (.html):** interactive conversation analytics and statistics
  - **Clipboard copy:** quick one-click copy in any format
  - **Right-click export:** export any single response
  - **Download to file:** auto-named with timestamps
- **Integrations** (New!)
  - **GitHub:** Export directly to Gists or Issues
  - **Notion:** Create pages with rich formatting and blocks
  - Client-side only, privacy-first, optional host permissions

### Advanced Selection & Filtering
- **Enhanced Interactive Timeline**
  - Vertical timeline showing conversation flow
  - Color-coded (blue = user, gray = assistant)
  - Message length scaling, scroll-synced highlights
  - **Multi-selection support**:
    - **Ctrl+Click**: Toggle individual messages on/off
    - **Shift+Click**: Extend selection from last anchor
    - **Ctrl+Shift+Click**: Add range to existing selection
    - **Ctrl+Drag**: Add/remove multiple messages while dragging
    - **Right-Click**: Clear all selections
  - Click-and-drag range selection with resize handles
  - Non-contiguous selections for complex filtering
- **Interactive Message Toggles**
  - Checkbox button on each message in preview area
  - Click to include/exclude messages from export
  - Visual feedback (green checkmark = included)
  - Bidirectional sync with timeline selection
  - No keyboard shortcuts required
- **Smart Message Visibility**
  - Excluded messages shown greyed-out instead of hidden
  - Auto-collapse excluded messages for clarity
  - Click to expand/collapse for review
  - Clear "(Not in export)" labels
  - Preserved message alignment (user right, assistant left)
- **Content filters**
  - 🤖 **Assistant Only** — hide user messages
  - 💻 **Code** — extract code blocks
  - 📊 **Tables** — export only tabular data
  - 📝 **Lists** — isolate list items
  - **Range selection** — export just part of a conversation  

### User Interface
- Floating export button (bottom-right, with tooltip)  
- Export panel with live preview  
- Context menu (right-click any assistant message)  
- Keyboard shortcuts:  
  - `Alt+E` → open export panel  
  - `Esc` → close panel  
- Auto light/dark theme support  

### Advanced Features
- **Enhanced thinking detection**
  - Multi-stage thinking sequences with time tracking
  - Accurate time parsing (handles "5s", "1m 30s", "a few seconds", etc.)
  - Displays thinking labels in correct position (after role headers)
  - Total thinking time calculations in dashboard
- **Smart code language detection**
  - Detects 20+ languages: Python, Java, JavaScript, TypeScript, C#, Go, Rust, Ruby, Swift, Kotlin, and more
  - Uses ChatGPT's own language labels when available
  - Pattern-based fallback for unlabeled code blocks
  - Accurate dashboard metrics by language
- **Canvas artifact detection**
  - Identifies ChatGPT canvas documents
  - Marks canvas artifacts in exports with title and type
  - Dashboard analytics for canvas usage
- **File attachment detection**
  - Detects uploaded files in user messages
  - Categorizes by type (images, PDFs, documents, code, archives)
  - File metadata in exports and dashboard
- **Interactive dashboard**
  - Conversation analytics and statistics
  - Code language breakdown
  - Thinking metrics (time, stages, average)
  - Canvas and attachment summaries
  - Message distribution charts
- **Smart content extraction**
  - Preserves headings, lists, code, tables, blockquotes
  - Handles images with alt text
  - Maintains links and math equations
- **SPA navigation support** — works across ChatGPT's single-page interface
- **Performance optimized** — efficient DOM handling & debounced updates

---

## Security & Privacy
- All processing happens locally in your browser  
- **No remote code, no telemetry, no tracking**  
- **Minimal permissions** (only clipboard write, if used)  
- Exported HTML files include a **strict Content Security Policy (CSP)**  
- **XSS prevention** and **URL sanitization** built in  
- Extension UI isolated with **Shadow DOM**  

See [PRIVACY.md](./PRIVACY.md) for details.

---

## Installation (Temporary Testing)
1. Download or clone this repository  
2. Open Firefox and go to `about:debugging`  
3. Click **This Firefox** → **Load Temporary Add-on**  
4. Select the `manifest.json` file  

*(AMO Store version coming soon)*

---

## Usage

### Basic Export
1. Click the floating export button  
2. Choose a format from the dropdown  
3. Click **Export Conversation**

### Filtered Export
1. Open the export panel  
2. Toggle filters (Assistant Only, Code, Tables, Lists)  
3. Combine filters as needed  
4. Export the filtered result  

### Message Selection
- **Timeline Selection**:
  - Click and drag on timeline to select a range
  - Ctrl+Click to toggle individual messages on/off
  - Shift+Click to extend selection from last click
  - Ctrl+Shift+Click to add range to existing selection
  - Ctrl+Drag to add/remove multiple messages
  - Right-click to clear all selections
  - Adjust selection with resize handles
- **Preview Area Selection**:
  - Click checkbox next to "You" or "ChatGPT" label
  - Toggle messages in/out of export while reviewing
  - Greyed-out messages are excluded from export
  - Click excluded messages to expand/collapse
- **Clear Selection**:
  - Click **Clear Selection** button to reset to all messages
  - Or manually toggle all messages back on  

### Quick Export
- Right-click any assistant message  
- Choose export format or **Copy to Clipboard**  
- Immediate single-message export  

---

## Export Formats

- **Markdown (.md)**
  Clean, human-readable, preserves formatting. Great for notes, Obsidian, GitHub, etc. Includes thinking labels, canvas markers, and file attachments.

- **HTML (.html)**
  Styled standalone webpage. Includes CSP headers, light/dark support, no external resources. Beautifully formatted with syntax highlighting.

- **JSON (.json)**
  Complete structured data with metadata (title, model, timestamp, thinking time, canvas info, attachments). Ideal for programmatic analysis.

- **Dashboard (.html)**
  Interactive analytics page with conversation statistics, code language breakdown, thinking metrics, canvas/attachment summaries, and visual charts.

---

## Integrations

### GitHub Export
Export conversations directly to GitHub as Gists or Issues.

**Setup:**
1. Open the export panel and click the settings gear icon
2. Go to the "Integrations" section
3. Create a GitHub Personal Access Token:
   - Visit [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=gist&description=Capsula)
   - Select the **"gist"** scope (for Gists)
   - For Issues, also add **"repo"** or **"public_repo"** scope
   - Copy the generated token
4. Paste the token into the "GitHub Personal Access Token" field
5. Click "Test Connection" to verify
6. Click "Save Settings"

**Usage:**
- Click the **GitHub** button in the export panel footer
- Choose options:
  - **Gist Filename**: Auto-generated with date
  - **Description**: Optional description for your gist
  - **Visibility**: Private (default) or Public
  - **Advanced**: Create as GitHub Issue (requires repository)
- Click "Create Gist"
- URL automatically copied to clipboard

**Features:**
- Automatic file splitting for large conversations (>1MB)
- Markdown format with full metadata
- Progress tracking with visual feedback
- Private gists by default
- Optional GitHub Issue creation

### Notion Export
Export conversations directly to Notion as pages with rich formatting.

**Setup:**
1. Create a Notion Integration:
   - Visit [Notion Integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Give it a name (e.g., "Capsula")
   - Copy the "Internal Integration Token"
2. Share a parent page with your integration:
   - Open a Notion page where you want exports to go
   - Click "Share" → "Invite"
   - Select your integration
3. In Capsula settings:
   - Paste the token into "Integration Token"
   - Click "Test Connection"
   - Click "Save Settings"

**Usage:**
- Click the **Notion** button in the export panel footer
- Configure options:
  - **Page Title**: Auto-filled with conversation title
  - **Parent Page**: Click "Select Parent Page..." and choose a page
- Click "Create Page"
- URL automatically copied to clipboard

**Features:**
- Rich formatting with Notion blocks (headings, paragraphs, code, lists, quotes)
- Automatic content chunking for large conversations
- Batch uploads with progress tracking (100 blocks per request)
- Preserves code syntax highlighting
- Canvas and attachment markers
- Thinking labels included

### Privacy & Permissions
- Tokens stored locally in browser storage (never transmitted to third parties)
- Optional encryption for tokens (Web Crypto API)
- Host permissions requested only when first using an integration
- All API calls made directly from your browser to GitHub/Notion
- No Capsula servers involved
- Tokens can be cleared anytime in settings

### Troubleshooting

**GitHub:**
- **"Invalid token"**: Regenerate token with correct scopes
- **"Access forbidden"**: Ensure token has "gist" scope
- **"Rate limit exceeded"**: Wait a few minutes and try again
- **For Issues**: Token needs "repo" or "public_repo" scope

**Notion:**
- **"No pages found"**: Share a parent page with your integration
- **"Invalid parent"**: Verify the page is shared with your integration
- **"Request failed"**: Check your integration token is correct
- **Large conversations**: May take a minute due to batching (100 blocks at a time)

---

## Technical Details
- **Version:** 1.2.0
- **Platform:** Firefox (Manifest V3)
- **Implementation:** Content script + background broker for API requests
- **Dependencies:** None (self-contained)
- **Font:** Matches ChatGPT's font stack automatically
- **Code Detection:** Supports 20+ programming languages
- **Metadata:** Thinking states, canvas artifacts, file attachments
- **Integrations:** GitHub (Gists/Issues), Notion (Pages)

---

## Privacy
- No analytics, no telemetry  
- No external API calls  
- Clipboard access only when explicitly used  
- All data stays on your device  

---

## File Structure
capsula/
├── manifest.json # Extension manifest
├── content.js # Main content script
├── README.md # This file
├── PRIVACY.md # Privacy policy
├── LICENSE # License file
└── icons/ # Extension icons
    ├── 16.png
    ├── 32.png
    ├── 48.png
    ├── 96.png
    └── 128.png

---

## Feedback & Support
Capsula is proprietary software and not open source.  

We welcome feedback, bug reports, and feature requests to help improve the extension.  
Please reach out via [support@seveneves.ai](mailto:support@seveneves.ai) or visit [seveneves.ai/capsula](https://seveneves.ai/capsula).

All development follows:
- Firefox AMO policies and review standards  
- Security best practices (no remote code, minimal permissions)  
- Strong focus on privacy and transparency

---

## License
Capsula is proprietary software.  
Copyright (c) 2025 Seveneves AI. All rights reserved.  
See the [LICENSE](./LICENSE) file for details.

---

## Author
Developed by **Mark T. Short**  
Website: [seveneves.ai](https://seveneves.ai/capsula)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

### Unreleased (Next Version)
- **Enhanced Timeline with Multi-Selection**: Ctrl+Click, Shift+Click, Ctrl+Drag for advanced message selection
- **Interactive Message Toggles**: Checkbox on each message to include/exclude from export
- **Smart Message Visibility**: Excluded messages shown greyed-out instead of hidden
- Auto-collapse excluded messages with click-to-expand
- Bidirectional sync between timeline and preview toggles
- Non-contiguous selections for complex filtering needs
- Preserved message alignment (user right, assistant left)
- Improved UX with multiple selection methods (no keyboard shortcuts required)

### v1.2.0 (Latest)
- **GitHub Integration:** Export conversations directly to GitHub Gists or Issues
- **Notion Integration:** Create Notion pages with rich block formatting
- Automatic content chunking for large conversations (Notion: 100 blocks/request)
- File splitting for oversized conversations (GitHub: >1MB auto-split)
- Privacy-first integration architecture (client-side only, local token storage)
- Optional host permissions requested on first use
- Progress tracking with visual feedback
- Comprehensive error handling and retry logic with exponential backoff
- Integration settings UI with connection testing

### v1.1.1
- Added Firefox Add-ons store compliance metadata
- No functional changes

### v1.1.0
- **Dashboard export format** with conversation analytics
- **Enhanced thinking detection** with multi-stage support and accurate time parsing
- **Smart code language detection** (20+ languages)
- **Canvas artifact detection** and metadata
- **File attachment detection** and categorization
- **Improved export formats** with thinking labels, canvas markers, and attachment info
- Code cleanup and production optimizations

### v1.0.0
- Initial release
- Multiple export formats (Markdown, HTML, JSON)
- Interactive timeline with range selection
- Content filtering (Assistant Only, Code, Tables, Lists)
- Thinking state detection for o1 models
- Security features with CSP headers

---

> **Note:** Capsula is an independent tool and is not affiliated with OpenAI.
