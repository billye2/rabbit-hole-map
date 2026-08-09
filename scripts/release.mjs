// Package the extension for the Chrome Web Store (modeled on 10block's flow).
//
//   npm run release          build → verify versions in sync → zip
//
// The zip contains only what the extension needs at runtime: manifest,
// bundles, page HTML, icons. Tests, sources, and marketing stay out.
// Versions are managed separately by scripts/bump.mjs (odometer scheme).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (pkg.version !== manifest.version) {
  console.error(`✗ version drift: package.json ${pkg.version} != manifest.json ${manifest.version}`);
  process.exit(1);
}

execFileSync('node', ['build.mjs'], { stdio: 'inherit' });
mkdirSync('release', { recursive: true });

const out = `release/rabbit-hole-map-${pkg.version}.zip`;
if (existsSync(out)) rmSync(out);
execFileSync(
  'zip',
  [
    '-X',
    out,
    'manifest.json',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
    'dist/background.js',
    'dist/map.js',
    'dist/popup.js',
    'dist/options.js',
    'src/map/map.html',
    'src/popup/popup.html',
    'src/options/options.html',
  ],
  { stdio: 'inherit' }
);
console.log(`\npacked ${out}`);
