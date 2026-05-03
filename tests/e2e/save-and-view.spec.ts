// E2E smoke test for the unpacked extension.
//
// This test loads `dist/` as an unpacked extension via
// `chromium.launchPersistentContext` and verifies that:
//   - the extension loads (a service worker shows up),
//   - the new-tab page renders,
//   - the empty-state copy is visible,
//   - no console errors fire during load.
//
// Caveats:
//   - Loading MV3 extensions requires a non-headless Chromium (or the new
//     `--headless=new` mode). On a machine without a display server and
//     without `xvfb-run`, this test cannot run; in that case it is skipped
//     and the full E2E lands in Plan 3.
//   - Driving the toolbar action (the actual save flow) is hard to script
//     and is intentionally deferred to Plan 3. This file is a smoke test.
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXT_PATH = path.resolve(__dirname, '../../dist');
const USER_DATA_DIR = path.resolve(__dirname, '../../.playwright-user');

const hasDisplay = Boolean(process.env.DISPLAY) || process.platform === 'darwin' || process.platform === 'win32';

test.describe('extension smoke', () => {
  test.skip(!hasDisplay, 'No display server available; extension loading requires a head. See Plan 3 for CI E2E.');

  test('new-tab page renders empty state', async () => {
    // Clean any leftover persistent profile to avoid cross-run state.
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }

    const consoleErrors: string[] = [];

    const context: BrowserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false, // extension loading requires a head
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    context.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    context.on('weberror', (err) => {
      consoleErrors.push(err.error().message);
    });

    try {
      // Find the extension service worker so we can derive the extension id.
      let [sw] = context.serviceWorkers();
      if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
      const extensionId = sw.url().split('/')[2];
      expect(extensionId).toBeTruthy();

      // Open the new-tab page directly.
      const newtab = await context.newPage();
      await newtab.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`);

      // Smoke: page loaded at the expected URL.
      expect(newtab.url()).toContain('/src/newtab/newtab.html');

      // Empty-state copy is visible.
      await expect(
        newtab.getByText('No bookmarks yet — click the toolbar icon on any page to save.'),
      ).toBeVisible();

      // No console errors during load.
      expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
