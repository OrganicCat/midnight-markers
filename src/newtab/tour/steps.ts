/**
 * The guided tour, as data. Each step points at an element via a
 * `[data-tour="..."]` hook placed on the real UI — no step owns markup of its
 * own, so moving a control around the page can't break the tour, only renaming
 * its hook can.
 *
 * A step with no `target` is shown centered with the whole page dimmed; that's
 * how the intro and outro read.
 */
export type TourStep = {
  /** Stable id — used by tests and by `startAt`. */
  id: string;
  /** `data-tour` value of the element to spotlight, or null for a centered card. */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side of the target for the tooltip. Falls back if it won't fit. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Extra breathing room around the cutout, in px. Default 8. */
  padding?: number;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to midnight',
    body: 'This new tab page is your bookmark library. Everything lives on this machine — no account, no sync, no telemetry. Here is the two-minute version.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    title: 'Your library, filtered',
    body: 'Smart filters up top — Recent, Unread, Starred, Untagged and Broken are computed for you, not folders you maintain. Below them sit your collections and tags.',
    placement: 'right',
  },
  {
    id: 'collections',
    target: 'new-collection',
    title: 'Collections',
    body: 'Collections are your own folders, and they nest. Drag a bookmark onto one in the sidebar to file it, or drag a collection onto another to nest it.',
    placement: 'bottom',
  },
  {
    id: 'search',
    target: 'search',
    title: 'Search everything',
    body: 'Full-text over titles, URLs, notes and tags. Press ⌘K (or /) from anywhere on the page to jump straight here.',
    placement: 'bottom',
  },
  {
    id: 'view',
    target: 'view-toggle',
    title: 'Grid or list',
    body: 'Cards give you favicons and descriptions; the dense list shows collection and tags per row. Keys 1 and 2 switch between them.',
    placement: 'bottom',
  },
  {
    id: 'resort',
    target: 'resort',
    title: 'Resort with AI',
    body: 'Optional, and off until you add your own OpenRouter key in Settings. It proposes a reorganisation, shows you the full before/after tree, and nothing moves until you approve — with one-tap undo afterwards.',
    placement: 'bottom',
  },
  {
    id: 'grid',
    target: 'results',
    title: 'Your bookmarks',
    body: 'Save new ones with the toolbar icon on any page. Here, J/K or ↑/↓ move the selection, ↵ opens, S stars, ⌫ deletes.',
    placement: 'bottom',
    padding: 12,
  },
  {
    id: 'help',
    target: 'help',
    title: 'That is the tour',
    body: 'The ? button reopens this — it has the full keyboard cheat sheet and can replay the walkthrough any time.',
    placement: 'bottom',
  },
];
