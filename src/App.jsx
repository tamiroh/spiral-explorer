/* @flow strict-local */

import {useCallback, useState} from 'react';

import type {Layout} from './layout.js';
import type {View} from './view.js';

import {LAYOUTS} from './layouts.js';
import {isPrime} from './primes.js';
import SpiralCanvas from './SpiralCanvas.jsx';
import {clampView} from './view.js';

const DEFAULT_VIEW: View = {x: 0, y: 0, scale: 3};
const ZOOM_STEP = 1.5;

export default component App() {
  const [layout, setLayout] = useState<Layout>(LAYOUTS[0]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);

  const updateView = useCallback(
    (update: View => View) => setView(current => clampView(update(current))),
    [],
  );

  const zoomBy = (factor: number) =>
    updateView(current => ({...current, scale: current.scale * factor}));

  const hoveredCell = hovered == null ? null : layout.position(hovered);

  return (
    <div className="app">
      <SpiralCanvas
        layout={layout}
        view={view}
        onViewChange={updateView}
        onHover={setHovered}
      />

      <aside className="panel">
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
          : 'Drag or arrow keys to pan · Scroll to zoom'}
      </footer>
    </div>
  );
}
