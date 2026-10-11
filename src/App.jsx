/* @flow strict-local */

import {useEffect, useRef, useState} from 'react';

import type {Cell, Pattern} from './patterns.js';

import {isMarked, PATTERNS} from './patterns.js';
import styles from './App.module.css';

// -----------------------------------------------------------------------------
// View
// -----------------------------------------------------------------------------

// Center of the viewport in cell coordinates, and pixels per cell.
type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

// A screen position in pixels, relative to the center of the viewport.
type Offset = {readonly dx: number, readonly dy: number};

const CENTER: Offset = {dx: 0, dy: 0};

const MIN_SCALE = 0.5;
const MAX_SCALE = 64;

// Keeps every reachable number far below 2^53, where integers stay exact.
const MAX_COORDINATE = 2 ** 20;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// The cell shown at `offset`.
const cellAt = (view: View, offset: Offset): Cell => ({
  x: Math.round(view.x + offset.dx / view.scale),
  y: Math.round(view.y - offset.dy / view.scale),
});

// Scales the view by `factor` while moving the cell shown at `from` to `to`,
// as far as the zoom and coordinate limits allow. Every change of view goes
// through here, so a view never leaves those limits.
const transformView = (
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

const DEFAULT_VIEW: View = {x: 0, y: 0, scale: 3};
const ZOOM_STEP = 1.5;

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

const WHEEL_ZOOM_RATE = 0.0015;

// Screen distance covered by one arrow key press.
const KEY_PAN_PX = 48;
const ARROW_STEPS = new Map<string, Cell>([
  ['ArrowLeft', {x: -1, y: 0}],
  ['ArrowRight', {x: 1, y: 0}],
  ['ArrowUp', {x: 0, y: 1}],
  ['ArrowDown', {x: 0, y: -1}],
]);

const midpoint = (a: Offset, b: Offset): Offset => ({
  dx: (a.dx + b.dx) / 2,
  dy: (a.dy + b.dy) / 2,
});

const distance = (a: Offset, b: Offset): number =>
  Math.hypot(a.dx - b.dx, a.dy - b.dy);

// -----------------------------------------------------------------------------
// Tiles
// -----------------------------------------------------------------------------

// Cells along one side of a tile. Tile (i, j) covers the cells from
// (i * TILE_SIZE, j * TILE_SIZE) up to, but not including, the next tile.
const TILE_SIZE = 256;

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

// Finds the marked cells of one tile: the result holds 1 at
// row * TILE_SIZE + column, with row 0 at the lowest y.
//
// Numbers are tested a range at a time rather than cell by cell, so the tile
// is first split into runs: straight lines of cells that hold consecutive
// numbers.
function tileMarks(pattern: Pattern, tileX: number, tileY: number): Uint8Array {
  const numbers = new Float64Array(TILE_SIZE * TILE_SIZE);
  for (let row = 0; row < TILE_SIZE; row++) {
    for (let column = 0; column < TILE_SIZE; column++) {
      numbers[row * TILE_SIZE + column] = pattern.numberAt(
        tileX * TILE_SIZE + column,
        tileY * TILE_SIZE + row,
      );
    }
  }

  const marks = new Uint8Array(numbers.length);
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

// Renders one tile as a TILE_SIZE-pixel bitmap with one opaque black pixel per
// marked cell and everything else transparent. Row 0 is the highest y.
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

// -----------------------------------------------------------------------------
// Painting
// -----------------------------------------------------------------------------

// Time spent computing new tiles per frame before yielding to the browser.
const TILE_BUDGET_MS = 6;

// Tiles kept beyond the visible ones before the farthest are dropped.
const SPARE_TILES = 128;

const PAPER = '#ffffff';
const PENDING = '#ededed';

type TileCache = Map<string, HTMLCanvasElement>;
type TileCoordinate = {readonly tileX: number, readonly tileY: number};

const tileKey = (tileX: number, tileY: number): string => `${tileX},${tileY}`;

// Paints every visible tile that is ready and returns the ones that are not,
// nearest to the center of the view first.
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
  // Screen position of the left edge of column `cellX` and the top edge of
  // row `cellY`; a cell is centered on its integer coordinates.
  const screenX = (cellX: number) => width / 2 + (cellX - 0.5 - x) * scale;
  const screenY = (cellY: number) => height / 2 - (cellY + 0.5 - y) * scale;

  const halfColumns = width / (2 * scale) + 1;
  const halfRows = height / (2 * scale) + 1;
  const firstTileX = Math.floor((x - halfColumns) / TILE_SIZE);
  const lastTileX = Math.floor((x + halfColumns) / TILE_SIZE);
  const firstTileY = Math.floor((y - halfRows) / TILE_SIZE);
  const lastTileY = Math.floor((y + halfRows) / TILE_SIZE);

  // Shrinking below one pixel per cell averages cells into shades of gray;
  // enlarging keeps hard cell edges.
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

  // Hairlines between cells once they are large enough to tell apart.
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

// -----------------------------------------------------------------------------
// App
// -----------------------------------------------------------------------------

export default component App() {
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Lets the paint loop and the input handlers read the current view.
  const viewRef = useRef(view);
  const requestPaintRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    // Repaint at the new size.
    const observer = new ResizeObserver(() => requestPaintRef.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // The paint loop outlives view changes, so tiles keep loading while the
  // view is still moving. A new pattern starts over with an empty tile cache.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas == null || context == null) {
      return;
    }
    const tiles: TileCache = new Map();
    let frame = 0;

    const requestPaint = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      frame = 0;
      const missing = paint(canvas, context, viewRef.current, tiles);
      if (missing.length === 0) {
        return;
      }
      const deadline = performance.now() + TILE_BUDGET_MS;
      for (const {tileX, tileY} of missing) {
        tiles.set(tileKey(tileX, tileY), renderTile(pattern, tileX, tileY));
        if (performance.now() >= deadline) {
          break;
        }
      }
      requestPaint();
    };

    requestPaintRef.current = requestPaint;
    return () => {
      cancelAnimationFrame(frame);
      requestPaintRef.current = () => {};
    };
  }, [pattern]);

  useEffect(() => {
    viewRef.current = view;
    requestPaintRef.current();
  }, [view, pattern]);

  // Pointer, wheel and keyboard input: drag or arrow keys to pan, wheel or
  // pinch to zoom, and hover to report the number under the pointer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    // Pointer position relative to the center of the canvas.
    const fromCenter = (event: MouseEvent): Offset => {
      const rect = canvas.getBoundingClientRect();
      return {
        dx: event.clientX - rect.left - rect.width / 2,
        dy: event.clientY - rect.top - rect.height / 2,
      };
    };

    // Last known position of every pointer that is pressed on the canvas.
    const pressed = new Map<number, Offset>();

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const offset = fromCenter(event);
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
      setView(current => transformView(current, offset, offset, factor));
    };

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      pressed.set(event.pointerId, fromCenter(event));
    };

    const onPointerUp = (event: PointerEvent) => {
      pressed.delete(event.pointerId);
    };

    // One pointer drags the view; two pinch it around their midpoint.
    const onPointerMove = (event: PointerEvent) => {
      const offset = fromCenter(event);
      const previous = pressed.get(event.pointerId);
      if (previous != null) {
        pressed.set(event.pointerId, offset);
        const [other] = [...pressed]
          .filter(([pointerId]) => pointerId !== event.pointerId)
          .map(([, position]) => position);
        if (other == null) {
          setView(current => transformView(current, previous, offset, 1));
        } else if (pressed.size === 2) {
          const from = midpoint(previous, other);
          const to = midpoint(offset, other);
          const factor =
            distance(offset, other) / Math.max(distance(previous, other), 1);
          setView(current => transformView(current, from, to, factor));
        }
      }
      const {x, y} = cellAt(viewRef.current, offset);
      setHovered(pattern.numberAt(x, y));
    };

    const onPointerLeave = () => setHovered(null);

    const onKeyDown = (event: KeyboardEvent) => {
      const step = ARROW_STEPS.get(event.key);
      // Leave the arrow keys to the pattern picker while it has focus.
      if (step == null || event.target instanceof HTMLSelectElement) {
        return;
      }
      event.preventDefault();
      const from = {dx: step.x * KEY_PAN_PX, dy: -step.y * KEY_PAN_PX};
      setView(current => transformView(current, from, CENTER, 1));
    };

    canvas.addEventListener('wheel', onWheel, {passive: false});
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [pattern]);

  const zoomBy = (factor: number) =>
    setView(current => transformView(current, CENTER, CENTER, factor));

  const hoveredCell = hovered == null ? null : pattern.position(hovered);

  return (
    <div className={styles.app}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <aside className={styles.panel}>
        <dl>
          <dt>Pattern</dt>
          <dd>
            <select
              aria-label="Pattern"
              value={pattern.id}
              onChange={event => {
                const {value} = event.currentTarget;
                setPattern(
                  current => PATTERNS.find(l => l.id === value) ?? current,
                );
              }}>
              {PATTERNS.map(({id, name}) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </dd>
        </dl>

        <div className={styles.zoom}>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / ZOOM_STEP)}>
            −
          </button>
          <output>{view.scale.toFixed(2)} px</output>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(ZOOM_STEP)}>
            +
          </button>
          <button type="button" onClick={() => setView(DEFAULT_VIEW)}>
            Reset
          </button>
        </div>
      </aside>

      <footer className={styles.readout}>
        {hovered != null && hoveredCell != null
          ? `n = ${hovered}  (${hoveredCell.x}, ${hoveredCell.y})  ${
              isMarked(pattern, hovered)
                ? pattern.label
                : `not ${pattern.label}`
            }`
          : 'Drag or arrow keys to pan · Scroll or pinch to zoom'}
      </footer>
    </div>
  );
}
