// E2E for keyboard navigation on the new-tab page, against the real unpacked
// extension. Same head-required caveat as save-and-view.spec.ts.
//
// The point of doing this end-to-end rather than in jsdom: the behaviours that
// matter here — Enter reaching the page while the search box has focus, a new
// tab actually opening, the grid's column count — only exist in a real browser.
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXT_PATH = path.resolve(__dirname, '../../dist');
const USER_DATA_DIR = path.resolve(__dirname, '../../.playwright-user-keys');

const hasDisplay =
  Boolean(process.env.DISPLAY) || process.platform === 'darwin' || process.platform === 'win32';

/** Bookmarks and one folder, written straight into IndexedDB before the app boots. */
async function seed(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const open = indexedDB.open('midnight-markers', 3);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onupgradeneeded = () => {
        const d = open.result;
        const bm = d.createObjectStore('bookmarks', { keyPath: 'id' });
        bm.createIndex('by-collection', 'collectionId');
        bm.createIndex('by-domain', 'domain');
        bm.createIndex('by-createdAt', 'createdAt');
        bm.createIndex('by-starred', 'starred');
        bm.createIndex('by-unread', 'unread');
        bm.createIndex('by-isBroken', 'isBroken');
        const col = d.createObjectStore('collections', { keyPath: 'id' });
        col.createIndex('by-parent', 'parentId');
        const tags = d.createObjectStore('tags', { keyPath: 'id' });
        tags.createIndex('by-name', 'name', { unique: true });
        d.createObjectStore('settings');
        d.createObjectStore('snapshots', { keyPath: 'id' });
        d.createObjectStore('secrets');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });

    const bookmark = (id: string, title: string, collectionId: string | null, createdAt: number) => ({
      id,
      url: `https://example.com/${id}`,
      title,
      originalTitle: title,
      domain: 'example.com',
      faviconUrl: null,
      thumbnailUrl: null,
      description: null,
      excerpt: null,
      collectionId,
      tagIds: [],
      starred: false,
      unread: false,
      note: null,
      createdAt,
      updatedAt: createdAt,
      lastCheckedAt: null,
      isBroken: false,
    });

    const tx = db.transaction(['bookmarks', 'collections', 'settings'], 'readwrite');
    // Newest first is the sort order, so createdAt fixes the on-screen order.
    tx.objectStore('bookmarks').put(bookmark('b1', 'Alpha page', 'tools', 3));
    tx.objectStore('bookmarks').put(bookmark('b2', 'Beta page', 'tools', 2));
    tx.objectStore('bookmarks').put(bookmark('b3', 'Gamma page', null, 1));
    tx.objectStore('collections').put({
      id: 'tools',
      name: 'Tools',
      parentId: null,
      color: '#8b5cf6',
      sortOrder: 0,
      createdAt: 0,
    });
    // tourSeenAt keeps the first-run walkthrough from eating the keyboard.
    tx.objectStore('settings').put({ defaultView: 'list', tourSeenAt: 1, uiScale: 1 }, 'singleton');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

test.describe('keyboard navigation', () => {
  test.skip(!hasDisplay, 'No display server available; extension loading requires a head.');

  let context: BrowserContext;
  let extensionId: string;
  let page: Page;

  test.beforeAll(async () => {
    if (fs.existsSync(USER_DATA_DIR)) fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    extensionId = sw.url().split('/')[2]!;

    // Seed on a first load, then reload so the app reads the seeded database.
    page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`);
    await seed(page);
    await page.reload();
    await expect(page.getByText('Alpha page')).toBeVisible({ timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  const selected = () => page.locator('[aria-selected="true"]');

  /**
   * Put the page in list view with nothing focused. Done through the UI rather
   * than a seeded `defaultView`, because the app rewrites its settings on load
   * and would race the seed.
   */
  async function useListView(): Promise<void> {
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.locator('[role="tree"]')).toBeVisible();
    await page.locator('h1').click();
  }

  test('arrows walk the tree and Enter folds the folder under the cursor', async () => {
    await useListView();
    // The cursor starts on the first row, which is the folder.
    await expect(selected()).toHaveAttribute('aria-label', 'Tools, 2 bookmarks');

    // Enter shuts it; its bookmarks leave the tree.
    await page.keyboard.press('Enter');
    await expect(page.getByText('Alpha page')).toBeHidden();
    await expect(selected()).toHaveAttribute('aria-expanded', 'false');

    // Enter opens it again.
    await page.keyboard.press('Enter');
    await expect(page.getByText('Alpha page')).toBeVisible();

    // Right and Left fold too, and won't flap a folder already that way.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Alpha page')).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(selected()).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Alpha page')).toBeVisible();

    // Down walks off the folder onto the bookmarks beneath it.
    await page.keyboard.press('ArrowDown');
    await expect(selected()).toContainText('Alpha page');
    await page.keyboard.press('ArrowDown');
    await expect(selected()).toContainText('Beta page');
    await page.keyboard.press('ArrowUp');
    await expect(selected()).toContainText('Alpha page');
  });

  test('the search box hands back the arrows and Enter', async () => {
    await useListView();
    await page.locator('[data-search-input]').click();
    await page.keyboard.type('page');

    // Typing does not move the caret out of the box.
    await expect(page.locator('[data-search-input]')).toBeFocused();

    // Down moves the cursor through the results without leaving the box.
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-search-input]')).toBeFocused();
    const first = await selected().textContent();
    await page.keyboard.press('ArrowDown');
    expect(await selected().textContent()).not.toBe(first);

    // Enter opens the selected bookmark in a new tab.
    const opened = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const tab = await opened;
    expect(tab.url()).toContain('example.com/');
    await tab.close();
  });

  test('Escape clears the query, then leaves the box', async () => {
    await useListView();
    await page.locator('[data-search-input]').fill('');
    await page.locator('[data-search-input]').click();
    await page.keyboard.type('alpha');
    await expect(page.locator('[data-search-input]')).toHaveValue('alpha');

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-search-input]')).toHaveValue('');
    await expect(page.locator('[data-search-input]')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-search-input]')).not.toBeFocused();
  });

  test('the grid moves a card sideways and a whole row vertically', async () => {
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.locator('[data-bookmark-grid]')).toBeVisible();

    const cursor = page.locator('[data-nav-key].ring-2');
    const columns = await page.locator('[data-bookmark-grid]').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
    );
    expect(columns).toBeGreaterThan(1);

    // Newest first, so the seeded order across the row is b1, b2, b3.
    await expect(cursor).toHaveAttribute('data-nav-key', 'b1');
    await page.keyboard.press('ArrowRight');
    await expect(cursor).toHaveAttribute('data-nav-key', 'b2');
    await page.keyboard.press('ArrowLeft');
    await expect(cursor).toHaveAttribute('data-nav-key', 'b1');

    // Down jumps a whole row. All three cards fit on one row at this width,
    // so there is no row below and the cursor stops at the last card rather
    // than stepping sideways onto the next one.
    expect(columns).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('ArrowDown');
    await expect(cursor).toHaveAttribute('data-nav-key', 'b3');
  });
});
