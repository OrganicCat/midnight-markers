import { describe, it, expect } from 'vitest';
import {
  FILING_SYSTEM_PROMPT,
  buildFilingMessages,
  parseSkeleton,
  parseFilings,
} from '$lib/ai/resort/filing';
import type { BookmarkRef } from '$lib/ai/resort/types';

describe('buildFilingMessages', () => {
  it('numbers the skeleton folders and the batch', () => {
    const msgs = buildFilingMessages({
      skeleton: [['Dev', 'Rust'], ['Cooking']],
      batch: [{ id: 'b1', title: 'Borrow checker', domain: 'rust-lang.org', path: ['Old'] }],
    });
    expect(msgs[0]!.content).toBe(FILING_SYSTEM_PROMPT);
    expect(msgs[1]!.content).toContain('0. Dev > Rust');
    expect(msgs[1]!.content).toContain('1. Cooking');
    expect(msgs[1]!.content).toContain('0 — Borrow checker — rust-lang.org — Old');
  });

  it('keeps the ULID out of the prompt entirely', () => {
    const msgs = buildFilingMessages({
      skeleton: [['Cooking']],
      batch: [
        { id: '01J8ZQK3M5N7P9R2T4V6X8Y0AB', title: 'Bread', domain: 'x.com', path: [] },
      ],
    });
    // The id costs ~13 tokens per bookmark and the model never needs it —
    // it answers with the batch index instead.
    expect(msgs[1]!.content).not.toContain('01J8ZQK3M5N7P9R2T4V6X8Y0AB');
  });

  it('asks for index pairs in the system prompt', () => {
    expect(FILING_SYSTEM_PROMPT).toMatch(/only.*folders listed|do not invent/i);
    expect(FILING_SYSTEM_PROMPT).toContain('"f"');
    expect(FILING_SYSTEM_PROMPT).not.toContain('"id"');
  });
});

describe('parseSkeleton', () => {
  it('reads a well-formed skeleton', () => {
    const s = parseSkeleton({
      folders: [['Dev', 'Rust']],
      renames: [{ from: ['Stuff'], to: 'Reference' }],
      merges: [{ from: ['Web Dev'], into: ['Dev'] }],
    });
    expect(s.folders).toEqual([['Dev', 'Rust']]);
    expect(s.renames).toEqual([{ from: ['Stuff'], to: 'Reference' }]);
    expect(s.merges).toEqual([{ from: ['Web Dev'], into: ['Dev'] }]);
  });

  it('clamps folders deeper than 3 and trims names', () => {
    const s = parseSkeleton({ folders: [['  A  ', 'B', 'C', 'D']] });
    expect(s.folders).toEqual([['A', 'B', 'C']]);
  });

  it('drops empty paths, non-strings and duplicates', () => {
    const s = parseSkeleton({ folders: [[], ['A'], ['a'], [7, 'B'], 'nope'] });
    expect(s.folders).toEqual([['A'], ['B']]);
  });

  it('returns empty arrays for junk input', () => {
    expect(parseSkeleton(null)).toEqual({ folders: [], renames: [], merges: [] });
    expect(parseSkeleton({ folders: 'x', renames: 5 })).toEqual({ folders: [], renames: [], merges: [] });
  });

  it('drops renames with a blank or non-string target', () => {
    const s = parseSkeleton({ folders: [['A']], renames: [{ from: ['A'], to: '  ' }, { from: ['A'], to: 3 }] });
    expect(s.renames).toEqual([]);
  });

  it('drops a merge into itself', () => {
    const s = parseSkeleton({ folders: [['A']], merges: [{ from: ['A'], into: ['a'] }] });
    expect(s.merges).toEqual([]);
  });
});

describe('parseFilings', () => {
  const allowed = [['Dev', 'Rust'], ['Cooking']];
  const batch: BookmarkRef[] = [
    { id: 'b1', title: 'One', domain: 'a.com', path: [] },
    { id: 'b2', title: 'Two', domain: 'b.com', path: [] },
  ];

  it('resolves index pairs back to real ids and skeleton paths', () => {
    expect(parseFilings({ f: [[0, 0], [1, 1]] }, allowed, batch)).toEqual([
      { id: 'b1', path: ['Dev', 'Rust'] },
      { id: 'b2', path: ['Cooking'] },
    ]);
  });

  it('returns the skeleton array itself, not a copy of the model output', () => {
    const out = parseFilings({ f: [[0, 0]] }, allowed, batch);
    expect(out[0]!.path).toBe(allowed[0]);
  });

  it('rejects out-of-range indices on either side', () => {
    expect(parseFilings({ f: [[9, 0]] }, allowed, batch)).toEqual([]);
    expect(parseFilings({ f: [[0, 9]] }, allowed, batch)).toEqual([]);
    expect(parseFilings({ f: [[-1, 0]] }, allowed, batch)).toEqual([]);
  });

  it('rejects non-integer indices', () => {
    expect(parseFilings({ f: [[0.5, 0]] }, allowed, batch)).toEqual([]);
    expect(parseFilings({ f: [['0', '1']] }, allowed, batch)).toEqual([]);
  });

  it('keeps the first filing when a bookmark is named twice', () => {
    const out = parseFilings({ f: [[0, 1], [0, 0]] }, allowed, batch);
    expect(out).toEqual([{ id: 'b1', path: ['Cooking'] }]);
  });

  it('accepts a bare array with no envelope', () => {
    expect(parseFilings([[0, 1]], allowed, batch)).toEqual([{ id: 'b1', path: ['Cooking'] }]);
  });

  it('accepts filings / results / bookmarks as the envelope key', () => {
    expect(parseFilings({ filings: [[0, 1]] }, allowed, batch)).toHaveLength(1);
    expect(parseFilings({ results: [[0, 1]] }, allowed, batch)).toHaveLength(1);
    expect(parseFilings({ bookmarks: [[0, 1]] }, allowed, batch)).toHaveLength(1);
  });

  it('accepts object entries as well as tuples', () => {
    expect(parseFilings({ f: [{ b: 0, f: 1 }] }, allowed, batch)).toEqual([
      { id: 'b1', path: ['Cooking'] },
    ]);
  });

  it('drops bad entries without losing the rest of the batch', () => {
    const out = parseFilings({ f: [[0, 0], 'junk', [99, 0], [1, 1]] }, allowed, batch);
    expect(out).toEqual([
      { id: 'b1', path: ['Dev', 'Rust'] },
      { id: 'b2', path: ['Cooking'] },
    ]);
  });

  it('returns empty for junk', () => {
    expect(parseFilings(null, allowed, batch)).toEqual([]);
    expect(parseFilings({ f: 'nope' }, allowed, batch)).toEqual([]);
    expect(parseFilings({ f: [[0, 0]] }, [], batch)).toEqual([]);
  });
});
