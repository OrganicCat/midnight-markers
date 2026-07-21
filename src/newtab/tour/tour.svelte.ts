import { TOUR_STEPS, type TourStep } from './steps';

/**
 * Drop steps whose target isn't on the page right now. An empty library has no
 * collections and no results, and spotlighting a hole where nothing is reads as
 * a bug — better to skip the step than to point at nothing.
 *
 * `exists` is injected so this is testable without a DOM.
 */
export function resolveSteps(steps: TourStep[], exists: (target: string) => boolean): TourStep[] {
  return steps.filter((s) => s.target === null || exists(s.target));
}

const domExists = (target: string): boolean =>
  typeof document !== 'undefined' && document.querySelector(`[data-tour="${target}"]`) !== null;

export type Tour = ReturnType<typeof createTour>;

/**
 * The tour's state machine. Owns which step is showing and nothing else — the
 * overlay reads `current` and draws it, App.svelte decides when to `start()`.
 */
export function createTour(
  allSteps: TourStep[] = TOUR_STEPS,
  exists: (target: string) => boolean = domExists,
) {
  let steps = $state<TourStep[]>([]);
  let index = $state(0);
  /** Called once per run when the tour ends, however it ends. */
  let onEnd: (() => void) | null = null;

  return {
    get active(): boolean {
      return steps.length > 0;
    },
    get steps(): TourStep[] {
      return steps;
    },
    get index(): number {
      return index;
    },
    get current(): TourStep | null {
      return steps[index] ?? null;
    },
    get isLast(): boolean {
      return steps.length > 0 && index === steps.length - 1;
    },

    /**
     * Begin a run. Resolving targets happens here, so a tour started after the
     * user has saved bookmarks includes steps an empty library would skip.
     * Returns false (and does nothing) if no step can be shown at all.
     */
    start(onEndCallback?: () => void): boolean {
      const resolved = resolveSteps(allSteps, exists);
      if (resolved.length === 0) return false;
      steps = resolved;
      index = 0;
      onEnd = onEndCallback ?? null;
      return true;
    },

    next(): void {
      if (!steps.length) return;
      if (index >= steps.length - 1) this.end();
      else index += 1;
    },

    prev(): void {
      if (index > 0) index -= 1;
    },

    goTo(stepIndex: number): void {
      if (stepIndex >= 0 && stepIndex < steps.length) index = stepIndex;
    },

    /** Finish, skip and Esc all land here — one exit, so the flag is always written. */
    end(): void {
      if (!steps.length) return;
      steps = [];
      index = 0;
      const cb = onEnd;
      onEnd = null;
      cb?.();
    },
  };
}
