import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TagPicker from '../../../src/popup/TagPicker.svelte';
import { _resetDbForTests } from '$lib/storage/db';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('TagPicker', () => {
  it('renders existing tag pills passed in', () => {
    const t = { id: 'T1', name: 'design', count: 1 };
    const { getByText } = render(TagPicker, { selectedIds: [t.id], allTags: [t] });
    expect(getByText('design')).toBeTruthy();
  });

  it('shows autocomplete suggestions when typing', async () => {
    const all = [
      { id: 'T1', name: 'design', count: 1 },
      { id: 'T2', name: 'webdev', count: 1 },
    ];
    const { getByPlaceholderText, findByText } = render(TagPicker, { selectedIds: [], allTags: all });
    const input = getByPlaceholderText('add tag') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'des' } });
    expect(await findByText('design')).toBeTruthy();
  });
});
