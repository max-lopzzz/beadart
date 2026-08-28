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

function makeGridOverlayCheckerboard(
  blockSize: number,
  blocksX: number,
  blocksY: number,
  lineWidth: number,
): ImageBuffer {
  // A checkerboard where every block has a solid-colored line along its top
  // and left edge, like a bead-pattern reference image with grid lines drawn
  // over the design. Distinct from addNoise: this is a perfectly clean image
  // with no per-pixel noise at all - the only thing being tested here is
  // whether the gridline itself throws off detection.
  const width = blockSize * blocksX;
  const height = blockSize * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];
  const line: [number, number, number] = [0, 0, 0];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockSize);
    const localY = y % blockSize;
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockSize);
      const localX = x % blockSize;
      const isLine = localX < lineWidth || localY < lineWidth;
      const color = isLine ? line : (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

// A checkerboard sprite centered in a much larger solid-color canvas, like a
// character exported with background padding/margin rather than cropped
// tight to its own bounding box.
function makePaddedSprite(
  blockSize: number,
  blocksX: number,
  blocksY: number,
  canvasWidth: number,
  canvasHeight: number,
): ImageBuffer {
  const data = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  const bg: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < canvasWidth * canvasHeight; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }

  const spriteWidth = blockSize * blocksX;
  const spriteHeight = blockSize * blocksY;
  const offsetX = Math.floor((canvasWidth - spriteWidth) / 2);
  const offsetY = Math.floor((canvasHeight - spriteHeight) / 2);
  const colorA: [number, number, number] = [255, 200, 50];
  const colorB: [number, number, number] = [200, 60, 60];
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const color = (bx + by) % 2 === 0 ? colorA : colorB;
      for (let y = 0; y < blockSize; y++) {
        for (let x = 0; x < blockSize; x++) {
          const px = offsetX + bx * blockSize + x;
          const py = offsetY + by * blockSize + y;
          const idx = (py * canvasWidth + px) * 4;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
          data[idx + 3] = 255;
        }
      }
    }
  }

  return { width: canvasWidth, height: canvasHeight, data };
}

function addNoise(image: ImageBuffer, amplitude: number): ImageBuffer {
  const noisy = new Uint8ClampedArray(image.data);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const idx = (y * image.width + x) * 4;
      // Deterministic pseudo-noise in [-amplitude, amplitude], varying per pixel
      // to simulate JPEG compression noise between adjacent same-color pixels.
      const n = ((x * 37 + y * 17) % (amplitude * 2 + 1)) - amplitude;
      noisy[idx] = image.data[idx] + n;
      noisy[idx + 1] = image.data[idx + 1] + n;
      noisy[idx + 2] = image.data[idx + 2] + n;
      noisy[idx + 3] = 255;
    }
  }
  return { width: image.width, height: image.height, data: noisy };
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

  it('detects the block size despite small per-pixel noise, like JPEG compression', () => {
    const clean = makeCheckerboard(6, 6, 3, 3);
    const noisy = addNoise(clean, 6);
    expect(detectBlockSize(noisy)).toEqual({ blockWidth: 6, blockHeight: 6 });
  });

  it('detects the block size on a clean image with a drawn grid overlay', () => {
    // The gridline itself produces two color-change boundaries per block (fill
    // -> line, then line -> fill), so a naive "most common gap" can tie between
    // the line width and the true block pitch, picking the meaningless line
    // width instead. This has nothing to do with noise - the image is exact.
    const image = makeGridOverlayCheckerboard(8, 3, 3, 1);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 8, blockHeight: 8 });
  });

  it('detects the block size on a grid overlay with a thicker 2px gridline', () => {
    const image = makeGridOverlayCheckerboard(10, 3, 3, 2);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 10, blockHeight: 10 });
  });

  it('detects the block size on a noisy grid overlay, where the line/fill gap counts are close but not exactly tied', () => {
    // Real photographed/screenshotted grid-overlay images (see the JPEG case
    // that motivated this) rarely repeat with zero variation: JPEG noise and
    // uneven crop margins mean the line-width and fill-width gap counts end
    // up close but not perfectly equal, unlike the idealized exact-tie cases
    // above.
    const clean = makeGridOverlayCheckerboard(9, 6, 6, 1);
    const noisy = addNoise(clean, 6);
    expect(detectBlockSize(noisy)).toEqual({ blockWidth: 9, blockHeight: 9 });
  });

  it('detects a consistent block size on both axes of a non-square noisy grid overlay', () => {
    // A real bug report: on an actual photo, width detection returned garbage
    // (the line width) while height correctly detected the block size, on the
    // very same image. The two axes see different noise, which happened to
    // land width's "line vs fill" gap-count ratio just below a fixed
    // threshold while height's landed just above it - a coin flip, not a fix.
    // A non-square block count (23 x 27, matching the real report) is enough
    // to make width and height noise diverge the same way.
    const clean = makeGridOverlayCheckerboard(11, 23, 27, 1);
    const noisy = addNoise(clean, 8);
    expect(detectBlockSize(noisy)).toEqual({ blockWidth: 11, blockHeight: 11 });
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

  it('detects the block size of a sprite with background padding around it, not filling the whole canvas', () => {
    // Real-world regression: a character/sprite exported with margin around
    // it (e.g. an AI-upscaled image on a large canvas) previously failed to
    // detect entirely, because the boundary threshold required a column's
    // color changes to span at least half of the FULL image height/width —
    // a bar the sprite's own content can never clear once there's enough
    // padding, even though its grid is just as consistent within itself.
    const image = makePaddedSprite(16, 8, 8, 400, 400);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 16, blockHeight: 16 });
  });

  it('falls back to the detected axis for the other when only one axis has a detectable grid', () => {
    // Vertical stripes only: color varies along x but is constant down every
    // column, so height detection finds zero boundaries and would normally
    // give up entirely. Real pixel art overwhelmingly uses square blocks, so
    // reusing the successfully detected width for height is a much better
    // guess than discarding the whole detection and falling back to a blind
    // default grid size.
    const blockSize = 5;
    const width = blockSize * 4;
    const height = 17;
    const data = new Uint8ClampedArray(width * height * 4);
    const colorA: [number, number, number] = [255, 0, 0];
    const colorB: [number, number, number] = [0, 0, 255];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const blockX = Math.floor(x / blockSize);
        const color = blockX % 2 === 0 ? colorA : colorB;
        const idx = (y * width + x) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }
    expect(detectBlockSize({ width, height, data })).toEqual({ blockWidth: 5, blockHeight: 5 });
  });
});
