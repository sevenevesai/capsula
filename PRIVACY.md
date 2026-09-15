# Capsula — Privacy Policy
_Last updated: 2026-09-15 • Describes Capsula v1.5.0_

**Capsula** is a Firefox and Chrome/Edge extension for saving and exporting AI conversations.
It is designed with **data minimization** and **local-only processing** as guiding principles.

---

## TL;DR
- Seveneves does not collect or sell your conversation data.
- All processing happens locally in your browser.  
- No analytics or advertising. Network requests support reading ChatGPT conversations, downloading images, and exports you choose to send to GitHub or Notion.
- No background operation outside supported chat sites.  

If this ever changes, we will update this policy and require **explicit, in-product consent** before any new data collection begins.

---

## Who we are
- **Developer:** Seveneves AI  
- **Product:** Capsula (browser extension)
- **Contact:** support@seveneves.ai  
- **Website:** [https://seveneves.ai/capsula](https://seveneves.ai/capsula)

---

## Scope
This policy covers the Capsula extension itself.  
Interactions with the Seveneves website or support are covered by a separate website privacy notice.

---

## Data practices

### Data access
- Capsula runs **only** on supported chat domains (e.g., `chat.openai.com`, `chatgpt.com`).  
- It reads the conversation currently displayed, and asks ChatGPT's own conversation API (the same requests the page itself makes) for the complete thread, to generate an export preview and create a file **locally**.
- That API call uses the ChatGPT session you are already signed in with. The session token is used for the request and is never stored or sent anywhere else.
- Capsula **does not**:
  - read browsing history,
  - monitor other tabs or sites,
  - read passwords or cookies,
  - collect telemetry or usage analytics.  

### Network activity
- Capsula's network requests go to the site you are on (ChatGPT's conversation and file endpoints), to ChatGPT's image hosts when you export with images embedded, and to GitHub or Notion only when you use those integrations.
- No chat content is uploaded to Seveneves. Content is sent to GitHub or Notion only when you choose that export destination.
- Exported files are created entirely on your device (download to disk or copy to clipboard).

### Storage
- Capsula does not persist chat content.  
- If you save preferences (e.g., default export format), they are stored **locally** in your browser.  
- GitHub and Notion tokens you provide are stored locally in extension storage and sent only to their respective service.
- Preferences and tokens are not synced by Capsula.

### Permissions
- Capsula requests only the permissions needed for its features:
  - **Host access:** limited to supported chat domains (never `<all_urls>`).
  - **Optional host access:** `api.github.com` and `api.notion.com` for integrations, and ChatGPT's image hosts (`*.oaiusercontent.com`, `*.blob.core.windows.net`) for embedding images. Each is requested when needed and can be revoked in your browser's extension settings.
  - **Other permissions:** `storage` for local settings, tutorial state, and integration tokens; `clipboardWrite` for copying an export when requested.
- No broad or unrelated permissions are requested.

### Security measures
- **Shadow DOM isolation** for extension UI.  
- **Escaping and URL sanitization** for all processed content.  
- Exported HTML includes a restrictive **Content Security Policy (CSP)** to block script execution.  
- No use of `eval`, remote code, or third-party libraries.  

---

## What Capsula does not do
- No analytics, fingerprinting, or telemetry.  
- No advertising or affiliate tracking.  
- No third-party SDKs or CDNs.  
- No background services outside supported chat sites.  
- No automatic terms changes without notice.  

---

## User choices
- **Install/Uninstall:** You can install, disable, or remove Capsula in your browser's extension settings.
- **Permissions:** Optional host access requires your approval and can be revoked in your browser's extension settings.
- **Images:** Embedding is enabled by default for HTML and Markdown downloads and copies. Disable it in Settings → Behavior to keep image links instead. If an image cannot be embedded, its original link is retained; opening an export with external image links may contact those image hosts.
- **Exports:** You decide what to export, when, and where to save it. Capsula never uploads exports automatically.  

---

## Future changes
If we introduce additional data sharing beyond the features described here (e.g., optional sync, backup, or diagnostics):
1. This policy will be updated in advance.  
2. A clear in-product consent prompt will be shown.  
3. Data sharing will be **opt-in by default**.  
4. In-product controls will allow disabling at any time.  

---

## Children’s privacy
Capsula is a general-audience tool and does not target children.  
It does not knowingly collect personal data from children under 13.

---

## Data retention
Capsula does not collect or store personal data on our servers.  
Any files you export remain only on your device or the destination you choose.

---

## Third parties
Capsula does not integrate third-party analytics or advertising. ChatGPT hosts the source conversations and images. If you use the optional GitHub or Notion integrations, those services receive the content you export under their own privacy policies.

---

## Changes to this policy
We will maintain a version history of privacy-relevant changes.  
Substantive updates will be highlighted in the extension listing and on our website.

**Version history (privacy):**  
- v1.5.0 — Documents same-origin ChatGPT session/API access, image downloads, optional image-host permissions, and existing GitHub/Notion exports and token storage. No telemetry or Seveneves data collection added.
- v1.0.0 — Initial release; local-only processing; no data collection.  

---

## Contact
Questions or concerns?  
Email **support@seveneves.ai** with the subject line “Capsula Privacy.”
