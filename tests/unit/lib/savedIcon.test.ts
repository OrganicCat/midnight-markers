import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '$lib/savedIcon';

describe('normalizeUrl', () => {
  it('treats a fragment as the same page', () => {
    expect(normalizeUrl('https://a.com/x#top')).toBe(normalizeUrl('https://a.com/x'));
  });

  it('ignores a trailing slash on a non-root path', () => {
    expect(normalizeUrl('https://a.com/docs/')).toBe('https://a.com/docs');
  });

  it('keeps the root slash and the query string', () => {
    expect(normalizeUrl('https://A.com')).toBe('https://a.com/');
    expect(normalizeUrl('https://a.com/s?q=1')).not.toBe(normalizeUrl('https://a.com/s?q=2'));
  });

  it('rejects non-web and malformed URLs', () => {
    expect(normalizeUrl('chrome://newtab/')).toBeNull();
    expect(normalizeUrl('about:blank')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });
});
