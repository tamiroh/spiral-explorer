/* @flow strict */

export type Direction = 'clockwise' | 'counterclockwise';

export type Point = {readonly x: number, readonly y: number};

const POINTS_PER_TURN = 60;

const sign = (direction: Direction): number =>
  match (direction) {
    'clockwise' => 1,
    'counterclockwise' => -1,
  };

// Archimedean spiral that reaches `radius` after `turns` full rotations.
export function spiral(
  turns: number,
  radius: number,
  direction: Direction,
): Array<Point> {
  const steps = Math.max(1, Math.round(turns * POINTS_PER_TURN));
  return Array.from({length: steps + 1}, (_, i) => {
    const progress = i / steps;
    const angle = sign(direction) * progress * turns * 2 * Math.PI;
    return {
      x: radius * progress * Math.cos(angle),
      y: radius * progress * Math.sin(angle),
    };
  });
}
