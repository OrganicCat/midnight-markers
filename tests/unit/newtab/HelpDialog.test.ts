import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import HelpDialog from '../../../src/newtab/HelpDialog.svelte';
import { SHORTCUTS } from '../../../src/newtab/tour/shortcuts';

afterEach(cleanup);

describe('HelpDialog', () => {
  it('lists every keyboard shortcut', () => {
    render(HelpDialog, { props: { onClose: () => {}, onStartTour: () => {} } });
    for (const s of SHORTCUTS) {
      expect(screen.getByText(s.description)).toBeTruthy();
    }
  });

  it('starts the tour from the replay button', async () => {
    const onStartTour = vi.fn();
    render(HelpDialog, { props: { onClose: () => {}, onStartTour } });
    await fireEvent.click(screen.getByText(/replay guided tour/i));
    expect(onStartTour).toHaveBeenCalled();
  });

  it('closes on the ✕ button', async () => {
    const onClose = vi.fn();
    render(HelpDialog, { props: { onClose, onStartTour: () => {} } });
    await fireEvent.click(screen.getByRole('button', { name: /close help/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(HelpDialog, { props: { onClose, onStartTour: () => {} } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('says AI is off until a key is added', () => {
    render(HelpDialog, { props: { onClose: () => {}, onStartTour: () => {} } });
    expect(screen.getByText(/off until you add your own OpenRouter key/i)).toBeTruthy();
  });
});
