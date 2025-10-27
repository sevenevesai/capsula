# Capsula — Privacy Policy
_Last updated: 2025-08-26 • Applies to Capsula v1.0.0 and later_

**Capsula** is a Firefox extension for saving and exporting AI conversations.  
It is designed with **data minimization** and **local-only processing** as guiding principles.

---

## TL;DR
- We do not collect, transmit, or sell your data.  
- All processing happens locally in your browser.  
- No analytics, advertising, or third-party requests.  
- No background operation outside supported chat sites.  

If this ever changes, we will update this policy and require **explicit, in-product consent** before any new data collection begins.

---

## Who we are
- **Developer:** Seveneves AI  
- **Product:** Capsula (Firefox extension)  
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
- It reads the conversation currently displayed to generate an export preview and create a file **locally**.  
- Capsula **does not**:  
  - read browsing history,  
  - monitor other tabs or sites,  
  - access passwords, cookies, or account tokens,  
  - collect telemetry or usage analytics.  

### Network activity
- Capsula does not make outbound network requests.  
- No chat content is uploaded to Seveneves or any third party.  
- Exported files are created entirely on your device (download to disk or copy to clipboard).

### Storage
- Capsula does not persist chat content.  
- If you save preferences (e.g., default export format), they are stored **locally** in your browser.  
- No cloud storage or sync is used.

### Permissions
- Capsula requests only the permissions needed for its features. As of v1.0.0:  
  - **Host access:** limited to supported chat domains (never `<all_urls>`).  
  - **Other permissions:** none, except `clipboardWrite` if you enable one-click “Copy to clipboard.”  
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
- **Install/Uninstall:** You can install, disable, or remove Capsula at any time via Firefox Add-ons.  
- **Permissions:** If new permissions are required in the future, Firefox will prompt you for approval.  
- **Exports:** You decide what to export, when, and where to save it. Capsula never uploads exports automatically.  

---

## Future changes
If we introduce any feature that sends data off your device (e.g., optional sync, backup, or diagnostics):  
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
Capsula does not integrate third-party analytics, advertising, or other processors.  

---

## Changes to this policy
We will maintain a version history of privacy-relevant changes.  
Substantive updates will be highlighted in the extension listing and on our website.

**Version history (privacy):**  
- v1.0.0 — Initial release; local-only processing; no data collection.  

---

## Contact
Questions or concerns?  
Email **support@seveneves.ai** with the subject line “Capsula Privacy.”
