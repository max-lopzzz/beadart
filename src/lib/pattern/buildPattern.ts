import { RGB } from '../color/lab';
import { findNearestColor } from '../color/nearestMatch';
import { PaletteColor } from '../../types/palette';

export function buildCellColors(grid: RGB[][], palette: PaletteColor[]): string[][] {
  return grid.map((row) => row.map((rgb) => findNearestColor(rgb, palette).name));
}
