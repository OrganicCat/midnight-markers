import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';
import { suggestForBookmark } from '$lib/ai/suggest';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const baseInput = {
  title: 'Type theory primer',
  url: 'https://example.com/types',
  description: null,
  excerpt: null,
  existingTags: ['cs', 'reading'],
  existingCollections: [{ id: '01READING', path: ['Reading'] }],
};

describe('suggestForBookmark', () => {
  it('returns null when no API key is set', async () => {
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when all AI features are off', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: false, title: false, collection: false } });
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns parsed suggestions on a valid response', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'A Type Theory Primer',
            tags: ['cs', 'types'],
            collectionPath: ['Reading'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out).not.toBeNull();
    expect(out!.suggestedTitle).toBe('A Type Theory Primer');
    expect(out!.suggestedTags).toEqual([
      { name: 'cs', isNew: false },
      { name: 'types', isNew: true },
    ]);
    expect(out!.suggestedCollectionPath).toEqual(['Reading']);
  });

  it('caps collection path at 3 levels', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: [], collectionPath: ['Gaming', 'PoE', 'Builds', 'Necro', 'Spectre'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toEqual(['Gaming', 'PoE', 'Builds']);
  });

  it('returns null path when collectionPath is missing', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: null, tags: ['cs'] }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toBeNull();
  });

  it('returns null path when collection feature is off', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: false } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: [], collectionPath: ['Reading'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toBeNull();
  });

  it('lowercases tag names and caps total tags at 5', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: ['CS', 'Types', 'Foo', 'Bar', 'Baz', 'Qux', 'Extra'], collectionPath: null,
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedTags.map((t) => t.name)).toEqual(['cs', 'types', 'foo', 'bar', 'baz']);
  });

  it('respects feature flags — drops title when title flag off', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: false, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'Better Title', tags: ['cs'], collectionPath: null,
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedTitle).toBeNull();
    expect(out!.suggestedTags).toEqual([{ name: 'cs', isNew: false }]);
  });

  it('returns null on OpenRouter error (graceful degrade)', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
  });

  it('returns null on timeout', async () => {
    await settings.set({ aiKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockImplementationOnce(
      (_u: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const out = await suggestForBookmark(baseInput, { timeoutMs: 5 });
    expect(out).toBeNull();
  });
});
