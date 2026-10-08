/* @flow strict */

import type {Layout} from './layout.js';

import {primesInRange} from './primes.js';

// Cells along one side of a tile. Tile (i, j) covers the cells from
// (i * TILE_SIZE, j * TILE_SIZE) up to, but not including, the next tile.
export const TILE_SIZE = 256;

// Renders one tile as a TILE_SIZE-pixel bitmap with one opaque black pixel per
// prime cell and everything else transparent. Row 0 is the highest y.
export function renderTile(
  layout: Layout,
  tileX: number,
  tileY: number,
): HTMLCanvasElement {
  const x0 = tileX * TILE_SIZE;
  const y0 = tileY * TILE_SIZE;
  const x1 = x0 + TILE_SIZE - 1;
  const y1 = y0 + TILE_SIZE - 1;

  const image = new ImageData(TILE_SIZE, TILE_SIZE);
  layout.forEachRun({x0, y0, x1, y1}, (start, length, x, y, dx, dy) => {
    const flags = primesInRange(start, length);
    for (let i = 0; i < length; i++) {
      if (flags[i] === 1) {
        const column = x + i * dx - x0;
        const row = y1 - (y + i * dy);
        image.data[(row * TILE_SIZE + column) * 4 + 3] = 255;
      }
    }
  });

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas;
}
