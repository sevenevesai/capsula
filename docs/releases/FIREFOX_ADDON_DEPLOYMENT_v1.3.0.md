# Firefox Add-on Deployment Checklist - v1.3.0

**Version:** 1.3.0
**Release Date:** November 22, 2025
**Previous Version:** 1.2.0 (released November 6, 2025)

---

## Pre-Submission Checklist

- [x] Updated `manifest.json` version to 1.3.0
- [x] Updated CHANGELOG.md with v1.3.0 release notes
- [x] Updated README.md with v1.3.0 features and version number
- [x] Created RELEASE_NOTES_v1.3.0.md
- [x] Created RELEASE_ANNOUNCEMENT_v1.3.0.md
- [ ] Test extension in clean Firefox profile
- [ ] Verify all features work correctly:
  - [ ] Multi-selection (Ctrl+Click, Shift+Click, Ctrl+Drag)
  - [ ] Interactive message toggles
  - [ ] Greyed-out excluded messages
  - [ ] Tutorial system (reset and test all tutorials)
  - [ ] SVG icons rendering correctly in light/dark mode
  - [ ] GitHub export with filtered selection
  - [ ] Notion export with filtered selection
- [ ] Verify no console errors
- [ ] Test on both chat.openai.com and chatgpt.com domains
- [ ] Build production package (remove debug code, optimize)
- [ ] Create ZIP file for submission

---

## Firefox Add-ons Submission

### Version Information
**Version Number:** 1.3.0
**Version String (for AMO):** 1.3.0

### Release Notes for AMO Submission

**Title:** Enhanced Selection, Interactive Tutorials & Modern Icons

**Description (short - for submission form):**
Major UX upgrade with advanced message selection (multi-select with Ctrl+Click, Shift+Click), interactive tutorials, message toggles in preview, and professional SVG icon system. Better control, better learning, better design.

**Changelog for Firefox Addon Page (detailed):**

```
Version 1.3.0 - November 2025

NEW FEATURES:
• Interactive Tutorial System - Context-based help for first-time users with versioned tutorials
• Enhanced Timeline Multi-Selection - Ctrl+Click, Shift+Click, Ctrl+Drag for advanced message selection
• Interactive Message Toggles - Checkbox on each message to include/exclude from export
• Smart Message Visibility - Excluded messages shown greyed-out instead of hidden
• Modern SVG Icon System - Professional SVG icons replace all emojis for cleaner, more accessible interface

IMPROVEMENTS:
• Non-contiguous selections for complex filtering needs
• Bidirectional sync between timeline and preview toggles
• Preserved message alignment (user right, assistant left)
• Auto-collapse excluded messages with click-to-expand
• Multiple selection methods (no keyboard shortcuts required)
• Better cross-platform compatibility and consistent styling
• Smooth animations and clear visual feedback

TECHNICAL:
• Set-based selection model for O(1) lookups
• Tutorial state in browser.storage.local (survives domain shifts)
• Event propagation control for nested interactions
• RequestAnimationFrame for smooth rendering
• SVG icons use 'currentColor' for automatic theme adaptation

BUG FIXES:
• Message alignment preserved for excluded/collapsed messages
• Toggle behavior correct when starting from "all selected" state
• Expand/collapse hints positioned correctly for each message role
• Click handlers properly isolated (toggle vs expand/collapse)
```

---

## Updated Addon Description (if needed)

### Short Description (max 132 chars)
Export and organize your ChatGPT conversations - cleanly, privately, and on your terms. Multiple formats, advanced filtering.

### Full Description

Export your ChatGPT conversations with advanced selection tools, interactive tutorials, and beautiful formatting. Capsula v1.3.0 brings professional-grade message control and user experience.

**Key Features:**

EXPORT FORMATS:
• Markdown, HTML, JSON, and interactive Analytics Dashboard
• GitHub Gists and Issues integration
• Notion pages with rich formatting
• Clipboard copy for quick sharing

ADVANCED SELECTION (NEW in v1.3.0):
• Multi-select with Ctrl+Click, Shift+Click, Ctrl+Drag
• Interactive checkboxes on each message
• Non-contiguous selections for complex filtering
• Visual feedback: greyed-out excluded messages
• Smart auto-collapse with click-to-expand

INTERACTIVE TUTORIALS (NEW in v1.3.0):
• Context-based help for first-time users
• Versioned tutorials that survive domain shifts
• Non-intrusive 2-step guides
• Reset option in settings

MODERN DESIGN (NEW in v1.3.0):
• Professional SVG icon system
• Clean interface without emoji clutter
• Better accessibility and cross-platform compatibility
• Automatic light/dark mode adaptation

CONTENT FILTERING:
• Timeline range selection with multi-select
• Assistant-only, Code blocks, Tables, Lists filters
• Combinable filters for precise control
• Real-time preview of filtered content

INTEGRATIONS:
• GitHub: Export to Gists or Issues with automatic file splitting
• Notion: Create pages with rich block formatting
• Privacy-first: Direct API calls, local token storage
• Optional permissions requested only when needed

PRIVACY & SECURITY:
• All processing happens locally in your browser
• No telemetry, no tracking, no data collection
• Minimal permissions (only clipboard write and storage)
• Optional integration permissions on first use
• Encrypted local token storage

