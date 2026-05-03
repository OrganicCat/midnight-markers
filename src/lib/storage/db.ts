import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Bookmark, Collection, Tag, Settings } from '$lib/types';

export const DB_NAME = 'midnight-markers';
export const DB_VERSION = 1;

export interface MMSchema extends DBSchema {
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: {
      'by-collection': string;
      'by-domain': string;
      'by-createdAt': number;
      'by-starred': number;
      'by-unread': number;
      'by-isBroken': number;
    };
  };
  collections: { key: string; value: Collection; indexes: { 'by-parent': string } };
  tags: { key: string; value: Tag; indexes: { 'by-name': string } };
  settings: { key: string; value: Settings };
}

let dbPromise: Promise<IDBPDatabase<MMSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<MMSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MMSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const bm = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bm.createIndex('by-collection', 'collectionId');
        bm.createIndex('by-domain', 'domain');
        bm.createIndex('by-createdAt', 'createdAt');
        bm.createIndex('by-starred', 'starred');
        bm.createIndex('by-unread', 'unread');
        bm.createIndex('by-isBroken', 'isBroken');

        const col = db.createObjectStore('collections', { keyPath: 'id' });
        col.createIndex('by-parent', 'parentId');

        const tags = db.createObjectStore('tags', { keyPath: 'id' });
        tags.createIndex('by-name', 'name', { unique: true });

        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

export function _resetDbForTests(): void {
  dbPromise = null;
}
