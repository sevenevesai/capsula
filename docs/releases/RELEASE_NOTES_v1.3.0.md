# Capsula v1.3.0 - Enhanced Selection & Tutorial Release

**NEW:** Advanced message selection, interactive tutorials, and a modern SVG icon system!

---

## What's New in 60 Seconds

### Interactive Tutorial System
- **Context-based help** for first-time users
- Versioned tutorials that survive domain shifts
- Non-intrusive 2-step guides for GitHub/Notion features
- Dismiss with "Got it!" or "Don't show again"
- Reset option in Settings > Help & Tutorials

### Enhanced Timeline with Multi-Selection
- **Ctrl+Click** - Toggle individual messages on/off
- **Shift+Click** - Extend selection from last anchor
- **Ctrl+Shift+Click** - Add range to existing selection
- **Ctrl+Drag** - Add/remove multiple messages while dragging
- **Right-Click** - Clear all selections
- Non-contiguous selections for complex filtering

### Interactive Message Toggles
- **Checkbox on each message** in preview area
- Click to include/exclude from export
- Visual feedback (green checkmark = included)
- Bidirectional sync with timeline
- No keyboard shortcuts required

### Smart Message Visibility
- **Greyed-out display** for excluded messages
- Auto-collapse to 60px height
- Click to expand/collapse for review
- Clear "(Not in export)" labels
- Preserved message alignment (user right, assistant left)

### Modern SVG Icon System
- **Professional SVG icons** replace all emojis
- Automatic light/dark mode adaptation
- Better accessibility and cross-platform compatibility
- Cleaner, more modern interface
- Perfect rendering at all sizes

---

## Why It Matters

**Better Control:** Multiple ways to select messages - timeline, toggles, or keyboard shortcuts
**Better Visibility:** See exactly what's included/excluded in your export
**Better Learning:** Integrated tutorials help you discover features
**Better Design:** Professional appearance with accessible SVG icons
**Better Experience:** Smooth animations, clear feedback, intuitive controls

---

## Technical

- Set-based selection model for O(1) lookups
- Tutorial state in browser.storage.local (survives domain shifts)
- Event propagation control for nested interactions
- RequestAnimationFrame for smooth rendering
- SVG icons use 'currentColor' for theme adaptation

---

## Upgrade

**Firefox:** Auto-update from Add-ons Manager

**Manual:** Load new `manifest.json` from `about:debugging`

---

## Links

[Full Changelog](./CHANGELOG.md)
[Documentation](./README.md)
[Privacy Policy](./PRIVACY.md)
support@seveneves.ai

---

**Capsula v1.3.0** - Select smarter. Learn easier. Look better.

Privacy-first. Locally processed. Zero telemetry.

---

*Copyright © 2025 Seveneves AI. MIT License.*
