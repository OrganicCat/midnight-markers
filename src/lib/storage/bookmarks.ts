import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import { tags as tagsStore } from './tags';
import type { Bookmark, BookmarkFilter } from '$lib/types';

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

type CreateInput = {
  url: string;
  title: string;
  originalTitle: string;
  description?: string | null;
  excerpt?: string | null;
  faviconUrl?: string | null;
  thumbnailUrl?: string | null;
  collectionId?: string | null;
  tagIds?: string[];
};

export const bookmarks = {
  async create(input: CreateInput): Promise<Bookmark> {
    const db = await getDb();
    const now = Date.now();
    const row: Bookmark = {
      id: newId(),
      url: input.url,
      title: input.title,
      originalTitle: input.originalTitle,
      domain: domainOf(input.url),
      faviconUrl: input.faviconUrl ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      description: input.description ?? null,
      excerpt: input.excerpt ?? null,
      collectionId: input.collectionId ?? null,
      tagIds: input.tagIds ?? [],
      starred: false,
      unread: true,
      note: null,
      createdAt: now,
      updatedAt: now,
      lastCheckedAt: null,
      isBroken: false,
    };
    await db.put('bookmarks', row);
    emit({ type: 'bookmarks:changed' });
    return row;
  },

  async update(id: string, patch: Partial<Bookmark>): Promise<Bookmark> {
    const db = await getDb();
    const cur = await db.get('bookmarks', id);
    if (!cur) throw new Error('bookmark not found: ' + id);
    const next: Bookmark = { ...cur, ...patch, id: cur.id, updatedAt: Date.now() };
    await db.put('bookmarks', next);
    emit({ type: 'bookmarks:changed' });
    return next;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    const cur = await db.get('bookmarks', id);
    if (!cur) return;
    for (const tagId of cur.tagIds) await tagsStore.decrementCount(tagId);
    await db.delete('bookmarks', id);
    emit({ type: 'bookmarks:changed' });
  },

  async get(id: string): Promise<Bookmark | null> {
    const db = await getDb();
    return (await db.get('bookmarks', id)) ?? null;
  },

  async addTag(bookmarkId: string, tagId: string): Promise<void> {
    const cur = await this.get(bookmarkId);
    if (!cur || cur.tagIds.includes(tagId)) return;
    await this.update(bookmarkId, { tagIds: [...cur.tagIds, tagId] });
    await tagsStore.incrementCount(tagId);
  },

  async removeTag(bookmarkId: string, tagId: string): Promise<void> {
    const cur = await this.get(bookmarkId);
    if (!cur || !cur.tagIds.includes(tagId)) return;
    await this.update(bookmarkId, { tagIds: cur.tagIds.filter((id) => id !== tagId) });
    await tagsStore.decrementCount(tagId);
  },

  async list(filter: BookmarkFilter): Promise<Bookmark[]> {
    const db = await getDb();
    let rows = await db.getAll('bookmarks');

    if (filter.collectionId !== undefined) {
      rows = rows.filter((b) => b.collectionId === filter.collectionId);
    }
    if (filter.tagId) {
      rows = rows.filter((b) => b.tagIds.includes(filter.tagId!));
    }
    if (filter.smart) {
      switch (filter.smart) {
        case 'recent': {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          rows = rows.filter((b) => b.createdAt >= cutoff);
          break;
        }
        case 'unread': rows = rows.filter((b) => b.unread); break;
        case 'starred': rows = rows.filter((b) => b.starred); break;
        case 'untagged': rows = rows.filter((b) => b.tagIds.length === 0); break;
        case 'broken': rows = rows.filter((b) => b.isBroken); break;
      }
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        (b.note?.toLowerCase().includes(q) ?? false),
      );
    }

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
};
