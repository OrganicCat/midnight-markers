import { getDb } from './db';
import { emit } from './events';
import type { Collection } from '$lib/types';

export const SNAPSHOT_KEY = 'last-resort';

export type ResortSnapshot = {
  id: string;
  createdAt: number;
  collections: Collection[];
  bookmarkAssignments: { id: string; collectionId: string | null }[];
};

export const snapshots = {
  /** Captures the current tree and every bookmark's folder, overwriting any prior slot. */
  async save(): Promise<ResortSnapshot> {
    const db = await getDb();
    const cols = await db.getAll('collections');
    const bms = await db.getAll('bookmarks');
    const snap: ResortSnapshot = {
      id: SNAPSHOT_KEY,
      createdAt: Date.now(),
      collections: cols.map((c) => ({ ...c })),
      bookmarkAssignments: bms.map((b) => ({ id: b.id, collectionId: b.collectionId })),
    };
    await db.put('snapshots', snap);
    return snap;
  },

  async get(): Promise<ResortSnapshot | null> {
    const db = await getDb();
    return (await db.get('snapshots', SNAPSHOT_KEY)) ?? null;
  },

  /**
   * Rolls the collection tree and every recorded bookmark assignment back to
   * the snapshot, then clears the slot. Collections created after the snapshot
   * are removed; bookmarks created after it keep their current folder unless
   * that folder no longer exists, in which case they become unfiled.
   */
  async restore(): Promise<boolean> {
    const db = await getDb();
    const snap = await db.get('snapshots', SNAPSHOT_KEY);
    if (!snap) return false;

    const colTx = db.transaction('collections', 'readwrite');
    await colTx.store.clear();
    for (const c of snap.collections) await colTx.store.put(c);
    await colTx.done;

    const validIds = new Set(snap.collections.map((c) => c.id));
    const assignments = new Map(snap.bookmarkAssignments.map((a) => [a.id, a.collectionId]));

    const bmTx = db.transaction('bookmarks', 'readwrite');
    for (const b of await bmTx.store.getAll()) {
      const recorded = assignments.get(b.id);
      const next = recorded !== undefined ? recorded : b.collectionId;
      const safe = next !== null && validIds.has(next) ? next : null;
      if (safe !== b.collectionId) await bmTx.store.put({ ...b, collectionId: safe });
    }
    await bmTx.done;

    await db.delete('snapshots', SNAPSHOT_KEY);
    emit({ type: 'collections:changed' });
    emit({ type: 'bookmarks:changed' });
    return true;
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.delete('snapshots', SNAPSHOT_KEY);
  },
};
