import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('newId in a service worker', () => {
  // A Manifest V3 service worker has `crypto` but no `window`. The `ulid`
  // package's random-source detection only looked at `window.crypto`, so
  // importing it threw there and took the whole background script down
  // ("Service worker registration failed. Status code: 15").
  //
  // Node had a `require('crypto')` fallback that a worker doesn't, so a plain
  // "does it throw" test passed here regardless. What matters is that the
  // randomness comes from `globalThis.crypto`, the source a worker does have.
  it('draws randomness from globalThis.crypto when there is no window', async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    try {
      const { newId } = await import('$lib/ulid');
      expect(newId()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps IDs increasing when the clock steps backwards', async () => {
    vi.resetModules();
    const { newId } = await import('$lib/ulid');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      const a = newId();
      now.mockReturnValue(1_799_999_999_000);
      const b = newId();
      expect(a < b).toBe(true);
      expect(b.slice(0, 10)).toBe(a.slice(0, 10));
    } finally {
      now.mockRestore();
    }
  });

  it('encodes the timestamp the way the ULID spec does', async () => {
    vi.resetModules();
    const { newId } = await import('$lib/ulid');
    // Spec example: 1469918176385 encodes as 01ARYZ6S41.
    const now = vi.spyOn(Date, 'now').mockReturnValue(1469918176385);
    try {
      expect(newId().slice(0, 10)).toBe('01ARYZ6S41');
    } finally {
      now.mockRestore();
    }
  });
});
