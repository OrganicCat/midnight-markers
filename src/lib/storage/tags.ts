import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import type { Tag } from '$lib/types';

export const tags = {
  async upsertByName(name: string): Promise<Tag> {
    const lower = name.trim().toLowerCase();
    const db = await getDb();
    const existing = await db.getFromIndex('tags', 'by-name', lower);
    if (existing) return existing;
    const row: Tag = { id: newId(), name: lower, count: 0 };
    await db.put('tags', row);
    emit({ type: 'tags:changed' });
    return row;
  },

  async get(id: string): Promise<Tag | null> {
    const db = await getDb();
    return (await db.get('tags', id)) ?? null;
  },

  async incrementCount(id: string): Promise<void> {
    const db = await getDb();
    const t = await db.get('tags', id);
    if (!t) return;
    t.count += 1;
    await db.put('tags', t);
    emit({ type: 'tags:changed' });
  },

  async decrementCount(id: string): Promise<void> {
    const db = await getDb();
    const t = await db.get('tags', id);
    if (!t) return;
    t.count = Math.max(0, t.count - 1);
    await db.put('tags', t);
    emit({ type: 'tags:changed' });
  },

  async list(): Promise<Tag[]> {
    const db = await getDb();
    const rows = await db.getAll('tags');
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('tags', id);
    emit({ type: 'tags:changed' });
  },
};
