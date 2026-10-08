/* @flow strict */

// Sieve of Eratosthenes: the result holds 1 at index n when n is prime.
export function sievePrimes(limit: number): Uint8Array {
  const isPrime = new Uint8Array(limit + 1).fill(1, 2);
  for (let p = 2; p * p <= limit; p++) {
    if (isPrime[p] === 1) {
      for (let multiple = p * p; multiple <= limit; multiple += p) {
        isPrime[multiple] = 0;
      }
    }
  }
  return isPrime;
}
