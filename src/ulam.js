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

export type Rect = {
  readonly x0: number,
  readonly y0: number,
  readonly x1: number,
  readonly y1: number,
};

// Splits the cells inside `rect` (bounds inclusive) into runs of consecutive
// numbers: `start` sits at (x, y) and each following number is one (dx, dy)
// step further. Every cell is reported exactly once.
export function forEachUlamRun(
  rect: Rect,
  callback: (
    start: number,
    length: number,
    x: number,
    y: number,
    dx: number,
    dy: number,
  ) => void,
): void {
  const {x0, y0, x1, y1} = rect;
  const emit = (
    xa: number,
    ya: number,
    xb: number,
    yb: number,
    dx: number,
    dy: number,
  ) => {
    if (xa <= xb && ya <= yb) {
      const x = dx < 0 ? xb : xa;
      const y = dy < 0 ? yb : ya;
      callback(ulamNumberAt(x, y), xb - xa + yb - ya + 1, x, y, dx, dy);
    }
  };

  const nearest = Math.max(0, x0, -x1, y0, -y1);
  const farthest = Math.max(-x0, x1, -y0, y1);
  if (nearest === 0) {
    callback(1, 1, 0, 0, 1, 0);
  }
  // Each ring is walked as its right, top, left and bottom sides, with every
  // corner assigned to the side that reaches it last.
  for (let k = Math.max(1, nearest); k <= farthest; k++) {
    if (x0 <= k && k <= x1) {
      emit(k, Math.max(y0, 1 - k), k, Math.min(y1, k), 0, 1);
    }
    if (y0 <= k && k <= y1) {
      emit(Math.max(x0, -k), k, Math.min(x1, k - 1), k, -1, 0);
    }
    if (x0 <= -k && -k <= x1) {
      emit(-k, Math.max(y0, -k), -k, Math.min(y1, k - 1), 0, -1);
    }
    if (y0 <= -k && -k <= y1) {
      emit(Math.max(x0, 1 - k), -k, Math.min(x1, k), -k, 1, 0);
    }
  }
}
