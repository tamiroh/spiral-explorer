/* @flow strict */

import type {Cell} from './layouts.js';

// Center of the viewport in cell coordinates, and pixels per cell.
export type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

// A screen position in pixels, relative to the center of the viewport.
export type Offset = {readonly dx: number, readonly dy: number};

export const CENTER: Offset = {dx: 0, dy: 0};

const MIN_SCALE = 0.5;
const MAX_SCALE = 64;

// Keeps every reachable number far below 2^53, where integers stay exact.
const MAX_COORDINATE = 2 ** 20;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// The cell shown at `offset`.
export const cellAt = (view: View, offset: Offset): Cell => ({
  x: Math.round(view.x + offset.dx / view.scale),
  y: Math.round(view.y - offset.dy / view.scale),
});

// Scales the view by `factor` while moving the cell shown at `from` to `to`,
// as far as the zoom and coordinate limits allow. Every change of view goes
// through here, so a view never leaves those limits.
export const transformView = (
  view: View,
  from: Offset,
  to: Offset,
  factor: number,
): View => {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  return {
    x: clamp(
      view.x + from.dx / view.scale - to.dx / scale,
      -MAX_COORDINATE,
      MAX_COORDINATE,
    ),
    y: clamp(
      view.y - from.dy / view.scale + to.dy / scale,
      -MAX_COORDINATE,
      MAX_COORDINATE,
    ),
    scale,
  };
};
