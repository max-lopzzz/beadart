import { RGB } from '../color/lab';
import { ALPHA_EMPTY_THRESHOLD } from '../../types/pattern';

const CELL_SIZE_PX = 20;

export function containScale(width: number, height: number, maxSize: number): number {
  if (width <= maxSize && height <= maxSize) return 1;
  return Math.min(maxSize / width, maxSize / height);
}

export function renderRgbGridToDataUrl(grid: RGB[][], options: { maxSize?: number } = {}): string {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cols * CELL_SIZE_PX);
  canvas.height = Math.max(1, rows * CELL_SIZE_PX);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('renderRgbGridToDataUrl: could not get 2D canvas context');
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { r, g, b, a } = grid[row][col];
      // A cell below the same threshold buildCellColors uses to decide "no
      // bead" is left unpainted (an actual gap) here too, so the preview
      // agrees with what continuing will actually produce - previously this
      // only skipped fully-transparent cells (a < 1), so a cell that would
      // become empty in the real pattern (e.g. alpha 50) could preview as a
      // faint but present color swatch instead. A kept cell always renders
      // fully opaque, matching the solid palette color it will become -
      // partial alpha only ever decides empty-or-not, never a translucent
      // render.
      if (a !== undefined && a < ALPHA_EMPTY_THRESHOLD) continue;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
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
