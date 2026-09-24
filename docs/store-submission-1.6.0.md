# Store submission — Capsula 1.6.0

Release notes to paste into the listings:
[Capsula 1.6.0](releases/RELEASE_NOTES_v1.6.0.md).

## Packages

| Destination | File |
|---|---|
| Chrome Web Store | `dist/capsula-1.6.0-chrome.zip` |
| Firefox Add-ons | `dist/capsula-1.6.0-firefox.zip` |
| Firefox source code | `dist/capsula-1.6.0-source.zip` |

Build and source packaging commands: [release runbook](RELEASING.md).

## Chrome

Open the existing item in the [developer dashboard](https://chrome.google.com/webstore/devconsole).
Under Package, upload the Chrome zip. Update the release description, then submit for review.
Privacy disclosures need no change for this release (see below).
[Chrome update instructions](https://developer.chrome.com/docs/webstore/update).

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

Optional regression checks: `npm ci`, then `npm test`; all nine fixtures should match.

### Reviewer behavior notes

Sign into ChatGPT and open a saved conversation. Click the floating export button or press
Alt+E. Capsula reads `/api/auth/session` and the current conversation and file endpoints on
the same origin. The session token is used for these requests only and is never persisted
or sent to image hosts. API failures use DOM collection instead.

Writing boxes (ChatGPT's titled drafts with ① ② version tabs) are read from the same
conversation response; this release adds no requests. The export format picked in the panel
is saved with the other local settings.

HTML and Markdown downloads/copies embed available images by default, as in 1.5.0. Denied or
failed downloads keep their links. JSON and integration exports retain URLs.

## Privacy and permission updates

- No permission changes: both manifests differ from 1.5.0 only in `version`.
- No network changes. Writing-box versions come from `metadata.writing_blocks` in the
  conversation response Capsula already reads.
- The remembered export format is a local preference, which [PRIVACY.md](../PRIVACY.md)
  already describes under Storage. Store disclosures need no update.

## Known limitations

- ChatGPT's new page layout (turns marked with `data-turn-key`) is not recognized by the DOM
  harvester. Exports on that layout still work through the conversation API, but mounted turns
  add no content and the DOM fallback finds no turns, so when the conversation API is
  unavailable there, the fallback has nothing to collect. See
  [Known gaps](harvest-pipeline.md#known-gaps-and-unverified-assumptions).
- Writing boxes come only from the conversation API; the DOM fallback does not produce them.

## Live-browser checks before store submission

Checked by the maintainer in Firefox before the release commit: panel and preview widths,
exported HTML width, and the remembered export format.

Still open:

- [ ] Firefox: a chat with a writing box that has ①/② versions. The preview shows the card
  with both versions; Markdown, HTML and JSON exports contain both, with no `:::` text.
- [ ] Chrome: the same writing-box check.
- [ ] Chrome: the full [RELEASING step 5](RELEASING.md#5-validation) pass (nothing was tested
  in Chrome this cycle). Export button appears; Markdown and HTML exports; HTML code blocks,
  tables and math; a math-heavy chat; image embedding and permission denial; button drag and
  reset; the collection overlay; reopening the panel.
- [ ] Settings → Reset to Defaults resets the export format to Markdown.

## Validation record — 2026-09-24

Automated checks:

- `npm ci`, then `npm test`: all nine fixtures match, including the new `api-writing-block`
  fixture. The only golden change from the version bump is the export version header (1.6.0).
- Both browser bundles and the background script pass `node --check`.
- Every extension file rebuilt from the source archive matches its browser package byte-for-byte.
- `web-ext` 10.7.0 reports 0 errors and 19 warnings on `dist/firefox/`: the same 19 it reports
  for the 1.5.0 package (compatibility notices for older Firefox versions and dynamic HTML
  assignments). Nothing new for reviewers.

Live QA (maintainer to fill in):

- Firefox writing box: pending
- Chrome writing box: pending
- Chrome step 5 pass: pending
- Reset to Defaults: pending
