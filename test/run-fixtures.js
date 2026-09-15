#!/usr/bin/env node
/**
 * Fixture regression runner.
 *
 * Feeds captured ChatGPT DOM snapshots through the DOM harvester and captured
 * conversation JSON through the API normalizer, exports each as Markdown, and
 * compares against the golden files in test/golden/.
 *
 *   node test/run-fixtures.js            compare; exit 1 on any difference
 *   node test/run-fixtures.js --update   rewrite the goldens from current output
 *   node test/run-fixtures.js --only x   run fixtures whose name contains "x"
 *
 * Requires `npm install` once (jsdom is the only dev dependency) and a fresh
 * `node build.js firefox`. Only content extraction is exercised: the scroll
 * sweep, curtain and button placement need a real layout engine.
 *
 * Fixture kinds, by extension in test/fixtures/:
 *   .html  a page or turn snapshot (outerHTML fragments are fine)
 *   .json  a /backend-api/conversation/<id> payload
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (_) {
  console.error('jsdom is not installed. Run: npm install');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'firefox', 'content.js');
const FIXTURES = path.join(__dirname, 'fixtures');
const GOLDEN = path.join(__dirname, 'golden');

const args = process.argv.slice(2);
const update = args.includes('--update');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

if (!fs.existsSync(BUNDLE)) {
  console.error('Bundle missing. Run: node build.js firefox');
  process.exit(2);
}
const bundle = fs.readFileSync(BUNDLE, 'utf8');

// The bundle bootstraps only on chatgpt.com (CFG.urlGuard), so on this origin
// it defines its modules and mounts nothing.
function loadExtension(html) {
  const dom = new JSDOM(html, {
    url: 'https://fixtures.invalid/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!('innerText' in window.Element.prototype)) {
    Object.defineProperty(window.Element.prototype, 'innerText', {
      get() { return this.textContent; }
    });
  }
  const context = dom.getInternalVMContext();
  new vm.Script(bundle, { filename: 'content.js' }).runInContext(context);
  // Top-level consts live in the context's global lexical scope, not on window
  const api = vm.runInContext(
    '({ Harvester, ExportManager, ConversationApi, MarkdownBlocks, globalState })',
    context
  );
  return { window, api };
}

const META = { title: 'Fixture', url: 'https://fixtures.invalid/', model: null, exported_at: '2026-01-01T00:00:00.000Z' };

function renderDomFixture(file) {
  const html = fs.readFileSync(file, 'utf8');
  const { api } = loadExtension(html);
  const messages = api.Harvester.collectAllMessages();
  const meta = { ...META, model: api.Harvester.detectModel() };
  return { messages, markdown: api.ExportManager.toMarkdown(messages, meta), tier: api.Harvester.lastTurnStrategy };
}

function renderApiFixture(file) {
  const conv = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { api } = loadExtension('<!doctype html><title>fixture</title>');
  const messages = api.ConversationApi.messagesFromConversation(conv);
  const meta = { ...META, model: conv.default_model_slug || null };
  return { messages, markdown: api.ExportManager.toMarkdown(messages, meta), tier: 'api' };
}

// Locale/timezone-dependent and clock-dependent lines must not reach a golden
function stabilize(markdown) {
  return markdown
    .split('\n')
    .filter(line => !/^\*\*Exported\*\*:/.test(line))
    .join('\n')
    .replace(/\s+$/, '') + '\n';
}

function summarize(messages) {
  const kinds = {};
  messages.forEach(m => (m.blocks || []).forEach(b => { kinds[b.kind] = (kinds[b.kind] || 0) + 1; }));
  const roles = messages.reduce((acc, m) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {});
  return `${messages.length} messages (${Object.entries(roles).map(([r, n]) => `${n} ${r}`).join(', ')}); blocks: ` +
    (Object.entries(kinds).map(([k, n]) => `${k}=${n}`).join(' ') || 'none');
}

function firstDifference(expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const limit = Math.max(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 2);
      const show = (lines, tag) => lines.slice(from, i + 3).map((l, j) => `  ${tag} ${from + j + 1}: ${l === undefined ? '<eof>' : l}`).join('\n');
      return `line ${i + 1}\n${show(a, 'golden ')}\n${show(b, 'actual ')}`;
    }
  }
  return 'trailing content';
}

fs.mkdirSync(GOLDEN, { recursive: true });
const fixtures = fs.readdirSync(FIXTURES)
  .filter(f => /\.(html|json)$/.test(f))
  .filter(f => !only || f.includes(only))
  .sort();

if (fixtures.length === 0) {
  console.error('No fixtures found in', FIXTURES);
  process.exit(2);
}

let failures = 0;
for (const name of fixtures) {
  const file = path.join(FIXTURES, name);
  const goldenFile = path.join(GOLDEN, name.replace(/\.(html|json)$/, '.md'));
  let result;
  try {
    result = name.endsWith('.json') ? renderApiFixture(file) : renderDomFixture(file);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
    continue;
  }
  const actual = stabilize(result.markdown);
  const info = `${summarize(result.messages)}; selector tier: ${result.tier}`;

  if (update || !fs.existsSync(goldenFile)) {
    fs.writeFileSync(goldenFile, actual, 'utf8');
    console.log(`WROTE ${name}: ${info}`);
    continue;
  }
  const expected = fs.readFileSync(goldenFile, 'utf8').replace(/\r\n/g, '\n');
  if (expected === actual) {
    console.log(`ok    ${name}: ${info}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}: ${info}\n  differs at ${firstDifference(expected, actual)}`);
  }
}

if (failures) {
  console.log(`\n${failures} fixture(s) differ. Inspect, then rerun with --update if the new output is right.`);
  process.exit(1);
}
console.log(`\nAll ${fixtures.length} fixtures match.`);
