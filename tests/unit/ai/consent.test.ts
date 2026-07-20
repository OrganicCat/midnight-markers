import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings, DEFAULT_SETTINGS } from '$lib/storage/settings';
import { canUseAI, whyBlocked } from '$lib/ai/consent';
import { suggestForBookmarkResult } from '$lib/ai/suggest';
import type { Settings } from '$lib/types';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});
afterEach(() => vi.unstubAllGlobals());

function s(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

const ALL_ON = { tags: true, title: true, collection: true };

describe('canUseAI', () => {
  it('is false with no consent, even with a key and features on', () => {
    expect(canUseAI(s({ aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON, aiConsentAt: null }))).toBe(false);
  });

  it('is false with consent but no key', () => {
    expect(canUseAI(s({ aiKey: null, aiFeatures: ALL_ON, aiConsentAt: 1 }))).toBe(false);
  });

  it('is false with consent and key but every feature off', () => {
    expect(canUseAI(s({ aiKey: 'sk-or-v1-x', aiConsentAt: 1 }))).toBe(false);
  });

  it('is true only when all three hold', () => {
    expect(canUseAI(s({ aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON, aiConsentAt: 1 }))).toBe(true);
  });
});

describe('whyBlocked', () => {
  it('names consent first', () => {
    expect(whyBlocked(s({ aiConsentAt: null }))).toMatch(/disclosure/i);
  });
  it('names the missing key next', () => {
    expect(whyBlocked(s({ aiConsentAt: 1 }))).toMatch(/api key/i);
  });
  it('names the disabled features last', () => {
    expect(whyBlocked(s({ aiConsentAt: 1, aiKey: 'sk-or-v1-x' }))).toMatch(/turned off/i);
  });
  it('is null when the gate is open', () => {
    expect(whyBlocked(s({ aiConsentAt: 1, aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON }))).toBeNull();
  });
});

describe('suggestForBookmarkResult consent gate', () => {
  const input = {
    title: 'T',
    url: 'https://example.com',
    description: null,
    excerpt: null,
    existingTags: [],
    existingCollections: [],
  };

  it('makes NO network request when consent is absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await settings.set({ aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON });

    const r = await suggestForBookmarkResult(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('no-consent');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proceeds once consent is recorded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: null, tags: ['x'] }) } }],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await settings.set({ aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON, aiConsentAt: Date.now() });

    const r = await suggestForBookmarkResult(input);
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops again after consent is withdrawn', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await settings.set({ aiKey: 'sk-or-v1-x', aiFeatures: ALL_ON, aiConsentAt: Date.now() });
    await settings.set({ aiConsentAt: null });

    const r = await suggestForBookmarkResult(input);
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
