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
      let sumA = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * image.width + x) * 4;
          sumR += image.data[idx];
          sumG += image.data[idx + 1];
          sumB += image.data[idx + 2];
          sumA += image.data[idx + 3];
          count++;
        }
      }

      rowColors.push({
        r: Math.round(sumR / count),
        g: Math.round(sumG / count),
        b: Math.round(sumB / count),
        a: Math.round(sumA / count),
      });
    }
    grid.push(rowColors);
  }

  return grid;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function downsampleToGridByCount(image: ImageBuffer, cols: number, rows: number): RGB[][] {
  const grid: RGB[][] = [];

  for (let row = 0; row < rows; row++) {
    const startY = Math.floor((row * image.height) / rows);
    // Clamp each end boundary to at least start + 1: if the caller requests more
    // cols/rows than the image has pixels along that axis, the "natural"
    // boundary can equal the start boundary, giving a zero-width slice with no
    // well-defined sample. Guaranteeing at least 1 source pixel per cell means
    // an oversized grid oversamples the same source pixel across multiple
    // cells instead of reading out of bounds. The outer Math.min bounds are a
    // no-op in practice (start+1 and the natural end are always <= the image
    // dimension) but are kept as a safety net.
    const endY = Math.min(image.height, Math.max(startY + 1, Math.floor(((row + 1) * image.height) / rows)));
    const cellHeight = endY - startY;
    // Sample from the middle 50% of the cell (a quarter-height margin on
    // each side) so the sampled patch stays clear of a gridline border drawn
    // around each logical pixel block. For a 1-2px cell there's no room for
    // a margin, so the patch falls back to the whole cell.
    const padY = Math.floor(cellHeight * 0.25);
    const patchStartY = startY + padY;
    const patchEndY = Math.max(patchStartY + 1, endY - padY);
    const rowColors: RGB[] = [];

    for (let col = 0; col < cols; col++) {
      const startX = Math.floor((col * image.width) / cols);
      // Same zero-width guard as endY above, applied to the column axis.
      const endX = Math.min(image.width, Math.max(startX + 1, Math.floor(((col + 1) * image.width) / cols)));
      const cellWidth = endX - startX;
      const padX = Math.floor(cellWidth * 0.25);
      const patchStartX = startX + padX;
      const patchEndX = Math.max(patchStartX + 1, endX - padX);

      // Take the median of the interior patch rather than a single pixel:
      // real source images (photographed or screenshotted pixel art, often
      // JPEG) carry per-pixel compression noise, and a single sampled pixel
      // can happen to be a noisy outlier that matches a different palette
      // color than the cell's true, overwhelmingly dominant color. The
      // median is unaffected as long as noise isn't the majority of the
      // patch, while still avoiding the gridline border like a single
      // center-pixel sample would.
      const rValues: number[] = [];
      const gValues: number[] = [];
      const bValues: number[] = [];
      const aValues: number[] = [];
      for (let y = patchStartY; y < patchEndY; y++) {
        for (let x = patchStartX; x < patchEndX; x++) {
          const idx = (y * image.width + x) * 4;
          rValues.push(image.data[idx]);
          gValues.push(image.data[idx + 1]);
          bValues.push(image.data[idx + 2]);
          aValues.push(image.data[idx + 3]);
        }
      }

      rowColors.push({
        r: median(rValues),
        g: median(gValues),
        b: median(bValues),
        a: median(aValues),
      });
    }
    grid.push(rowColors);
  }

  return grid;
}
