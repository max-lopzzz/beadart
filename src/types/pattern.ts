// Sentinel used in Pattern.cellColors for a cell with no bead - either it
// came from a transparent source pixel, an auto-detected background color,
// or the user manually cleared it. Never a real palette color name (those
// are always non-empty). Every consumer of cellColors must treat this the
// same way: skip it in counts/completion, render it as a visible gap rather
// than a color, and leave it unfilled (transparent) in exported images.
export const EMPTY_CELL = '';

// A cell/pixel is treated as "no bead" once it's more transparent than
// opaque, rather than requiring near-full transparency - bead patterns are
// essentially never semi-transparent art, so a cell that's mostly (but not
// entirely) see-through is overwhelmingly more likely to be background
// bleeding in at an edge than a genuine half-opaque design color. Shared by
// every place that reads raw alpha (building the final pattern, the live
// preview, background-color detection) so they all agree on what counts as
// transparent instead of drifting apart as independent magic numbers.
export const ALPHA_EMPTY_THRESHOLD = 128;

export interface Pattern {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rows: number;
  cols: number;
  cellColors: string[][];
  paletteId: string;
  completedColors: string[];
  thumbnail: string;
  shareSlug?: string;
}
