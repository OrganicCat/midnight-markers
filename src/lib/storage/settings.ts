import { getDb } from './db';
import { emit } from './events';
import { seal, unseal, isSealed, type Sealed } from './crypto';
import type { Settings } from '$lib/types';

const KEY = 'singleton';

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'openrouter',
  openrouterKey: null,
  openrouterModel: 'anthropic/claude-haiku-4.5',
  anthropicKey: null,
  anthropicModel: 'claude-haiku-4-5',
  // Off by default. Nothing is sent anywhere until the user reads the
  // disclosure, accepts it, and turns a feature on. See aiConsentAt.
  aiFeatures: { tags: false, title: false, collection: false },
  aiConsentAt: null,
  defaultView: 'grid',
  defaultCollectionId: null,
  uiScale: 1,
  tourSeenAt: null,
};

/**
 * What actually lands in IndexedDB. No API key is ever persisted in the clear:
 * each lives in its own AES-GCM envelope whose key is a non-extractable
 * CryptoKey (see ./crypto). The plaintext key fields are absent from the
 * stored shape; they exist only on the in-memory Settings object callers see.
 */
type StoredSettings = Omit<Settings, 'openrouterKey' | 'anthropicKey'> & {
  openrouterKeySealed?: Sealed | null;
  anthropicKeySealed?: Sealed | null;
  /** Legacy plaintext fields, migrated away on first read. */
  openrouterKey?: string | null;
  anthropicKey?: string | null;
  /** Pre-v0.4 single-provider shape: the OpenRouter key and model. */
  aiKeySealed?: Sealed | null;
  aiKey?: string | null;
  aiModel?: string;
};

/** Strips every plaintext-key and legacy field so none can survive a write. */
function scrub(s: StoredSettings): StoredSettings {
  delete s.openrouterKey;
  delete s.anthropicKey;
  delete s.aiKey;
  delete s.aiKeySealed;
  delete s.aiModel;
  return s;
}

export const settings = {
  async get(): Promise<Settings> {
    const db = await getDb();
    const stored = (await db.get('settings', KEY)) as StoredSettings | undefined;
    if (!stored) return { ...DEFAULT_SETTINGS };

    const {
      openrouterKeySealed,
      anthropicKeySealed,
      openrouterKey: legacyOpenrouterPlaintext,
      anthropicKey: legacyAnthropicPlaintext,
      aiKeySealed: legacySealed,
      aiKey: legacyPlaintext,
      aiModel: legacyModel,
      ...rest
    } = stored;

    let openrouterKey: string | null = null;
    let anthropicKey: string | null = null;
    // Set when this read has to rewrite the record to complete a migration.
    let migratedModel: string | undefined;
    let needsWriteback = false;

    if (isSealed(openrouterKeySealed)) {
      openrouterKey = await unseal(openrouterKeySealed);
    } else if (isSealed(legacySealed)) {
      // Pre-v0.4: a single sealed key that was, by definition, the OpenRouter
      // one. Re-home it without ever putting it back on disk in the clear.
      openrouterKey = await unseal(legacySealed);
      needsWriteback = true;
    } else if (typeof legacyPlaintext === 'string' && legacyPlaintext.length > 0) {
      // Pre-v0.3: stored in the clear by an older build. Seal it now.
      openrouterKey = legacyPlaintext;
      needsWriteback = true;
    } else if (
      typeof legacyOpenrouterPlaintext === 'string' &&
      legacyOpenrouterPlaintext.length > 0
    ) {
      openrouterKey = legacyOpenrouterPlaintext;
      needsWriteback = true;
    }

    if (isSealed(anthropicKeySealed)) {
      anthropicKey = await unseal(anthropicKeySealed);
    } else if (
      typeof legacyAnthropicPlaintext === 'string' &&
      legacyAnthropicPlaintext.length > 0
    ) {
      anthropicKey = legacyAnthropicPlaintext;
      needsWriteback = true;
    }

    // Pre-v0.4 `aiModel` was the OpenRouter model. Only adopt it when the new
    // field is absent, so a completed migration is never undone.
    if (typeof legacyModel === 'string' && legacyModel.length > 0 && !rest.openrouterModel) {
      migratedModel = legacyModel;
      needsWriteback = true;
    }

    const result: Settings = {
      ...DEFAULT_SETTINGS,
      ...rest,
      ...(migratedModel ? { openrouterModel: migratedModel } : {}),
      openrouterKey,
      anthropicKey,
    };

    if (needsWriteback) {
      // Written directly rather than through set(), which would recurse back
      // here. Every legacy field is scrubbed so none can survive.
      const { openrouterKey: ork, anthropicKey: ank, ...plain } = result;
      const migrated: StoredSettings = scrub({
        ...plain,
        openrouterKeySealed: ork ? await seal(ork) : null,
        anthropicKeySealed: ank ? await seal(ank) : null,
      });
      await db.put('settings', migrated as unknown as Settings, KEY);
    }

    return result;
  },

  /**
   * Merge `patch` into the stored settings.
   *
   * Writes are serialized through {@link writeQueue}. Every set() is a
   * read-modify-write with several awaits in the middle, so two callers that
   * overlap — and on the new tab page they do, the view preference and the
   * tour flag are both written during first paint — would each read the same
   * "current" and the second put() would silently drop the first one's field.
   */
  set(patch: Partial<Settings>): Promise<Settings> {
    return enqueue(async () => {
      const db = await getDb();
      const current = await this.get();
      const next: Settings = { ...current, ...patch };

      const { openrouterKey, anthropicKey, ...rest } = next;
      const toStore: StoredSettings = scrub({
        ...rest,
        openrouterKeySealed: openrouterKey ? await seal(openrouterKey) : null,
        anthropicKeySealed: anthropicKey ? await seal(anthropicKey) : null,
      });

      await db.put('settings', toStore as unknown as Settings, KEY);
      emit({ type: 'settings:changed' });
      return next;
    });
  },
};

/**
 * Tail of the write chain. Each enqueued job starts only after the previous
 * one has settled, so read-modify-write cycles can't interleave. A rejected
 * job doesn't poison the chain for the jobs behind it.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(job, job);
  writeQueue = run.catch(() => {});
  return run;
}
