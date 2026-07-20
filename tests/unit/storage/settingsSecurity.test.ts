import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests, getDb } from '$lib/storage/db';
import { settings, DEFAULT_SETTINGS } from '$lib/storage/settings';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

/** The exact bytes sitting in IndexedDB, bypassing the settings accessor. */
async function rawStored(): Promise<Record<string, unknown> | undefined> {
  const db = await getDb();
  return (await db.get('settings', 'singleton')) as Record<string, unknown> | undefined;
}

describe('settings defaults', () => {
  it('ships with every AI feature OFF', () => {
    expect(DEFAULT_SETTINGS.aiFeatures).toEqual({ tags: false, title: false, collection: false });
  });

  it('ships with no consent recorded', () => {
    expect(DEFAULT_SETTINGS.aiConsentAt).toBeNull();
  });

  it('ships with no key', () => {
    expect(DEFAULT_SETTINGS.aiKey).toBeNull();
  });
});

describe('API key at rest', () => {
  it('round-trips through the accessor', async () => {
    await settings.set({ aiKey: 'sk-or-v1-topsecret' });
    expect((await settings.get()).aiKey).toBe('sk-or-v1-topsecret');
  });

  it('never persists the key in plaintext', async () => {
    await settings.set({ aiKey: 'sk-or-v1-topsecret' });
    const raw = await rawStored();
    expect(JSON.stringify(raw)).not.toContain('sk-or-v1-topsecret');
    expect(raw?.aiKey).toBeUndefined();
    expect(raw?.aiKeySealed).toBeTruthy();
  });

  it('clears the sealed value when the key is removed', async () => {
    await settings.set({ aiKey: 'sk-or-v1-topsecret' });
    await settings.set({ aiKey: null });
    expect((await settings.get()).aiKey).toBeNull();
    expect((await rawStored())?.aiKeySealed).toBeNull();
  });

  it('preserves other settings when the key changes', async () => {
    await settings.set({ aiModel: 'openai/gpt-4o-mini', uiScale: 1.3 });
    await settings.set({ aiKey: 'sk-or-v1-abc' });
    const s = await settings.get();
    expect(s.aiModel).toBe('openai/gpt-4o-mini');
    expect(s.uiScale).toBe(1.3);
  });

  it('migrates a legacy plaintext key and scrubs it from disk', async () => {
    // Simulate a pre-v0.3 record written by an older build.
    const db = await getDb();
    await db.put(
      'settings',
      { ...DEFAULT_SETTINGS, aiKey: 'sk-or-v1-legacy' } as never,
      'singleton',
    );

    // Reading it should still yield the key...
    expect((await settings.get()).aiKey).toBe('sk-or-v1-legacy');

    // ...but the plaintext must no longer be on disk afterwards.
    const raw = await rawStored();
    expect(raw?.aiKey).toBeUndefined();
    expect(JSON.stringify(raw)).not.toContain('sk-or-v1-legacy');
    expect((await settings.get()).aiKey).toBe('sk-or-v1-legacy');
  });
});
