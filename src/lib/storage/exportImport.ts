import { getDb } from './db';
import { emit } from './events';
import type { Bookmark, Collection, Tag } from '$lib/types';

export type ExportPayload = {
  version: 1;
  exportedAt: number;
  bookmarks: Bookmark[];
  collections: Collection[];
  tags: Tag[];
};

export async function exportToJSON(): Promise<ExportPayload> {
  const db = await getDb();
  const [bms, cols, tgs] = await Promise.all([
    db.getAll('bookmarks'),
    db.getAll('collections'),
    db.getAll('tags'),
  ]);
  return {
    version: 1,
    exportedAt: Date.now(),
    bookmarks: bms,
    collections: cols,
    tags: tgs,
  };
}

export type ImportResult = {
  imported: { bookmarks: number; collections: number; tags: number };
  skipped: { bookmarks: number; collections: number; tags: number };
};

function validate(payload: unknown): payload is ExportPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (p['version'] !== 1) return false;
  if (!Array.isArray(p['bookmarks']) || !Array.isArray(p['collections']) || !Array.isArray(p['tags'])) return false;
  return true;
}

export async function importFromJSON(payload: unknown): Promise<ImportResult> {
  if (!validate(payload)) throw new Error('Invalid export payload (expected version 1)');
  const db = await getDb();

  const result: ImportResult = {
    imported: { bookmarks: 0, collections: 0, tags: 0 },
    skipped: { bookmarks: 0, collections: 0, tags: 0 },
  };

  const tx = db.transaction(['bookmarks', 'collections', 'tags'], 'readwrite');

  for (const c of payload.collections) {
    const existing = await tx.objectStore('collections').get(c.id);
    if (existing) {
      result.skipped.collections++;
    } else {
      await tx.objectStore('collections').put(c);
      result.imported.collections++;
    }
  }

  for (const t of payload.tags) {
    const existing = await tx.objectStore('tags').get(t.id);
    if (existing) {
      result.skipped.tags++;
    } else {
      await tx.objectStore('tags').put(t);
      result.imported.tags++;
    }
  }

  for (const b of payload.bookmarks) {
    const existing = await tx.objectStore('bookmarks').get(b.id);
    if (existing) {
      result.skipped.bookmarks++;
    } else {
      await tx.objectStore('bookmarks').put(b);
      result.imported.bookmarks++;
    }
  }

  await tx.done;

  emit({ type: 'bookmarks:changed' });
  emit({ type: 'collections:changed' });
  emit({ type: 'tags:changed' });

  return result;
}
