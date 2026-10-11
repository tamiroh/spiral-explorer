/* @flow strict */

import type {Layout} from './layout.js';

import {primesInRange} from './primes.js';

// Cells along one side of a tile. Tile (i, j) covers the cells from
// (i * TILE_SIZE, j * TILE_SIZE) up to, but not including, the next tile.
export const TILE_SIZE = 256;

// Steps along which consecutive numbers may line up, as [column, row].
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

// Marks the prime cells of one tile: the result holds 1 at
// row * TILE_SIZE + column, with row 0 at the lowest y.
//
// Numbers are tested a range at a time rather than cell by cell, so the tile
// is first split into runs: straight lines of cells that hold consecutive
// numbers.
export function tilePrimes(
  layout: Layout,
  tileX: number,
  tileY: number,
): Uint8Array {
  const numbers = new Float64Array(TILE_SIZE * TILE_SIZE);
  for (let row = 0; row < TILE_SIZE; row++) {
    for (let column = 0; column < TILE_SIZE; column++) {
      numbers[row * TILE_SIZE + column] = layout.numberAt(
        tileX * TILE_SIZE + column,
        tileY * TILE_SIZE + row,
      );
    }
  }

  const primes = new Uint8Array(numbers.length);
  const assigned = new Uint8Array(numbers.length);
  // Whether the cell holds `n` and is not yet part of a run.
  const isFree = (column: number, row: number, n: number) =>
    column >= 0 &&
    column < TILE_SIZE &&
    row >= 0 &&
    row < TILE_SIZE &&
    assigned[row * TILE_SIZE + column] === 0 &&
    numbers[row * TILE_SIZE + column] === n;

  for (let row = 0; row < TILE_SIZE; row++) {
    for (let column = 0; column < TILE_SIZE; column++) {
      if (assigned[row * TILE_SIZE + column] === 1) {
        continue;
      }
      const n = numbers[row * TILE_SIZE + column];
      const [dx, dy] = DIRECTIONS.find(
        ([x, y]) =>
          isFree(column + x, row + y, n + 1) ||
          isFree(column - x, row - y, n - 1),
      ) ?? [1, 0];

      let before = 0;
      while (
        isFree(
          column - (before + 1) * dx,
          row - (before + 1) * dy,
          n - before - 1,
        )
      ) {
        before++;
      }
      let after = 0;
      while (
        isFree(column + (after + 1) * dx, row + (after + 1) * dy, n + after + 1)
      ) {
        after++;
      }

      const flags = primesInRange(n - before, before + after + 1);
      for (let i = -before; i <= after; i++) {
        const cell = (row + i * dy) * TILE_SIZE + column + i * dx;
        assigned[cell] = 1;
        primes[cell] = flags[i + before];
      }
    }
  }
  return primes;
}

// Renders one tile as a TILE_SIZE-pixel bitmap with one opaque black pixel per
// prime cell and everything else transparent. Row 0 is the highest y.
export function renderTile(
  layout: Layout,
  tileX: number,
  tileY: number,
): HTMLCanvasElement {
  const image = new ImageData(TILE_SIZE, TILE_SIZE);
  tilePrimes(layout, tileX, tileY).forEach((flag, cell) => {
    if (flag === 1) {
      const column = cell % TILE_SIZE;
      const row = TILE_SIZE - 1 - Math.floor(cell / TILE_SIZE);
      image.data[(row * TILE_SIZE + column) * 4 + 3] = 255;
    }
  });

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas;
}
