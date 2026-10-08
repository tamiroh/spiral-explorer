/* @flow strict-local */

import {useEffect, useRef} from 'react';

import type {Cell, Layout} from './layout.js';
import type {View} from './view.js';

const WHEEL_ZOOM_RATE = 0.0015;

// Screen distance covered by one arrow key press.
const KEY_PAN_PX = 48;
const ARROW_STEPS = new Map<string, Cell>([
  ['ArrowLeft', {x: -1, y: 0}],
  ['ArrowRight', {x: 1, y: 0}],
  ['ArrowUp', {x: 0, y: 1}],
  ['ArrowDown', {x: 0, y: -1}],
]);

// Wires the pointer, wheel and keyboard input of `canvasRef` to the view:
// drag or arrow keys to pan, wheel to zoom, and hover to report the number
// under the pointer.
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
  }, [canvasRef, layout, onViewChange, onHover]);
}
