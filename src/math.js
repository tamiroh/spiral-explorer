/* @flow strict */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

type Coordinates = {readonly x: number, readonly y: number};

export opaque type Point: Coordinates = Coordinates;

export function point(x: number, y: number): Point {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('Point coordinates must be finite numbers');
  }
  return {x, y};
}

export const midpoint = (a: Point, b: Point): Point =>
  point((a.x + b.x) / 2, (a.y + b.y) / 2);

export const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function primesUpTo(limit: number): Array<number> {
  const primes = [];
  const composite = new Uint8Array(limit + 1);
  for (let p = 2; p <= limit; p++) {
    if (composite[p] === 0) {
      primes.push(p);
      for (let multiple = p * p; multiple <= limit; multiple += p) {
        composite[multiple] = 1;
      }
    }
  }
  return primes;
}
