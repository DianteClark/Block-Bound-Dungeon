/* Piece shapes. Weight favours mid-sized pieces; the lab tunes these. */
const SRC = [
  [['#'], 0.7], [['##'], 1], [['###'], 1.1], [['####'], 0.9], [['#####'], 0.5],
  [['##', '##'], 1.2], [['###', '###'], 0.6], [['###', '###', '###'], 0.35],
  [['##', '#.'], 1.1], [['###', '#..', '#..'], 0.5],
  [['###', '.#.'], 1], [['##.', '.##'], 0.9], [['.##', '##.'], 0.9],
  [['#..', '###'], 0.9], [['..#', '###'], 0.9],
];
export const SHAPES = SRC.map(([rows, weight]) => {
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { cells, h: rows.length, w: Math.max(...rows.map(x => x.length)), weight };
});

export function rotate(shape) {
  return { cells: shape.cells.map(([r, c]) => [c, shape.h - 1 - r]), h: shape.w, w: shape.h };
}
