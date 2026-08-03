import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

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
      const isDimmed = !!options.onlyColors?.length && !options.onlyColors.includes(colorName);
      ctx.fillStyle = isDimmed ? '#e0e0e0' : (hexByName.get(colorName) ?? '#000000');
      ctx.fillRect(col * CELL_SIZE_PX, row * CELL_SIZE_PX, CELL_SIZE_PX, CELL_SIZE_PX);
    }
  }

  if (options.maxSize && canvas.width > options.maxSize) {
    const scaled = document.createElement('canvas');
    const scale = options.maxSize / canvas.width;
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
