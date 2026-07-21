/** Pure geometry for the spotlight overlay. No DOM access — see Spotlight.svelte. */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Placement = 'top' | 'bottom' | 'left' | 'right';

/** Grow a rect by `pad` on all sides, clamped to non-negative coordinates. */
export function inflate(rect: Rect, pad: number): Rect {
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  return {
    x,
    y,
    width: rect.width + (rect.x - x) + pad,
    height: rect.height + (rect.y - y) + pad,
  };
}

const GAP = 12; // space between the cutout and the tooltip
const MARGIN = 12; // minimum distance from the viewport edge

function originFor(placement: Placement, hole: Rect, tip: Size): { x: number; y: number } {
  switch (placement) {
    case 'top':
      return { x: hole.x + hole.width / 2 - tip.width / 2, y: hole.y - GAP - tip.height };
    case 'bottom':
      return { x: hole.x + hole.width / 2 - tip.width / 2, y: hole.y + hole.height + GAP };
    case 'left':
      return { x: hole.x - GAP - tip.width, y: hole.y + hole.height / 2 - tip.height / 2 };
    case 'right':
      return { x: hole.x + hole.width + GAP, y: hole.y + hole.height / 2 - tip.height / 2 };
  }
}

function fits(o: { x: number; y: number }, tip: Size, viewport: Size): boolean {
  return (
    o.x >= MARGIN &&
    o.y >= MARGIN &&
    o.x + tip.width <= viewport.width - MARGIN &&
    o.y + tip.height <= viewport.height - MARGIN
  );
}

const OPPOSITE: Record<Placement, Placement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Position the tooltip beside the spotlight hole. Tries the preferred side,
 * then its opposite, then the remaining two; whatever is chosen is clamped
 * into the viewport so the card is never partly offscreen.
 */
export function placeTooltip(
  hole: Rect,
  tip: Size,
  viewport: Size,
  preferred: Placement = 'bottom',
): { x: number; y: number; placement: Placement } {
  const order: Placement[] = [preferred, OPPOSITE[preferred], 'bottom', 'top', 'right', 'left'];

  for (const placement of order) {
    const o = originFor(placement, hole, tip);
    if (fits(o, tip, viewport)) return { ...o, placement };
  }

  // Nothing fits cleanly (tiny window, huge target): use the preferred side and clamp.
  const o = originFor(preferred, hole, tip);
  return {
    x: clamp(o.x, MARGIN, Math.max(MARGIN, viewport.width - tip.width - MARGIN)),
    y: clamp(o.y, MARGIN, Math.max(MARGIN, viewport.height - tip.height - MARGIN)),
    placement: preferred,
  };
}

/** Center a card in the viewport — used by steps with no target. */
export function centerTooltip(tip: Size, viewport: Size): { x: number; y: number } {
  return {
    x: Math.max(MARGIN, viewport.width / 2 - tip.width / 2),
    y: Math.max(MARGIN, viewport.height / 2 - tip.height / 2),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
