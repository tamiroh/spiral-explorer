/* @flow strict */

export type Cell = {readonly x: number, readonly y: number};

// A way of placing the positive integers on the cells of the square grid,
// with y pointing up.
export type Layout = {
  readonly id: string,
  readonly name: string,
  readonly position: (n: number) => Cell,
  readonly numberAt: (x: number, y: number) => number,
};
