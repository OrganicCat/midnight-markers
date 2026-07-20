import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ResortTree from '../../../src/newtab/ResortTree.svelte';
import type { PreviewNode } from '$lib/ai/resort/types';

function node(partial: Partial<PreviewNode> & { name: string }): PreviewNode {
  return {
    id: `path:${partial.name}`,
    name: partial.name,
    path: partial.path ?? [partial.name],
    badge: partial.badge ?? null,
    changeKey: partial.changeKey ?? null,
    children: partial.children ?? [],
    bookmarks: partial.bookmarks ?? [],
  };
}

describe('ResortTree', () => {
  it('renders nested folder names', () => {
    render(ResortTree, {
      props: {
        nodes: [node({ name: 'Dev', children: [node({ name: 'Rust', path: ['Dev', 'Rust'] })] })],
        selected: new Set<string>(),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getByText('Rust')).toBeTruthy();
  });

  it('shows a badge for each change kind', () => {
    render(ResortTree, {
      props: {
        nodes: [
          node({ name: 'A', badge: { kind: 'new' }, changeKey: 'new:a' }),
          node({ name: 'B', badge: { kind: 'renamed', from: 'Old' }, changeKey: 'rename:b' }),
          node({ name: 'C', badge: { kind: 'merged', from: 'Dupe' }, changeKey: 'merge:c' }),
          node({ name: 'D', badge: { kind: 'deleted' }, changeKey: 'del:d' }),
        ],
        selected: new Set<string>(),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.getByText('renamed from Old')).toBeTruthy();
    expect(screen.getByText('merged from Dupe')).toBeTruthy();
    expect(screen.getByText('will be deleted')).toBeTruthy();
  });

  it('renders a checkbox only for changed rows', () => {
    render(ResortTree, {
      props: {
        nodes: [node({ name: 'Changed', changeKey: 'new:a' }), node({ name: 'Same' })],
        selected: new Set<string>(),
        onToggle: () => {},
      },
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('reflects the selected set in the checkbox state', () => {
    render(ResortTree, {
      props: {
        nodes: [node({ name: 'A', changeKey: 'new:a' })],
        selected: new Set(['new:a']),
        onToggle: () => {},
      },
    });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('calls onToggle with the change key when clicked', async () => {
    const onToggle = vi.fn();
    render(ResortTree, {
      props: { nodes: [node({ name: 'A', changeKey: 'new:a' })], selected: new Set<string>(), onToggle },
    });
    await fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('new:a');
  });

  it('shows a bookmark row with its origin path', () => {
    render(ResortTree, {
      props: {
        nodes: [
          node({
            name: 'Dev',
            bookmarks: [{ id: 'b1', title: 'Borrow checker', fromPath: ['Old', 'Junk'], changeKey: 'move:b1' }],
          }),
        ],
        selected: new Set(['move:b1']),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('Borrow checker')).toBeTruthy();
    expect(screen.getByText('← Old > Junk')).toBeTruthy();
  });

  it('shows an unfiled origin as ← Unfiled', () => {
    render(ResortTree, {
      props: {
        nodes: [node({ name: 'Dev', bookmarks: [{ id: 'b1', title: 'Loose', fromPath: [], changeKey: 'move:b1' }] })],
        selected: new Set(['move:b1']),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('← Unfiled')).toBeTruthy();
  });
});
