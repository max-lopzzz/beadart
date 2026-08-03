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
    const endY = Math.min(image.height, Math.max(startY + 1, Math.floor(((row + 1) * image.height) / rows)));
    const rowColors: RGB[] = [];

    for (let col = 0; col < cols; col++) {
      const startX = Math.floor((col * image.width) / cols);
      const endX = Math.min(image.width, Math.max(startX + 1, Math.floor(((col + 1) * image.width) / cols)));

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
