import { describe, it, expect } from 'vitest';
import { downsampleToGrid, downsampleToGridByCount } from './downsample';
import { ImageBuffer } from './blockDetect';

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

function makeDistinctBlockGrid(
  blockSize: number,
  blocksPerSide: number,
): ImageBuffer {
  const width = blockSize * blocksPerSide;
  const height = blockSize * blocksPerSide;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const blockRow = Math.floor(y / blockSize);
    for (let x = 0; x < width; x++) {
      const blockCol = Math.floor(x / blockSize);
      // Distinct, easy-to-hand-compute color per block: r = block index * 10.
      const r = (blockRow * blocksPerSide + blockCol) * 10;
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

function makeCheckerboardWithGridlines(
  blockSize: number,
  blocksPerSide: number,
  borderColor: [number, number, number],
): ImageBuffer {
  const width = blockSize * blocksPerSide;
  const height = width;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockSize);
    const ly = y % blockSize;
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockSize);
      const lx = x % blockSize;
      const isBorder = lx === 0 || lx === blockSize - 1 || ly === 0 || ly === blockSize - 1;
      const color = isBorder ? borderColor : (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

function makeSolidColorWithOutlier(
  width: number,
  height: number,
  color: [number, number, number],
  outlier: { x: number; y: number; color: [number, number, number] },
): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = x === outlier.x && y === outlier.y ? outlier.color : color;
      const idx = (y * width + x) * 4;
      data[idx] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

function makeSolidColor(
  width: number,
  height: number,
  color: [number, number, number],
): ImageBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('downsampleToGrid', () => {
  it('averages each block to a single color', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const grid = downsampleToGrid(image, 3, 3);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 255, a: 255 },
      ],
      [
        { r: 0, g: 0, b: 255, a: 255 },
        { r: 255, g: 0, b: 0, a: 255 },
      ],
    ]);
  });

  it('handles non-evenly-divisible image dimensions', () => {
    // 7x7 image with 3x3 blocks: should produce 3x3 grid (ceil(7/3)=3), not 2x2 (round(7/3)=2)
    const image = makeSolidColor(7, 7, [100, 150, 200]);
    const grid = downsampleToGrid(image, 3, 3);

    // Verify grid dimensions
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(3);
    expect(grid[1].length).toBe(3);
    expect(grid[2].length).toBe(3);

    // Verify all cells have the correct color (solid image averages to itself)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(grid[row][col]).toEqual({ r: 100, g: 150, b: 200, a: 255 });
      }
    }
  });

  it('averages alpha the same way as color channels', () => {
    // A block that's half fully-opaque, half fully-transparent should
    // average to a mid alpha - the same block-average treatment as r/g/b.
    const width = 4;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 100;
        data[idx + 1] = 100;
        data[idx + 2] = 100;
        data[idx + 3] = x < width / 2 ? 255 : 0;
      }
    }
    const grid = downsampleToGrid({ width, height, data }, 4, 2);
    expect(grid[0][0].a).toBe(128);
  });
});

