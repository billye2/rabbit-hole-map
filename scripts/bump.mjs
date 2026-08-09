// Version bump with digit-style carry: each segment caps at 9 and rolls
// over into the next, like an odometer. 1.1.9 -> 1.2.0, 1.9.9 -> 2.0.0.
// Keeps package.json and manifest.json in sync.
//
// Usage: node scripts/bump.mjs          (bump once and rewrite both files)
//        node scripts/bump.mjs 1.2.2    (jump straight to a specific version)
//        node scripts/bump.mjs --dry    (print what would happen)
import { readFileSync, writeFileSync } from 'node:fs';

export function assertValid(version) {
  const parts = version.split('.').map(Number);
  const [maj, min, pat] = parts;
  const digit = (n) => Number.isInteger(n) && n >= 0 && n <= 9;
  if (parts.length !== 3 || !Number.isInteger(maj) || maj < 0 || !digit(min) || !digit(pat)) {
    throw new Error(`not a valid odometer version: "${version}" (minor/patch are digits 0-9)`);
  }
  return parts;
}

export function nextVersion(version) {
  let [major, minor, patch] = assertValid(version);
  patch++;
  if (patch > 9) {
    patch = 0;
    minor++;
  }
  if (minor > 9) {
    minor = 0;
    major++;
  }
  return `${major}.${minor}.${patch}`;
}

function bumpFile(path, version) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

if (process.argv[1].endsWith('bump.mjs') && !process.env.NODE_TEST_CONTEXT) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  if (pkg.version !== manifest.version) {
    console.error(`version drift: package.json ${pkg.version} != manifest.json ${manifest.version}`);
    process.exit(1);
  }
  const explicit = process.argv.slice(2).find((a) => !a.startsWith('--'));
  let next;
  if (explicit) {
    assertValid(explicit);
    next = explicit;
  } else {
    next = nextVersion(pkg.version);
  }
  if (process.argv.includes('--dry')) {
    console.log(`${pkg.version} -> ${next} (dry run)`);
  } else {
    bumpFile('package.json', next);
    bumpFile('manifest.json', next);
    console.log(`${pkg.version} -> ${next}`);
  }
}
