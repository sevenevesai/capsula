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

## 3. Build
```
node build.js --zip
```
→ `dist/capsula-X.Y.Z-firefox.zip` and `dist/capsula-X.Y.Z-chrome.zip`

## 4. Source zip (AMO requires it — content.js is machine-generated)
```powershell
$stage = Join-Path $env:TEMP 'capsula-src-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item src $stage\src -Recurse; Copy-Item icons $stage\icons -Recurse
'build.js','background.js','manifest-firefox.json','manifest-chrome.json',
'README.md','CHANGELOG.md','PRIVACY.md','LICENSE' | ForEach-Object { Copy-Item $_ $stage }
node -e "const {writeZip}=require('./build.js'); writeZip(process.env.TEMP+'/capsula-src-stage','./dist/capsula-X.Y.Z-source.zip')"
Remove-Item $stage -Recurse -Force
```

## 5. Manual QA (no test suite — this is the gate)
- Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `dist/firefox/manifest.json`
- Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome/`
- On chatgpt.com: export button appears; export a conversation as Markdown + HTML;
  open the HTML (check code blocks, tables, math rendering); test a math-heavy chat

## 6. Commit & tag
```
git add <the files you changed>   # never -A
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

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
