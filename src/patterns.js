/* @flow strict */

import {primesUpTo} from './math.js';

// -----------------------------------------------------------------------------
// Common
// -----------------------------------------------------------------------------

type Coordinates = {readonly x: number, readonly y: number};

export opaque type Cell: Coordinates = Coordinates;

export function cell(x: number, y: number): Cell {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    throw new RangeError('Cell coordinates must be safe integers');
  }
  return {x, y};
}

export type Pattern = {
  readonly id: string,
  readonly name: string,
  readonly label: string,
  readonly position: (n: number) => Cell,
  readonly numberAt: Cell => number,
  readonly marks: (start: number, length: number) => Uint8Array,
};

export const isMarked = (pattern: Pattern, n: number): boolean =>
  pattern.marks(n, 1)[0] === 1;

// -----------------------------------------------------------------------------
// Ulam spiral
// -----------------------------------------------------------------------------
//
// The Ulam spiral marks the primes on a square spiral that puts 1 at the
// origin, 2 to its right, and winds counterclockwise with y pointing up. Ring
// k ends at (2k + 1)^2 in the bottom-right corner (k, -k), and each of its
// four sides holds 2k numbers.

const BASE_LIMIT = 2 ** 22;
const BASE_PRIMES = primesUpTo(BASE_LIMIT);

const MAX_PRIME_CANDIDATE = BASE_LIMIT ** 2;

const ulam: Pattern = {
  id: 'ulam',
  name: 'Ulam spiral',
  label: 'prime',

  position(n) {
    const k = Math.ceil((Math.sqrt(n) - 1) / 2);
    const side = 2 * k;
    const offset = (side + 1) ** 2 - n;
    if (offset <= side) {
      return cell(k - offset, -k);
    }
    if (offset <= 2 * side) {
      return cell(-k, offset - side - k);
    }
    if (offset <= 3 * side) {
      return cell(offset - 2 * side - k, k);
    }
    return cell(k, k - (offset - 3 * side));
  },

  numberAt({x, y}) {
    const k = Math.max(Math.abs(x), Math.abs(y));
    const side = 2 * k;
    const last = (side + 1) ** 2;
    if (y === -k) {
      return last - (k - x);
    }
    if (x === -k) {
      return last - side - (y + k);
    }
    if (y === k) {
      return last - 2 * side - (x + k);
    }
    return last - 3 * side - (k - y);
  },

  marks(start, length) {
    const end = start + length - 1;
    if (end > MAX_PRIME_CANDIDATE) {
      throw new RangeError(`Cannot test numbers above ${MAX_PRIME_CANDIDATE}`);
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
  },
};

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------

export const PATTERNS: Array<Pattern> = [ulam];
