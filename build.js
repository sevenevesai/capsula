#!/usr/bin/env node

/**
 * Capsula Build Script
 *
 * Packages the extension for Firefox and Chrome distribution.
 * No dependencies required — uses Node.js built-ins only.
 *
 * Usage:
 *   node build.js              # Build both browsers
 *   node build.js firefox      # Build Firefox only
 *   node build.js chrome       # Build Chrome only
 *   node build.js --zip        # Build and create zip archives
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const SHARED_FILES = [
  'background.js',
];

// Content script is assembled from source modules
const CONTENT_SRC_DIR = path.join(ROOT, 'src', 'content');

const SHARED_DIRS = [
  'icons',
];

const MANIFESTS = {
  firefox: 'manifest-firefox.json',
  chrome: 'manifest-chrome.json',
};

// ---------------------------------------------------------------------------

function clean(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function checkVersionConsistency() {
  // The published 1.x builds once shipped with a stale internal version
  // string (3.3.0) in content.js — fail the build if CFG.version and the
  // manifests ever disagree again.
  const configSrc = fs.readFileSync(path.join(CONTENT_SRC_DIR, '01-config.js'), 'utf8');
  const cfgVersion = configSrc.match(/version:\s*'([^']+)'/)?.[1];

  const problems = [];
  if (!cfgVersion) {
    problems.push('CFG.version not found in src/content/01-config.js');
  }
  for (const manifestFile of Object.values(MANIFESTS)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestFile), 'utf8'));
    if (cfgVersion && manifest.version !== cfgVersion) {
      problems.push(`${manifestFile} is ${manifest.version}, CFG.version is ${cfgVersion}`);
    }
  }

  if (problems.length) {
    console.error('Version mismatch:');
    problems.forEach(p => console.error(`  ${p}`));
    process.exit(1);
  }
  console.log(`  Version: ${cfgVersion} (manifests and CFG.version aligned)`);
}

function buildTarget(target) {
  const manifestSrc = path.join(ROOT, MANIFESTS[target]);
  if (!fs.existsSync(manifestSrc)) {
    console.error(`Missing manifest: ${MANIFESTS[target]}`);
    process.exit(1);
  }

  const out = path.join(DIST, target);
  clean(out);
  mkdirp(out);

  // Copy manifest as manifest.json
  copyFile(manifestSrc, path.join(out, 'manifest.json'));

  // Assemble content.js from source modules
  const contentModules = fs.readdirSync(CONTENT_SRC_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
  const contentJs = contentModules
    .map(f => fs.readFileSync(path.join(CONTENT_SRC_DIR, f), 'utf8').replace(/\n$/, ''))
    .join('\n');
  fs.writeFileSync(path.join(out, 'content.js'), contentJs);

  // Copy shared JS files
  for (const file of SHARED_FILES) {
    copyFile(path.join(ROOT, file), path.join(out, file));
  }

  // Copy shared directories
  for (const dir of SHARED_DIRS) {
    copyDir(path.join(ROOT, dir), path.join(out, dir));
  }

  console.log(`  Built: dist/${target}/`);
  return out;
}

// --- Minimal zip writer ---------------------------------------------------
// Store zips must use forward-slash entry names (zip spec, APPNOTE 4.4.17);
// PowerShell's Compress-Archive writes backslashes, which addons.mozilla.org
// fails to unzip (mozilla/addons#290). Writing the zip ourselves keeps the
// build dependency-free and byte-identical across platforms.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: (((date.getFullYear() - 1980) & 0x7F) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function listFilesRecursive(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full, base));
    } else {
      files.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
    }
  }
  return files;
}

function writeZip(srcDir, zipPath) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { full, rel } of listFilesRecursive(srcDir)) {
    const data = fs.readFileSync(full);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const name = Buffer.from(rel, 'utf8');
    const dos = dosDateTime(fs.statSync(full).mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);      // local file header signature
    local.writeUInt16LE(20, 4);              // version needed to extract
    local.writeUInt16LE(0x0800, 6);          // flags: UTF-8 filenames
    local.writeUInt16LE(8, 8);               // compression: deflate
    local.writeUInt16LE(dos.time, 10);
    local.writeUInt16LE(dos.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);              // extra field length

    central.push({ name, crc, csize: compressed.length, usize: data.length, dos, offset });
    chunks.push(local, name, compressed);
    offset += local.length + name.length + compressed.length;
  }

  const cdStart = offset;
  for (const e of central) {
    const hdr = Buffer.alloc(46);            // trailing fields left zero
    hdr.writeUInt32LE(0x02014b50, 0);        // central directory signature
    hdr.writeUInt16LE(20, 4);                // version made by
    hdr.writeUInt16LE(20, 6);                // version needed to extract
    hdr.writeUInt16LE(0x0800, 8);            // flags: UTF-8 filenames
    hdr.writeUInt16LE(8, 10);                // compression: deflate
    hdr.writeUInt16LE(e.dos.time, 12);
    hdr.writeUInt16LE(e.dos.date, 14);
    hdr.writeUInt32LE(e.crc, 16);
    hdr.writeUInt32LE(e.csize, 20);
    hdr.writeUInt32LE(e.usize, 24);
    hdr.writeUInt16LE(e.name.length, 28);
    hdr.writeUInt32LE(e.offset, 42);
    chunks.push(hdr, e.name);
    offset += hdr.length + e.name.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // end of central directory signature
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(offset - cdStart, 12);
  eocd.writeUInt32LE(cdStart, 16);
  chunks.push(eocd);

  fs.writeFileSync(zipPath, Buffer.concat(chunks));
}

function createZip(dir, target) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const zipName = `capsula-${pkg.version}-${target}.zip`;
  const zipPath = path.join(DIST, zipName);
  writeZip(dir, zipPath);
  console.log(`  Zipped: dist/${zipName}`);
}

// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const doZip = args.includes('--zip');
  const targets = args.filter(a => a !== '--zip');

  const buildTargets = targets.length > 0
    ? targets.filter(t => t === 'firefox' || t === 'chrome')
    : ['firefox', 'chrome'];

  if (buildTargets.length === 0) {
    console.error('Usage: node build.js [firefox|chrome] [--zip]');
    process.exit(1);
  }

  console.log('Capsula build');
  console.log('─'.repeat(40));

  checkVersionConsistency();

  for (const target of buildTargets) {
    const outDir = buildTarget(target);
    if (doZip) {
      createZip(outDir, target);
    }
  }

  console.log('─'.repeat(40));
  console.log('Done.');
}

if (require.main === module) {
  main();
}

module.exports = { writeZip };
