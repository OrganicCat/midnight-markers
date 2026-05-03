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
    expect(s.aiKey).toBeNull();
    expect(s.aiModel).toBe('anthropic/claude-haiku-4.5');
    expect(s.aiFeatures).toEqual({ tags: true, title: true, collection: true });
    expect(s.defaultView).toBe('grid');
  });

  it('round-trips settings.set / settings.get', async () => {
    await settings.set({ aiKey: 'sk-ant-test', aiModel: 'openai/gpt-4o-mini' });
    const s = await settings.get();
    expect(s.aiKey).toBe('sk-ant-test');
    expect(s.aiModel).toBe('openai/gpt-4o-mini');
  });

  it('partial set merges with existing', async () => {
    await settings.set({ aiKey: 'sk-1' });
    await settings.set({ defaultView: 'list' });
    const s = await settings.get();
    expect(s.aiKey).toBe('sk-1');
    expect(s.defaultView).toBe('list');
  });
});
