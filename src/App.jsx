/* @flow strict-local */

import {useEffect, useRef, useState} from 'react';

import type {Cell, Pattern} from './patterns.js';
import type {GridRenderer, View} from './renderer.js';

import {isMarked, PATTERNS} from './patterns.js';
import styles from './App.module.css';
import {clamp} from './math.js';
import {createGridRenderer} from './renderer.js';

// -----------------------------------------------------------------------------
// View
// -----------------------------------------------------------------------------

// A screen position in pixels, relative to the center of the viewport.
type Offset = {readonly dx: number, readonly dy: number};

const CENTER: Offset = {dx: 0, dy: 0};

const MIN_SCALE = 0.5;
const MAX_SCALE = 64;

// Keeps every reachable number far below 2^53, where integers stay exact.
const MAX_COORDINATE = 2 ** 20;

const cellAt = (view: View, offset: Offset): Cell => ({
  x: Math.round(view.x + offset.dx / view.scale),
  y: Math.round(view.y - offset.dy / view.scale),
});

// Scales the view by `factor` while moving the cell shown at `from` to `to`,
// within the zoom and coordinate limits.
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
// App
// -----------------------------------------------------------------------------

export default component App() {
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [pointer, setPointer] = useState<Offset | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rendererRef = useRef<GridRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    const renderer = createGridRenderer(canvas);
    rendererRef.current = renderer;

    const fromCenter = (event: MouseEvent): Offset => {
      const rect = canvas.getBoundingClientRect();
      return {
        dx: event.clientX - rect.left - rect.width / 2,
        dy: event.clientY - rect.top - rect.height / 2,
      };
    };

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
      setPointer(offset);
    };

    const onPointerLeave = () => setPointer(null);

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
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.show(pattern, view);
  }, [pattern, view]);

  const zoomBy = (factor: number) =>
    setView(current => transformView(current, CENTER, CENTER, factor));

  const hoveredCell = pointer == null ? null : cellAt(view, pointer);
  const hovered =
    hoveredCell == null ? null : pattern.numberAt(hoveredCell.x, hoveredCell.y);

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
