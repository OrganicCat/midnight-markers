import { describe, it, expect } from 'vitest';
import {
  FILING_SYSTEM_PROMPT,
  buildFilingMessages,
  parseSkeleton,
  parseFilings,
} from '$lib/ai/resort/filing';

describe('buildFilingMessages', () => {
  it('lists the full skeleton and the batch', () => {
    const msgs = buildFilingMessages({
      skeleton: [['Dev', 'Rust'], ['Cooking']],
      batch: [{ id: 'b1', title: 'Borrow checker', domain: 'rust-lang.org', path: ['Old'] }],
    });
    expect(msgs[0]!.content).toBe(FILING_SYSTEM_PROMPT);
    expect(msgs[1]!.content).toContain('Dev > Rust');
    expect(msgs[1]!.content).toContain('Cooking');
    expect(msgs[1]!.content).toContain('b1 — Borrow checker — rust-lang.org — Old');
  });

  it('forbids inventing folders in the system prompt', () => {
    expect(FILING_SYSTEM_PROMPT).toMatch(/only.*folders listed|do not invent/i);
    expect(FILING_SYSTEM_PROMPT).toContain('"id"');
    expect(FILING_SYSTEM_PROMPT).toContain('"path"');
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
  const ids = new Set(['b1', 'b2']);

  it('accepts filings whose path is in the skeleton', () => {
    expect(parseFilings([{ id: 'b1', path: ['Dev', 'Rust'] }], allowed, ids)).toEqual([
      { id: 'b1', path: ['Dev', 'Rust'] },
    ]);
  });

  it('matches skeleton paths case-insensitively but returns the skeleton casing', () => {
    expect(parseFilings([{ id: 'b1', path: ['dev', 'RUST'] }], allowed, ids)).toEqual([
      { id: 'b1', path: ['Dev', 'Rust'] },
    ]);
  });

  it('rejects paths not in the skeleton', () => {
    expect(parseFilings([{ id: 'b1', path: ['Invented'] }], allowed, ids)).toEqual([]);
  });

  it('rejects unknown ids and duplicate ids', () => {
    expect(parseFilings([{ id: 'nope', path: ['Cooking'] }], allowed, ids)).toEqual([]);
    const dupes = parseFilings(
      [{ id: 'b1', path: ['Cooking'] }, { id: 'b1', path: ['Dev', 'Rust'] }],
      allowed,
      ids,
    );
    expect(dupes).toHaveLength(1);
  });

  it('unwraps a { filings: [...] } or { results: [...] } envelope', () => {
    expect(parseFilings({ filings: [{ id: 'b2', path: ['Cooking'] }] }, allowed, ids)).toHaveLength(1);
    expect(parseFilings({ results: [{ id: 'b2', path: ['Cooking'] }] }, allowed, ids)).toHaveLength(1);
  });

  it('returns empty for junk', () => {
    expect(parseFilings(null, allowed, ids)).toEqual([]);
    expect(parseFilings([{ id: 5, path: 'x' }], allowed, ids)).toEqual([]);
  });
});
