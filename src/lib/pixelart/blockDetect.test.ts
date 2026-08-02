import { describe, it, expect } from 'vitest';
import { detectBlockSize, ImageBuffer } from './blockDetect';

function makeCheckerboard(
  blockWidth: number,
  blockHeight: number,
  blocksX: number,
  blocksY: number,
): ImageBuffer {
  const width = blockWidth * blocksX;
  const height = blockHeight * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockWidth);
      const color = (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

describe('detectBlockSize', () => {
  it('detects a square block size from a checkerboard pattern', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 3, blockHeight: 3 });
  });

  it('detects a non-square block size', () => {
    const image = makeCheckerboard(4, 5, 3, 2);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 4, blockHeight: 5 });
  });

  it('returns null for a solid-color image with no detectable grid', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 100;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }
    expect(detectBlockSize({ width, height, data })).toBeNull();
  });
});
