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

### Advanced Selection & Filtering
- **Interactive timeline**  
  - Vertical timeline showing conversation flow  
  - Color-coded (blue = user, gray = assistant)  
  - Message length scaling, scroll-synced highlights  
  - Click-and-drag range selection with resize handles  
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

### Range Selection
- Use the timeline to drag-select a range  
- Or click + Shift-click messages to define a segment  
- Adjust with resize handles  
- Click **Clear Selection** to reset  

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

## Technical Details
- **Version:** 1.1.0
- **Platform:** Firefox (Manifest V3)
- **Implementation:** Content script only (no background process)
- **Dependencies:** None (self-contained)
- **Font:** Matches ChatGPT's font stack automatically
- **Code Detection:** Supports 20+ programming languages
- **Metadata:** Thinking states, canvas artifacts, file attachments

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

### v1.1.0 (Latest)
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
