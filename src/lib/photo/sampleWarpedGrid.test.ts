import { describe, it, expect } from 'vitest';
import { sampleWarpedGrid } from './sampleWarpedGrid';
import { ImageBuffer } from '../pixelart/blockDetect';
import { RGB } from '../color/lab';

function makeGridWithBorders(
  cellSize: number,
  rows: number,
  cols: number,
  colors: RGB[][],
  borderColor: RGB,
): ImageBuffer {
  const width = cellSize * cols;
  const height = cellSize * rows;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cellSize);
    const localY = y % cellSize;
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / cellSize);
      const localX = x % cellSize;
      const isBorder = localX < 2 || localX >= cellSize - 2 || localY < 2 || localY >= cellSize - 2;
      const color = isBorder ? borderColor : colors[row][col];
      const idx = (y * width + x) * 4;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('sampleWarpedGrid', () => {
  it('averages only the center-inset region of each cell, ignoring a 2px border of noise', () => {
    const colors: RGB[][] = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 255, b: 0 },
        { r: 255, g: 255, b: 0 },
      ],
    ];
    const image = makeGridWithBorders(10, 2, 2, colors, { r: 0, g: 0, b: 0 });

    expect(sampleWarpedGrid(image, 2, 2)).toEqual(colors);
  });
});
