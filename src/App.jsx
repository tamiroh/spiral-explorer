/* @flow strict-local */

import {useEffect, useRef, useState} from 'react';

import type {Layout} from './layouts.js';
import type {View} from './useViewControls.js';

import {LAYOUTS} from './layouts.js';
import {isPrime} from './primes.js';
import styles from './App.module.css';
import {renderTile, TILE_SIZE} from './tiles.js';
import {CENTER, transformView, useViewControls} from './useViewControls.js';

const DEFAULT_VIEW: View = {x: 0, y: 0, scale: 3};
const ZOOM_STEP = 1.5;

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

export default component App() {
  const [layout, setLayout] = useState<Layout>(LAYOUTS[0]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Bumped on resize so the canvas is repainted at the new size.
  const [resizes, setResizes] = useState(0);

  // Lets the paint loop read the current view.
  const viewRef = useRef(view);
  const requestPaintRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    const observer = new ResizeObserver(() => setResizes(n => n + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // The paint loop outlives view changes, so tiles keep loading while the
  // view is still moving. A new layout starts over with an empty tile cache.
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
        tiles.set(tileKey(tileX, tileY), renderTile(layout, tileX, tileY));
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
  }, [layout]);

  useEffect(() => {
    viewRef.current = view;
    requestPaintRef.current();
  }, [view, resizes, layout]);

  useViewControls(canvasRef, layout, view, setView, setHovered);

  const zoomBy = (factor: number) =>
    setView(current => transformView(current, CENTER, CENTER, factor));

  const hoveredCell = hovered == null ? null : layout.position(hovered);

  return (
    <div className={styles.app}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <aside className={styles.panel}>
        <dl>
          <dt>Layout</dt>
          <dd>
            <select
              aria-label="Layout"
              value={layout.id}
              onChange={event => {
                const {value} = event.currentTarget;
                setLayout(
                  current => LAYOUTS.find(l => l.id === value) ?? current,
                );
              }}>
              {LAYOUTS.map(({id, name}) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </dd>
          <dt>Highlight</dt>
          <dd>Prime numbers</dd>
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
              isPrime(hovered) ? 'prime' : 'not prime'
            }`
          : 'Drag or arrow keys to pan · Scroll or pinch to zoom'}
      </footer>
    </div>
  );
}
