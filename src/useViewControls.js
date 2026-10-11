/* @flow strict-local */

import {useEffect, useRef} from 'react';

import type {Cell, Layout} from './layouts.js';

// -----------------------------------------------------------------------------
// View
// -----------------------------------------------------------------------------

// Center of the viewport in cell coordinates, and pixels per cell.
export type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

// A screen position in pixels, relative to the center of the viewport.
type Offset = {readonly dx: number, readonly dy: number};

export const CENTER: Offset = {dx: 0, dy: 0};

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

// -----------------------------------------------------------------------------
// Controls
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

// Wires the pointer, wheel and keyboard input of `canvasRef` to the view:
// drag or arrow keys to pan, wheel or pinch to zoom, and hover to report the
// number under the pointer.
export hook useViewControls(
  canvasRef: {readonly current: HTMLCanvasElement | null},
  layout: Layout,
  view: View,
  onViewChange: (update: (View) => View) => void,
  onHover: (n: number | null) => void,
): void {
  // Lets the hover handler read the current view.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

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
      onViewChange(current => transformView(current, offset, offset, factor));
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
          onViewChange(current => transformView(current, previous, offset, 1));
        } else if (pressed.size === 2) {
          const from = midpoint(previous, other);
          const to = midpoint(offset, other);
          const factor =
            distance(offset, other) / Math.max(distance(previous, other), 1);
          onViewChange(current => transformView(current, from, to, factor));
        }
      }
      const {x, y} = cellAt(viewRef.current, offset);
      onHover(layout.numberAt(x, y));
    };

    const onPointerLeave = () => onHover(null);

    const onKeyDown = (event: KeyboardEvent) => {
      const step = ARROW_STEPS.get(event.key);
      // Leave the arrow keys to the layout picker while it has focus.
      if (step == null || event.target instanceof HTMLSelectElement) {
        return;
      }
      event.preventDefault();
      const from = {dx: step.x * KEY_PAN_PX, dy: -step.y * KEY_PAN_PX};
      onViewChange(current => transformView(current, from, CENTER, 1));
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
  }, [canvasRef, layout, onViewChange, onHover]);
}
