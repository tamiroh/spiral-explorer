/* @flow strict */

export type Cell = {readonly x: number, readonly y: number};

// A block of cells, bounds inclusive.
export type Rect = {
  readonly x0: number,
  readonly y0: number,
  readonly x1: number,
  readonly y1: number,
};

// A run of consecutive numbers: `start` sits at (x, y) and each following
// number is one (dx, dy) step further.
export type RunCallback = (
  start: number,
  length: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
) => void;

// A way of placing the positive integers on the cells of the square grid,
// with y pointing up.
export type Layout = {
  readonly id: string,
  readonly name: string,
  readonly position: (n: number) => Cell,
  readonly numberAt: (x: number, y: number) => number,
  // Splits the cells inside `rect` into runs, reporting every cell exactly
  // once.
  readonly forEachRun: (rect: Rect, callback: RunCallback) => void,
};
