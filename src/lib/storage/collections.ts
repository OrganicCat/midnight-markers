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

/** Why a `move` was refused. */
export type MoveResult =
  | { ok: true }
  | { ok: false; reason: 'cycle' | 'name-collision' | 'not-found' };

/** Case-insensitive sibling name match within one parent scope. */
function siblingNamed(all: Collection[], parentId: string | null, name: string): Collection | null {
  const wanted = name.trim().toLowerCase();
  return all.find((c) => c.parentId === parentId && c.name.trim().toLowerCase() === wanted) ?? null;
}

/** Every id in `id`'s subtree, including `id` itself. */
function subtreeIds(all: Collection[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

export const collections = {
  /**
   * Creates a collection, or returns the existing one when a sibling already
   * carries that name.
   *
   * Two same-named siblings are indistinguishable in the sidebar and ambiguous
   * everywhere paths are used as identity — `resolvePath` finds only the first,
   * and resort's planner cannot tell them apart at all. Collapsing on create is
   * the cheapest place to stop them appearing. Callers that want to warn the
   * user first can check `findSibling` before calling.
   */
  async create(input: { name: string; parentId?: string | null; color?: string }): Promise<Collection> {
    const db = await getDb();
    const all = await db.getAll('collections');
    const parentId = input.parentId ?? null;
    const existing = siblingNamed(all, parentId, input.name);
    if (existing) return existing;
    const row: Collection = {
      id: newId(),
      name: input.name,
      parentId,
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
   * Refused, with a reason the caller can surface, when the drop would create a
   * cycle (onto itself or one of its own descendants) or would land the
   * collection next to a sibling of the same name.
   */
  async move(id: string, newParentId: string | null, index: number): Promise<MoveResult> {
    const db = await getDb();
    const dragged = await db.get('collections', id);
    if (!dragged) return { ok: false, reason: 'not-found' };

    const all = await db.getAll('collections');

    // Reject cycles: the new parent must not be the dragged node or a descendant of it.
    if (newParentId && subtreeIds(all, id).has(newParentId)) {
      return { ok: false, reason: 'cycle' };
    }

    // Reject a landing that would produce two same-named siblings.
    const clash = siblingNamed(all, newParentId, dragged.name);
    if (clash && clash.id !== id) return { ok: false, reason: 'name-collision' };

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
    return { ok: true };
  },

  /** The sibling of `parentId` already using `name`, if there is one. */
  async findSibling(parentId: string | null, name: string): Promise<Collection | null> {
    const db = await getDb();
    return siblingNamed(await db.getAll('collections'), parentId, name);
  },

  /**
   * Other collections sharing this one's parent and name.
   *
   * Always empty for a library built by the current code, which refuses to make
   * duplicates. It is not empty for libraries that predate that guard, where a
   * drag to the root or a second "+ Collection" could leave two of the same
   * folder side by side.
   */
  async duplicateSiblings(id: string): Promise<Collection[]> {
    const db = await getDb();
    const all = await db.getAll('collections');
    const self = all.find((c) => c.id === id);
    if (!self) return [];
    const wanted = self.name.trim().toLowerCase();
    return all.filter(
      (c) => c.id !== id && c.parentId === self.parentId && c.name.trim().toLowerCase() === wanted,
    );
  },

  /**
   * Folds `sourceId` into `targetId`: its bookmarks and child folders move
   * across, then the now-empty source is deleted. Returns what moved.
   *
   * Folding a collection into itself or into its own descendant would orphan
   * the subtree, so both are refused.
   */
  async absorb(sourceId: string, targetId: string): Promise<{ bookmarks: number; children: number }> {
    if (sourceId === targetId) throw new Error('cannot absorb a collection into itself');
    const db = await getDb();
    const all = await db.getAll('collections');
    if (!all.some((c) => c.id === sourceId)) throw new Error('collection not found: ' + sourceId);
    if (!all.some((c) => c.id === targetId)) throw new Error('collection not found: ' + targetId);
    if (subtreeIds(all, sourceId).has(targetId)) {
      throw new Error('cannot absorb a collection into its own descendant');
    }

    let children = 0;
    for (const c of all) {
      if (c.parentId !== sourceId) continue;
      await db.put('collections', { ...c, parentId: targetId });
      children++;
    }

    let moved = 0;
    for (const b of await db.getAll('bookmarks')) {
      if (b.collectionId !== sourceId) continue;
      await db.put('bookmarks', { ...b, collectionId: targetId, updatedAt: Date.now() });
      moved++;
    }

    await db.delete('collections', sourceId);
    emit({ type: 'collections:changed' });
    if (moved > 0) emit({ type: 'bookmarks:changed' });
    return { bookmarks: moved, children };
  },

  /** Direct bookmarks and direct child folders, for a "this will affect N things" prompt. */
  async countContents(id: string): Promise<{ bookmarks: number; children: number }> {
    const db = await getDb();
    const children = (await db.getAll('collections')).filter((c) => c.parentId === id).length;
    const bookmarks = (await db.getAll('bookmarks')).filter((b) => b.collectionId === id).length;
    return { bookmarks, children };
  },

  /**
   * Deletes a collection without taking its contents down with it: bookmarks
   * inside become unfiled, and child folders move up to take its place. Returns
   * how much was set loose.
   *
   * `delete` is the raw row removal and assumes the caller has already emptied
   * the collection; this is what a user pressing Delete should get.
   */
  async remove(id: string): Promise<{ bookmarks: number; children: number }> {
    const db = await getDb();
    const self = await db.get('collections', id);
    if (!self) return { bookmarks: 0, children: 0 };

    let children = 0;
    for (const c of await db.getAll('collections')) {
      if (c.parentId !== id) continue;
      await db.put('collections', { ...c, parentId: self.parentId });
      children++;
    }

    let unfiled = 0;
    for (const b of await db.getAll('bookmarks')) {
      if (b.collectionId !== id) continue;
      await db.put('bookmarks', { ...b, collectionId: null, updatedAt: Date.now() });
      unfiled++;
    }

    await db.delete('collections', id);
    emit({ type: 'collections:changed' });
    if (unfiled > 0) emit({ type: 'bookmarks:changed' });
    return { bookmarks: unfiled, children };
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
