/* Grid geometry: placement, full lines, and grid transforms. A board is a flat array of
 * GRID*GRID cells holding a block type or null. */
import { GRID as N } from '../data/rules.js';
import { rotate } from '../data/shapes.js';

export function fits(board, piece, r, c) {
  for (const [dr, dc] of piece.cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= N || cc >= N || board[rr * N + cc]) return false;
  }
  return true;
}

export function fitsAnywhere(board, piece) {
  for (let r = 0; r <= N - piece.h; r++)
    for (let c = 0; c <= N - piece.w; c++)
      if (fits(board, piece, r, c)) return true;
  return false;
}

export function fitsAnyRotation(board, piece) {
  let p = piece;
  for (let k = 0; k < 4; k++) {
    if (fitsAnywhere(board, p)) return true;
    p = { ...p, ...rotate(p) };
  }
  return false;
}

export function fullLines(board) {
  const rows = [], cols = [];
  for (let r = 0; r < N; r++) {
    let full = true;
    for (let c = 0; c < N; c++) if (!board[r * N + c]) { full = false; break; }
    if (full) rows.push(r);
  }
  for (let c = 0; c < N; c++) {
    let full = true;
    for (let r = 0; r < N; r++) if (!board[r * N + c]) { full = false; break; }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export function lineCells(rows, cols) {
  const set = new Set();
  for (const r of rows) for (let c = 0; c < N; c++) set.add(r * N + c);
  for (const c of cols) for (let r = 0; r < N; r++) set.add(r * N + c);
  return set;
}

export const rowCells = r => Array.from({ length: N }, (_, c) => r * N + c);
export const colCells = c => Array.from({ length: N }, (_, r) => r * N + c);

export function filledIn(board, cells) {
  let n = 0;
  for (const i of cells) if (board[i]) n++;
  return n;
}

/** Index of the row (or column) with the most blocks; ties go to the lowest index. */
export function fullestRow(board) {
  let best = 0, bestN = -1;
  for (let r = 0; r < N; r++) { const n = filledIn(board, rowCells(r)); if (n > bestN) { bestN = n; best = r; } }
  return best;
}
export function fullestCol(board) {
  let best = 0, bestN = -1;
  for (let c = 0; c < N; c++) { const n = filledIn(board, colCells(c)); if (n > bestN) { bestN = n; best = c; } }
  return best;
}
