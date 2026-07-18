import { describe, it, expect } from 'vitest';
import { buildMessages } from '$lib/ai/prompt';

describe('buildMessages', () => {
  const baseInput = {
    title: 'Designing for the long now',
    url: 'https://jakeworth.com/long-now-web',
    description: 'An essay on durable web design.',
    excerpt: 'When we design for the web today, we tend to optimize for...',
    existingTags: ['design', 'webdev', 'longread'],
    existingCollections: [
      { id: '01ABC', path: ['Reading'] },
      { id: '01DEF', path: ['Design'] },
      { id: '01GHI', path: ['Gaming', 'Path of Exile'] },
    ],
  };

  it('returns a system message and a user message', () => {
    const msgs = buildMessages(baseInput);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.role).toBe('user');
  });

  it('system message instructs JSON-only output with the expected schema', () => {
    const msgs = buildMessages(baseInput);
    const sys = msgs[0]!.content;
    expect(sys).toMatch(/JSON/);
    expect(sys).toMatch(/"title"/);
    expect(sys).toMatch(/"tags"/);
    expect(sys).toMatch(/"collectionPath"/);
  });

  it('system message instructs to prefer existing tags and cap new tags at 2', () => {
    const sys = buildMessages(baseInput)[0]!.content;
    expect(sys).toMatch(/prefer existing/i);
    expect(sys).toMatch(/at most 2 new/i);
  });

  it('system message caps collection path depth at 3', () => {
    const sys = buildMessages(baseInput)[0]!.content;
    expect(sys).toMatch(/NEVER more than 3/);
  });

  it('system message encodes the filing rule: fit first, then nest, then invent at altitude', () => {
    const sys = buildMessages(baseInput)[0]!.content;
    // fit-first: reuse an existing path exactly
    expect(sys).toMatch(/fit first/i);
    // nest a sub-folder when close but not exact
    expect(sys).toMatch(/nest/i);
    // prefer a two-level topic > sub-folder path
    expect(sys).toMatch(/two levels/i);
  });

  it('system message warns against over-general, format-based, and over-specific folders', () => {
    const sys = buildMessages(baseInput)[0]!.content;
    // junk-drawer top folders
    expect(sys).toMatch(/\["Learning"\]/);
    // filing by media format instead of topic
    expect(sys).toMatch(/format/i);
    expect(sys).toMatch(/\["Videos", "Tutorials"\]/);
    // over-specific top folder gets nested instead
    expect(sys).toMatch(/\["Raspberry Pi"\]/);
    expect(sys).toContain('["Electronics", "Single-board computers"]');
  });

  it('user message includes the page title, url, description, and excerpt', () => {
    const user = buildMessages(baseInput)[1]!.content;
    expect(user).toContain('Designing for the long now');
    expect(user).toContain('https://jakeworth.com/long-now-web');
    expect(user).toContain('An essay on durable web design.');
    expect(user).toContain('When we design for the web today');
  });

  it('user message lists existing tags and collections as paths', () => {
    const user = buildMessages(baseInput)[1]!.content;
    expect(user).toContain('design');
    expect(user).toContain('webdev');
    expect(user).toContain('Reading');
    expect(user).toContain('Design');
    expect(user).toContain('Gaming > Path of Exile');
  });

  it('handles null description and excerpt gracefully', () => {
    const user = buildMessages({ ...baseInput, description: null, excerpt: null })[1]!.content;
    expect(user).not.toMatch(/null/i);
  });

  it('truncates excerpt at 500 characters', () => {
    const longExcerpt = 'a'.repeat(2000);
    const user = buildMessages({ ...baseInput, excerpt: longExcerpt })[1]!.content;
    const aRuns = user.match(/a{500,}/g) ?? [];
    expect(aRuns.length).toBeLessThanOrEqual(1);
    expect(aRuns[0]?.length ?? 0).toBeLessThanOrEqual(510);
  });

  it('handles empty existingCollections gracefully', () => {
    const user = buildMessages({ ...baseInput, existingCollections: [] })[1]!.content;
    expect(user).toContain('(none yet)');
  });
});
