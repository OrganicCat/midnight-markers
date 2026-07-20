import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests, getDb } from '$lib/storage/db';
import { seal, unseal, isSealed, getOrCreateKey, _resetKeyForTests } from '$lib/storage/crypto';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('crypto', () => {
  it('round-trips a value', async () => {
    const sealed = await seal('sk-or-v1-secret');
    expect(await unseal(sealed)).toBe('sk-or-v1-secret');
  });

  it('produces ciphertext that does not contain the plaintext', async () => {
    const sealed = await seal('sk-or-v1-secret');
    const asText = JSON.stringify(sealed);
    expect(asText).not.toContain('sk-or-v1');
    expect(asText).not.toContain('secret');
  });

  it('uses a fresh IV per seal, so identical inputs differ', async () => {
    const a = await seal('same');
    const b = await seal('same');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
    expect(await unseal(a)).toBe('same');
    expect(await unseal(b)).toBe('same');
  });

  it('reuses one persisted key across calls', async () => {
    // IndexedDB structured-clones the CryptoKey on each read, so the two
    // handles are distinct objects. What matters is that they are the same
    // *key*: a value sealed via one must open via the other.
    const sealed = await seal('cross-handle');
    _resetDbForTests();
    expect(await unseal(sealed)).toBe('cross-handle');

    const k1 = await getOrCreateKey();
    const k2 = await getOrCreateKey();
    expect(k1.algorithm).toEqual(k2.algorithm);
    expect(k1.extractable).toBe(false);
  });

  it('stores the key as NON-EXTRACTABLE so it cannot be read back out', async () => {
    const key = await getOrCreateKey();
    expect(key.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('never writes raw key bytes into the secrets store', async () => {
    await getOrCreateKey();
    const db = await getDb();
    const stored = await db.get('secrets', 'aes-key-v1');
    // A CryptoKey, not an ArrayBuffer / byte array.
    expect(stored).toBeInstanceOf(CryptoKey);
  });

  it('returns null rather than throwing when the envelope cannot be opened', async () => {
    const sealed = await seal('value');
    await _resetKeyForTests();
    expect(await unseal(sealed)).toBeNull();
  });

  it('returns null for a corrupted envelope', async () => {
    const sealed = await seal('value');
    sealed.ct[0] = (sealed.ct[0]! + 1) % 256;
    expect(await unseal(sealed)).toBeNull();
  });

  it('isSealed recognises envelopes and rejects anything else', () => {
    expect(isSealed({ iv: [1], ct: [2] })).toBe(true);
    expect(isSealed('sk-or-v1-plaintext')).toBe(false);
    expect(isSealed(null)).toBe(false);
    expect(isSealed({})).toBe(false);
  });
});
