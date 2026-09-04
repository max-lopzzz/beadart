import { describe, it, expect } from 'vitest';
import { floodFillRegion } from './floodFill';

function sortCells(cells: { row: number; col: number }[]) {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe('floodFillRegion', () => {
  it('returns just the clicked cell when no neighbor shares its color', () => {
    const grid = [
      ['red', 'blue'],
      ['blue', 'blue'],
    ];
    expect(sortCells(floodFillRegion(grid, 0, 0))).toEqual([{ row: 0, col: 0 }]);
  });

  it('collects an orthogonally connected blob of the same color', () => {
    const grid = [
      ['red', 'red', 'blue'],
      ['red', 'blue', 'blue'],
      ['blue', 'blue', 'blue'],
    ];
    expect(sortCells(floodFillRegion(grid, 0, 0))).toEqual(
      sortCells([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]),
    );
  });

  it('does not leak across a diagonal-only touch', () => {
    const grid = [
      ['red', 'blue'],
      ['blue', 'red'],
    ];
    expect(sortCells(floodFillRegion(grid, 0, 0))).toEqual([{ row: 0, col: 0 }]);
  });

  it('treats empty cells as a matchable color, filling a connected empty region', () => {
    const grid = [
      ['', '', 'red'],
      ['red', '', 'red'],
    ];
    expect(sortCells(floodFillRegion(grid, 0, 0))).toEqual(
      sortCells([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ]),
    );
  });

  it('returns an empty array for out-of-bounds coordinates', () => {
    const grid = [['red']];
    expect(floodFillRegion(grid, 5, 5)).toEqual([]);
  });

  it('fills the entire grid when every cell shares the same color', () => {
    const grid = [
      ['red', 'red'],
      ['red', 'red'],
    ];
    expect(sortCells(floodFillRegion(grid, 1, 1))).toEqual(
      sortCells([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ]),
    );
  });
});
