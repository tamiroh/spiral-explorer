/* @flow strict */

// Every prime up to `baseLimit`, in ascending order. These are enough to sieve
// any range that ends at or below baseLimit^2, and the list grows on demand.
let baseLimit = 0;
let basePrimes: Array<number> = [];

function ensureBasePrimes(limit: number): void {
  if (limit <= baseLimit) {
    return;
  }
  baseLimit = Math.max(limit, 2 * baseLimit, 1024);
  basePrimes = [];
  const composite = new Uint8Array(baseLimit + 1);
  for (let p = 2; p <= baseLimit; p++) {
    if (composite[p] === 0) {
      basePrimes.push(p);
      for (let multiple = p * p; multiple <= baseLimit; multiple += p) {
        composite[multiple] = 1;
      }
    }
  }
}

// Segmented sieve of Eratosthenes over start..start + length - 1: the result
// holds 1 at index i when start + i is prime.
export function primesInRange(start: number, length: number): Uint8Array {
  const end = start + length - 1;
  const flags = new Uint8Array(length).fill(1);
  for (let n = start; n < 2 && n <= end; n++) {
    flags[n - start] = 0;
  }
  ensureBasePrimes(Math.floor(Math.sqrt(end)) + 1);
  for (const p of basePrimes) {
    if (p * p > end) {
      break;
    }
    const first = Math.max(p * p, Math.ceil(start / p) * p);
    for (let multiple = first; multiple <= end; multiple += p) {
      flags[multiple - start] = 0;
    }
  }
  return flags;
}

export const isPrime = (n: number): boolean => primesInRange(n, 1)[0] === 1;
