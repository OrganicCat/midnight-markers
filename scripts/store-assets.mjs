/**
 * Generates the Chrome Web Store listing images into release/store/.
 *
 * Two assets are mandatory beyond the 128px icon that ships inside the zip:
 * a 440x280 small promo tile, and at least one 1280x800 screenshot. Both are
 * produced here so the listing can be rebuilt from scratch rather than
 * depending on images someone cropped by hand two months ago.
 *
 * The screenshots drive the real extension through Playwright, which needs a
 * display server — MV3 extensions do not load in old headless Chromium. If
 * there is no display, the promo tile is still written and the screenshot
 * step reports what it skipped instead of failing silently.
 *
 *   npm run store-assets
 */
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'release', 'store');
const PROFILE = path.join(ROOT, '.playwright-store-profile');

mkdirSync(OUT, { recursive: true });

// --- promo tile ----------------------------------------------------------

// Same palette and moon mark as scripts/generate-icons.mjs, so the tile and
// the icon read as one product rather than two.
const TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0e15"/>
      <stop offset="100%" stop-color="#14172a"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b9bff"/>
      <stop offset="100%" stop-color="#bd93f9"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#e8eaf6"/>
      <stop offset="100%" stop-color="#bd93f9"/>
    </linearGradient>
  </defs>
  <rect width="440" height="280" fill="url(#bg)"/>
  <g opacity="0.55">
    <circle cx="360" cy="48" r="1.6" fill="#8b9bff"/>
    <circle cx="404" cy="92" r="1.1" fill="#bd93f9"/>
    <circle cx="330" cy="106" r="1.1" fill="#8b9bff"/>
    <circle cx="58" cy="226" r="1.3" fill="#8b9bff"/>
    <circle cx="106" cy="252" r="1" fill="#bd93f9"/>
    <circle cx="74" cy="62" r="1.2" fill="#bd93f9"/>
    <circle cx="382" cy="232" r="1.2" fill="#8b9bff"/>
  </g>
  <path d="M82 28a46 46 0 1 0 18 75 38 38 0 0 1-18-75z" fill="url(#moon)"
        transform="translate(178 44) scale(0.66) translate(-64 -28)"/>
  <text x="220" y="196" text-anchor="middle" font-family="DejaVu Sans" font-size="30"
        font-weight="bold" fill="url(#ink)">Midnight Markers</text>
  <text x="220" y="224" text-anchor="middle" font-family="DejaVu Sans" font-size="14"
        fill="#8f93b0">A dark, polished bookmark library</text>
  <rect x="203" y="242" width="34" height="3" rx="1.5" fill="#bd93f9"/>
