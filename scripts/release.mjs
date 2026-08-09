// Cut a Web Store release in two phases (modeled on 10block's flow).
//
//   npm run release                 gates → bump → build → zip → "Release vX" commit → tag vX
//   npm run release:publish         push main + tag → GitHub release with the zip attached
//   npm run release -- --dry-run    run the gates only, change nothing
//   npm run release -- --zip-only   bump/sync/build/zip (no git)
//   npm run release -- --no-bump    re-zip the current version as-is (no git)
//
// Versioning is the odometer scheme from scripts/bump.mjs (0–9 per component,
// carrying) so the Web Store number stays short. The CHANGELOG section for the
// *next* version must exist before cutting (preview the number with
// `npm run bump -- --dry`); that section becomes the GitHub release notes.
//
// The split keeps the remote, irreversible steps (push, gh release) behind an
// explicit second command so the release commit can be reviewed first. Always
// package through this script — it keeps package.json and manifest.json in
// lockstep and guarantees the zip version increases, so the Web Store never
// rejects an upload for a non-incremented version.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { nextVersion } from './bump.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const zipOnly = args.includes('--zip-only');
const noBump = args.includes('--no-bump');
const publish = args.includes('--publish');
const skipGit = zipOnly || noBump;

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// The given version's section: everything between its "## [X.Y.Z]" heading and
// the next "## [" heading (or EOF), trimmed. Null if the heading is missing.
function changelogSection(version) {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const escaped = version.replaceAll('.', '\\.');
  const m = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : null;
}

// ---- Phase 2: publish (push + GitHub release) --------------------------------

if (publish) {
  const version = readJSON('package.json').version;
  const tag = `v${version}`;
  const zip = `release/rabbit-hole-map-${version}.zip`;

  if (!git('tag', '-l', tag)) fail(`tag ${tag} does not exist — run "npm run release" first`);
  if (!existsSync(zip)) fail(`${zip} not found — run "npm run release" first`);
  const notes = changelogSection(version);
  if (!notes) fail(`CHANGELOG.md has no "## [${version}]" section`);
  try {
    git('remote', 'get-url', 'origin');
  } catch {
    fail('no "origin" remote — create a GitHub repo and add it first');
  }
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    fail('gh is not authenticated — run "gh auth login"');
  }
  let exists = false;
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
    exists = true;
  } catch {
    // not found — good
  }
  if (exists) fail(`GitHub release ${tag} already exists`);

  // Push before gh release create so gh finds the tag on the remote
  // (--verify-tag then guarantees it never invents one).
  console.log(`→ pushing main + ${tag}`);
  execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', tag], { stdio: 'inherit' });
  console.log(`→ creating GitHub release ${tag}`);
  execFileSync('gh', ['release', 'create', tag, zip, '--title', tag, '--verify-tag', '--notes-file', '-'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    input: notes,
  });
  console.log(`\n✓ published ${tag} — now upload ${zip} to the Web Store dashboard`);
  process.exit(0);
}

// ---- Phase 1: cut the release -------------------------------------------------

const current = readJSON('package.json').version;
if (readJSON('manifest.json').version !== current) {
  fail(`version drift: package.json ${current} != manifest.json ${readJSON('manifest.json').version}`);
}
const next = noBump || dryRun ? current : nextVersion(current);

if (!skipGit && !dryRun) {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') fail(`releases are cut from main (currently on "${branch}")`);

  if (!changelogSection(next)) {
    fail(`CHANGELOG.md has no "## [${next}]" section — write the changelog entry first`);
  }
  if (git('tag', '-l', `v${next}`)) fail(`tag v${next} already exists`);

  const releaseFiles = ['package.json', 'package-lock.json', 'CHANGELOG.md', 'manifest.json'];
  const dirty = git('status', '--porcelain')
    .split('\n')
    .filter((l) => l && !releaseFiles.includes(l.slice(3)));
  if (dirty.length) {
    console.warn(`⚠ uncommitted changes NOT included in the release commit:\n  ${dirty.join('\n  ')}`);
  }
}

// Gates: a release never ships red.
console.log('→ gates');
execFileSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'lint'], { stdio: 'inherit' });
execFileSync('npm', ['test'], { stdio: 'inherit' });
if (dryRun) {
  console.log('\n✓ gates green (dry run — nothing changed)');
  process.exit(0);
}

const zipPath = `release/rabbit-hole-map-${next}.zip`;
if (existsSync(zipPath)) fail(`${zipPath} already exists`);

// Keep package.json and the manifest on the same version.
if (!noBump) {
  for (const file of ['package.json', 'manifest.json']) {
    const data = readJSON(file);
    data.version = next;
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

console.log(`\n→ packaging v${next}`);
execFileSync('node', ['build.mjs'], { stdio: 'inherit' });
mkdirSync('release', { recursive: true });
// Only what the extension needs at runtime: manifest, bundles, HTML, icons.
execFileSync(
  'zip',
  [
    '-X',
    zipPath,
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
  { stdio: 'inherit' },
);
console.log(`✓ ${zipPath}`);

if (!skipGit) {
  // The zip is a new file — stage it so the pathspec commit can include it.
  execFileSync('git', ['add', zipPath]);
  // Pathspec form so nothing outside these files is swept into the commit
  // (unstaged edits to them ARE included — the CHANGELOG entry is the point).
  execFileSync(
    'git',
    [
      'commit',
      '-m',
      `Release v${next}`,
      '--',
      'package.json',
      'package-lock.json',
      'CHANGELOG.md',
      'manifest.json',
      zipPath,
    ],
    { stdio: 'inherit' },
  );
  // Annotated: lightweight tags silently don't push with --follow-tags.
  execFileSync('git', ['tag', '-a', `v${next}`, '-m', `Release v${next}`], { stdio: 'inherit' });
  console.log(`\n✓ committed + tagged v${next}`);
  console.log('  review the commit, then: npm run release:publish');
}
