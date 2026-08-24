import { RGB } from '../color/lab';

const CELL_SIZE_PX = 20;

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
      const { r, g, b } = grid[row][col];
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
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
