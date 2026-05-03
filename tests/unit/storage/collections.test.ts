import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('collections', () => {
  it('creates with defaults and returns the row', async () => {
    const c = await collections.create({ name: 'Reading' });
    expect(c.name).toBe('Reading');
    expect(c.parentId).toBeNull();
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.id).toHaveLength(26);
  });

  it('lists collections, ordered by sortOrder asc', async () => {
    await collections.create({ name: 'A' });
    await collections.create({ name: 'B' });
    const rows = await collections.list();
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('updates name and color', async () => {
    const c = await collections.create({ name: 'X' });
    const updated = await collections.update(c.id, { name: 'X2', color: '#ff0000' });
    expect(updated.name).toBe('X2');
    expect(updated.color).toBe('#ff0000');
  });

  it('delete removes the row', async () => {
    const c = await collections.create({ name: 'Tmp' });
    await collections.delete(c.id);
    expect(await collections.list()).toHaveLength(0);
  });
});
