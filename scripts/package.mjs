/**
 * Builds the store upload archives — one for the Chrome Web Store, one for
 * addons.mozilla.org.
 *
 * Both stores take a zip, not a signed package — Google signs the crx and
 * Mozilla signs the xpi on their side. The archive must have manifest.json at
 * its root, not nested inside a folder, which is the most common reason an
 * upload is rejected outright.
 *
 * Everything here is checked before a zip is written. A packaging script that
 * produces a subtly broken archive is worse than one that refuses to produce
 * anything, because you don't find out until the dashboard says no.
 *
 *   npm run package            # both browsers
 *   npm run package chrome     # just one
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = path.join(ROOT, 'release');

/** Characters that are illegal in a filename on Windows. */
const ILLEGAL = /[:?*<>|"]/;

const REQUIRED_ICONS = ['16', '32', '48', '128'].map((s) => `icons/icon-${s}.png`);

/**
 * The two builds differ only in their manifest, but they differ in ways each
 * store will reject the other's for. Chrome runs the background script as a
 * service worker; Firefox has never shipped one for extensions and uses an
 * event page instead. Firefox also needs a stable add-on ID to publish under.
 */
const TARGETS = [
  {
    browser: 'chrome',
    dist: 'dist',
    store: 'https://chrome.google.com/webstore/devconsole',
    checkManifest(manifest, check) {
      check(
        Boolean(manifest.background?.service_worker),
        'chrome build is missing background.service_worker',
      );
      check(
        !manifest.background?.scripts,
        'chrome build has background.scripts, which Chrome does not support in MV3',
      );
    },
  },
  {
    browser: 'firefox',
    dist: 'dist-firefox',
    store: 'https://addons.mozilla.org/developers/addon/submit/distribution',
    checkManifest(manifest, check) {
      check(
        Array.isArray(manifest.background?.scripts) && manifest.background.scripts.length > 0,
        'firefox build is missing background.scripts',
      );
      check(
        !manifest.background?.service_worker,
        'firefox build still has background.service_worker, which Firefox does not support',
      );
      check(
        Boolean(manifest.browser_specific_settings?.gecko?.id),
        'firefox build is missing browser_specific_settings.gecko.id, which AMO requires to publish',
      );
    },
  },
];

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

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

const requested = process.argv.slice(2);
const targets = requested.length ? TARGETS.filter((t) => requested.includes(t.browser)) : TARGETS;

if (targets.length === 0) {
  console.error(`unknown target(s): ${requested.join(', ')} — expected chrome and/or firefox`);
  process.exit(1);
}

mkdirSync(RELEASE, { recursive: true });

const written = [];

for (const target of targets) {
  console.log(`\npackaging midnight-markers ${version} for ${target.browser}`);

  const DIST = path.join(ROOT, target.dist);
  const problems = [];
  const check = (ok, message) => {
    if (!ok) problems.push(message);
  };

  // --- build -------------------------------------------------------------

  rmSync(DIST, { recursive: true, force: true });
  run('npm', ['run', 'build:release'], {
    env: { ...process.env, TARGET: target.browser },
  });

  // --- verify ------------------------------------------------------------

  const manifestPath = path.join(DIST, 'manifest.json');
  check(existsSync(manifestPath), `${target.dist}/manifest.json is missing`);

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    check(
      manifest.version === version,
      `manifest version ${manifest.version} does not match package.json ${version}`,
    );
    check(manifest.manifest_version === 3, 'manifest_version must be 3');
    check(Boolean(manifest.icons?.['128']), 'manifest is missing the 128px icon the store requires');
    check(
      !JSON.stringify(manifest).includes('{{'),
      'a browser-tagged manifest key survived into the build — check the {{chrome}}/{{firefox}} prefixes',
    );
    target.checkManifest(manifest, check);
  }

  const files = existsSync(DIST) ? walk(DIST) : [];
  check(files.length > 0, `${target.dist}/ is empty`);

  for (const icon of REQUIRED_ICONS) {
    check(files.includes(icon), `missing required icon: ${icon}`);
  }

  for (const f of files) {
    // Chrome reserves the leading underscore for its own use and refuses to
    // load any extension containing one, at any depth. Firefox doesn't care,
    // but both builds come out of the same Rollup config, so both get checked.
    const underscored = f.split('/').find((seg) => seg.startsWith('_'));
    check(!underscored, `reserved underscore-prefixed path: ${f}`);
    check(!ILLEGAL.test(f), `filename is illegal on Windows: ${f}`);
    check(!f.endsWith('.map'), `sourcemap leaked into the release build: ${f}`);
  }

  if (problems.length > 0) {
    console.error(`\nrefusing to package ${target.browser} — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  // --- zip ---------------------------------------------------------------

  const zipPath = path.join(RELEASE, `midnight-markers-${version}-${target.browser}.zip`);
  rmSync(zipPath, { force: true });

  // Zipped from inside the dist dir so that manifest.json lands at the archive
  // root. -X drops platform extra-attribute blocks, keeping it reproducible.
  run('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: DIST });

  const size = statSync(zipPath).size;
  written.push({ ...target, zipPath, size, count: files.length });

  // --- source archive ----------------------------------------------------

  /**
   * AMO requires the original source for any extension built with a bundler,
   * and rejects submissions without it. `git archive` is the right tool: it
   * ships exactly what is committed, so a reviewer rebuilding from it gets
   * the same output. Anything uncommitted would not be reproducible anyway.
   */
  if (target.browser === 'firefox') {
    const sourcePath = path.join(RELEASE, `midnight-markers-${version}-source.zip`);
    rmSync(sourcePath, { force: true });
    try {
      run('git', ['archive', '--format=zip', '-o', sourcePath, 'HEAD']);
      written.push({
        browser: 'firefox source',
        zipPath: sourcePath,
        size: statSync(sourcePath).size,
        count: 0,
        store: 'the "Source code" upload on the AMO submission form',
      });
    } catch {
      console.error('could not run `git archive` — upload the source to AMO by hand');
    }
  }
}

console.log('');
for (const w of written) {
  const detail = w.count ? `, ${w.count} files` : '';
  console.log(`wrote ${path.relative(ROOT, w.zipPath)} (${(w.size / 1024).toFixed(0)} KB${detail})`);
  console.log(`  upload at ${w.store}`);
}
