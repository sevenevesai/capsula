# 🚀 Capsula v1.2.0 - Integration Release

**Release Date:** January 2025

We're thrilled to announce Capsula v1.2.0, bringing powerful **GitHub and Notion integrations** that transform how you save and share AI conversations!

---

## 🎉 What's New

### GitHub Integration - Your Conversations, Version Controlled

Export conversations directly to GitHub with a single click. No more copy-paste juggling!

**✨ Export to Gists**
- Create **private or public gists** directly from ChatGPT
- Auto-generated filenames with timestamps
- Conversations >1MB? No problem - automatic file splitting handles it
- URL instantly copied to your clipboard

**🔧 Export to Issues** *(Advanced)*
- Create repository issues from conversations
- Perfect for documenting bugs, feature requests, or research
- Full markdown formatting preserved

**💪 Smart Features**
- Visual progress tracking so you know exactly what's happening
- Intelligent retry logic handles network hiccups automatically
- User-friendly error messages with actionable solutions
- Connection testing before your first export

---

### Notion Integration - Beautiful Pages, Effortlessly

Turn your AI conversations into organized, searchable Notion pages with rich formatting.

**📝 Rich Page Creation**
- Interactive parent page selector - choose exactly where to save
- Support for both pages and databases as parents
- **Stunning formatting**: headings, code blocks, lists, quotes, and more
- Automatic batching for large conversations (handles any size!)

**🎨 Premium Formatting**
- Syntax highlighting preserved in code blocks
- Proper list nesting and structure
- Block quotes styled beautifully
- Canvas markers and thinking labels included
- Your metadata stays with you

**⚡ Performance Optimized**
- Batch uploads (100 blocks at a time)
- Progress tracking for large conversations
- URL copied to clipboard on success

---

### 🛠️ New Integration Settings

**Secure Token Management**
- Easy setup with step-by-step instructions
- Test connections before exporting
- Encrypted local storage (Web Crypto API)
- Tokens stored only on your device - never transmitted to Capsula servers
- Clear tokens instantly if needed

**Privacy-First Architecture**
- Optional permissions - only requested when you first use an integration
- Direct browser-to-API communication (no middleman)
- Zero telemetry or tracking
- Complete transparency

---

### ✨ Improvements & Fixes

**Message Filtering Now Works Everywhere**
- Timeline range selection? ✅ Works in GitHub/Notion exports
- Content filters (code only, assistant only, etc.)? ✅ Fully supported
- Export exactly what you see - filtered or full conversation

**Better Modal Experience**
- Fixed keyboard input focus issues
- Smooth typing without interruptions
- Proper event isolation from ChatGPT's UI

**Rock-Solid Error Handling**
- User-friendly error messages with clear next steps
- Automatic retry with exponential backoff for network issues
- Rate limit detection and helpful guidance
- Token scope validation with suggestions

---

## 🎯 Why This Matters

### For Developers
- **Version control your AI research** with GitHub
- **Document decisions** by exporting to Issues
- **Share knowledge** via public gists

### For Knowledge Workers
- **Centralize insights** in your Notion workspace
- **Build a searchable library** of AI conversations
- **Organize by project** with parent page selection

### For Everyone
- **Export filtered content** - only what you need
- **Privacy remains paramount** - your data, your control
- **Seamless workflow** - one click, automatic clipboard copy

---

## 📊 Technical Highlights

- New `background.js` broker for CSP-compliant API requests
- Message-passing architecture (content ↔ background)
- Enhanced error handling with retry patterns
- Improved modal event isolation
- File splitting algorithm for large payloads
- Batch upload optimization for Notion

---

## 🚦 Getting Started

### GitHub Setup (30 seconds)
1. Open Capsula settings (⚙️ icon in export panel)
2. Create a [GitHub token](https://github.com/settings/tokens/new?scopes=gist&description=Capsula) with "gist" scope
3. Paste, test, save - done! 🎉

### Notion Setup (1 minute)
1. Create a [Notion integration](https://www.notion.so/my-integrations)
2. Share a parent page with your integration
3. Paste token in Capsula settings
4. Test connection - ready to go! 🚀

---

## 📈 What's Next?

v1.2.0 is just the beginning. We're exploring:
- Additional integration platforms
- Custom export templates
- Conversation organization features
- Enhanced analytics and insights

---

## 🙏 Thank You

To our early users: your feedback shaped this release. Thank you for helping make Capsula better!

---

## 📥 Upgrade Now

**Firefox users:** Update automatically from the Add-ons Manager, or download from Firefox Add-ons (when published).

**Manual install:** Load the new `manifest.json` from `about:debugging`.

---

## 📚 Documentation

- **Full Changelog:** [CHANGELOG.md](./CHANGELOG.md)
- **Setup Guides:** [README.md](./README.md) - See "Integrations" section
- **Privacy Policy:** [PRIVACY.md](./PRIVACY.md)

---

## 💬 Feedback & Support

Questions? Issues? Ideas? We'd love to hear from you!

- **Email:** support@seveneves.ai
- **Website:** [seveneves.ai/capsula](https://seveneves.ai/capsula)

---

**Capsula v1.2.0** - Save smarter. Share easier. Stay private.

---

*Copyright © 2025 Seveneves AI. MIT License.*
