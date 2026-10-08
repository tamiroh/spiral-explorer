/* @flow strict */

// Center of the viewport in cell coordinates, and pixels per cell.
export type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 64;

// Keeps every reachable number far below 2^53, where integers stay exact.
export const MAX_COORDINATE = 2 ** 20;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampView = (view: View): View => ({
  x: clamp(view.x, -MAX_COORDINATE, MAX_COORDINATE),
  y: clamp(view.y, -MAX_COORDINATE, MAX_COORDINATE),
  scale: clamp(view.scale, MIN_SCALE, MAX_SCALE),
});
