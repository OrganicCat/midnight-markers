import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { collections } from '$lib/storage/collections';
import { tags } from '$lib/storage/tags';
import { exportToJSON, importFromJSON } from '$lib/storage/exportImport';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('export/import', () => {
  it('exports an empty store as an empty payload', async () => {
    const json = await exportToJSON();
    expect(json.version).toBe(1);
    expect(json.bookmarks).toEqual([]);
    expect(json.collections).toEqual([]);
    expect(json.tags).toEqual([]);
  });

  it('round-trips bookmarks/collections/tags', async () => {
    const c = await collections.create({ name: 'Reading' });
    const t = await tags.upsertByName('design');
    const b = await bookmarks.create({
      url: 'https://example.com',
      title: 'X',
      originalTitle: 'X',
      collectionId: c.id,
    });
    await bookmarks.addTag(b.id, t.id);

    const exported = await exportToJSON();

    // Wipe and reimport
    globalThis.indexedDB = new IDBFactory();
    _resetDbForTests();

    const result = await importFromJSON(exported);
    expect(result.imported.bookmarks).toBe(1);
    expect(result.imported.collections).toBe(1);
    expect(result.imported.tags).toBe(1);

    const list = await bookmarks.list({});
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('X');
    expect(list[0]!.tagIds).toContain(t.id);
    expect(list[0]!.collectionId).toBe(c.id);
  });

  it('importFromJSON skips entries that already exist (by id)', async () => {
    const c = await collections.create({ name: 'Reading' });
    const exported = await exportToJSON();
    const result = await importFromJSON(exported);
    expect(result.imported.collections).toBe(0);
    expect(result.skipped.collections).toBe(1);
    void c;
  });

  it('importFromJSON rejects an invalid payload', async () => {
    await expect(importFromJSON({ version: 999 } as unknown as any)).rejects.toThrow();
  });
});
