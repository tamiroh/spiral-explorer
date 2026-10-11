/* @flow strict */

function primesUpTo(limit: number): Array<number> {
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

const BASE_LIMIT = 2 ** 22;
const BASE_PRIMES = primesUpTo(BASE_LIMIT);

export const MAX_NUMBER: number = BASE_LIMIT ** 2;

export function primesInRange(start: number, length: number): Uint8Array {
  const end = start + length - 1;
  if (end > MAX_NUMBER) {
    throw new RangeError(`Cannot test numbers above ${MAX_NUMBER}`);
  }
  const flags = new Uint8Array(length).fill(1);
  for (let n = start; n < 2 && n <= end; n++) {
    flags[n - start] = 0;
  }
  for (const p of BASE_PRIMES) {
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
