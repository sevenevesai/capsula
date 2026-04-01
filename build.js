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
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const SHARED_FILES = [
  'content.js',
  'background.js',
];

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

function createZip(dir, target) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const version = pkg.version;
  const zipName = `capsula-${version}-${target}.zip`;
  const zipPath = path.join(DIST, zipName);

  // Remove existing zip if present
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // Use platform-appropriate zip command
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      execSync(
        `powershell -Command "Compress-Archive -Path '${dir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`cd "${dir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
    }
    console.log(`  Zipped: dist/${zipName}`);
  } catch (e) {
    console.error(`  Warning: Could not create zip for ${target}: ${e.message}`);
  }
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

  for (const target of buildTargets) {
    const outDir = buildTarget(target);
    if (doZip) {
      createZip(outDir, target);
    }
  }

  console.log('─'.repeat(40));
  console.log('Done.');
}

main();
