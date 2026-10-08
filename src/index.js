/* @flow strict */

type Direction = 'clockwise' | 'counterclockwise';

type Point = {readonly x: number, readonly y: number};

const sign = (direction: Direction): number =>
  match (direction) {
    'clockwise' => -1,
    'counterclockwise' => 1,
  };

export function spiral(
  steps: number,
  direction: Direction = 'counterclockwise',
): Array<Point> {
  return Array.from({length: steps}, (_, i) => {
    const angle = sign(direction) * i * 0.5;
    return {x: i * Math.cos(angle), y: i * Math.sin(angle)};
  });
}

console.log(spiral(5));
