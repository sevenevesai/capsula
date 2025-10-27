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
- **Thinking state detection** — labels o1 “thinking” phases  
- **Smart content extraction**  
  - Preserves headings, lists, code, tables, blockquotes  
  - Handles images with alt text  
  - Maintains links and math equations  
- **SPA navigation support** — works across ChatGPT’s single-page interface  
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
  Clean, human-readable, preserves formatting. Great for notes, Obsidian, GitHub, etc.

- **HTML (.html)**  
  Styled standalone webpage. Includes CSP headers, light/dark support, no external resources.

- **JSON (.json)**  
  Complete structured data with metadata (title, model, timestamp). Ideal for programmatic analysis.

---

## Technical Details
- **Version:** 1.0.0
- **Platform:** Firefox (Manifest V3)  
- **Implementation:** Content script only (no background process)  
- **Dependencies:** None (self-contained)  
- **Font:** Matches ChatGPT’s font stack automatically  

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
### v1.0.0
- Added thinking state detection for o1 models  
- Improved timeline with scroll-synced highlights  
- Enhanced security with CSP headers  
- Added resize handles for range selection  
- Optimized performance with debouncing  
- Improved SPA navigation handling  

---

> **Note:** Capsula is an independent tool and is not affiliated with OpenAI.
