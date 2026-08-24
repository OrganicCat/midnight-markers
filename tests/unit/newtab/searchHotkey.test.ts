import { describe, it, expect } from 'vitest';
import {
  SEARCH_HOTKEY_LABEL,
  SEARCH_PLACEHOLDER,
  focusSearch,
  isSearchHotkey,
} from '../../../src/newtab/searchHotkey';

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('isSearchHotkey', () => {
  it('matches Ctrl+Shift+F and Cmd+Shift+F', () => {
    expect(isSearchHotkey(key({ key: 'f', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isSearchHotkey(key({ key: 'F', metaKey: true, shiftKey: true }))).toBe(true);
  });

  it('still accepts the old Ctrl/Cmd+K', () => {
    expect(isSearchHotkey(key({ key: 'k', ctrlKey: true }))).toBe(true);
  });

  it('ignores plain keys and browser shortcuts we do not own', () => {
    expect(isSearchHotkey(key({ key: 'f' }))).toBe(false);
    expect(isSearchHotkey(key({ key: 'f', ctrlKey: true }))).toBe(false); // browser find
    expect(isSearchHotkey(key({ key: 'k', ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

describe('placeholder', () => {
  it('names the hotkey', () => {
    expect(SEARCH_PLACEHOLDER).toContain(SEARCH_HOTKEY_LABEL);
    expect(SEARCH_PLACEHOLDER).toContain('Search bookmarks');
  });
});

describe('focusSearch', () => {
  it('focuses the tagged input', () => {
    document.body.innerHTML = '<input data-search-input />';
    focusSearch();
    expect(document.activeElement).toBe(document.querySelector('input'));
  });

  it('does nothing when there is no search box', () => {
    document.body.innerHTML = '';
    expect(() => focusSearch()).not.toThrow();
  });
});
