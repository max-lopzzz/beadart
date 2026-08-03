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
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 0 },
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
        expect(grid[row][col]).toEqual({ r: 100, g: 150, b: 200 });
      }
    }
  });
});

describe('downsampleToGridByCount', () => {
  it('averages each cell to a single color, matching downsampleToGrid for an evenly-divisible case', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const grid = downsampleToGridByCount(image, 2, 2);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 0 },
      ],
    ]);
  });

  it('produces exactly the requested cols x rows with no dropped or duplicated pixels for a non-evenly-divisible count', () => {
    // A uniform-color source can't distinguish correct partitioning from
    // broken partitioning (overlapping/skipped/duplicated pixels all still
    // average to the same solid color), so this uses a 9x9 image built from
    // a 3x3 grid of distinct-colored 3x3 blocks, downsampled to a 2x2 grid.
    // 2 doesn't divide 9 evenly, so the cell boundaries (widths 4 and 5) cut
    // across block boundaries: cell (0,0) spans x/y [0,4), which is 3 columns
    // of block-col 0 plus 1 column of block-col 1 (and likewise for rows), so
    // its expected average is a known weighted mix of 4 distinct blocks
    // rather than a single block's color. A boundary-off-by-one bug (e.g.
    // dropping or duplicating a row/column of source pixels at a cell edge)
    // would shift these weights and change the computed average, so this
    // test can actually fail on a partitioning regression.
    const image = makeDistinctBlockGrid(3, 3);
    const grid = downsampleToGridByCount(image, 2, 2);

    expect(grid.length).toBe(2);
    expect(grid[0].length).toBe(2);
    expect(grid[1].length).toBe(2);

    // Expected r averages, hand-computed from the block layout above:
    // cell(0,0) = (9*0 + 3*10 + 3*30 + 1*40) / 16 = 10
    // cell(0,1) = (6*10 + 9*20 + 2*40 + 3*50) / 20 = 23.5 -> rounds to 24
    // cell(1,0) = (6*30 + 2*40 + 9*60 + 3*70) / 20 = 50.5 -> rounds to 51
    // cell(1,1) = (4*40 + 6*50 + 6*70 + 9*80) / 25 = 64
    expect(grid).toEqual([
      [
        { r: 10, g: 0, b: 0 },
        { r: 24, g: 0, b: 0 },
      ],
      [
        { r: 51, g: 0, b: 0 },
        { r: 64, g: 0, b: 0 },
      ],
    ]);
  });

  it('does not produce NaN cells when the requested grid is larger than the source image', () => {
    // 2x2 image with a 3x3 requested grid: some columns/rows have startX === endX
    // (or startY === endY) under the naive Math.floor boundaries, which previously
    // caused count to stay 0 and sumR/count etc. to evaluate to NaN.
    const image = makeSolidColor(2, 2, [50, 60, 70]);
    const grid = downsampleToGridByCount(image, 3, 3);

    expect(grid.length).toBe(3);
    for (const row of grid) {
      expect(row.length).toBe(3);
      for (const cell of row) {
        expect(cell).toEqual({ r: 50, g: 60, b: 70 });
      }
    }
  });
});
