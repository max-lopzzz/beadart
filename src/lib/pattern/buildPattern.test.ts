import { describe, it, expect } from 'vitest';
import { buildCellColors } from './buildPattern';
import { PaletteColor } from '../../types/palette';
import { EMPTY_CELL } from '../../types/pattern';

describe('buildCellColors', () => {
  const palette: PaletteColor[] = [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ];

  it('maps each cell to its nearest palette color name', () => {
    const grid = [
      [{ r: 250, g: 5, b: 5 }, { r: 5, g: 5, b: 250 }],
      [{ r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 0 }],
    ];
    expect(buildCellColors(grid, palette)).toEqual([
      ['Red', 'Blue'],
      ['Blue', 'Red'],
    ]);
  });

  it('returns an empty grid for an empty input grid', () => {
    expect(buildCellColors([], palette)).toEqual([]);
  });

  it('maps a mostly-transparent cell to the empty sentinel instead of a palette color', () => {
    const grid = [[{ r: 250, g: 5, b: 5, a: 255 }, { r: 5, g: 5, b: 250, a: 20 }]];
    expect(buildCellColors(grid, palette)).toEqual([['Red', EMPTY_CELL]]);
  });

  it('treats a cell with no alpha field at all as fully opaque', () => {
    // Cells that never went through the alpha-sampling downsample path
    // (e.g. constructed directly in older code paths) have no `a` field -
    // absence must not be misread as "fully transparent".
    const grid = [[{ r: 250, g: 5, b: 5 }]];
    expect(buildCellColors(grid, palette)).toEqual([['Red']]);
  });
});
