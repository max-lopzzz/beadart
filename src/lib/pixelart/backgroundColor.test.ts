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

  it('does not double-count corner pixels, which would let a minority corner color outvote the true majority', () => {
    // 3-wide x 4-tall image: the 4 corners are one color (4 unique border
    // pixels), the 6 non-corner border pixels are another. Sampled once
    // each, the non-corner color is the clear majority (6 vs 4) and must
    // win. If corners are instead sampled twice - once scanning rows, once
    // scanning columns - the corner color's effective weight becomes 8,
    // wrongly outvoting the true 6-pixel majority.
    const width = 3;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    const cornerColor: [number, number, number] = [10, 200, 10];
    const majorityColor: [number, number, number] = [200, 10, 10];
    const interior: [number, number, number] = [0, 0, 0];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isCorner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
        const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
        const color = isCorner ? cornerColor : isBorder ? majorityColor : interior;
        const idx = (y * width + x) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }
    expect(detectBackgroundColor({ width, height, data })).toEqual({ r: 200, g: 10, b: 10 });
  });

  it('ignores transparent border pixels rather than averaging in their meaningless RGB', () => {
    // Many encoders zero out RGB under alpha=0, so a transparent border
    // pixel's color channels don't represent anything real. A border that's
    // mostly transparent, with one small solid-colored patch, should detect
    // that solid color - not a wrong color derived from zeroed/garbage RGB
    // sitting under transparency.
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    const solid: [number, number, number] = [40, 90, 200];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
        const idx = (y * width + x) * 4;
        if (!isBorder) continue;
        // A small solid patch along the top edge; the rest of the border is
        // fully transparent with garbage (zeroed) RGB, as real encoders
        // commonly produce.
        const inSolidPatch = y === 0 && x >= 1 && x <= 3;
        if (inSolidPatch) {
          data[idx] = solid[0];
          data[idx + 1] = solid[1];
          data[idx + 2] = solid[2];
          data[idx + 3] = 255;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        }
      }
    }
    expect(detectBackgroundColor({ width, height, data })).toEqual({
      r: solid[0],
      g: solid[1],
      b: solid[2],
    });
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
