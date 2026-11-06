import { ext } from '$lib/ext';
import { getDb } from '$lib/storage/db';
import { storageEvents } from '$lib/storage/events';
import { BOOKMARKS_CHANGED_MESSAGE, normalizeUrl, savedIconEnabled } from '$lib/savedIcon';

/**
 * Swaps the toolbar icon for one with a small "B" badge on any tab whose page
 * is already in the library. Opt-in: it only runs while the optional `tabs`
 * permission is granted.
 *
 * Paths start with a slash so they resolve from the extension root in both
 * Chrome (which fetches them relative to the service worker's URL) and
 * Firefox (relative to the background page).
 */
const DEFAULT_ICON = { 16: '/icons/icon-16.png', 32: '/icons/icon-32.png' };
const SAVED_ICON = { 16: '/icons/icon-saved-16.png', 32: '/icons/icon-saved-32.png' };
const DEFAULT_TITLE = 'Save to midnight-markers';
const SAVED_TITLE = 'Already saved to midnight-markers';

/**
 * Normalized URLs of every saved bookmark. Rebuilt lazily after a library
 * change, so a burst of edits (an import, a resort) costs one read. A
 * terminated service worker simply starts with an empty cache.
 */
let savedUrls: Promise<Set<string>> | null = null;

function loadSavedUrls(): Promise<Set<string>> {
  if (!savedUrls) {
    const load = (async () => {
      const db = await getDb();
      const all = await db.getAll('bookmarks');
      const set = new Set<string>();
      for (const b of all) {
        const n = normalizeUrl(b.url);
        if (n) set.add(n);
      }
      return set;
    })();
    savedUrls = load;
    // A failed read shouldn't stick; the next lookup retries.
    load.catch(() => {
      if (savedUrls === load) savedUrls = null;
    });
  }
  return savedUrls;
}

export async function isSaved(url: string | undefined): Promise<boolean> {
  const n = normalizeUrl(url);
  if (!n) return false;
  return (await loadSavedUrls()).has(n);
}

async function paint(tabId: number, saved: boolean): Promise<void> {
  try {
    await ext.action.setIcon({ tabId, path: saved ? SAVED_ICON : DEFAULT_ICON });
    await ext.action.setTitle({ tabId, title: saved ? SAVED_TITLE : DEFAULT_TITLE });
  } catch {
    // The tab closed between the lookup and the paint. Nothing to do.
  }
}

export async function refreshTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  await paint(tab.id, await isSaved(tab.url));
}

export async function refreshAllTabs(): Promise<void> {
  if (!(await savedIconEnabled())) return;
  const tabs = await ext.tabs.query({});
  await Promise.all(tabs.map(refreshTab));
}

/** Puts the plain icon back on every tab. Used when the feature is turned off. */
export async function resetAllTabs(): Promise<void> {
  const tabs = await ext.tabs.query({});
  await Promise.all(tabs.map((t) => (t.id === undefined ? undefined : paint(t.id, false))));
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Coalesces a burst of library changes into one cache rebuild and repaint. */
export function onLibraryChanged(delayMs = 150): void {
  savedUrls = null;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void refreshAllTabs();
  }, delayMs);
}

export function _resetSavedIconForTests(): void {
  savedUrls = null;
  if (pending) clearTimeout(pending);
  pending = null;
}

function grantsTabs(p: chrome.permissions.Permissions): boolean {
  return p.permissions?.includes('tabs') ?? false;
}

export function registerSavedIcon(): void {
  ext.tabs.onUpdated.addListener(async (_tabId, change, tab) => {
    // Firefox resets a tab's custom icon when it navigates, so repaint once
    // the new page has loaded as well as when the URL changes.
    if (change.url === undefined && change.status !== 'complete') return;
    if (!(await savedIconEnabled())) return;
    await refreshTab(tab);
  });

  ext.permissions.onAdded.addListener((p) => {
    if (grantsTabs(p)) void refreshAllTabs();
  });
  ext.permissions.onRemoved.addListener((p) => {
    if (grantsTabs(p)) void resetAllTabs();
  });

  // Same-origin pages reach a live worker over BroadcastChannel. The runtime
  // message is there to wake a worker the browser has already shut down.
  storageEvents.on('bookmarks:changed', () => onLibraryChanged());
  ext.runtime.onMessage.addListener((msg: unknown) => {
    if (msg === BOOKMARKS_CHANGED_MESSAGE) onLibraryChanged();
  });

  ext.runtime.onStartup.addListener(() => void refreshAllTabs());
  ext.runtime.onInstalled.addListener(() => void refreshAllTabs());
}
