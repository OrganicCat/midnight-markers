import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('settings store', () => {
  it('returns defaults when nothing is stored', async () => {
    const s = await settings.get();
    expect(s.openrouterKey).toBeNull();
    expect(s.openrouterModel).toBe('anthropic/claude-haiku-4.5');
    // AI ships off: no data may leave the device before explicit consent.
    expect(s.aiFeatures).toEqual({ tags: false, title: false, collection: false });
    expect(s.aiConsentAt).toBeNull();
    expect(s.defaultView).toBe('grid');
  });

  it('round-trips settings.set / settings.get', async () => {
    await settings.set({ openrouterKey: 'sk-ant-test', openrouterModel: 'openai/gpt-4o-mini' });
    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-ant-test');
    expect(s.openrouterModel).toBe('openai/gpt-4o-mini');
  });

  it('partial set merges with existing', async () => {
    await settings.set({ openrouterKey: 'sk-1' });
    await settings.set({ defaultView: 'list' });
    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-1');
    expect(s.defaultView).toBe('list');
  });

  it('uiScale defaults to 1 and round-trips', async () => {
    expect((await settings.get()).uiScale).toBe(1);
    await settings.set({ uiScale: 1.3 });
    expect((await settings.get()).uiScale).toBe(1.3);
  });

  it('tourSeenAt defaults to null and round-trips', async () => {
    expect((await settings.get()).tourSeenAt).toBe(null);
    await settings.set({ tourSeenAt: 1234 });
    expect((await settings.get()).tourSeenAt).toBe(1234);
  });

  it('concurrent partial writes do not clobber each other', async () => {
    // Both of these are fired without awaiting, exactly as the new tab page
    // does on first paint. Serialized correctly, both fields survive; with a
    // naive read-modify-write the later put() drops the earlier field.
    await Promise.all([
      settings.set({ tourSeenAt: 999 }),
      settings.set({ defaultView: 'list' }),
      settings.set({ uiScale: 1.2 }),
    ]);
    const s = await settings.get();
    expect(s.tourSeenAt).toBe(999);
    expect(s.defaultView).toBe('list');
    expect(s.uiScale).toBe(1.2);
  });
});
