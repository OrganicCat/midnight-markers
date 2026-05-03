import { describe, it, expect } from 'vitest';
import { newId } from '$lib/ulid';

describe('newId', () => {
  it('produces a 26-char ULID', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('produces monotonically increasing IDs within the same ms', () => {
    const a = newId();
    const b = newId();
    expect(a < b).toBe(true);
  });

  it('produces unique IDs across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(set.size).toBe(1000);
  });
});
