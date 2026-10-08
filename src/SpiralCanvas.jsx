/* @flow strict-local */

import {useEffect, useRef, useState} from 'react';

import type {Cell, Layout} from './layout.js';
import type {View} from './view.js';

import {renderTile, TILE_SIZE} from './tiles.js';

const WHEEL_ZOOM_RATE = 0.0015;

// Screen distance covered by one arrow key press.
const KEY_PAN_PX = 48;
const ARROW_STEPS = new Map<string, Cell>([
  ['ArrowLeft', {x: -1, y: 0}],
  ['ArrowRight', {x: 1, y: 0}],
  ['ArrowUp', {x: 0, y: 1}],
  ['ArrowDown', {x: 0, y: -1}],
]);

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

export default component SpiralCanvas(
  layout: Layout,
  view: View,
  onViewChange: (update: (View) => View) => void,
  onHover: (n: number | null) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Bumped on resize so the canvas is repainted at the new size.
  const [resizes, setResizes] = useState(0);

  // Lets the handlers and the paint loop read the current view.
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    // Pointer position relative to the center of the canvas.
    const fromCenter = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        dx: event.clientX - rect.left - rect.width / 2,
        dy: event.clientY - rect.top - rect.height / 2,
      };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const {dx, dy} = fromCenter(event);
      onViewChange(current => {
        const scale = current.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
        // Keep the cell under the pointer fixed while zooming.
        return {
          x: current.x + dx / current.scale - dx / scale,
          y: current.y - dy / current.scale + dy / scale,
          scale,
        };
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) {
        const {movementX, movementY} = event;
        onViewChange(current => ({
          ...current,
          x: current.x - movementX / current.scale,
          y: current.y + movementY / current.scale,
        }));
      }
      const {dx, dy} = fromCenter(event);
      const {x, y, scale} = viewRef.current;
      onHover(
        layout.numberAt(Math.round(x + dx / scale), Math.round(y - dy / scale)),
      );
    };

    const onPointerLeave = () => onHover(null);

    const onKeyDown = (event: KeyboardEvent) => {
      const step = ARROW_STEPS.get(event.key);
      // Leave the arrow keys to the layout picker while it has focus.
      if (step == null || event.target instanceof HTMLSelectElement) {
        return;
      }
      event.preventDefault();
      onViewChange(current => ({
        ...current,
        x: current.x + (step.x * KEY_PAN_PX) / current.scale,
        y: current.y + (step.y * KEY_PAN_PX) / current.scale,
      }));
    };

    canvas.addEventListener('wheel', onWheel, {passive: false});
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [layout, onViewChange, onHover]);

  return <canvas ref={canvasRef} className="spiral-canvas" />;
}
