/* @flow strict-local */

import {useState} from 'react';

import type {Direction} from './spiral.js';

import {spiral} from './spiral.js';

const SIZE = 400;

export default component App() {
  const [turns, setTurns] = useState(5);
  const [direction, setDirection] = useState<Direction>('counterclockwise');

  const points = spiral(turns, SIZE / 2 - 10, direction)
    .map(({x, y}) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  return (
    <main>
      <h1>Spiral Explorer</h1>
      <svg
        viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label="Spiral preview">
        <polyline points={points} />
      </svg>
      <label>
        Turns: {turns}
        <input
          type="range"
          min="1"
          max="20"
          value={turns}
          onChange={event => setTurns(Number(event.currentTarget.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={direction === 'clockwise'}
          onChange={event =>
            setDirection(
              event.currentTarget.checked ? 'clockwise' : 'counterclockwise',
            )
          }
        />
        Clockwise
      </label>
    </main>
  );
}
