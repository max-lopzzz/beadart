import { ImageBuffer } from '../pixelart/blockDetect';
import { RGB } from '../color/lab';

const INSET_FRACTION = 0.3;

export function sampleWarpedGrid(image: ImageBuffer, rows: number, cols: number): RGB[][] {
  const cellWidth = image.width / cols;
  const cellHeight = image.height / rows;

  const grid: RGB[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowColors: RGB[] = [];
    for (let col = 0; col < cols; col++) {
      const cellStartX = col * cellWidth;
      const cellStartY = row * cellHeight;
      const insetX = cellWidth * INSET_FRACTION;
      const insetY = cellHeight * INSET_FRACTION;

      const startX = Math.floor(cellStartX + insetX);
      const endX = Math.ceil(cellStartX + cellWidth - insetX);
      const startY = Math.floor(cellStartY + insetY);
      const endY = Math.ceil(cellStartY + cellHeight - insetY);

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
