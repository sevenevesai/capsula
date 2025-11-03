# Capsula DOM Structure Research Documentation

**Project:** Capsula - ChatGPT Conversation Export Firefox Addon
**Task:** DOM Structure Research & Documentation (Task 1)
**Status:** Research Phase - Documentation Complete, Awaiting Manual Browser Inspection
**Date:** 2025-11-03

---

## 📖 Overview

This directory contains comprehensive documentation for researching and understanding ChatGPT's DOM structure to improve the Capsula Firefox addon.

**Purpose:** Systematically document the actual DOM structure of ChatGPT conversations to identify:
- Reliable CSS selectors and data attributes
- Canvas artifact structure
- File attachment representation
- Thinking indicator lifecycle
- Edge cases and error states
- Gaps in current implementation

---

## 📁 Documentation Files

### 1. **chatgpt-dom-structure.md** ⭐
**The complete research guide**

- 10 detailed test scenarios with step-by-step instructions
- Browser inspection methodology
- DOM lifecycle/timing analysis
- Comprehensive research questions
- Documentation templates for each scenario
- Validation checklist

**Use this:** As the primary guide when performing manual browser inspection

**Time required:** 2-4 hours of focused research

---

### 2. **research-checklist.md** ✅
**Quick-reference checklist**

- Condensed task list for each scenario
- Time estimates per task
- Key questions to answer
- Console commands for testing
- Troubleshooting tips

**Use this:** As a quick reference while researching, print it out or keep it open in a second window

**Time required:** Same tasks as main guide, just organized as checklist

---

### 3. **current-selectors-reference.md** 📚
**Current implementation catalog**

- All CSS selectors currently used (v3.3.0)
- 5-tier message detection strategy
- Block type extraction methods
- Thinking state pattern matching
- Known limitations and fragile implementations
- Code locations for each feature

**Use this:** To understand what Capsula currently does before researching improvements

**Prerequisites:** Read this before starting research

---

### 4. **implementation-gaps.md** 🎯
**Gap analysis & priorities**

- Critical missing features (canvas, files)
- Medium priority issues (model detection, thinking)
- Low priority enhancements (live updates)
- Priority matrix and implementation order
- Success criteria
- Code locations for fixes

**Use this:** After research, to plan implementation tasks (Task 2, 3, 4)

**Next steps:** Once research reveals actual DOM structure, update this with concrete solutions

---

## 🚀 Quick Start Guide

### If You're Performing the Research:

1. **Read First** (30 min):
   - `current-selectors-reference.md` - Understand current implementation
   - `chatgpt-dom-structure.md` - Full methodology
   - `research-checklist.md` - Task breakdown

2. **Setup** (15 min):
   - Open browser with DevTools
   - Create folders: `docs/research/` and `docs/screenshots/`
   - Sign into ChatGPT (Plus account recommended)

3. **Execute** (2-3 hours):
   - Follow `research-checklist.md` scenarios 1-10
   - Document each scenario in `docs/research/scenario-N-name.md`
   - Take screenshots for each scenario
   - Test selectors in browser console
   - Capture timing/lifecycle of message generation

4. **Validate** (30 min):
   - Verify all scenarios documented
   - Ensure all selectors tested
   - Check deliverables complete

5. **Next Steps**:
   - Review findings against `implementation-gaps.md`
   - Update gaps document with concrete solutions
   - Proceed to Task 2 (implementation)

---

### If You're Reviewing the Research:

1. Check that `docs/research/` contains:
   - [ ] 10+ scenario documentation files
   - [ ] Each file has HTML examples
   - [ ] Timing analysis documented

2. Check that `docs/screenshots/` contains:
   - [ ] 12+ screenshot files
   - [ ] Thinking indicators (active & complete)
   - [ ] Canvas artifacts
   - [ ] File uploads
   - [ ] Error states

3. Verify selector validation:
   - [ ] All selectors tested in console
   - [ ] Results documented
   - [ ] Stability assessment included

---

## 🎯 Research Objectives

### Primary Goals

- **Canvas Artifacts:** Document structure, find reliable selectors ⚠️ CRITICAL
- **File Attachments:** Understand upload representation ⚠️ CRITICAL
- **Thinking Indicators:** Find DOM attributes (not text patterns) 🔴 HIGH PRIORITY
- **State Management:** Identify status attributes (error, complete, generating) 🟡 MEDIUM

### Secondary Goals

- Validate current 5-tier selector strategy still works
- Find per-message model attribution
- Improve timestamp reliability
- Document conversation metadata
- Identify Shadow DOM usage

---

## 📋 Expected Deliverables

After research completion:

```
docs/
├── README-Research.md (this file)
├── chatgpt-dom-structure.md (methodology)
├── research-checklist.md (quick reference)
├── current-selectors-reference.md (current state)
├── implementation-gaps.md (gap analysis)
│
├── research/
│   ├── scenario-1-user-message.md
│   ├── scenario-2-assistant-message.md
│   ├── scenario-3-thinking-indicator.md
│   ├── scenario-4-thinking-expanded.md
│   ├── scenario-5-canvas-artifact.md ⚠️ CRITICAL
│   ├── scenario-6-file-upload.md ⚠️ CRITICAL
│   ├── scenario-7-file-analysis.md
│   ├── scenario-8-error-state.md
│   ├── scenario-9-empty-response.md
│   ├── scenario-10-multi-turn.md
│   ├── timing-analysis.md
│   ├── data-attributes.md
│   ├── css-classes.md
│   └── selector-tests.md
│
└── screenshots/
    ├── scenario-1-user-message.png
    ├── scenario-2-assistant-message.png
    ├── scenario-3-thinking-active.png ⚠️ CRITICAL
    ├── scenario-3-thinking-complete.png ⚠️ CRITICAL
    ├── scenario-4-thinking-collapsed.png
    ├── scenario-4-thinking-expanded.png
    ├── scenario-5-canvas-artifact.png ⚠️ CRITICAL
    ├── scenario-6-file-upload.png
    ├── scenario-7-file-analysis.png
    ├── scenario-8-error-state.png
    ├── scenario-9-empty-response.png
    └── scenario-10-multi-turn.png
```

