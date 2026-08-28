import { RGB } from '../color/lab';
import { findNearestColor } from '../color/nearestMatch';
import { PaletteColor } from '../../types/palette';
import { ALPHA_EMPTY_THRESHOLD, EMPTY_CELL } from '../../types/pattern';

export function buildCellColors(grid: RGB[][], palette: PaletteColor[]): string[][] {
  return grid.map((row) =>
    row.map((rgb) => {
      if (rgb.a !== undefined && rgb.a < ALPHA_EMPTY_THRESHOLD) return EMPTY_CELL;
      return findNearestColor(rgb, palette).name;
    }),
  );
}
