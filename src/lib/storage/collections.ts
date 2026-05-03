import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import type { Collection } from '$lib/types';

const PALETTE = [
  '#8b9bff', '#bd93f9', '#ff79c6', '#ff8a65', '#ffe66d', '#50fa7b',
  '#6fe6cf', '#8be9fd', '#a8e6cf', '#c7ceea', '#f1a7c8', '#ffb86c',
];

function nextColor(used: string[]): string {
  for (const c of PALETTE) if (!used.includes(c)) return c;
  return PALETTE[used.length % PALETTE.length]!;
}

export const collections = {
  async create(input: { name: string; parentId?: string | null; color?: string }): Promise<Collection> {
    const db = await getDb();
    const all = await db.getAll('collections');
    const row: Collection = {
      id: newId(),
      name: input.name,
      parentId: input.parentId ?? null,
      color: input.color ?? nextColor(all.map((c) => c.color)),
      sortOrder: all.length,
      createdAt: Date.now(),
    };
    await db.put('collections', row);
    emit({ type: 'collections:changed' });
    return row;
  },

  async update(id: string, patch: Partial<Collection>): Promise<Collection> {
    const db = await getDb();
    const cur = await db.get('collections', id);
    if (!cur) throw new Error('collection not found: ' + id);
    const next: Collection = { ...cur, ...patch, id: cur.id };
    await db.put('collections', next);
    emit({ type: 'collections:changed' });
    return next;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('collections', id);
    emit({ type: 'collections:changed' });
  },

  async list(): Promise<Collection[]> {
    const db = await getDb();
    const rows = await db.getAll('collections');
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<Collection | null> {
    const db = await getDb();
    return (await db.get('collections', id)) ?? null;
  },
};
