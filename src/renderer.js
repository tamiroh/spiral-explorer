/* @flow strict */

import {useEffect, useRef} from 'react';
import {cell} from './patterns.js';

import type {Pattern} from './patterns.js';

// Center of the canvas in cell coordinates, and pixels per cell.
export type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

type TileCache = Map<string, HTMLCanvasElement>;
type TileCoordinate = {readonly tileX: number, readonly tileY: number};

// Cells along one side of a tile.
const TILE_SIZE = 256;
const TILE_BUDGET_MS = 6;
const SPARE_TILES = 128;
const PAPER = '#ffffff';
const PENDING = '#ededed';
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

// Tests a run at a time rather than cell by cell: a run is a straight line of
// cells that hold consecutive numbers. Row 0 of the result is the lowest y.
function tileMarks(pattern: Pattern, tileX: number, tileY: number): Uint8Array {
  const numbers = new Float64Array(TILE_SIZE * TILE_SIZE);
  for (let row = 0; row < TILE_SIZE; row++) {
    for (let column = 0; column < TILE_SIZE; column++) {
      numbers[row * TILE_SIZE + column] = pattern.numberAt(
        cell(tileX * TILE_SIZE + column, tileY * TILE_SIZE + row),
      );
    }
  }

  const marks = new Uint8Array(numbers.length);
  const assigned = new Uint8Array(numbers.length);
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

      const flags = pattern.marks(n - before, before + after + 1);
      for (let i = -before; i <= after; i++) {
        const cell = (row + i * dy) * TILE_SIZE + column + i * dx;
        assigned[cell] = 1;
        marks[cell] = flags[i + before];
      }
    }
  }
  return marks;
}

function renderTile(
  pattern: Pattern,
  tileX: number,
  tileY: number,
): HTMLCanvasElement {
  const image = new ImageData(TILE_SIZE, TILE_SIZE);
  tileMarks(pattern, tileX, tileY).forEach((flag, cell) => {
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

const tileKey = (tileX: number, tileY: number): string => `${tileX},${tileY}`;

// Returns the visible tiles that are not ready yet, nearest first.
function paint(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  view: View,
  tiles: TileCache,
): Array<TileCoordinate> {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio;
  const bufferWidth = Math.round(width * ratio);
  const bufferHeight = Math.round(height * ratio);
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);

  const {x, y, scale} = view;
  // A cell is centered on its integer coordinates.
  const screenX = (cellX: number) => width / 2 + (cellX - 0.5 - x) * scale;
  const screenY = (cellY: number) => height / 2 - (cellY + 0.5 - y) * scale;

  const halfColumns = width / (2 * scale) + 1;
  const halfRows = height / (2 * scale) + 1;
  const firstTileX = Math.floor((x - halfColumns) / TILE_SIZE);
  const lastTileX = Math.floor((x + halfColumns) / TILE_SIZE);
  const firstTileY = Math.floor((y - halfRows) / TILE_SIZE);
  const lastTileY = Math.floor((y + halfRows) / TILE_SIZE);

  // Average cells into shades of gray only when shrinking.
  context.imageSmoothingEnabled = scale < 1;

  const missing: Array<TileCoordinate> = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY++) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX++) {
      // Snap to whole pixels so neighboring tiles meet without seams.
      const left = Math.round(screenX(tileX * TILE_SIZE));
      const right = Math.round(screenX((tileX + 1) * TILE_SIZE));
      const top = Math.round(screenY((tileY + 1) * TILE_SIZE - 1));
      const bottom = Math.round(screenY(tileY * TILE_SIZE - 1));
      const tile = tiles.get(tileKey(tileX, tileY));
      if (tile == null) {
        missing.push({tileX, tileY});
        context.fillStyle = PENDING;
        context.fillRect(left, top, right - left, bottom - top);
      } else {
        context.drawImage(tile, left, top, right - left, bottom - top);
      }
    }
  }

  // Hairlines between cells.
  if (scale >= 6) {
    context.fillStyle = PAPER;
    for (
      let cellX = Math.floor(x - halfColumns);
      cellX <= x + halfColumns;
      cellX++
    ) {
      context.fillRect(Math.round(screenX(cellX)), 0, 1, height);
    }
    for (let cellY = Math.floor(y - halfRows); cellY <= y + halfRows; cellY++) {
      context.fillRect(0, Math.round(screenY(cellY)), width, 1);
    }
  }

  const distance = ({tileX, tileY}: TileCoordinate) =>
    Math.hypot((tileX + 0.5) * TILE_SIZE - x, (tileY + 0.5) * TILE_SIZE - y);
  missing.sort((a, b) => distance(a) - distance(b));

  const visible = (lastTileX - firstTileX + 1) * (lastTileY - firstTileY + 1);
  if (tiles.size > visible + SPARE_TILES) {
    const center = {
      tileX: x / TILE_SIZE - 0.5,
      tileY: y / TILE_SIZE - 0.5,
    };
    const farthestFirst = [...tiles.keys()]
      .map(key => {
        const [tileX, tileY] = key.split(',').map(Number);
        return {
          key,
          distance: Math.hypot(tileX - center.tileX, tileY - center.tileY),
        };
      })
      .sort((a, b) => b.distance - a.distance);
    for (const {key} of farthestFirst.slice(0, tiles.size - visible)) {
      tiles.delete(key);
    }
  }

  return missing;
}

type GridRenderer = {
  readonly show: (pattern: Pattern, view: View) => void,
  readonly dispose: () => void,
};

function createGridRenderer(canvas: HTMLCanvasElement): GridRenderer {
  const context = canvas.getContext('2d');
  if (context == null) {
    throw new Error('Canvas 2D is not available');
  }
  const tiles: TileCache = new Map();
  // Nothing is painted until the first `show`.
  let scene: {readonly pattern: Pattern, readonly view: View} | null = null;
  let frame = 0;

  const requestPaint = () => {
    if (frame === 0) {
      frame = requestAnimationFrame(tick);
    }
  };

  const tick = () => {
    frame = 0;
    const shown = scene;
    if (shown == null) {
      return;
    }
    const missing = paint(canvas, context, shown.view, tiles);
    if (missing.length === 0) {
      return;
    }
    const deadline = performance.now() + TILE_BUDGET_MS;
    for (const {tileX, tileY} of missing) {
      tiles.set(tileKey(tileX, tileY), renderTile(shown.pattern, tileX, tileY));
      if (performance.now() >= deadline) {
        break;
      }
    }
    requestPaint();
  };

  const observer = new ResizeObserver(requestPaint);
  observer.observe(canvas);

  return {
    show(pattern, view) {
      if (pattern !== scene?.pattern) {
        tiles.clear();
      }
      scene = {pattern, view};
      requestPaint();
    },
    dispose() {
      observer.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}

export hook useGridRenderer(
  canvasRef: {readonly current: HTMLCanvasElement | null},
  pattern: Pattern,
  view: View,
): void {
  const rendererRef = useRef<GridRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    const renderer = createGridRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    rendererRef.current?.show(pattern, view);
  }, [pattern, view]);
}
