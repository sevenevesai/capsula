# Capsula v1.3.0 - Enhanced Selection & Tutorial Release

**Release Date:** November 2025

We're excited to announce Capsula v1.3.0, bringing **advanced message selection**, **interactive tutorials**, and a **modern SVG icon system** that makes working with AI conversations more intuitive and powerful than ever!

---

## What's New

### Interactive Tutorial System - Learn as You Go

Never miss a feature again! v1.3.0 introduces a smart tutorial system that helps you discover Capsula's capabilities.

**Versioned Context-Based Help**
- Tutorials appear when you first open GitHub/Notion modals
- Non-intrusive 2-step guides that don't get in your way
- Tutorial state stored in browser.storage.local (survives ChatGPT domain shifts)
- Versioned tutorial keys (e.g., `github_modal:v1`, `notion_modal:v1`)
- Bumping version re-prompts all users once for new features

**User-Friendly Controls**
- Dismiss with "Got it!" to complete the tutorial
- "Don't show again" to skip permanently
- Reset all tutorials in Settings > Help & Tutorials
- Always accessible, never annoying

---

### Enhanced Timeline with Multi-Selection - Select Exactly What You Need

The timeline just got a major upgrade! Complex message selection is now effortless with keyboard modifiers and mouse interactions.

**Advanced Selection Methods**
- **Ctrl+Click**: Toggle individual messages on/off in timeline
- **Shift+Click**: Extend selection from last anchor point
- **Ctrl+Shift+Click**: Add range to existing selection
- **Ctrl+Drag**: Add or remove multiple messages while dragging
- **Right-Click**: Clear all selections instantly

**Non-Contiguous Selections**
- Select message 1, skip 2-5, select 6-8, skip 9, select 10
- Perfect for extracting specific parts of complex conversations
- Great for removing sensitive content while keeping context
- Flexible enough for any filtering scenario

**Visual Feedback**
- Timeline segments highlight on hover
- Selected messages clearly marked
- Smooth animations for all state changes
- Resize handles for fine-tuning selection boundaries

---

### Interactive Message Toggles - Direct Control in Preview

Want to quickly include/exclude messages while reviewing? Now you can!

**Checkbox Toggles on Every Message**
- Click the checkbox button next to "You" or "ChatGPT" label
- Toggle messages in/out of export instantly
- Visual feedback: checked (green) = included, unchecked = excluded
- No need to touch the timeline or remember keyboard shortcuts

**Bidirectional Sync**
- Toggle in preview → timeline updates
- Select in timeline → preview updates
- Both views always in perfect sync
- Choose whichever method feels more natural

**Accessible Design**
- Keyboard navigation supported
- Screen reader friendly
- Clear visual states
- Intuitive hover effects

---

### Smart Message Visibility - See What's Excluded

Excluded messages no longer disappear! Instead, they're shown greyed-out so you can review your selection.

**Greyed-Out Display**
- 50% opacity for excluded messages
- Diagonal stripe pattern overlay for clear distinction
- 40% grayscale filter on message bubbles
- Auto-collapse to 60px height to reduce clutter

**Click to Expand/Collapse**
- Click excluded messages to expand for review
- Click again to collapse
- Expand/collapse hints with intuitive icons
- "(Not in export)" labels for absolute clarity

**Preserved Alignment**
- User messages stay right-aligned even when excluded
- Assistant messages remain left-aligned
- Chat flow remains visually coherent
- No layout jumps or shifts

---

### Modern SVG Icon System - Professional & Accessible

Say goodbye to emojis! v1.3.0 introduces a complete SVG icon system for a cleaner, more professional appearance.

**Complete Icon Overhaul**
- Filter buttons (Assistant, Code, Tables, Lists) use clean SVG icons
- Tutorial titles are text-only for clarity
- Dashboard uses SVG icon instead of emoji
- Section headers and stats cards use text labels
- File attachments show category-specific SVG icons
- Code and thinking indicators use text tags ([code], [thinking])
- Success notifications use text-based feedback
- Notion page/database selectors use SVG icons

**Technical Excellence**
- All icons use 'currentColor' for automatic light/dark mode adaptation
- Perfect rendering at all sizes and resolutions
- No font dependencies
- No platform-specific emoji inconsistencies

