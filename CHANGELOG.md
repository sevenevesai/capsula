# Changelog

All notable changes to Capsula will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.3.0] - 2025-11-22

### Major New Features

#### Interactive Tutorial System
- **Versioned Tutorial Nudges**: Context-based help for first-time users
  - Tutorial state stored in browser.storage.local (survives domain shifts)
  - Versioned tutorial keys (e.g., `github_modal:v1`, `notion_modal:v1`)
  - Bumping version re-prompts all users once for new features
  - Non-intrusive 2-step guides shown when opening GitHub/Notion modals
  - Users can dismiss tutorials with "Got it!" or "Don't show again"
  - Reset option in Settings > Help & Tutorials

#### Enhanced Timeline with Multi-Selection
- **Multi-Selection Support**: Advanced message selection with keyboard modifiers
  - **Ctrl+Click**: Toggle individual messages on/off in timeline
  - **Shift+Click**: Extend selection from last anchor point
  - **Ctrl+Shift+Click**: Add range to existing selection
  - **Ctrl+Drag**: Add or remove multiple messages while dragging
  - **Right-Click**: Clear all selections instantly
  - Non-contiguous selections for complex filtering needs

- **Interactive Message Toggles**: Direct toggle controls in preview area
  - Checkbox button on each message role label
  - Click to include/exclude messages from export
  - Visual feedback: checked (green) = included, unchecked = excluded
  - Bidirectional sync with timeline selection
  - No keyboard shortcuts required for basic usage
  - Accessible with keyboard navigation and screen readers

- **Improved Message Visibility**: Excluded messages shown instead of hidden
  - Greyed-out display with 50% opacity for excluded messages
  - Diagonal stripe pattern overlay for clear visual distinction
  - Grayscale filter (40%) applied to excluded message bubbles
  - Auto-collapse excluded messages to 60px height
  - Click to expand/collapse for review
  - "(Not in export)" labels for clarity
  - Expand/collapse hints with intuitive icons

### Enhancements

- **Better UX for Message Selection**:
  - All messages remain visible regardless of selection state
  - Clear visual indicators for what will be included in export
  - Multiple ways to select: timeline, preview toggles, or keyboard shortcuts
  - Smooth animations and transitions for all state changes
  - Preserved message alignment (user messages stay right-aligned)

- **Selection Model Improvements**:
  - Replaced simple range (start/end) with flexible Set-based selection
  - Empty Set represents "all selected" for efficiency
  - Smart toggle logic: first exclusion selects all except that message
  - Automatic cleanup when all messages re-selected (returns to empty Set)
  - Resize handles work with new multi-selection model

- **Export Integration**:
  - All export formats respect multi-selection (Markdown, HTML, JSON, Dashboard)
  - GitHub Gists and Issues integration updated
  - Notion pages integration updated
  - Two-tier filtering: preview shows all, export uses selection

### 🔧 Fixed

- Message alignment preserved for excluded/collapsed messages
- User messages stay right-aligned even when greyed out
- Toggle behavior correct when starting from "all selected" state
- Expand/collapse hints positioned correctly for each message role
- Click handlers properly isolated (toggle vs expand/collapse)

### UI/UX

#### Modern SVG Icon System
- **Complete emoji replacement with professional SVG icons**:
  - Filter buttons (Assistant, Code, Tables, Lists) use clean SVG icons
  - Tutorial titles are text-only for clarity
  - Dashboard uses SVG icon instead of emoji
  - Section headers and stats cards use text labels
  - File attachments show category-specific SVG icons
  - Code and thinking indicators now use text tags ([code], [thinking])
  - Success notifications use text-based feedback
  - Notion page/database selectors use SVG icons
  - All icons use 'currentColor' for automatic light/dark mode adaptation
- **Benefits**:
  - Professional, modern appearance across all UI elements
  - Consistent icon styling throughout the extension
  - Better accessibility and cross-platform compatibility
  - Cleaner interface without visual clutter
  - Perfect rendering at all sizes and resolutions

#### Enhanced Interactions
- New checkbox toggles in message role labels
- Hover effects on timeline segments and toggle buttons
- Visual state feedback for selected/unselected messages
- Keyboard focus indicators for accessibility
- Smooth scale animations on hover (110%)
- Color-coded checkmarks (green for included)

