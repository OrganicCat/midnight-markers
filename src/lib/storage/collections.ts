import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import type { Collection } from '$lib/types';

export const MAX_COLLECTION_DEPTH = 3;

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

  /**
   * Re-parents and/or reorders a collection.
   *
   * The dragged collection becomes a child of `newParentId` (or a top-level
   * collection when `newParentId` is null) and is placed at `index` within that
   * sibling group. `index` is measured against the sibling group *excluding* the
   * dragged collection, and is clamped to a valid slot. The whole target group's
   * `sortOrder` is renumbered 0..n so ordering stays dense and stable.
   *
   * Dropping a collection onto itself or one of its own descendants is a no-op
   * (it would create a cycle).
   */
  async move(id: string, newParentId: string | null, index: number): Promise<void> {
    const db = await getDb();
    const dragged = await db.get('collections', id);
    if (!dragged) throw new Error('collection not found: ' + id);

    const all = await db.getAll('collections');

    // Reject cycles: the new parent must not be the dragged node or a descendant of it.
    if (newParentId) {
      const subtree = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of all) {
          if (c.parentId && subtree.has(c.parentId) && !subtree.has(c.id)) {
            subtree.add(c.id);
            grew = true;
          }
        }
      }
      if (subtree.has(newParentId)) return;
    }

    // Ordered target siblings, excluding the dragged node, then splice it in.
    const siblings = all
      .filter((c) => c.parentId === newParentId && c.id !== id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const at = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(at, 0, dragged);

    // Renumber the whole group in one transaction so sortOrder stays dense.
    const tx = db.transaction('collections', 'readwrite');
    for (let i = 0; i < siblings.length; i++) {
      const s = siblings[i]!;
      const next: Collection = { ...s, sortOrder: i };
      if (s.id === id) next.parentId = newParentId;
      await tx.store.put(next);
    }
    await tx.done;
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

  /**
   * Returns the path of names from root to this collection, e.g. ['Gaming', 'Path of Exile', 'Builds'].
   * Walks up through parentId. Stops at depth MAX_COLLECTION_DEPTH to prevent runaway loops.
   */
  async pathOf(id: string): Promise<string[]> {
    const db = await getDb();
    const path: string[] = [];
    let cur: Collection | undefined = await db.get('collections', id);
    let safety = 0;
    while (cur && safety < MAX_COLLECTION_DEPTH * 2) {
      path.unshift(cur.name);
      if (!cur.parentId) break;
      cur = await db.get('collections', cur.parentId);
      safety++;
    }
    return path;
  },

  /**
   * Returns all collections with their computed path. Use for AI prompts and tree views.
   */
  async listWithPaths(): Promise<Array<{ id: string; path: string[]; depth: number; parentId: string | null; color: string; sortOrder: number; name: string }>> {
    const all = await this.list();
    const byId = new Map(all.map((c) => [c.id, c]));
    const result = all.map((c) => {
      const path: string[] = [];
      let cur: Collection | undefined = c;
      let safety = 0;
      while (cur && safety < MAX_COLLECTION_DEPTH * 2) {
        path.unshift(cur.name);
        if (!cur.parentId) break;
        cur = byId.get(cur.parentId);
        safety++;
      }
      return {
        id: c.id,
        path,
        depth: path.length - 1,
        parentId: c.parentId,
        color: c.color,
        sortOrder: c.sortOrder,
        name: c.name,
      };
    });
    return result;
  },

  /**
   * Walks a path of names (e.g. ['Gaming', 'Path of Exile', 'Builds']) and returns the leaf
   * collection id, creating intermediate collections as needed. Capped at MAX_COLLECTION_DEPTH.
   * Matching is case-insensitive on name within a parent scope.
   */
  async resolvePath(path: string[]): Promise<string> {
    if (path.length === 0) throw new Error('resolvePath called with empty path');
    const trimmed = path
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, MAX_COLLECTION_DEPTH);
    if (trimmed.length === 0) throw new Error('resolvePath path was all empty after trim');

    const all = await this.list();
    let parentId: string | null = null;
    let leafId = '';

    for (const segment of trimmed) {
      const lower = segment.toLowerCase();
      const existing = all.find(
        (c) => c.parentId === parentId && c.name.toLowerCase() === lower,
      );
      if (existing) {
        parentId = existing.id;
        leafId = existing.id;
      } else {
        const created = await this.create({ name: segment, parentId });
        all.push(created);
        parentId = created.id;
        leafId = created.id;
      }
    }
    return leafId;
  },
};
