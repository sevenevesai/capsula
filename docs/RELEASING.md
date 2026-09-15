# Release Runbook

Steps to ship a new Capsula version to both stores. (Store copy & listing details
for a specific release: see `docs/store-submission-<version>.md`.)

## 1. Bump version (3 places)
- `manifest-firefox.json` → `"version"`
- `manifest-chrome.json` → `"version"`
- `src/content/01-config.js` → `CFG.version` (+ header comment)

The build fails if these disagree.

## 2. Update docs
- `CHANGELOG.md`: rename `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`
- `README.md`: version in Technical Details + new `### vX.Y.Z (Latest)` summary
- `docs/releases/RELEASE_NOTES_vX.Y.Z.md`: user-facing release notes
- `docs/store-submission-X.Y.Z.md`: packages, reviewer notes, changed permission disclosures
- `PRIVACY.md`: update when data access or network behavior changes

## 3. Build
```
node build.js --zip
```
→ `dist/capsula-X.Y.Z-firefox.zip` and `dist/capsula-X.Y.Z-chrome.zip`

## 4. Source zip (AMO requires it — content.js is machine-generated)
```powershell
$sourceStage = Join-Path (Resolve-Path dist).Path 'source-stage-X.Y.Z'
if (Test-Path -LiteralPath $sourceStage) { throw 'Source stage already exists; use a fresh directory.' }
New-Item -ItemType Directory $sourceStage | Out-Null
Copy-Item src (Join-Path $sourceStage 'src') -Recurse
Copy-Item icons (Join-Path $sourceStage 'icons') -Recurse
Copy-Item test (Join-Path $sourceStage 'test') -Recurse
'build.js','background.js','manifest-firefox.json','manifest-chrome.json',
'package.json','package-lock.json','README.md','CHANGELOG.md','PRIVACY.md','LICENSE' |
  ForEach-Object { Copy-Item -LiteralPath $_ -Destination $sourceStage }
New-Item -ItemType Directory (Join-Path $sourceStage 'docs') | Out-Null
Copy-Item docs/harvest-pipeline.md (Join-Path $sourceStage 'docs')
Copy-Item docs/store-submission-X.Y.Z.md (Join-Path $sourceStage 'docs')
node -e "const {writeZip}=require('./build.js'); writeZip('./dist/source-stage-X.Y.Z','./dist/capsula-X.Y.Z-source.zip')"
```

Extract the source zip into a fresh directory and run `node build.js` there. Compare every
generated file with `dist/firefox/` and `dist/chrome/`; all file hashes must match.

## 5. Validation

- `npm ci`, then `npm test`: all captured DOM/JSON fixtures must match. Before adding a
  snapshot, remove session/account data and scripts outside the conversation DOM.
- Syntax-check both built content scripts and `background.js` with `node --check`.
- Run the Firefox extension linter on `dist/firefox/`; resolve errors before submission.
- Live-browser QA remains the gate for store submission; fixtures do not cover layout,
  permission prompts, the loading overlay, or real ChatGPT API behavior:
- Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `dist/firefox/manifest.json`
- Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome/`
- On chatgpt.com: export button appears; export a conversation as Markdown + HTML;
  open the HTML (check code blocks, tables, math rendering); test a math-heavy chat
- Check image embedding and permission denial, button drag/reset, the collection overlay,
  and reopening the panel. Record results in the release-specific submission doc.

## 6. Commit & tag
```
git add <the files you changed>   # never -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Capsula vX.Y.Z"
git push --atomic origin main vX.Y.Z
```

Create a GitHub release for that tag using `docs/releases/RELEASE_NOTES_vX.Y.Z.md`, and attach
the Chrome, Firefox, and source zips. Push only the intended tag; preserve earlier releases.

## 7. Firefox (addons.mozilla.org/developers)
My Add-ons → Capsula → **Submit New Version**
1. Upload `capsula-X.Y.Z-firefox.zip`
2. When asked for source code: upload `capsula-X.Y.Z-source.zip`
3. Reviewer notes: "Requires Node.js, no npm deps. Run `node build.js firefox`
   from repo root; `dist/firefox/` matches the submitted zip. content.js is a
   plain concatenation of src/content/*.js — no minification."
4. Release notes: paste from CHANGELOG / store-submission doc

## 8. Chrome (chrome.google.com/webstore/devconsole)
Item → **Package → Upload new package** → `capsula-X.Y.Z-chrome.zip`
- Update description/"what's new" if needed → Submit for review
- (First-time listing: complete the Privacy tab — see store-submission doc)

## 9. After approval
- Confirm the live listing shows the new version
- Firefox auto-updates users; Chrome rolls out within hours
