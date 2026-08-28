// Sentinel used in Pattern.cellColors for a cell with no bead - either it
// came from a transparent source pixel, an auto-detected background color,
// or the user manually cleared it. Never a real palette color name (those
// are always non-empty). Every consumer of cellColors must treat this the
// same way: skip it in counts/completion, render it as a visible gap rather
// than a color, and leave it unfilled (transparent) in exported images.
export const EMPTY_CELL = '';

export interface Pattern {
  id: string;
  name: string;
  createdAt: string;
  rows: number;
  cols: number;
  cellColors: string[][];
  paletteId: string;
  completedColors: string[];
  thumbnail: string;
  shareSlug?: string;
}
