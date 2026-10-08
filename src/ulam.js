/* @flow strict */

export type Cell = {readonly x: number, readonly y: number};

// The Ulam spiral puts 1 at the origin, 2 to its right, and winds
// counterclockwise with y pointing up. Ring k ends at (2k + 1)^2 in the
// bottom-right corner (k, -k), and each of its four sides holds 2k numbers.

export function ulamPosition(n: number): Cell {
  const k = Math.ceil((Math.sqrt(n) - 1) / 2);
  const side = 2 * k;
  const offset = (side + 1) ** 2 - n;
  if (offset <= side) {
    return {x: k - offset, y: -k};
  }
  if (offset <= 2 * side) {
    return {x: -k, y: offset - side - k};
  }
  if (offset <= 3 * side) {
    return {x: offset - 2 * side - k, y: k};
  }
  return {x: k, y: k - (offset - 3 * side)};
}

export function ulamNumberAt(x: number, y: number): number {
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
}