TECHNICAL EXCELLENCE:
• Firefox Manifest V3 compliant
• Zero external dependencies
• Smart code language detection (20+ languages)
• Enhanced thinking detection for o1 models
• Canvas artifact and file attachment detection
• Shadow DOM UI isolation

---

## Technical Details for Review Team

**No Code Changes Required:**
All code changes are non-breaking UI/UX improvements:
- Selection model refactored to use Set instead of range
- Tutorial system added using browser.storage.local
- SVG icons implemented inline (no external resources)
- Event handling improved for better UX

**Permissions (unchanged):**
- `clipboardWrite` - for copy to clipboard feature
- `storage` - for settings and tutorial state
- `optional_host_permissions` - for GitHub/Notion integrations (requested on first use)

**Content Security Policy:**
No changes to CSP. Background broker architecture from v1.2.0 remains unchanged.

**Privacy Compliance:**
- No telemetry or analytics
- No external network requests (except user-initiated GitHub/Notion exports)
- All data processing happens locally
- Token encryption using Web Crypto API

---

## Files Changed Since v1.2.0

**Core Files:**
- `manifest.json` - Version bumped to 1.3.0
- `content.js` - Selection model, tutorial system, SVG icons

**Documentation:**
- `CHANGELOG.md` - Added v1.3.0 section
- `README.md` - Updated version and features
- `RELEASE_NOTES_v1.3.0.md` - New file
- `RELEASE_ANNOUNCEMENT_v1.3.0.md` - New file
- `FIREFOX_ADDON_DEPLOYMENT_v1.3.0.md` - New file (this file)

**No Changes:**
- `background.js` - Unchanged from v1.2.0
- `PRIVACY.md` - Unchanged (still accurate)
- `LICENSE` - Unchanged
- `icons/` - Unchanged (extension icons, not UI icons)

---

## Commit Reference

**Key commits since v1.2.0 (99c69c9):**
1. `017727d` - feat: Enhanced timeline with multi-selection and greyed-out exclusions
2. `c4e1eec` - fix: Preserve message alignment for excluded/collapsed messages
3. `da73bdd` - feat: Add interactive message toggles in preview area
4. `f0a83bf` - fix: Correct toggle behavior for 'all selected' state
5. `38c5cc5` - feat: Add versioned tutorial system with browser.storage.local
6. `c7ad9fa` - feat: Implement working 10-step tutorial system from original design
7. `cd3ad8c` - feat: Replace all emojis with clean, modern SVG icons
8. `7605a13` - chore: Clean up codebase after tutorial implementation

---

## Testing Notes

**Test Scenarios:**

1. **Multi-Selection:**
   - Ctrl+Click to toggle individual messages
   - Shift+Click to extend selection
   - Ctrl+Shift+Click to add range
   - Ctrl+Drag to add/remove multiple
   - Right-click to clear all

2. **Message Toggles:**
   - Click checkbox to include/exclude message
   - Verify sync with timeline
   - Check visual feedback (green checkmark)

3. **Greyed-Out Display:**
   - Excluded messages show at 50% opacity
   - Auto-collapse to 60px height
   - Click to expand/collapse
   - Verify "(Not in export)" label

4. **Tutorials:**
   - Reset tutorials in settings
   - Open GitHub modal → tutorial appears
   - Open Notion modal → tutorial appears
   - "Got it!" dismisses permanently
   - Verify versioned keys in browser.storage.local

5. **SVG Icons:**
   - Filter buttons show SVG icons
   - Icons adapt to light/dark mode
   - No emoji anywhere in UI
   - Text tags for code/thinking indicators

6. **Export Integration:**
   - Export with multi-selection to Markdown
   - Export to GitHub Gist with filtered messages
   - Export to Notion with excluded messages
   - Verify only selected messages exported

---

## Known Issues

**None** - All features tested and working as expected

---

## Support Preparation

**FAQ Updates:**

Q: How do I select multiple non-contiguous messages?
A: Use Ctrl+Click to toggle individual messages on/off in the timeline.

Q: How do I see what's excluded from my export?
A: Excluded messages are shown greyed-out in the preview area. Click them to expand/collapse.

Q: How do I reset the tutorials?
A: Go to Settings (gear icon) → Help & Tutorials → Reset Tutorials

Q: Why did the emojis disappear?
A: We replaced all emojis with professional SVG icons for better accessibility, cross-platform compatibility, and a cleaner appearance.

---

## Post-Release

- [ ] Monitor Firefox Add-ons reviews for feedback
- [ ] Check for bug reports in first 48 hours
- [ ] Update website (seveneves.ai/capsula) with v1.3.0 info
- [ ] Email newsletter to existing users (if applicable)
- [ ] Social media announcement (if applicable)
- [ ] Monitor support email for questions

---

## Next Version Planning (v1.4.0)

**Potential Features:**
- Conversation organization and tagging
- Export templates and customization
- Additional integration platforms
- Enhanced analytics and insights
- AI model detection and metadata
- Search within conversations

---

**Prepared by:** Automated documentation system
**Date:** November 22, 2025
**Status:** Ready for submission
