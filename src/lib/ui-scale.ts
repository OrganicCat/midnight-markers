import { settings } from './storage/settings';

export const SCALE_OPTIONS = [
  { value: 0.9, label: '90%' },
  { value: 1, label: '100%' },
  { value: 1.15, label: '115%' },
  { value: 1.3, label: '130%' },
  { value: 1.5, label: '150%' },
];

export const SCALE_MIN = 0.9;
export const SCALE_MAX = 1.5;

export function clampScale(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, n));
}

/** Reads the scale setting and applies it to `document.documentElement` font-size. */
export async function applyUIScale(): Promise<void> {
  if (typeof document === 'undefined') return;
  const s = await settings.get();
  const scale = clampScale(s.uiScale ?? 1);
  document.documentElement.style.fontSize = `${16 * scale}px`;
}

/** Apply a specific scale immediately, without reading settings. */
export function setRootScale(scale: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${16 * clampScale(scale)}px`;
}
