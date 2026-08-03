import { describe, it, expect } from 'vitest';
import { pathKey, isPathPrefix, renderPath } from '$lib/ai/resort/types';

describe('pathKey', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(pathKey([' Dev ', 'RUST'])).toBe(pathKey(['dev', 'rust']));
  });

  it('does not let a space in a name collapse two different paths', () => {
    expect(pathKey(['Web Development', 'React'])).not.toBe(
      pathKey(['Web', 'Development React']),
    );
  });

  it('distinguishes a nested path from a single folder of the same words', () => {
    expect(pathKey(['Design', 'System'])).not.toBe(pathKey(['Design System']));
  });
});

describe('isPathPrefix', () => {
  it('treats a path as its own prefix', () => {
    expect(isPathPrefix(['A', 'B'], ['A', 'B'])).toBe(true);
  });

  it('rejects a longer prefix', () => {
    expect(isPathPrefix(['A', 'B'], ['A'])).toBe(false);
  });
});

describe('renderPath', () => {
  it('labels an empty path', () => {
    expect(renderPath([])).toBe('(unfiled)');
  });
});
