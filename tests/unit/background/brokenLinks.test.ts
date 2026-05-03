import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { checkOnce, pickBatch } from '../../../src/background/brokenLinks';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('pickBatch', () => {
  it('returns up to N bookmarks with oldest lastCheckedAt first, only those past cooldown', async () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    const b = await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const c = await bookmarks.create({ url: 'https://c', title: 'C', originalTitle: 'C' });
    // a was checked 8 days ago (eligible), b checked 2 days ago (in cooldown), c never checked
    await bookmarks.update(a.id, { lastCheckedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    await bookmarks.update(b.id, { lastCheckedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 });
    void c; // never-checked, eligible

    const batch = await pickBatch(10, week);
    const ids = batch.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
  });

  it('caps at the requested batch size', async () => {
    for (let i = 0; i < 5; i++) {
      await bookmarks.create({ url: 'https://x' + i, title: 'X', originalTitle: 'X' });
    }
    const batch = await pickBatch(3, 0);
    expect(batch).toHaveLength(3);
  });
});

describe('checkOnce', () => {
  it('marks 4xx/5xx as broken', async () => {
    const b = await bookmarks.create({ url: 'https://broken', title: 'B', originalTitle: 'B' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(true);
    expect(after!.lastCheckedAt).toBeGreaterThan(0);
  });

  it('marks 2xx/3xx as not broken', async () => {
    const b = await bookmarks.create({ url: 'https://ok', title: 'O', originalTitle: 'O' });
    await bookmarks.update(b.id, { isBroken: true });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(false);
  });

  it('treats network errors as broken', async () => {
    const b = await bookmarks.create({ url: 'https://offline', title: 'X', originalTitle: 'X' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await checkOnce(b);
    const after = await bookmarks.get(b.id);
    expect(after!.isBroken).toBe(true);
  });
});