</svg>`;

await sharp(Buffer.from(TILE)).png().toFile(path.join(OUT, 'promo-tile-440x280.png'));
console.log('wrote release/store/promo-tile-440x280.png');

// --- screenshots ---------------------------------------------------------

const hasDisplay =
  Boolean(process.env.DISPLAY) || process.platform === 'darwin' || process.platform === 'win32';

if (!existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('\ndist/ is not built — run `npm run package` first. Skipping screenshots.');
  process.exit(1);
}

if (!hasDisplay) {
  console.warn('\nNo display server (DISPLAY unset) — MV3 extensions cannot load. Skipping screenshots.');
  console.warn('Run this on a desktop session, or install xvfb and re-run under xvfb-run.');
  process.exit(0);
}

/**
 * Demo library written straight into IndexedDB. It has to match the schema in
 * src/lib/storage/db.ts (v3) because we are bypassing the app's own storage
 * layer — the bundled modules are not reachable from the page context.
 */
const SEED = {
  collections: [
    { id: 'c-read', name: 'Reading list', color: '#8b9bff', sortOrder: 0 },
    { id: 'c-design', name: 'Design', color: '#bd93f9', sortOrder: 1 },
    { id: 'c-dev', name: 'Engineering', color: '#6ee7b7', sortOrder: 2 },
    { id: 'c-rust', name: 'Rust', color: '#fbbf24', sortOrder: 3, parentId: 'c-dev' },
  ],
  tags: [
    { id: 't-ref', name: 'reference', count: 7 },
    { id: 't-later', name: 'read-later', count: 4 },
    { id: 't-tools', name: 'tools', count: 4 },
  ],
  bookmarks: [
    ['Type systems, explained without the jargon', 'https://blog.example.com/type-systems', 'c-dev', ['t-ref'], true, false],
    ['The grid systems that shaped modern layout', 'https://design.example.org/grids', 'c-design', ['t-ref'], false, true],
    ['Ownership and borrowing, one more time', 'https://rustnotes.example.dev/ownership', 'c-rust', ['t-ref', 't-later'], true, false],
    ['A field guide to colour contrast', 'https://a11y.example.net/contrast', 'c-design', ['t-tools'], false, false],
    ['Why your build is slow', 'https://perf.example.io/builds', 'c-dev', ['t-tools'], false, true],
    ['Notes on writing plainly', 'https://prose.example.com/plain', 'c-read', ['t-later'], true, false],
    ['Everything about IndexedDB', 'https://web.example.dev/indexeddb', 'c-dev', ['t-ref'], false, false],
    ['The long, strange history of the bookmark', 'https://history.example.org/bookmarks', 'c-read', [], false, true],
    ['Typography for screens, from first principles', 'https://design.example.org/type', 'c-design', ['t-ref'], true, false],
    ['Lifetimes without the hand-waving', 'https://rustnotes.example.dev/lifetimes', 'c-rust', ['t-later'], false, true],
    ['A short history of the service worker', 'https://web.example.dev/sw', 'c-dev', [], false, false],
    ['Dark mode is harder than it looks', 'https://design.example.org/dark', 'c-design', ['t-tools'], true, false],
    ['How search ranking actually works', 'https://search.example.io/ranking', 'c-dev', ['t-ref'], false, false],
    ['The case for smaller dependencies', 'https://prose.example.com/deps', 'c-read', ['t-later'], false, true],
    ['Colour palettes that survive contrast checks', 'https://a11y.example.net/palettes', 'c-design', ['t-tools'], false, false],
    ['Writing documentation people read', 'https://prose.example.com/docs', 'c-read', ['t-ref'], true, false],
  ],
};

/**
 * Card thumbnails. Real saved pages carry an og:image; the demo library has
 * none, and a grid of empty grey rectangles undersells the product. These are
 * generated gradients in the extension's own palette, inlined as data URIs
 * because thumbnailUrl is rendered straight into an <img src>.
 */
const THUMB_PAIRS = [
  ['#1b2040', '#3b2f63'],
  ['#16233a', '#2b4a63'],
  ['#231a3a', '#4a3170'],
  ['#14202b', '#2a4a45'],
  ['#241d2e', '#5a3a55'],
  ['#1a1f33', '#39406e'],
];

async function gradientThumb([from, to], i) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="320" height="180" fill="url(#g)"/>
    <circle cx="${240 + (i % 3) * 18}" cy="${46 + (i % 2) * 20}" r="${20 + (i % 3) * 6}"
            fill="#8b9bff" opacity="0.16"/>
    <circle cx="${70 + (i % 4) * 14}" cy="${138 - (i % 3) * 12}" r="${26 + (i % 2) * 10}"
            fill="#bd93f9" opacity="0.13"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

SEED.thumbs = await Promise.all(
  SEED.bookmarks.map((_, i) => gradientThumb(THUMB_PAIRS[i % THUMB_PAIRS.length], i)),
);

function seedScript(seed) {
  return `(async () => {
    const now = Date.now();
    const open = indexedDB.open('midnight-markers', 3);
    const db = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
    });
    const seed = ${JSON.stringify(seed)};
    const tx = db.transaction(['bookmarks', 'collections', 'tags', 'settings'], 'readwrite');
    for (const c of seed.collections) {
      tx.objectStore('collections').put({
        parentId: null, createdAt: now, ...c,
      });
    }
    for (const t of seed.tags) tx.objectStore('tags').put(t);
    seed.bookmarks.forEach(([title, url, collectionId, tagIds, starred, unread], i) => {
      const domain = new URL(url).hostname;
      tx.objectStore('bookmarks').put({
        id: 'b-' + i,
        url, title, originalTitle: title, domain,
        faviconUrl: null, thumbnailUrl: seed.thumbs[i],
        description: 'A short standing description used for the store screenshot.',
        excerpt: null,
        collectionId, tagIds, starred, unread,
        note: null,
        createdAt: now - i * 3600_000,
        updatedAt: now - i * 3600_000,
        lastCheckedAt: null, isBroken: false,
      });
    });
    // tourSeenAt must be set or the guided tour spotlight covers the shot.
    tx.objectStore('settings').put({
      aiProvider: 'openrouter',
      openrouterKey: null, openrouterModel: 'anthropic/claude-sonnet-4.5',
      anthropicKey: null, anthropicModel: 'claude-sonnet-4-5',
      aiFeatures: { tags: true, title: true, collection: true },
      aiConsentAt: null,
      defaultView: 'grid',
      defaultCollectionId: null,
      uiScale: 1,
      tourSeenAt: now,
    }, 'singleton');
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  })()`;
}

rmSync(PROFILE, { recursive: true, force: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const shots = [];
try {
  // The service worker registration is what tells us the extension's ID.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  const extId = new URL(sw.url()).host;
  console.log(`extension id: ${extId}`);

  const page = await context.newPage();
  const newtab = `chrome-extension://${extId}/src/newtab/newtab.html`;

  await page.goto(newtab);
  await page.evaluate(seedScript(SEED));
  await page.goto(newtab);
  await page.waitForTimeout(1200);

  async function shot(name) {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    shots.push(name);
    console.log(`wrote release/store/${name}.png`);
  }

  await shot('screenshot-1-library-grid');

  // List view — keyboard shortcut 2, per the README's shortcut table.
  await page.keyboard.press('2');
  await page.waitForTimeout(600);
  await shot('screenshot-2-list-view');

  // Search overlay.
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  await page.keyboard.type('design', { delay: 60 });
  await page.waitForTimeout(700);
  await shot('screenshot-3-search');
  await page.keyboard.press('Escape');

  // Settings page.
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extId}/src/settings/settings.html`);
  await settings.waitForTimeout(900);
  await settings.screenshot({ path: path.join(OUT, 'screenshot-4-settings.png') });
  shots.push('screenshot-4-settings');
  console.log('wrote release/store/screenshot-4-settings.png');
} finally {
  await context.close();
  rmSync(PROFILE, { recursive: true, force: true });
}

// Every screenshot must be exactly 1280x800 or the store rejects it.
for (const name of shots) {
  const file = path.join(OUT, `${name}.png`);
  const { width, height } = await sharp(file).metadata();
  if (width !== 1280 || height !== 800) {
    console.error(`${name}.png is ${width}x${height}, expected 1280x800`);
    process.exitCode = 1;
  }
}

writeFileSync(
  path.join(OUT, 'README.txt'),
  [
    'Chrome Web Store listing assets — regenerate with `npm run store-assets`.',
    '',
    'promo-tile-440x280.png   small promo tile (mandatory)',
    ...shots.map((s) => `${s}.png   screenshot 1280x800`),
    '',
    'Upload at https://chrome.google.com/webstore/devconsole',
  ].join('\n'),
);

console.log(`\n${shots.length} screenshot(s) + promo tile in release/store/`);
