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

  const col = (id: string, name: string, parentId: string | null = null) => ({
    id, name, parentId, color: '#fff', sortOrder: 0, createdAt: 0,
  });

  it('offers rename, resort and delete on right-click', async () => {
    const { getByText } = render(Sidebar, {
      collections: [col('C1', 'Reading')],
      tags: [],
      selection: { kind: 'all' },
      onSelect: () => {},
      onResortCollection: () => {},
      onRenameCollection: () => {},
      onDeleteCollection: () => {},
    });
    await fireEvent.contextMenu(getByText('Reading'));
    expect(getByText('Rename…')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
    expect(getByText('✦ Resort this folder')).toBeTruthy();
  });

  it('emits the collection id when delete is chosen', async () => {
    let deleted: string | null = null;
    const { getByText } = render(Sidebar, {
      collections: [col('C1', 'Reading')],
      tags: [],
      selection: { kind: 'all' },
      onSelect: () => {},
      onDeleteCollection: (id: string) => (deleted = id),
    });
    await fireEvent.contextMenu(getByText('Reading'));
    await fireEvent.click(getByText('Delete'));
    expect(deleted).toBe('C1');
  });

  it('offers a merge only when a same-named sibling exists', async () => {
    const { getByText, queryByText } = render(Sidebar, {
      collections: [col('C1', 'Games'), col('C2', 'Solo')],
      tags: [],
      selection: { kind: 'all' },
      onSelect: () => {},
      onMergeDuplicates: () => {},
    });
    await fireEvent.contextMenu(getByText('Solo'));
    expect(queryByText(/Merge/)).toBeNull();
  });

  it('offers to merge same-named siblings into the one clicked', async () => {
    let merged: string | null = null;
    const { getAllByText, getByText } = render(Sidebar, {
      collections: [col('C1', 'Games'), col('C2', 'games')],
      tags: [],
      selection: { kind: 'all' },
      onSelect: () => {},
      onMergeDuplicates: (id: string) => (merged = id),
    });
    await fireEvent.contextMenu(getAllByText('Games')[0]!);
    await fireEvent.click(getByText('Merge 1 duplicate into this'));
    expect(merged).toBe('C1');
  });

  it('does not treat a same-named collection under another parent as a duplicate', async () => {
    const { getByText, queryByText } = render(Sidebar, {
      collections: [col('P1', 'Gaming'), col('C1', 'Builds'), col('C2', 'Builds', 'P1')],
      tags: [],
      selection: { kind: 'all' },
      onSelect: () => {},
      onMergeDuplicates: () => {},
    });
    await fireEvent.contextMenu(getByText('Gaming'));
    expect(queryByText(/Merge/)).toBeNull();
  });
});
