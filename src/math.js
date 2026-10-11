/* @flow strict */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export type Vector = {readonly x: number, readonly y: number};

export const midpoint = (a: Vector, b: Vector): Vector => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const distance = (a: Vector, b: Vector): number =>
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
