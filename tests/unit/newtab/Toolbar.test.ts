import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Toolbar from '../../../src/newtab/Toolbar.svelte';

function props(overrides: Record<string, unknown> = {}) {
  return {
    search: '',
    title: 'All bookmarks',
    count: 3,
    view: 'grid' as const,
    onNewCollection: () => {},
    onResort: () => {},
    canResort: true,
    onHelp: () => {},
    ...overrides,
  };
}

describe('Toolbar help button', () => {
  it('calls onHelp when the ? button is clicked', async () => {
    const onHelp = vi.fn();
    render(Toolbar, { props: props({ onHelp }) });
    await fireEvent.click(screen.getByRole('button', { name: /help/i }));
    expect(onHelp).toHaveBeenCalled();
  });
});

describe('Toolbar resort button', () => {
  it('renders a Resort button', () => {
    render(Toolbar, { props: props() });
    expect(screen.getByRole('button', { name: /resort/i })).toBeTruthy();
  });

  it('calls onResort when clicked', async () => {
    const onResort = vi.fn();
    render(Toolbar, { props: props({ onResort }) });
    await fireEvent.click(screen.getByRole('button', { name: /resort/i }));
    expect(onResort).toHaveBeenCalled();
  });

  it('is disabled when the current selection cannot be resorted', () => {
    render(Toolbar, { props: props({ canResort: false }) });
    expect((screen.getByRole('button', { name: /resort/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
