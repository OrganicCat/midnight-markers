import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Listener = (...args: unknown[]) => unknown;
function event() {
  const fns: Listener[] = [];
  return {
    addListener: (fn: Listener) => void fns.push(fn),
    removeListener: () => {},
    fire: (...args: unknown[]) => Promise.all(fns.map((f) => f(...args))),
  };
}

let granted: boolean;
let openTabs: chrome.tabs.Tab[];

function makeFake() {
  // Fresh per test: module copies loaded by earlier tests stay alive and
  // must not be able to write into this test's assertions.
  return {
    action: { setIcon: vi.fn(async (_d: unknown) => {}), setTitle: vi.fn(async (_d: unknown) => {}) },
    tabs: { query: vi.fn(async () => openTabs), onUpdated: event() },
    permissions: {
      contains: vi.fn(async () => granted),
      onAdded: event(),
      onRemoved: event(),
    },
    runtime: {
      onMessage: event(),
      onStartup: event(),
      onInstalled: event(),
      sendMessage: vi.fn(async (_m: unknown) => {}),
    },
  };
}
let fake: ReturnType<typeof makeFake>;
let closeChannel: () => void = () => {};

// `ext` is resolved when $lib/ext is first imported, so the fake has to be in
// place before the modules under test load.
async function load() {
  vi.resetModules();
  fake = makeFake();
  vi.stubGlobal('chrome', fake);
  const events = await import('$lib/storage/events');
  closeChannel = events._resetBroadcastForTests;
  const { bookmarks } = await import('$lib/storage/bookmarks');
  const icon = await import('../../../src/background/savedIcon');
  return { bookmarks, icon };
}

function lastIconFor(tabId: number): string | undefined {
  const calls = fake.action.setIcon.mock.calls.map(
    (c) => c[0] as { tabId: number; path: Record<number, string> },
  );
  return calls.filter((c) => c.tabId === tabId).at(-1)?.path[16];
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  granted = true;
  openTabs = [];
});
afterEach(() => {
  closeChannel();
  vi.unstubAllGlobals();
});

describe('saved icon', () => {
  it('badges tabs whose page is saved and leaves the others plain', async () => {
    const { bookmarks, icon } = await load();
    await bookmarks.create({ url: 'https://saved.com/page/', title: 'S', originalTitle: 'S' });
    openTabs = [
      { id: 1, url: 'https://saved.com/page#intro' } as chrome.tabs.Tab,
      { id: 2, url: 'https://other.com/' } as chrome.tabs.Tab,
    ];
    await icon.refreshAllTabs();
    expect(lastIconFor(1)).toBe('/icons/icon-saved-16.png');
    expect(lastIconFor(2)).toBe('/icons/icon-16.png');
    expect(fake.action.setTitle).toHaveBeenCalledWith({ tabId: 1, title: 'Already saved to midnight-markers' });
  });

  it('does nothing while the tabs permission is not granted', async () => {
    const { bookmarks, icon } = await load();
    granted = false;
    await bookmarks.create({ url: 'https://saved.com/', title: 'S', originalTitle: 'S' });
    openTabs = [{ id: 1, url: 'https://saved.com/' } as chrome.tabs.Tab];
    icon.registerSavedIcon();
    await icon.refreshAllTabs();
    await fake.tabs.onUpdated.fire(1, { url: 'https://saved.com/' }, openTabs[0]);
    expect(fake.action.setIcon).not.toHaveBeenCalled();
  });

  it('repaints a tab when it navigates or finishes loading, not on other updates', async () => {
    const { bookmarks, icon } = await load();
    await bookmarks.create({ url: 'https://saved.com/', title: 'S', originalTitle: 'S' });
    icon.registerSavedIcon();
    const tab = { id: 7, url: 'https://saved.com/' } as chrome.tabs.Tab;

    await fake.tabs.onUpdated.fire(7, { title: 'ignored' }, tab);
    expect(fake.action.setIcon).not.toHaveBeenCalled();

    await fake.tabs.onUpdated.fire(7, { status: 'complete' }, tab);
    expect(lastIconFor(7)).toBe('/icons/icon-saved-16.png');
  });

  it('picks up a new save after the library changes', async () => {
    const { bookmarks, icon } = await load();
    openTabs = [{ id: 3, url: 'https://new.com/' } as chrome.tabs.Tab];
    await icon.refreshAllTabs();
    expect(lastIconFor(3)).toBe('/icons/icon-16.png');

    await bookmarks.create({ url: 'https://new.com/', title: 'N', originalTitle: 'N' });
    icon.onLibraryChanged(0);
    await vi.waitFor(() => expect(lastIconFor(3)).toBe('/icons/icon-saved-16.png'));
  });

  it('a wake-up message from another page triggers a repaint', async () => {
    const { bookmarks, icon } = await load();
    await bookmarks.create({ url: 'https://woken.com/', title: 'W', originalTitle: 'W' });
    icon.registerSavedIcon();
    openTabs = [{ id: 4, url: 'https://woken.com/' } as chrome.tabs.Tab];
    await fake.runtime.onMessage.fire('mm:bookmarks-changed');
    await vi.waitFor(() => expect(lastIconFor(4)).toBe('/icons/icon-saved-16.png'));
  });

  it('puts the plain icon back on every tab when the permission is removed', async () => {
    const { icon } = await load();
    icon.registerSavedIcon();
    openTabs = [{ id: 5 } as chrome.tabs.Tab, { id: 6 } as chrome.tabs.Tab];
    await fake.permissions.onRemoved.fire({ permissions: ['tabs'] });
    await vi.waitFor(() => {
      expect(lastIconFor(5)).toBe('/icons/icon-16.png');
      expect(lastIconFor(6)).toBe('/icons/icon-16.png');
    });
  });

  it('saving a bookmark sends the wake-up message', async () => {
    const { bookmarks } = await load();
    await bookmarks.create({ url: 'https://x.com/', title: 'X', originalTitle: 'X' });
    expect(fake.runtime.sendMessage).toHaveBeenCalledWith('mm:bookmarks-changed');
  });
});
