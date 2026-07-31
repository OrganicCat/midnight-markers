/**
 * Builds a Chrome Web Store upload archive.
 *
 * The store takes a zip, not a crx — Google signs the crx on their side. The
 * archive must have manifest.json at its root, not nested inside a folder,
 * which is the most common reason an upload is rejected outright.
 *
 * Everything here is checked before the zip is written. A packaging script
 * that produces a subtly broken archive is worse than one that refuses to
 * produce anything, because you don't find out until the dashboard says no.
 *
 *   npm run package
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');

/** Characters that are illegal in a filename on Windows. */
const ILLEGAL = /[:?*<>|"]/;

const REQUIRED_ICONS = ['16', '32', '48', '128'].map((s) => `icons/icon-${s}.png`);

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
}

/** Every file under `dir`, as paths relative to it, using forward slashes. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(rel);
  }
  return out;
}

const problems = [];
function check(ok, message) {
  if (!ok) problems.push(message);
}

// --- build ---------------------------------------------------------------

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

console.log(`packaging midnight-markers ${version}`);

rmSync(DIST, { recursive: true, force: true });
run('npm', ['run', 'build:release']);

// --- verify --------------------------------------------------------------

check(existsSync(path.join(DIST, 'manifest.json')), 'dist/manifest.json is missing');

if (existsSync(path.join(DIST, 'manifest.json'))) {
  const manifest = JSON.parse(readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  check(
    manifest.version === version,
    `manifest version ${manifest.version} does not match package.json ${version}`,
  );
  check(manifest.manifest_version === 3, 'manifest_version must be 3');
  check(Boolean(manifest.icons?.['128']), 'manifest is missing the 128px icon the store requires');
}

const files = walk(DIST);
check(files.length > 0, 'dist/ is empty');

for (const icon of REQUIRED_ICONS) {
  check(files.includes(icon), `missing required icon: ${icon}`);
}

for (const f of files) {
  // Chrome reserves the leading underscore for its own use and refuses to
  // load any extension containing one, at any depth.
  const underscored = f.split('/').find((seg) => seg.startsWith('_'));
  check(!underscored, `reserved underscore-prefixed path: ${f}`);
  check(!ILLEGAL.test(f), `filename is illegal on Windows: ${f}`);
  check(!f.endsWith('.map'), `sourcemap leaked into the release build: ${f}`);
}

if (problems.length > 0) {
  console.error(`\nrefusing to package — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// --- zip -----------------------------------------------------------------

mkdirSync(RELEASE, { recursive: true });
const zipPath = path.join(RELEASE, `midnight-markers-${version}.zip`);
rmSync(zipPath, { force: true });

// Zipped from inside dist/ so that manifest.json lands at the archive root.
// -X drops platform extra-attribute blocks, keeping the archive reproducible.
run('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: DIST });

const size = statSync(zipPath).size;
console.log(`\nwrote ${path.relative(ROOT, zipPath)} (${(size / 1024).toFixed(0)} KB, ${files.length} files)`);
console.log('upload this zip at https://chrome.google.com/webstore/devconsole');
