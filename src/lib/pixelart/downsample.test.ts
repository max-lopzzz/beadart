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
  it('samples the center pixel of each cell, ignoring gridline-colored borders around each source block', () => {
    // Real pixel-art source images are often exported with a 1px gridline
    // border drawn around each logical pixel block. Averaging the whole
    // cell (as downsampleToGrid does) blends that border color into the
    // result; sampling only the center pixel stays inside the fill color
    // and never touches the border, regardless of the border's color.
    const image = makeCheckerboardWithGridlines(5, 2, [0, 0, 0]);
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

  it('samples the center pixel of each cell to a single color, matching downsampleToGrid for an evenly-divisible, border-free case', () => {
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

  it('produces exactly the requested cols x rows and picks the correct center pixel for a non-evenly-divisible count', () => {
    // 9x9 image built from a 3x3 grid of distinct-colored 3x3 blocks,
    // downsampled to a 2x2 grid. 2 doesn't divide 9 evenly, so the cell
    // boundaries (widths 4 and 5) cut across block boundaries: cell (0,0)
    // spans x/y [0,4) with center pixel at index 2, still inside block-col/
    // row 0; cell (1,1) spans x/y [4,9) with center pixel at index 6, inside
    // block-col/row 2. A boundary-off-by-one bug in the start/end/center
    // computation would land on a different block and change the sampled
    // color, so this test can still fail on a partitioning regression even
    // though it no longer averages.
    const image = makeDistinctBlockGrid(3, 3);
    const grid = downsampleToGridByCount(image, 2, 2);

    expect(grid.length).toBe(2);
    expect(grid[0].length).toBe(2);
    expect(grid[1].length).toBe(2);

    // Expected r values: center pixel (x=2,y=2) falls in block (row 0, col
    // 0) -> r=0; center (x=6,y=2) falls in block (row 0, col 2) -> r=20;
    // center (x=2,y=6) falls in block (row 2, col 0) -> r=60; center (x=6,
    // y=6) falls in block (row 2, col 2) -> r=80.
    expect(grid).toEqual([
      [
        { r: 0, g: 0, b: 0 },
        { r: 20, g: 0, b: 0 },
      ],
      [
        { r: 60, g: 0, b: 0 },
        { r: 80, g: 0, b: 0 },
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
        expect(cell).toEqual({ r: 50, g: 60, b: 70 });
      }
    }
  });
});
