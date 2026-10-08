/* @flow strict-local */

import {useCallback, useState} from 'react';

import type {View} from './view.js';

import {isPrime} from './primes.js';
import SpiralCanvas from './SpiralCanvas.jsx';
import {ulamPosition} from './ulam.js';
import {clampView} from './view.js';

const DEFAULT_VIEW: View = {x: 0, y: 0, scale: 3};
const ZOOM_STEP = 1.5;

export default component App() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);

  const updateView = useCallback(
    (update: View => View) => setView(current => clampView(update(current))),
    [],
  );

  const zoomBy = (factor: number) =>
    updateView(current => ({...current, scale: current.scale * factor}));

  const hoveredCell = hovered == null ? null : ulamPosition(hovered);

  return (
    <div className="app">
      <SpiralCanvas
        view={view}
        onViewChange={updateView}
        onHover={setHovered}
      />

      <aside className="panel">
        <dl>
          <dt>Layout</dt>
          <dd>Ulam spiral</dd>
          <dt>Highlight</dt>
          <dd>Prime numbers</dd>
        </dl>

        <div className="zoom">
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

      <footer className="readout">
        {hovered != null && hoveredCell != null
          ? `n = ${hovered}  (${hoveredCell.x}, ${hoveredCell.y})  ${
              isPrime(hovered) ? 'prime' : 'not prime'
            }`
          : 'Drag to pan · Scroll to zoom'}
      </footer>
    </div>
  );
}
