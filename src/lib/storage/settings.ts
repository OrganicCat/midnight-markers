import { getDb } from './db';
import { emit } from './events';
import type { Settings } from '$lib/types';

const KEY = 'singleton';

export const DEFAULT_SETTINGS: Settings = {
  aiKey: null,
  aiModel: 'anthropic/claude-haiku-4.5',
  aiFeatures: { tags: true, title: true, collection: true },
  defaultView: 'grid',
  defaultCollectionId: null,
};

export const settings = {
  async get(): Promise<Settings> {
    const db = await getDb();
    const stored = await db.get('settings', KEY);
    return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
  },

  async set(patch: Partial<Settings>): Promise<Settings> {
    const db = await getDb();
    const current = await this.get();
    const next: Settings = { ...current, ...patch };
    await db.put('settings', next, KEY);
    emit({ type: 'settings:changed' });
    return next;
  },
};
