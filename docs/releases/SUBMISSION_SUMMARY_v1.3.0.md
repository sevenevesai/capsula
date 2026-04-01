# Capsula v1.3.0 - Firefox Add-ons Submission Summary

**Quick reference guide for submitting to addons.mozilla.org**

---

## Version Info

- **Version:** 1.3.0
- **Previous Version:** 1.2.0 (Nov 6, 2025)
- **Release Date:** November 22, 2025
- **Type:** Major feature update

---

## What Changed (Summary for AMO)

### 5 Major New Features:

1. **Interactive Tutorial System** - Context-based help for first-time users
2. **Enhanced Timeline Multi-Selection** - Ctrl+Click, Shift+Click, Ctrl+Drag
3. **Interactive Message Toggles** - Checkbox on each message
4. **Smart Message Visibility** - Greyed-out excluded messages (not hidden)
5. **Modern SVG Icon System** - Professional icons replace all emojis

### Key Improvements:

- Non-contiguous message selections
- Bidirectional sync (timeline ↔ preview toggles)
- Auto-collapse excluded messages
- Better accessibility
- Cleaner, more professional UI

---

## AMO Submission Form Fields

### Version Notes (copy-paste ready):

**Title:**
Enhanced Selection, Interactive Tutorials & Modern Icons

**Release Notes (for version page):**

```
🎉 NEW FEATURES:
• Interactive Tutorial System with versioned context-based help
• Enhanced Timeline Multi-Selection (Ctrl+Click, Shift+Click, Ctrl+Drag)
• Interactive Message Toggles - checkbox on each message
• Smart Message Visibility - greyed-out excluded messages
• Modern SVG Icon System - professional, accessible icons

✨ IMPROVEMENTS:
• Non-contiguous selections for complex filtering
• Bidirectional sync between timeline and preview
• Auto-collapse excluded messages with click-to-expand
• Multiple selection methods (keyboard optional)
• Better cross-platform compatibility

🔧 BUG FIXES:
• Message alignment preserved for excluded messages
• Toggle behavior corrected for "all selected" state
• Click handlers properly isolated
```

### Technical Review Notes (for Mozilla reviewers):

**Changes in this version:**
- Refactored selection model from range-based to Set-based for better multi-selection
- Added tutorial system using browser.storage.local
- Replaced emoji UI elements with inline SVG icons
- Improved event handling and propagation control
- No new permissions required
- No external resource dependencies added
- All processing remains local (privacy-first)

**Permissions (unchanged):**
- clipboardWrite: For copy to clipboard
- storage: For settings and tutorial state
- optional_host_permissions: For GitHub/Notion (on-demand)

**Privacy:**
- No telemetry or analytics
- No external network requests (except user-initiated GitHub/Notion exports)
- All data processing local

---

## Files to Include in ZIP

**Required:**
- manifest.json (v1.3.0)
- content.js (main extension code)
- background.js (API broker, unchanged from v1.2.0)
- icons/16.png
- icons/32.png
- icons/48.png
- icons/96.png
- icons/128.png

**Documentation (recommended):**
- README.md
- CHANGELOG.md
- PRIVACY.md
- LICENSE

---

## Pre-Submission Testing

**Must verify:**
- [ ] Extension loads in clean Firefox profile
- [ ] Multi-selection works (Ctrl+Click, Shift+Click, Ctrl+Drag)
- [ ] Message toggles work in preview
- [ ] Greyed-out messages display correctly
- [ ] Tutorials appear (after reset)
- [ ] SVG icons render in light/dark mode
- [ ] GitHub export respects selection
- [ ] Notion export respects selection
- [ ] No console errors
- [ ] Works on both chat.openai.com and chatgpt.com

---

## Comparison to Current Version

| Feature | v1.2.0 | v1.3.0 |
|---------|--------|--------|
| Message Selection | Range only (drag) | Multi-select + Range |
| Selection Methods | Timeline only | Timeline + Toggles |
| Excluded Messages | Hidden | Greyed-out (visible) |
| Tutorials | None | Interactive, versioned |
| Icons | Emojis | Professional SVGs |
| Selection Model | Start/End range | Set-based |

---

## Key Selling Points

**For Users:**
1. **More Control** - Select exactly what you want, multiple ways
2. **Better Learning** - Tutorials help discover features
3. **Cleaner Look** - Professional SVG icons
4. **Better UX** - See what's excluded, not just what's included

**For Firefox Add-ons Team:**
1. No new permissions
2. No external dependencies
3. Privacy-first design maintained
4. Accessibility improvements (SVG icons, keyboard nav)
5. Cross-platform compatibility improved

---

## Screenshots for AMO (recommended updates)

**Suggest new screenshots showing:**
1. Multi-selection in timeline (Ctrl+Click)
2. Message toggles in preview area
3. Greyed-out excluded messages
4. Tutorial system in action
5. SVG icons throughout UI

---

## Support Links

- **Website:** https://seveneves.ai/capsula
- **Support Email:** support@seveneves.ai
- **Privacy Policy:** Included in PRIVACY.md
- **License:** MIT (see LICENSE file)

---

## Post-Submission

**When approved:**
1. Monitor reviews and ratings
2. Check support email for questions
3. Update website with v1.3.0 info
4. Announce on social media (if applicable)

**If issues found:**
1. Assess severity
2. Hotfix if critical (v1.3.1)
3. Note for next release if minor

---

## Quick Stats

- **Lines of code changed:** ~200 (mostly in content.js)
- **New features:** 5 major
- **Bug fixes:** 4
- **Breaking changes:** None
- **Migration required:** None (automatic)
- **Performance impact:** Minimal (RequestAnimationFrame for smooth rendering)

---

**Status:** ✅ Ready for submission
**All documentation:** ✅ Complete
**Testing:** ⏳ Pending manual verification
**Package build:** ⏳ Pending
