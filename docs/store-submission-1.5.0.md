# Store submission — Capsula 1.5.0

Release notes to paste into the listings:
[Capsula 1.5.0](releases/RELEASE_NOTES_v1.5.0.md).

## Packages

| Destination | File |
|---|---|
| Chrome Web Store | `dist/capsula-1.5.0-chrome.zip` |
| Firefox Add-ons | `dist/capsula-1.5.0-firefox.zip` |
| Firefox source code | `dist/capsula-1.5.0-source.zip` |

Build and source packaging commands: [release runbook](RELEASING.md).

## Chrome

Open the existing item in the [developer dashboard](https://chrome.google.com/webstore/devconsole).
Under Package, upload the Chrome zip. Update the release description and privacy disclosures,
then submit for review. [Chrome update instructions](https://developer.chrome.com/docs/webstore/update).

## Firefox

Open Capsula in [My Add-ons](https://addons.mozilla.org/developers/addons/) and submit a new
version. Upload the Firefox zip and the matching source zip. Paste the release notes and the
reviewer instructions below.
[Mozilla source requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/).

### Reviewer build instructions

Built on Windows with Node.js 20.19.2. Install [Node.js](https://nodejs.org/) if needed. The
build uses only Node built-ins; npm dependencies are required only for optional fixture tests.
From the extracted source archive's root, run:

```sh
node build.js firefox
```

`dist/firefox/` contains the extension files. `content.js` is a plain alphabetical
concatenation of `src/content/*.js`, without minification or transpilation.

Optional regression checks: `npm ci`, then `npm test`; all eight fixtures should match.

### Reviewer behavior notes

Sign into ChatGPT and open a saved conversation. Click the floating export button or press
Alt+E. Capsula reads `/api/auth/session` and the current conversation and file endpoints on
the same origin. The session token is used for these requests only and is never persisted
or sent to image hosts. API failures use DOM collection instead.

HTML and Markdown downloads/copies embed available images by default. The extension first
tries a direct image fetch; cross-origin failures can use the background broker after an
optional host-permission grant. Denied or failed downloads keep their links. Toggle embedding
in Settings → Behavior. JSON and integration exports retain URLs.

## Privacy and permission updates

- New optional hosts: `https://*.oaiusercontent.com/*` and
  `https://*.blob.core.windows.net/*`, used to download ChatGPT images for local exports.
- Existing `clipboardWrite` and `storage` permissions still support clipboard copies, local
  preferences, tutorial state, and integration tokens.
- ChatGPT content-script domains and optional GitHub/Notion hosts are unchanged.
- Update store disclosures to describe conversation/API reads, image downloads, and
  user-directed GitHub/Notion exports consistently with [PRIVACY.md](../PRIVACY.md).
  Seveneves receives no conversation data or telemetry.

## Live-browser checks before store submission

- In Chrome and Firefox, load the new build and export a saved conversation as Markdown
  and HTML. Check early messages, available thinking summaries, code, tables, and math.
- Export a conversation with images. Confirm embedded HTML images remain visible offline;
  check that disabling embedding keeps links and that permission denial still allows export.
- Check the collection overlay on short and long conversations, including the DOM fallback.
- Drag the button, reload, resize, and reset its position. Reopen the panel quickly and
  navigate between conversations to check panel lifetime.

## Validation record — 2026-09-15

- All eight fixtures match; only the expected export version headers changed to 1.5.0.
- Both browser bundles and the background script pass `node --check`.
- Every extension file rebuilt from the source archive matches its browser package byte-for-byte.
- `web-ext` 10.6.0 reports 0 errors and 19 warnings. The 1.4.0 baseline has 18 warnings:
  compatibility notices for older Firefox versions and dynamic HTML assignments. The added
  warning is the loading overlay template in `HarvestCurtain.show()`. Its progress details use
  `textContent`; template values are layout/theme values. Store reviewers may inspect these
  assignments and compatibility declarations.
- Live ChatGPT checks in Chrome and Firefox are awaiting confirmation. Complete the checks
  above before submitting to the stores.