**Benefits**
- Professional, modern appearance across all UI elements
- Consistent icon styling throughout the extension
- Better accessibility (works with screen readers, no ambiguity)
- Better cross-platform compatibility (no OS-dependent rendering)
- Cleaner interface without visual clutter

---

## Improvements & Enhancements

**Selection Model Rewrite**
- Replaced simple range (start/end) with flexible Set-based selection
- Empty Set represents "all selected" for efficiency
- Smart toggle logic: first exclusion selects all except that message
- Automatic cleanup when all messages re-selected (returns to empty Set)

**Export Integration**
- All export formats respect multi-selection (Markdown, HTML, JSON, Dashboard)
- GitHub Gists and Issues integration updated
- Notion pages integration updated
- Two-tier filtering: preview shows all, export uses selection

**UI/UX Polish**
- Smooth scale animations on hover (110%)
- Color-coded checkmarks (green for included)
- Keyboard focus indicators for accessibility
- Event propagation properly controlled for nested interactions
- RequestAnimationFrame for smooth rendering

**Bug Fixes**
- Message alignment preserved for excluded/collapsed messages
- Toggle behavior correct when starting from "all selected" state
- Expand/collapse hints positioned correctly for each message role
- Click handlers properly isolated (toggle vs expand/collapse)

---

## Why This Matters

### For Power Users
- **Precise control** over exactly what gets exported
- **Non-contiguous selections** for complex filtering scenarios
- **Multiple selection methods** - use what feels natural to you
- **Visual confirmation** of what's included/excluded

### For New Users
- **Interactive tutorials** help you discover features without reading docs
- **No keyboard shortcuts required** - everything accessible via point-and-click
- **Clear visual feedback** at every step
- **Forgiving UI** - easy to undo mistakes

### For Everyone
- **Professional appearance** with modern SVG icons
- **Better accessibility** with screen reader support and keyboard navigation
- **Cleaner interface** without emoji clutter
- **Consistent experience** across all platforms and devices

---

## Technical Highlights

**Selection Architecture**
- Set-based selection model for O(1) message lookups
- `MessageFilter.apply()` for preview (shows all with metadata)
- `MessageFilter.getExportMessages()` for exports (only selected)
- `onSelectionChange` callback for bidirectional sync

**Tutorial System**
- Versioned keys enable feature re-prompts when needed
- browser.storage.local persistence survives domain shifts
- Non-blocking async initialization
- Minimal DOM overhead

**Icon System**
- SVG elements with 'currentColor' for theme adaptation
- Inline SVG for zero network requests
- Semantic HTML for accessibility
- CSS transforms for animations

---

## Getting Started

**Explore the New Selection Features**
1. Open Capsula export panel (Alt+E)
2. Try Ctrl+Click on timeline segments to toggle messages
3. Use checkboxes in preview area to include/exclude messages
4. Notice how excluded messages are greyed-out but still visible
5. Export and see exactly what you selected

**Experience the Tutorials**
1. Clear your tutorial state in Settings > Help & Tutorials > Reset Tutorials
2. Open GitHub or Notion export modal
3. Follow the 2-step tutorial
4. Dismiss when done or opt out permanently

**Enjoy the New Icons**
- No action needed - just notice the cleaner, more professional appearance!

---

## What's Next?

v1.3.0 brings major UX improvements, but we're not stopping here. Future plans include:
- Additional export templates and customization
- Conversation organization and tagging
- Enhanced analytics and insights
- More integration platforms
- AI model detection and metadata

---

## Thank You

To our community: your feedback continues to shape Capsula. This release addresses multiple feature requests around selection control and discoverability. Thank you for helping make Capsula better!

---

## Upgrade Now

**Firefox users:** Update automatically from the Add-ons Manager, or download from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/capsula/).

**Manual install:** Load the new `manifest.json` from `about:debugging`.

---

## Documentation

- **Full Changelog:** [CHANGELOG.md](./CHANGELOG.md)
- **Feature Guide:** [README.md](./README.md)
- **Privacy Policy:** [PRIVACY.md](./PRIVACY.md)

---

## Feedback & Support

Questions? Issues? Ideas? We'd love to hear from you!

- **Email:** support@seveneves.ai
- **Website:** [seveneves.ai/capsula](https://seveneves.ai/capsula)

---

**Capsula v1.3.0** - Select smarter. Learn easier. Look better.

---

*Copyright © 2025 Seveneves AI. MIT License.*
