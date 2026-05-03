import { describe, it, expect } from 'vitest';
import { extractJSON, parseModelJSON } from '$lib/ai/parse';

describe('extractJSON', () => {
  it('returns plain JSON unchanged', () => {
    expect(extractJSON('{"a":1}')).toBe('{"a":1}');
  });

  it('strips ```json ... ``` fences', () => {
    const wrapped = '```json\n{"a":1}\n```';
    expect(extractJSON(wrapped)).toBe('{"a":1}');
  });

  it('strips bare ``` ... ``` fences', () => {
    const wrapped = '```\n{"a":1}\n```';
    expect(extractJSON(wrapped)).toBe('{"a":1}');
  });

  it('handles fenced JSON with leading/trailing whitespace', () => {
    const wrapped = '   ```json\n  {"a":1}  \n```   ';
    expect(extractJSON(wrapped)).toBe('{"a":1}');
  });

  it('handles fenced JSON with multiple lines and indentation', () => {
    const wrapped = '```json\n{\n  "title": "Foo",\n  "tags": ["a", "b"],\n  "collectionId": null\n}\n```';
    const out = extractJSON(wrapped);
    expect(JSON.parse(out)).toEqual({ title: 'Foo', tags: ['a', 'b'], collectionId: null });
  });

  it('strips an unclosed leading fence (truncated response)', () => {
    const wrapped = '```json\n{"a":1}';
    const out = extractJSON(wrapped);
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it('extracts JSON object from prose preamble', () => {
    const prose = "Here's the result:\n\n{\"a\":1}\n\nLet me know if you need more.";
    expect(JSON.parse(extractJSON(prose))).toEqual({ a: 1 });
  });

  it('handles the actual Claude Haiku response format from the bug report', () => {
    const raw = '```json\n{\n  "title": "Spectre Summoner Necromancer Build Guide PoE",\n  "tags": ["poe", "necromancer", "summoner", "build-guide"],\n  "collectionId": null\n}\n```';
    const parsed = JSON.parse(extractJSON(raw));
    expect(parsed.title).toBe('Spectre Summoner Necromancer Build Guide PoE');
    expect(parsed.tags).toEqual(['poe', 'necromancer', 'summoner', 'build-guide']);
    expect(parsed.collectionId).toBeNull();
  });

  it('returns input unchanged when there are no braces', () => {
    expect(extractJSON('totally not json')).toBe('totally not json');
  });
});

describe('parseModelJSON', () => {
  it('parses fenced JSON', () => {
    expect(parseModelJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses plain JSON', () => {
    expect(parseModelJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('throws on unparseable input', () => {
    expect(() => parseModelJSON('not json')).toThrow();
  });
});
