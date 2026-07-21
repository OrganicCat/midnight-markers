import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import Spotlight from '../../../../src/newtab/tour/Spotlight.svelte';
import { createTour } from '../../../../src/newtab/tour/tour.svelte';
import type { TourStep } from '../../../../src/newtab/tour/steps';

const STEPS: TourStep[] = [
  { id: 'a', target: null, title: 'Welcome aboard', body: 'Intro copy.' },
  { id: 'b', target: 'sidebar', title: 'The sidebar', body: 'Filters live here.' },
];

afterEach(cleanup);

function mount(exists: (t: string) => boolean = () => true) {
  const tour = createTour(STEPS, exists);
  render(Spotlight, { props: { tour } });
  return tour;
}

describe('Spotlight', () => {
  it('renders nothing while the tour is inactive', () => {
    mount();
    expect(document.querySelector('[data-tour-overlay]')).toBe(null);
  });

  it('shows the current step once started', async () => {
    const tour = mount();
    tour.start();
    await waitFor(() => expect(screen.getByText('Welcome aboard')).toBeTruthy());
    expect(screen.getByText('Intro copy.')).toBeTruthy();
    expect(document.querySelector('[data-tour-overlay]')).toBeTruthy();
  });

  it('advances with the Next button and finishes on the last step', async () => {
    const onEnd = vi.fn();
    const tour = mount();
    tour.start(onEnd);
    await waitFor(() => screen.getByText('Welcome aboard'));

    await fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getByText('The sidebar')).toBeTruthy());

    // Last step's primary button reads Done, not Next.
    await fireEvent.click(screen.getByText('Done'));
    await waitFor(() => expect(document.querySelector('[data-tour-overlay]')).toBe(null));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and reports the end', async () => {
    const onEnd = vi.fn();
    const tour = mount();
    tour.start(onEnd);
    await waitFor(() => screen.getByText('Welcome aboard'));

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-tour-overlay]')).toBe(null));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('moves with the arrow keys', async () => {
    const tour = mount();
    tour.start();
    await waitFor(() => screen.getByText('Welcome aboard'));

    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('The sidebar')).toBeTruthy());

    await fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText('Welcome aboard')).toBeTruthy());
  });

  it('reports progress as "n of total"', async () => {
    const tour = mount();
    tour.start();
    await waitFor(() => expect(screen.getByText(/1 of 2/)).toBeTruthy());
  });

  it('counts only the steps whose targets exist', async () => {
    const tour = mount(() => false); // no targets on the page
    tour.start();
    await waitFor(() => expect(screen.getByText(/1 of 1/)).toBeTruthy());
    expect(screen.queryByText('The sidebar')).toBe(null);
  });

  it('Skip ends the tour immediately', async () => {
    const onEnd = vi.fn();
    const tour = mount();
    tour.start(onEnd);
    await waitFor(() => screen.getByText('Welcome aboard'));
    await fireEvent.click(screen.getByText('Skip'));
    await waitFor(() => expect(document.querySelector('[data-tour-overlay]')).toBe(null));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
