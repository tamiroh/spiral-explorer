/* @flow strict-local */

import {useEffect, useRef, useState} from 'react';

import {ulamNumberAt, ulamPosition} from './ulam.js';

// Center of the viewport in cell coordinates, and pixels per cell.
export type View = {
  readonly x: number,
  readonly y: number,
  readonly scale: number,
};

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 64;

const WHEEL_ZOOM_RATE = 0.0015;

export const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export default component SpiralCanvas(
  count: number,
  highlighted: Uint8Array,
  view: View,
  onViewChange: (update: (View) => View) => void,
  onHover: (n: number | null) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Bumped on resize so the drawing effect reruns at the new size.
  const [resizes, setResizes] = useState(0);

  // Lets the pointer handlers read the current view without resubscribing.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }
    const observer = new ResizeObserver(() => setResizes(n => n + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

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
        const scale = clampScale(
          current.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        );
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
        ulamNumberAt(Math.round(x + dx / scale), Math.round(y - dy / scale)),
      );
    };

    const onPointerLeave = () => onHover(null);

    canvas.addEventListener('wheel', onWheel, {passive: false});
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [onViewChange, onHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas == null || context == null) {
      return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    // Leave a hairline between cells once they are large enough to tell apart.
    const cell = view.scale >= 6 ? view.scale - 1 : Math.max(1, view.scale);
    const left = width / 2 - view.x * view.scale - cell / 2;
    const top = height / 2 + view.y * view.scale - cell / 2;

    context.fillStyle = '#000000';
    for (let n = 1; n <= count; n++) {
      if (highlighted[n] === 1) {
        const {x, y} = ulamPosition(n);
        const px = left + x * view.scale;
        const py = top - y * view.scale;
        if (px > -cell && px < width && py > -cell && py < height) {
          context.fillRect(px, py, cell, cell);
        }
      }
    }
  }, [resizes, view, count, highlighted]);

  return <canvas ref={canvasRef} className="spiral-canvas" />;
}
