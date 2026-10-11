/* @flow strict */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

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
