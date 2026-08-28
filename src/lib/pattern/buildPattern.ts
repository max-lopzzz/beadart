import { RGB } from '../color/lab';
import { findNearestColor } from '../color/nearestMatch';
import { PaletteColor } from '../../types/palette';
import { EMPTY_CELL } from '../../types/pattern';

// A cell is treated as "no bead" once it's more transparent than opaque,
// rather than requiring near-full transparency - bead patterns are
// essentially never semi-transparent art, so a cell that's mostly (but not
// entirely) see-through is overwhelmingly more likely to be background
// bleeding in at an edge than a genuine half-opaque design color.
const ALPHA_EMPTY_THRESHOLD = 128;

export function buildCellColors(grid: RGB[][], palette: PaletteColor[]): string[][] {
  return grid.map((row) =>
    row.map((rgb) => {
      if (rgb.a !== undefined && rgb.a < ALPHA_EMPTY_THRESHOLD) return EMPTY_CELL;
      return findNearestColor(rgb, palette).name;
    }),
  );
}
