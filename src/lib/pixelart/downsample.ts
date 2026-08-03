import { ImageBuffer } from './blockDetect';
import { RGB } from '../color/lab';

export function downsampleToGrid(
  image: ImageBuffer,
  blockWidth: number,
  blockHeight: number,
): RGB[][] {
  const cols = Math.ceil(image.width / blockWidth);
  const rows = Math.ceil(image.height / blockHeight);
  const grid: RGB[][] = [];

  for (let row = 0; row < rows; row++) {
    const rowColors: RGB[] = [];
    for (let col = 0; col < cols; col++) {
      const startX = col * blockWidth;
      const startY = row * blockHeight;
      const endX = Math.min(startX + blockWidth, image.width);
      const endY = Math.min(startY + blockHeight, image.height);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * image.width + x) * 4;
          sumR += image.data[idx];
          sumG += image.data[idx + 1];
          sumB += image.data[idx + 2];
          count++;
        }
      }

      rowColors.push({
        r: Math.round(sumR / count),
        g: Math.round(sumG / count),
        b: Math.round(sumB / count),
      });
    }
    grid.push(rowColors);
  }

  return grid;
}

export function downsampleToGridByCount(image: ImageBuffer, cols: number, rows: number): RGB[][] {
  const grid: RGB[][] = [];

  for (let row = 0; row < rows; row++) {
    const startY = Math.floor((row * image.height) / rows);
    // Clamp each end boundary to at least start + 1: if the caller requests more
    // cols/rows than the image has pixels along that axis, the "natural"
    // boundary can equal the start boundary, giving a zero-width slice with no
    // well-defined center pixel. Guaranteeing at least 1 source pixel per cell
    // means an oversized grid oversamples the same source pixel across multiple
    // cells instead of reading out of bounds. The outer Math.min bounds are a
    // no-op in practice (start+1 and the natural end are always <= the image
    // dimension) but are kept as a safety net.
    const endY = Math.min(image.height, Math.max(startY + 1, Math.floor(((row + 1) * image.height) / rows)));
    const centerY = startY + Math.floor((endY - startY) / 2);
    const rowColors: RGB[] = [];

    for (let col = 0; col < cols; col++) {
      const startX = Math.floor((col * image.width) / cols);
      // Same zero-width guard as endY above, applied to the column axis.
      const endX = Math.min(image.width, Math.max(startX + 1, Math.floor(((col + 1) * image.width) / cols)));
      const centerX = startX + Math.floor((endX - startX) / 2);

      // Sample only the center pixel of the cell rather than averaging the
      // whole cell: source pixel-art images are often exported with a
      // gridline border drawn around each logical pixel block, and averaging
      // would blend that border color into the result.
      const idx = (centerY * image.width + centerX) * 4;
      rowColors.push({
        r: image.data[idx],
        g: image.data[idx + 1],
        b: image.data[idx + 2],
      });
    }
    grid.push(rowColors);
  }

  return grid;
}
