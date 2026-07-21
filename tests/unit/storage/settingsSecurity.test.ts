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

  it('ships with no key for either provider', () => {
    expect(DEFAULT_SETTINGS.openrouterKey).toBeNull();
    expect(DEFAULT_SETTINGS.anthropicKey).toBeNull();
  });

  it('ships with OpenRouter as the active provider', () => {
    expect(DEFAULT_SETTINGS.aiProvider).toBe('openrouter');
  });
});

describe('API key at rest', () => {
  it('round-trips through the accessor', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-topsecret' });
    expect((await settings.get()).openrouterKey).toBe('sk-or-v1-topsecret');
  });

  it('never persists either key in plaintext', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-topsecret', anthropicKey: 'sk-ant-topsecret' });
    const raw = await rawStored();
    expect(JSON.stringify(raw)).not.toContain('sk-or-v1-topsecret');
    expect(JSON.stringify(raw)).not.toContain('sk-ant-topsecret');
    expect(raw?.openrouterKey).toBeUndefined();
    expect(raw?.anthropicKey).toBeUndefined();
    expect(raw?.openrouterKeySealed).toBeTruthy();
    expect(raw?.anthropicKeySealed).toBeTruthy();
  });

  it('clears the sealed value when the key is removed', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-topsecret' });
    await settings.set({ openrouterKey: null });
    expect((await settings.get()).openrouterKey).toBeNull();
    expect((await rawStored())?.openrouterKeySealed).toBeNull();
  });

  it('seals the two providers\' keys independently', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-abc', anthropicKey: 'sk-ant-xyz' });
    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-or-v1-abc');
    expect(s.anthropicKey).toBe('sk-ant-xyz');
    const raw = await rawStored();
    expect(raw?.openrouterKeySealed).not.toEqual(raw?.anthropicKeySealed);
  });

  it('removing one provider key leaves the other intact', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-abc', anthropicKey: 'sk-ant-xyz' });
    await settings.set({ anthropicKey: null });
    const s = await settings.get();
    expect(s.anthropicKey).toBeNull();
    expect(s.openrouterKey).toBe('sk-or-v1-abc');
  });

  it('switching provider does not disturb either stored key', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-abc', anthropicKey: 'sk-ant-xyz' });
    await settings.set({ aiProvider: 'anthropic' });
    await settings.set({ aiProvider: 'openrouter' });
    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-or-v1-abc');
    expect(s.anthropicKey).toBe('sk-ant-xyz');
  });

  it('preserves other settings when the key changes', async () => {
    await settings.set({ openrouterModel: 'openai/gpt-4o-mini', uiScale: 1.3 });
    await settings.set({ openrouterKey: 'sk-or-v1-abc' });
    const s = await settings.get();
    expect(s.openrouterModel).toBe('openai/gpt-4o-mini');
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

    // Reading it should still yield the key, as the OpenRouter one...
    expect((await settings.get()).openrouterKey).toBe('sk-or-v1-legacy');

    // ...but the plaintext must no longer be on disk afterwards.
    const raw = await rawStored();
    expect(raw?.aiKey).toBeUndefined();
    expect(JSON.stringify(raw)).not.toContain('sk-or-v1-legacy');
    expect((await settings.get()).openrouterKey).toBe('sk-or-v1-legacy');
  });
});

describe('pre-v0.4 single-provider migration', () => {
  /** Writes a record in the shape a pre-v0.4 build would have left behind. */
  async function seedLegacy(extra: Record<string, unknown> = {}): Promise<void> {
    const db = await getDb();
    const { openrouterKey, anthropicKey, openrouterModel, anthropicModel, aiProvider, ...base } =
      DEFAULT_SETTINGS;
    void openrouterKey;
    void anthropicKey;
    void openrouterModel;
    void anthropicModel;
    void aiProvider;
    await db.put('settings', { ...base, ...extra } as never, 'singleton');
  }

  it('re-homes a sealed aiKey onto the OpenRouter slot', async () => {
    // Seal a key the way the old build did, by writing through the old field.
    await settings.set({ openrouterKey: 'sk-or-v1-sealed' });
    const raw = await rawStored();
    const sealed = raw?.openrouterKeySealed;

    // Now rewrite the record in the old shape, with that envelope under aiKeySealed.
    await seedLegacy({ aiKeySealed: sealed, aiModel: 'openai/gpt-4o-mini' });

    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-or-v1-sealed');
    expect(s.openrouterModel).toBe('openai/gpt-4o-mini');
    expect(s.aiProvider).toBe('openrouter');
    expect(s.anthropicKey).toBeNull();
  });

  it('scrubs the legacy fields from disk after migrating', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-sealed' });
    const sealed = (await rawStored())?.openrouterKeySealed;
    await seedLegacy({ aiKeySealed: sealed, aiModel: 'openai/gpt-4o-mini' });

    await settings.get();

    const raw = await rawStored();
    expect(raw?.aiKeySealed).toBeUndefined();
    expect(raw?.aiKey).toBeUndefined();
    expect(raw?.aiModel).toBeUndefined();
    expect(raw?.openrouterKeySealed).toBeTruthy();
  });

  it('is idempotent across repeated reads', async () => {
    await settings.set({ openrouterKey: 'sk-or-v1-sealed' });
    const sealed = (await rawStored())?.openrouterKeySealed;
    await seedLegacy({ aiKeySealed: sealed, aiModel: 'openai/gpt-4o-mini' });

    expect((await settings.get()).openrouterKey).toBe('sk-or-v1-sealed');
    expect((await settings.get()).openrouterKey).toBe('sk-or-v1-sealed');
    expect((await settings.get()).openrouterModel).toBe('openai/gpt-4o-mini');
  });

  it('migrates a pre-v0.3 plaintext key straight into the sealed OpenRouter slot', async () => {
    await seedLegacy({ aiKey: 'sk-or-v1-ancient', aiModel: 'openai/gpt-4o-mini' });

    const s = await settings.get();
    expect(s.openrouterKey).toBe('sk-or-v1-ancient');
    expect(s.openrouterModel).toBe('openai/gpt-4o-mini');

    const raw = await rawStored();
    expect(JSON.stringify(raw)).not.toContain('sk-or-v1-ancient');
    expect(raw?.openrouterKeySealed).toBeTruthy();
  });

  it('leaves a record with no key at all on the defaults', async () => {
    await seedLegacy();
    const s = await settings.get();
    expect(s.openrouterKey).toBeNull();
    expect(s.anthropicKey).toBeNull();
    expect(s.openrouterModel).toBe(DEFAULT_SETTINGS.openrouterModel);
  });
});
