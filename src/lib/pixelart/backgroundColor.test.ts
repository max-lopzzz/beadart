import { describe, it, expect } from 'vitest';
import { detectBackgroundColor, isBackgroundColor } from './backgroundColor';
import { ImageBuffer } from './blockDetect';

function makeFramedImage(
  width: number,
  height: number,
  frameColor: [number, number, number],
  centerColor: [number, number, number],
  centerSize: number,
): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  const centerStartX = Math.floor((width - centerSize) / 2);
  const centerStartY = Math.floor((height - centerSize) / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inCenter =
        x >= centerStartX &&
        x < centerStartX + centerSize &&
        y >= centerStartY &&
        y < centerStartY + centerSize;
      const color = inCenter ? centerColor : frameColor;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('detectBackgroundColor', () => {
  it('picks the color that dominates the image border, not the most common color overall', () => {
    // The center block is bigger in total area than the thin border, so a
    // "most frequent color overall" heuristic would pick the center color -
    // exactly backwards. Sampling only the border finds the true background.
    const image = makeFramedImage(20, 20, [255, 255, 255], [10, 10, 10], 18);
    expect(detectBackgroundColor(image)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('detects a non-white background', () => {
    const image = makeFramedImage(20, 20, [30, 60, 120], [200, 200, 50], 10);
    expect(detectBackgroundColor(image)).toEqual({ r: 30, g: 60, b: 120 });
  });
});

describe('isBackgroundColor', () => {
  const background = { r: 255, g: 255, b: 255 };

  it('is true for the exact background color', () => {
    expect(isBackgroundColor(background, background)).toBe(true);
  });

  it('is true for a color close to the background (antialiasing/compression noise)', () => {
    expect(isBackgroundColor({ r: 250, g: 253, b: 255 }, background)).toBe(true);
  });

  it('is false for a color clearly distinct from the background', () => {
    expect(isBackgroundColor({ r: 20, g: 30, b: 40 }, background)).toBe(false);
  });
});
