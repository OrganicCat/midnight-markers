// E2E for the guided tour and the Help panel, against the real unpacked
// extension. Same head-required caveat as save-and-view.spec.ts.
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXT_PATH = path.resolve(__dirname, '../../dist');
const USER_DATA_DIR = path.resolve(__dirname, '../../.playwright-user-tour');

const hasDisplay =
  Boolean(process.env.DISPLAY) || process.platform === 'darwin' || process.platform === 'win32';

test.describe('guided tour', () => {
  test.skip(!hasDisplay, 'No display server available; extension loading requires a head.');

  let context: BrowserContext;
  let extensionId: string;

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
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('runs on first visit, then never again', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`);

    // First run: the overlay appears unprompted.
    const overlay = page.locator('[data-tour-overlay]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Welcome to midnight')).toBeVisible();

    // Step forward, then back.
    await page.locator('[data-tour-next]').click();
    await expect(page.getByText('Your library, filtered')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Welcome to midnight')).toBeVisible();

    // Skip closes it and records that it has been seen.
    await page.locator('[data-tour-skip]').click();
    await expect(overlay).toBeHidden();

    // Reload: it must not come back.
    await page.reload();
    await page.waitForTimeout(1_000);
    await expect(overlay).toBeHidden();

    // But the Help button reopens it on demand.
    await page.getByRole('button', { name: 'Help' }).click();
    await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible();
    await page.locator('[data-tour-replay]').click();
    await expect(overlay).toBeVisible();
    await expect(page.getByText('Welcome to midnight')).toBeVisible();

    // Esc closes the tour.
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    await page.close();
  });
});
