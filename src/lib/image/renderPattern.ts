import { EMPTY_CELL, Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { containScale } from './renderRgbGrid';

const CELL_SIZE_PX = 20;

export function renderPatternToDataUrl(
  pattern: Pattern,
  palette: Palette,
  options: { onlyColors?: string[]; maxSize?: number } = {},
): string {
  const canvas = document.createElement('canvas');
  canvas.width = pattern.cols * CELL_SIZE_PX;
  canvas.height = pattern.rows * CELL_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('renderPatternToDataUrl: could not get 2D canvas context');
  }

  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  for (let row = 0; row < pattern.rows; row++) {
    for (let col = 0; col < pattern.cols; col++) {
      const colorName = pattern.cellColors[row][col];
      // A cell with no bead is left unpainted (transparent) rather than
      // filled with a placeholder color - a bead-pattern reference image
      // should show an actual gap where there's nothing to place, not a
      // color that looks like it needs a bead.
      if (colorName === EMPTY_CELL) continue;
      const isDimmed = !!options.onlyColors?.length && !options.onlyColors.includes(colorName);
      ctx.fillStyle = isDimmed ? '#e0e0e0' : (hexByName.get(colorName) ?? '#000000');
      ctx.fillRect(col * CELL_SIZE_PX, row * CELL_SIZE_PX, CELL_SIZE_PX, CELL_SIZE_PX);
    }
  }

  const scale = options.maxSize ? containScale(canvas.width, canvas.height, options.maxSize) : 1;
  if (scale < 1) {
    const scaled = document.createElement('canvas');
    scaled.width = Math.round(canvas.width * scale);
    scaled.height = Math.round(canvas.height * scale);
    const scaledCtx = scaled.getContext('2d');
    if (scaledCtx) {
      scaledCtx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return scaled.toDataURL('image/png');
    }
  }

  return canvas.toDataURL('image/png');
}