### Technical

- Set-based selection model for O(1) lookups
- `MessageFilter.apply()` for preview (shows all with metadata)
- `MessageFilter.getExportMessages()` for exports (only selected)
- `onSelectionChange` callback for bidirectional sync
- Event propagation control for nested interactions
- RequestAnimationFrame for smooth rendering

---

## [1.2.0] - 2025-01-XX

### 🎉 Major New Features

#### GitHub Integration
- **Export to GitHub Gists**: Create public or private gists directly from conversations
  - Auto-generated filenames with date stamps
  - Custom descriptions and visibility settings
  - Automatic file splitting for conversations >1MB
  - URL automatically copied to clipboard on success

- **Export to GitHub Issues**: Create repository issues from conversations (Advanced option)
  - Specify owner/repository format
  - Requires "repo" or "public_repo" token scope
  - Converts conversations to markdown-formatted issues

- **GitHub Features**:
  - Progress tracking with visual feedback
  - Intelligent retry logic with exponential backoff (network failures)
  - Comprehensive error handling with user-friendly messages
  - Connection testing before first use
  - Token validation and scope verification

#### Notion Integration
- **Export to Notion Pages**: Create rich, formatted pages in your Notion workspace
  - Interactive parent page selector
  - Support for pages and databases as parents
  - Rich block formatting (headings, paragraphs, code, lists, quotes)
  - Automatic content chunking (100 blocks per batch)
  - Progress tracking for large conversations
  - URL automatically copied to clipboard on success

- **Notion Features**:
  - Code blocks with syntax highlighting preservation
  - Proper list nesting and formatting
  - Block quote support
  - Canvas and attachment markers preserved
  - Thinking labels included in exports
  - Batch upload optimization
  - Connection testing and page search

#### Integration Infrastructure
- **Settings UI**: New integration settings panel
  - Token management for GitHub and Notion
  - Test connection functionality
  - Clear, save, and validation features
  - Encrypted local storage for tokens (Web Crypto API)
  - Help text and setup instructions

- **Background Request Broker**: CSP-compliant architecture
  - Background script handles all external API calls
  - Message-passing bridge between content script and background
  - Fixes Content Security Policy violations
  - Proper permission handling (optional_host_permissions)
  - Permission prompts only when first using an integration

- **Privacy & Security**:
  - All tokens stored locally (never transmitted to Capsula servers)
  - Optional host permissions (requested only when needed)
  - Direct browser-to-API communication (no intermediaries)
  - Clear token management with instant deletion
  - No telemetry or tracking of export activity

### ✨ Enhancements

- **Message Filtering for Integrations**:
  - Timeline range selection now applies to GitHub/Notion exports
  - Content filters (assistant only, code, tables, lists) respected in integrations
  - Export exactly what you see in the preview

- **Modal Input Focus**:
  - Fixed keyboard event isolation in export modals
  - Prevents ChatGPT interference with modal inputs
  - Smooth typing experience without focus loss

- **Error Handling**:
  - User-friendly error messages with actionable hints
  - Automatic retry logic for transient network failures
  - Rate limit detection and guidance
  - Token scope validation and suggestions

### 🔧 Fixed

- Modal input losing focus on each keystroke
- Double JSON stringification in markdown exporters
- Content Security Policy violations in API calls
- Filtered messages not being applied to integration exports
- Export button duplication on modal re-open

### 📚 Technical

- Added `background.js` for CSP-compliant API requests
- Added `storage` permission for token management
- Added `optional_host_permissions` for GitHub and Notion APIs
- Implemented message-passing architecture (content ↔ background)
- Enhanced error handling with retry patterns
- Improved modal event isolation

### 🎨 UI/UX

- New GitHub and Notion export buttons in footer
- Integration icons and branding
- Progress bars with step-by-step feedback
- Success states with clickable URLs
- Settings gear icon for quick access to configuration
- Improved modal styling and responsiveness

---

## [1.1.1] - 2025-01-XX

### Fixed
- Added required `data_collection_permissions` property to manifest.json for Firefox Add-ons store compliance
- Declared no telemetry or crash report collection (confirming existing privacy-first design)

### Technical
- This is a metadata-only release to meet Firefox Add-ons store requirements
- No functional changes to extension behavior
- All code remains identical to v1.1.0

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
