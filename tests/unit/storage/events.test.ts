import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storageEvents, emit, _resetBroadcastForTests } from '$lib/storage/events';

beforeEach(() => storageEvents.removeAll());

describe('storageEvents', () => {
  it('notifies subscribers when an event is emitted', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).toHaveBeenCalledWith({ type: 'bookmarks:changed' });
  });

  it('off removes a single listener', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    storageEvents.off('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not crash when no listeners', () => {
    expect(() => emit({ type: 'collections:changed' })).not.toThrow();
  });
});

describe('storageEvents cross-page', () => {
  afterEach(() => _resetBroadcastForTests());

  it('subscribers receive events posted from another page even if no local emit ran first', async () => {
    // Models the newtab-page scenario: it listens but never emits before the
    // popup adds a bookmark. The subscriber must still fire.
    _resetBroadcastForTests();

    const received = new Promise<unknown>((resolve) => {
      storageEvents.on('bookmarks:changed', resolve);
    });

    const otherPage = new BroadcastChannel('mm.storage');
    otherPage.postMessage({ type: 'bookmarks:changed' });

    const e = await Promise.race([
      received,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
    expect(e).toEqual({ type: 'bookmarks:changed' });
    otherPage.close();
  });
});
