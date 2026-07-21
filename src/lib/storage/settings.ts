import { getDb } from './db';
import { emit } from './events';
import { seal, unseal, isSealed, type Sealed } from './crypto';
import type { Settings } from '$lib/types';

const KEY = 'singleton';

export const DEFAULT_SETTINGS: Settings = {
  aiKey: null,
  aiModel: 'anthropic/claude-haiku-4.5',
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
 * What actually lands in IndexedDB. The API key is never persisted in the
 * clear: it lives in `aiKeySealed` as an AES-GCM envelope whose key is a
 * non-extractable CryptoKey (see ./crypto). `aiKey` is absent from the stored
 * shape; it exists only on the in-memory Settings object callers see.
 */
type StoredSettings = Omit<Settings, 'aiKey'> & {
  aiKeySealed?: Sealed | null;
  /** Legacy plaintext field, migrated away on first read. Pre-v0.3 only. */
  aiKey?: string | null;
};

export const settings = {
  async get(): Promise<Settings> {
    const db = await getDb();
    const stored = (await db.get('settings', KEY)) as StoredSettings | undefined;
    if (!stored) return { ...DEFAULT_SETTINGS };

    const { aiKeySealed, aiKey: legacyPlaintext, ...rest } = stored;

    let aiKey: string | null = null;
    if (isSealed(aiKeySealed)) {
      aiKey = await unseal(aiKeySealed);
    } else if (typeof legacyPlaintext === 'string' && legacyPlaintext.length > 0) {
      // Upgrade in place: an older build stored this in the clear. Written
      // directly rather than through set(), which would recurse back here.
      aiKey = legacyPlaintext;
      const migrated: StoredSettings = {
        ...DEFAULT_SETTINGS,
        ...rest,
        aiKeySealed: await seal(aiKey),
      };
      delete migrated.aiKey;
      await db.put('settings', migrated as unknown as Settings, KEY);
    }

    return { ...DEFAULT_SETTINGS, ...rest, aiKey };
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

      const { aiKey, ...rest } = next;
      const toStore: StoredSettings = {
        ...rest,
        aiKeySealed: aiKey ? await seal(aiKey) : null,
      };
      // Guarantee the legacy plaintext field cannot survive a write.
      delete toStore.aiKey;

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
