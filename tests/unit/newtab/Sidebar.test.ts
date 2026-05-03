import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Sidebar from '../../../src/newtab/Sidebar.svelte';

describe('Sidebar', () => {
  it('renders smart filters and emits selection', async () => {
    let selected: any = null;
    const { getByText } = render(Sidebar, {
      collections: [],
      tags: [],
      selection: { kind: 'all' },
      onSelect: (s: any) => (selected = s),
    });
    await fireEvent.click(getByText('Starred'));
    expect(selected).toEqual({ kind: 'smart', smart: 'starred' });
  });

  it('renders collections and emits selection', async () => {
    let selected: any = null;
    const collections = [{ id: 'C1', name: 'Reading', parentId: null, color: '#fff', sortOrder: 0, createdAt: 0 }];
    const { getByText } = render(Sidebar, {
      collections,
      tags: [],
      selection: { kind: 'all' },
      onSelect: (s: any) => (selected = s),
    });
    await fireEvent.click(getByText('Reading'));
    expect(selected).toEqual({ kind: 'collection', id: 'C1' });
  });
});
