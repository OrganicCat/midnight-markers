import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';
import { applyUIScale, clampScale, setRootScale, SCALE_OPTIONS } from '$lib/ui-scale';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  document.documentElement.style.fontSize = '';
});

describe('clampScale', () => {
  it('returns 1 for NaN', () => {
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('clamps below 0.9 up to 0.9', () => {
    expect(clampScale(0.5)).toBe(0.9);
  });

  it('clamps above 1.5 down to 1.5', () => {
    expect(clampScale(3)).toBe(1.5);
  });

  it('passes through values in range', () => {
    expect(clampScale(1.15)).toBe(1.15);
  });
});

describe('SCALE_OPTIONS', () => {
  it('contains the standard set including 100%', () => {
    const values = SCALE_OPTIONS.map((o) => o.value);
    expect(values).toContain(1);
    expect(values).toEqual([0.9, 1, 1.15, 1.3, 1.5]);
  });
});

describe('setRootScale', () => {
  it('applies font-size to documentElement', () => {
    setRootScale(1.3);
    expect(document.documentElement.style.fontSize).toBe(`${16 * 1.3}px`);
  });

  it('clamps the value before applying', () => {
    setRootScale(5);
    expect(document.documentElement.style.fontSize).toBe(`${16 * 1.5}px`);
  });
});

describe('applyUIScale', () => {
  it('reads from settings store and applies to font-size', async () => {
    await settings.set({ uiScale: 1.3 });
    await applyUIScale();
    expect(document.documentElement.style.fontSize).toBe(`${16 * 1.3}px`);
  });

  it('uses default 1 when no setting persisted', async () => {
    await applyUIScale();
    expect(document.documentElement.style.fontSize).toBe(`${16}px`);
  });
});
