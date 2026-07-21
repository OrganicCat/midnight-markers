import { describe, it, expect } from 'vitest';
import { inflate, placeTooltip, centerTooltip } from '../../../../src/newtab/tour/geometry';

const VIEWPORT = { width: 1280, height: 800 };
const TIP = { width: 320, height: 160 };

describe('inflate', () => {
  it('grows the rect on every side', () => {
    expect(inflate({ x: 100, y: 100, width: 50, height: 40 }, 10)).toEqual({
      x: 90,
      y: 90,
      width: 70,
      height: 60,
    });
  });

  it('clamps to the viewport origin without losing the far edge', () => {
    // A target flush against the top-left can only grow down and right.
    const r = inflate({ x: 2, y: 0, width: 50, height: 40 }, 10);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.x + r.width).toBe(62); // 2 + 50 + 10
    expect(r.y + r.height).toBe(50); // 0 + 40 + 10
  });
});

describe('placeTooltip', () => {
  it('honours the preferred side when it fits', () => {
    const hole = { x: 500, y: 300, width: 100, height: 40 };
    const p = placeTooltip(hole, TIP, VIEWPORT, 'bottom');
    expect(p.placement).toBe('bottom');
    expect(p.y).toBe(352); // 300 + 40 + 12 gap
  });

  it('flips to the opposite side when the preferred one overflows', () => {
    // Target near the bottom edge: "bottom" would run off, so it flips up.
    const hole = { x: 500, y: 740, width: 100, height: 40 };
    const p = placeTooltip(hole, TIP, VIEWPORT, 'bottom');
    expect(p.placement).toBe('top');
    expect(p.y).toBe(568); // 740 - 12 - 160
  });

  it('flips a left-preferred tooltip to the right at the left edge', () => {
    const hole = { x: 4, y: 300, width: 180, height: 40 };
    const p = placeTooltip(hole, TIP, VIEWPORT, 'left');
    expect(p.placement).toBe('right');
    expect(p.x).toBe(196); // 4 + 180 + 12
  });

  it('keeps the card on screen when no side fits', () => {
    const tiny = { width: 360, height: 200 };
    const hole = { x: 0, y: 0, width: 360, height: 200 };
    const p = placeTooltip(hole, TIP, tiny, 'bottom');
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + TIP.width).toBeLessThanOrEqual(tiny.width);
  });
});

describe('centerTooltip', () => {
  it('centres the card in the viewport', () => {
    expect(centerTooltip(TIP, VIEWPORT)).toEqual({ x: 480, y: 320 });
  });

  it('never returns a negative origin on a small viewport', () => {
    const p = centerTooltip(TIP, { width: 200, height: 100 });
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});
