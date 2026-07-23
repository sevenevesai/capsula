# Store Submission — Capsula 1.4.0

Everything needed to upload 1.4.0 to Firefox Add-ons (AMO) and the Chrome Web Store.
Build artifacts: run `node build.js --zip` → `dist/capsula-1.4.0-firefox.zip`, `dist/capsula-1.4.0-chrome.zip`.

---

## Release notes (paste into both stores)

**What's new in 1.4.0**

- Fixed exports for the current ChatGPT interface — ChatGPT changed its page structure, and exports now capture every message reliably again
- Long conversations: messages ChatGPT unloads while you scroll are no longer missing from exports (Capsula sweeps the full conversation before exporting)
- Mermaid diagrams now export as rendered images; math equations render in HTML exports just like the chat window, and export as proper LaTeX in markdown
- Code blocks keep their language labels; bold, italic, links, and inline code are preserved throughout
- Markdown fixes: tables export as pipe tables, nested lists keep their structure, code fences can't be broken by code containing backticks
- Export files are named after the conversation title, not a heading from the message content
- Now also available for Chrome and Edge (Chrome 116+, Edge 116+)

---

## Firefox Add-ons (AMO) — addons.mozilla.org

**Upload:** `dist/capsula-1.4.0-firefox.zip`

### Data collection consent (new since last release)
The manifest now declares `data_collection_permissions: { required: ["none"] }` —
Mozilla's data collection consent framework is mandatory for all extensions as of 2026.
Firefox shows "No data collected" in the install prompt. No listing action needed;
just be aware the reviewer will see this as a manifest change.

### Source code submission (required)
`content.js` is machine-generated (concatenated from `src/content/*.js` by `build.js`),
so AMO's policy on generated code requires uploading source alongside the build.

- Upload `dist/capsula-1.4.0-source.zip` in the "Source code" step
- Build instructions for the reviewer (paste into the reviewer notes field):

> Requires Node.js (any recent LTS; no npm dependencies).
> Run `node build.js firefox` from the repo root.
> Output in `dist/firefox/` matches the submitted extension zip exactly.
> `content.js` is a straight concatenation of `src/content/*.js` in alphabetical
> order — no minification or transpilation.

### Listing description — suggested refresh
Short summary (unchanged): `Save & export your AI conversations.`

If updating the long description, lead with:

> Capsula exports your ChatGPT conversations to Markdown, HTML, JSON, or an
> interactive analytics dashboard — with an interactive timeline for selecting
> exactly which messages to include, content filters (code, tables, lists),
> and direct export to GitHub Gists/Issues and Notion pages.
>
> Privacy-first: all processing happens locally in your browser. No telemetry,
> no tracking, no Capsula servers. GitHub/Notion access is optional and only
> requested when you enable those integrations.

---

## Chrome Web Store — chrome.google.com/webstore/devconsole

**Upload:** `dist/capsula-1.4.0-chrome.zip`

If this is the **first Chrome release** (no existing listing), the new-item flow needs:

### Listing basics
- **Name:** Capsula
- **Summary (132 chars max):** Save & export your AI conversations.
- **Category:** Productivity → Tools
- **Language:** English
- **Description:** use the long description above (same as AMO)
- **Icon:** `icons/128.png`
- **Screenshots:** 1280×800 or 640×400 PNG. Repo has `ss-1` through `ss-7`:
  all are 1280×800 except `ss-4.png` (913×1104 — resize/recrop or exclude it)
- **Homepage:** https://seveneves.ai/capsula
- **Support:** support@seveneves.ai

### Privacy tab
- **Single purpose:** Export ChatGPT conversations from the current page into
  local files (Markdown, HTML, JSON) or the user's own GitHub/Notion accounts.
- **Permission justifications:**
  - `clipboardWrite` — copies the exported conversation to the clipboard when
    the user clicks "Copy to Clipboard"
  - `storage` — stores user preferences (export format, tutorial state) and,
    if the user enables integrations, their GitHub/Notion API tokens, locally only
  - Host permission `chat.openai.com` / `chatgpt.com` (content script) — the
    extension reads the conversation on the page in order to export it
  - Optional host `api.github.com` — only requested when the user enables
    GitHub export; used to create Gists/Issues in the user's own account
  - Optional host `api.notion.com` — only requested when the user enables
    Notion export; used to create pages in the user's own workspace
- **Remote code:** No, extension does not use remote code
- **Data usage:** does NOT collect or transmit any user data. Tokens the user
  provides are stored locally and sent only to GitHub/Notion respectively.
- **Privacy policy URL:** link to hosted copy of PRIVACY.md (e.g. on seveneves.ai)

### Edge
The Chrome zip also works for Microsoft Edge Add-ons (separate submission at
partner.microsoft.com) if/when desired — not required for this release.

---

## Pre-upload checklist

- [ ] `node build.js --zip` passes the version-consistency check (1.4.0 everywhere)
- [ ] Load `dist/firefox/` via about:debugging → export button appears, export works
- [ ] Load `dist/chrome/` via chrome://extensions → export button appears, export works
- [ ] AMO: upload extension zip + source zip + reviewer build notes
- [ ] Chrome: upload zip, complete privacy tab (first-time listing)
- [ ] After approval: tag the release in git (`git tag v1.4.0`)
