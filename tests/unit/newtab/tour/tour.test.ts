import { describe, it, expect, vi } from 'vitest';
import { createTour, resolveSteps } from '../../../../src/newtab/tour/tour.svelte';
import { TOUR_STEPS, type TourStep } from '../../../../src/newtab/tour/steps';

const STEPS: TourStep[] = [
  { id: 'a', target: null, title: 'A', body: '' },
  { id: 'b', target: 'sidebar', title: 'B', body: '' },
  { id: 'c', target: 'results', title: 'C', body: '' },
];

const all = () => true;

describe('resolveSteps', () => {
  it('keeps targetless steps and steps whose target is present', () => {
    const kept = resolveSteps(STEPS, (t) => t === 'sidebar');
    expect(kept.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('drops every targeted step when nothing is on the page', () => {
    expect(resolveSteps(STEPS, () => false).map((s) => s.id)).toEqual(['a']);
  });
});

describe('createTour', () => {
  it('is inactive until started', () => {
    const tour = createTour(STEPS, all);
    expect(tour.active).toBe(false);
    expect(tour.current).toBe(null);
  });

  it('starts at the first resolvable step', () => {
    const tour = createTour(STEPS, (t) => t === 'results');
    expect(tour.start()).toBe(true);
    expect(tour.current?.id).toBe('a');
    expect(tour.steps.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('refuses to start when no step resolves', () => {
    const onEnd = vi.fn();
    const tour = createTour([{ id: 'x', target: 'gone', title: '', body: '' }], () => false);
    expect(tour.start(onEnd)).toBe(false);
    expect(tour.active).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('walks forward and back without running off either end', () => {
    const tour = createTour(STEPS, all);
    tour.start();
    tour.prev();
    expect(tour.index).toBe(0);
    tour.next();
    tour.next();
    expect(tour.current?.id).toBe('c');
    expect(tour.isLast).toBe(true);
  });

  it('ends when advancing past the last step, and reports it once', () => {
    const onEnd = vi.fn();
    const tour = createTour(STEPS, all);
    tour.start(onEnd);
    tour.next();
    tour.next();
    tour.next(); // past the end
    expect(tour.active).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    tour.end(); // a stray Esc after the fact must not double-fire
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('reports the end when skipped part-way through', () => {
    const onEnd = vi.fn();
    const tour = createTour(STEPS, all);
    tour.start(onEnd);
    tour.next();
    tour.end();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(tour.active).toBe(false);
  });

  it('re-resolves targets on each run', () => {
    let hasResults = false;
    const tour = createTour(STEPS, (t) => (t === 'results' ? hasResults : true));
    tour.start();
    expect(tour.steps.map((s) => s.id)).toEqual(['a', 'b']);
    tour.end();

    hasResults = true; // the user has since saved a bookmark
    tour.start();
    expect(tour.steps.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('restarts from step one', () => {
    const tour = createTour(STEPS, all);
    tour.start();
    tour.next();
    tour.end();
    tour.start();
    expect(tour.index).toBe(0);
  });

  it('ignores goTo outside the step range', () => {
    const tour = createTour(STEPS, all);
    tour.start();
    tour.goTo(99);
    tour.goTo(-1);
    expect(tour.index).toBe(0);
    tour.goTo(2);
    expect(tour.index).toBe(2);
  });
});

describe('TOUR_STEPS', () => {
  it('has unique ids', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });

  it('opens with a targetless welcome so an empty library still gets a tour', () => {
    expect(TOUR_STEPS[0]?.target).toBe(null);
    expect(resolveSteps(TOUR_STEPS, () => false).length).toBeGreaterThan(0);
  });
});