---

## ⚠️ Important Notes

### Limitations

**Claude Code CLI (AI) cannot perform this research** because:
- No browser access
- Cannot interact with web UIs
- Cannot take screenshots
- Cannot run JavaScript in browser console

**These documents serve as:**
- ✅ Complete research methodology
- ✅ Structured documentation templates
- ✅ Current implementation analysis
- ✅ Gap identification and prioritization

**Manual research required** by someone with:
- ChatGPT account (Plus for o1 and canvas)
- Browser with DevTools (Firefox or Chrome)
- 2-4 hours of time
- Basic HTML/CSS knowledge

---

## 🔄 Task Flow

```
┌─────────────────────────────────────────────────┐
│  Task 1: DOM Research (Current Task)            │
│  Status: Documentation Complete                 │
│  Next: Manual browser inspection needed         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Task 2: Critical Features Implementation       │
│  - Add canvas artifact support                  │
│  - Add file attachment handling                 │
│  - Improve thinking detection                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Task 3: Reliability Improvements               │
│  - Better model detection                       │
│  - Error state handling                         │
│  - Timestamp consistency                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Task 4: Polish & Enhancement                   │
│  - Live updates (MutationObserver)              │
│  - Conversation metadata                        │
│  - UI improvements                              │
└─────────────────────────────────────────────────┘
```

---

## 🎓 Key Research Questions

These are the most important unknowns to resolve:

### Canvas Artifacts (CRITICAL)
- [ ] What is the exact DOM structure?
- [ ] Is content in iframe, shadow DOM, or direct DOM?
- [ ] What CSS classes/data attributes identify canvas?
- [ ] How to programmatically extract canvas content?

### File Attachments (CRITICAL)
- [ ] How are uploaded files represented in user messages?
- [ ] What attributes store file metadata (name, type, size)?
- [ ] Where are thumbnails? How to extract?

### Thinking Indicators (HIGH PRIORITY)
- [ ] Is there a `data-thinking` or `data-status` attribute?
- [ ] What happens to thinking indicator when response completes?
- [ ] Does it stay, get removed, or get replaced?

### State Management (MEDIUM)
- [ ] What `data-*` attributes indicate message state?
- [ ] How are error/incomplete/regenerated messages marked?
- [ ] Can we detect streaming vs. complete states?

---

## 📊 Success Metrics

Research is complete when:

- [ ] All 10 scenarios documented with HTML + screenshots
- [ ] Canvas structure fully documented
- [ ] File attachment structure fully documented
- [ ] Thinking lifecycle documented with timing
- [ ] All selectors tested and validated in console
- [ ] Data attributes cataloged
- [ ] CSS classes cataloged
- [ ] Edge cases identified

---

## 💡 Tips for Researchers

### Efficient Research

1. **Use video recording:** Capture DOM changes during live generation, review later
2. **Batch screenshots:** Take all in one session
3. **Copy HTML immediately:** Before navigating away
4. **Test selectors as you go:** Validate in console before moving on
5. **Over-document:** Better too much info than too little

### Console Commands

```javascript
// Quick tests (use $$ shorthand for querySelectorAll)
$$('article[data-scroll-anchor]')                    // All messages
$$('[data-message-author-role="user"]')              // User messages
$$('[data-message-author-role="assistant"]')         // Assistant messages
$$('[class*="thinking"]')                            // Thinking elements
$$('[class*="canvas"]')                              // Canvas elements
Array.from($0.attributes).filter(a => a.name.startsWith('data-'))  // All data-* on selected element
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Can't find element | Use "Select element" tool (arrow icon) |
| HTML too large | Copy sections, not entire page |
| Dynamic changes | Pause updates: Break on → Subtree modifications |
| o1 not available | Requires ChatGPT Plus |
| Canvas doesn't appear | Try: "Create HTML game", "Make a chart" |

---

## 📚 Additional Resources

- **ChatGPT URL:** https://chatgpt.com/
- **Source Code:** `/home/user/capsula/content.js`
- **Current Version:** 3.3.0
- **Browser DevTools:** Press F12 in browser
- **Selector Testing:** Browser console tab

---

## 🤝 Contributing

If you're performing this research:

1. Follow the methodology exactly
2. Document everything (even uncertainties)
3. Test all selectors in console
4. Take clear, labeled screenshots
5. Note any unexpected behavior
6. Ask questions if stuck

After completing research:
- Update `implementation-gaps.md` with concrete findings
- Create GitHub issue with summary
- Attach research files for review

---

## 📞 Questions?

If stuck during research:
1. Document what you found so far
2. Note specific questions or blockers
3. Capture screenshots of unexpected behavior
4. Create issue on GitHub repo

---

## ✨ Credits

**Documentation Created By:** Claude Code (AI) - Analysis of existing codebase + research methodology design
**Research To Be Performed By:** Human with browser access
**Based On:** Capsula v3.3.0 codebase analysis

---

**Status:** ✅ Documentation complete, ⏳ Manual research pending
**Priority:** 🔴 CRITICAL (blocks all other addon fixes)
**Estimated Research Time:** 2-4 hours
**Next Action:** Perform manual browser inspection following `research-checklist.md`

---

*Good luck with the research! 🔬*