describe('downsampleToGridByCount', () => {
  it('is not thrown off by a single noisy outlier pixel landing exactly on the sampled center', () => {
    // Real photographed/screenshotted source images (e.g. a JPEG export of a
    // bead pattern) have per-pixel compression noise, and browsers may
    // additionally color-manage the image (e.g. a Display P3 -> sRGB
    // conversion), which can push an isolated pixel's color enough to match
    // a different palette entry than its neighbors. Sampling a single fixed
    // pixel per cell means that if the noisy pixel happens to land exactly
    // on the sampled point, the whole cell gets the outlier's color instead
    // of the cell's true, overwhelmingly dominant color.
    const image = makeSolidColorWithOutlier(9, 9, [200, 100, 50], {
      x: 4,
      y: 4,
      color: [0, 0, 0],
    });
    const grid = downsampleToGridByCount(image, 3, 3);
    // Cell (1,1) spans x/y [3,6) - its geometric center is exactly (4,4),
    // the outlier pixel. The other 8 pixels in that cell are the true color.
    expect(grid[1][1]).toEqual({ r: 200, g: 100, b: 50, a: 255 });
  });

  it('samples an interior patch of each cell, ignoring gridline-colored borders around each source block', () => {
    // Real pixel-art source images are often exported with a 1px gridline
    // border drawn around each logical pixel block. Averaging the whole
    // cell (as downsampleToGrid does) blends that border color into the
    // result; sampling only the cell's interior (excluding its outer
    // quarter-margin on each side) stays inside the fill color and never
    // touches the border, regardless of the border's color.
    const image = makeCheckerboardWithGridlines(5, 2, [0, 0, 0]);
    const grid = downsampleToGridByCount(image, 2, 2);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 255, a: 255 },
      ],
      [
        { r: 0, g: 0, b: 255, a: 255 },
        { r: 255, g: 0, b: 0, a: 255 },
      ],
    ]);
  });

  it('samples each cell to a single color, matching downsampleToGrid for an evenly-divisible, border-free, noise-free case', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const grid = downsampleToGridByCount(image, 2, 2);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0, a: 255 },
        { r: 0, g: 0, b: 255, a: 255 },
      ],
      [
        { r: 0, g: 0, b: 255, a: 255 },
        { r: 255, g: 0, b: 0, a: 255 },
      ],
    ]);
  });

  it('produces exactly the requested cols x rows and picks the correct interior patch for a non-evenly-divisible count', () => {
    // 9x9 image built from a 3x3 grid of distinct-colored 3x3 blocks,
    // downsampled to a 2x2 grid. 2 doesn't divide 9 evenly, so the cell
    // boundaries (widths 4 and 5) cut across block boundaries. A
    // boundary-off-by-one bug in the start/end/patch computation would shift
    // which blocks the patch covers and change the sampled color, so this
    // test can still fail on a partitioning regression.
    const image = makeDistinctBlockGrid(3, 3);
    const grid = downsampleToGridByCount(image, 2, 2);

    expect(grid.length).toBe(2);
    expect(grid[0].length).toBe(2);
    expect(grid[1].length).toBe(2);

    // Expected r values, hand-computed from the block layout above and the
    // interior-patch (middle 50%, i.e. 1px margin trimmed from a 4-wide cell
    // and a 5-wide cell) + per-channel-median sampling:
    // cell(0,0): patch x,y in [1,3) -> entirely block (row 0, col 0) -> r=0
    // cell(0,1): patch x in [5,8), y in [1,3) -> r values [10,20,20,10,20,20]
    //   (block col 1 at x=5, block col 2 at x=6,7) -> median = 20
    // cell(1,0): patch x in [1,3), y in [5,8) -> r values [30,30,60,60,60,60]
    //   (block row 1 at y=5, block row 2 at y=6,7) -> median = 60
    // cell(1,1): patch x,y in [5,8) -> r values [40,50,50,70,80,80,70,80,80]
    //   sorted [40,50,50,70,70,80,80,80,80] -> median (5th of 9) = 70
    expect(grid).toEqual([
      [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 20, g: 0, b: 0, a: 255 },
      ],
      [
        { r: 60, g: 0, b: 0, a: 255 },
        { r: 70, g: 0, b: 0, a: 255 },
      ],
    ]);
  });

  it('does not read out of bounds when the requested grid is larger than the source image', () => {
    // 2x2 image with a 3x3 requested grid: some columns/rows have startX === endX
    // (or startY === endY) under the naive Math.floor boundaries, which would give
    // a zero-width cell with no valid center pixel to sample. Oversampled cells
    // should fall back to duplicating the nearest source pixel instead.
    const image = makeSolidColor(2, 2, [50, 60, 70]);
    const grid = downsampleToGridByCount(image, 3, 3);

    expect(grid.length).toBe(3);
    for (const row of grid) {
      expect(row.length).toBe(3);
      for (const cell of row) {
        expect(cell).toEqual({ r: 50, g: 60, b: 70, a: 255 });
      }
    }
  });

  it('samples alpha via the same interior-patch median as the color channels', () => {
    // A fully transparent block next to fully opaque blocks: the cell over
    // the transparent block should sample alpha near 0, not blend with its
    // opaque neighbors.
    const width = 6;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 200;
        data[idx + 1] = 100;
        data[idx + 2] = 50;
        data[idx + 3] = x < 3 ? 0 : 255;
      }
    }
    const grid = downsampleToGridByCount({ width, height, data }, 2, 1);
    expect(grid[0][0].a).toBe(0);
    expect(grid[0][1].a).toBe(255);
  });
});
