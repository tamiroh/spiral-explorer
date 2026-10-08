/* @flow strict-local */

import {useMemo, useState} from 'react';

import type {View} from './SpiralCanvas.jsx';

import {sievePrimes} from './primes.js';
import SpiralCanvas, {clampScale} from './SpiralCanvas.jsx';
import {ulamPosition} from './ulam.js';

const MAX_COUNT = 2_000_000;
const DEFAULT_COUNT = 40_000;
const DEFAULT_VIEW: View = {x: 0, y: 0, scale: 3};
const ZOOM_STEP = 1.5;

const clampCount = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_COUNT, Math.max(1, Math.floor(value)))
    : 1;

export default component App() {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [hovered, setHovered] = useState<number | null>(null);

  const primes = useMemo(() => sievePrimes(count), [count]);
  const primeCount = useMemo(
    () => primes.reduce((total, flag) => total + flag, 0),
    [primes],
  );

  const zoomBy = (factor: number) =>
    setView(current => ({
      ...current,
      scale: clampScale(current.scale * factor),
    }));

  const hoveredCell =
    hovered != null && hovered <= count ? ulamPosition(hovered) : null;

  return (
    <div className="app">
      <SpiralCanvas
        count={count}
        highlighted={primes}
        view={view}
        onViewChange={setView}
        onHover={setHovered}
      />

      <aside className="panel">
        <h1>Spiral Explorer</h1>

        <dl>
          <dt>Layout</dt>
          <dd>Ulam spiral</dd>
          <dt>Highlight</dt>
          <dd>Prime numbers</dd>
        </dl>

        <label>
          Numbers 1 to
          <input
            type="number"
            min="1"
            max={MAX_COUNT}
            step="1000"
            value={count}
            onChange={event =>
              setCount(clampCount(event.currentTarget.valueAsNumber))
            }
          />
        </label>

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
              primes[hovered] === 1 ? 'prime' : 'not prime'
            }`
          : `${primeCount} primes up to ${count}`}
      </footer>
    </div>
  );
}
