import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { tags } from '$lib/storage/tags';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('tags', () => {
  it('upsertByName creates a tag with lowercased name and returns it', async () => {
    const t = await tags.upsertByName('Design');
    expect(t.name).toBe('design');
    expect(t.count).toBe(0);
  });

  it('upsertByName returns existing tag when name already exists (case-insensitive)', async () => {
    const a = await tags.upsertByName('design');
    const b = await tags.upsertByName('DESIGN');
    expect(b.id).toBe(a.id);
  });

  it('incrementCount and decrementCount track usage', async () => {
    const t = await tags.upsertByName('webdev');
    await tags.incrementCount(t.id);
    await tags.incrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(2);
    await tags.decrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(1);
  });

  it('decrement floors at 0', async () => {
    const t = await tags.upsertByName('x');
    await tags.decrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(0);
  });

  it('list returns all tags sorted by name', async () => {
    await tags.upsertByName('zeta');
    await tags.upsertByName('alpha');
    const list = await tags.list();
    expect(list.map((t) => t.name)).toEqual(['alpha', 'zeta']);
  });
});
