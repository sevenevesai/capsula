# Changelog

All notable changes to Capsula will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2025-01-XX

### Added
- **Dashboard Export Format**: New interactive HTML dashboard with comprehensive conversation analytics
  - Message statistics (count, word count, average length)
  - Code language breakdown with detection for 20+ languages
  - Thinking metrics (total time, stages, average per message)
  - Canvas artifacts summary
  - File attachments categorization
  - Visual distribution charts

- **Enhanced Thinking Detection**: Multi-strategy detection system
  - Detects canvas-only responses with thinking labels
  - Captures multi-stage thinking sequences (5+ stages)
  - Accurate time parsing for various formats:
    - Numeric: "5s", "1m 30s", "2m"
    - Informal: "a few seconds", "a couple of seconds", "a moment"
  - Total thinking time calculations
  - Thinking labels now correctly positioned after role headers

- **Smart Code Language Detection**: 3-tier priority system
  - Priority 1: Uses ChatGPT's header div language labels (ground truth)
  - Priority 2: Extracts from className attributes
  - Priority 3: Pattern-based detection for 20+ languages:
    - Web: JavaScript, TypeScript, HTML, XML, CSS, JSON, Markdown, YAML
    - High-level: Python, Ruby, PHP
    - Compiled: Java, C#, C, C++, Go, Rust
    - Modern: Swift, Kotlin
    - Special purpose: SQL, Bash
  - Supports both ChatGPT code block structures (pre>code and div-based)
  - Conservative detection: returns empty string if uncertain

- **Canvas Artifact Detection**
  - Identifies ChatGPT canvas documents via ProseMirror structure
  - Extracts canvas title and type
  - Marks canvas artifacts in all export formats with 📋 icon
  - Dashboard analytics for canvas usage

- **File Attachment Detection**
  - Detects uploaded files in user messages
  - Extracts file name and type
  - Categorizes by type: images, PDFs, documents, code files, archives
  - Marks attachments in exports with 📎 icon
  - Dashboard breakdown by attachment type

### Changed
- **Export Format Improvements**
  - Markdown: Thinking labels now appear after role headers (was before, causing them to float)
  - HTML: Added styled markers for canvas artifacts and file attachments
  - JSON: Enhanced metadata includes thinking time, canvas info, and attachment details
  - All formats: Multi-stage thinking properly displayed in sequence

- **Dashboard Statistics**
  - Fixed thinking time calculation (was showing 0s)
  - Added multi-stage thinking detection and metrics
  - Enhanced code language breakdown (no more "unknown")
  - Added sections for canvas and attachments

- **Role Detection**
  - Prioritizes `article[data-turn]` attribute
  - Removed thinking-based role detection fallback
  - More accurate message attribution

- **Message Processing Order**
  - Now follows correct sequence: Role → Canvas/Attachment → Thinking → Content
  - Ensures proper metadata association

### Fixed
- Thinking labels appearing before role headers in Markdown exports
- Thinking time showing 0 seconds in dashboard
- Code blocks always showing as "unknown" language
- Missing detection for canvas-only responses
- Undercounting of multi-stage thinking sequences
- Edge cases with informal time patterns ("couple of seconds")

### Removed
- Debug console.log statements for production release
- Unnecessary verbose logging

---

## [1.0.0] - 2025-01-XX

### Added
- Initial public release
- **Multiple Export Formats**
  - Markdown (.md) for clean, readable notes
  - HTML (.html) with styled presentation
  - JSON (.json) for structured data
  - Clipboard copy functionality
  - Right-click context menu for single message export

- **Interactive Timeline**
  - Vertical timeline showing conversation flow
  - Color-coded messages (blue = user, gray = assistant)
  - Message length scaling
  - Scroll-synced highlights
  - Click-and-drag range selection
  - Resize handles for selection adjustment

- **Content Filtering**
  - Assistant Only filter (hide user messages)
  - Code blocks filter
  - Tables filter
  - Lists filter
  - Combinable filters

- **Thinking State Detection**
  - Detection for o1 model thinking phases
  - Thinking labels in exports
  - Structural selector-based detection

- **User Interface**
  - Floating export button (bottom-right)
  - Export panel with live preview
  - Keyboard shortcuts (Alt+E to open, Esc to close)
  - Auto light/dark theme support
  - Shadow DOM isolation

- **Advanced Features**
  - Smart content extraction (headings, lists, code, tables, blockquotes)
  - Image handling with alt text
  - Link and math equation preservation
  - SPA navigation support
  - Performance optimizations with debouncing

- **Security & Privacy**
  - All processing local (no external calls)
  - No telemetry or tracking
  - Minimal permissions (clipboard write only)
  - Strict Content Security Policy in HTML exports
  - XSS prevention and URL sanitization
  - Shadow DOM UI isolation

- **Technical**
  - Firefox Manifest V3 compliance
  - Content script only (no background process)
  - Zero dependencies (self-contained)
  - Auto font matching with ChatGPT

---

## Release Notes

### Browser Compatibility
- **Firefox**: 109.0 or higher (Manifest V3)
- **Chrome/Edge**: Not yet supported (Firefox-first release)

### Known Limitations
- Only works on ChatGPT (chat.openai.com, chatgpt.com)
- Requires conversation to be loaded in browser
- Canvas artifacts show metadata but not full content export

### Future Roadmap
- Additional AI platform support
- More export format options
- Enhanced canvas content extraction
- Conversation search and organization
- Export templates and customization

---

## How to Update

### From Firefox Add-ons (Recommended)
Firefox will automatically update to the latest version.

### Manual Update
1. Download the latest version
2. Go to `about:debugging` in Firefox
3. Remove the old version
4. Load the new `manifest.json`

---

## Support

For bug reports, feature requests, or support:
- Email: [support@seveneves.ai](mailto:support@seveneves.ai)
- Website: [seveneves.ai/capsula](https://seveneves.ai/capsula)

---

**Note:** Capsula is proprietary software. Copyright (c) 2025 Seveneves AI. All rights reserved.
