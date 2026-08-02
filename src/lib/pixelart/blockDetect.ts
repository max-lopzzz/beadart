export interface ImageBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface BlockSize {
  blockWidth: number;
  blockHeight: number;
}

function getPixel(image: ImageBuffer, x: number, y: number): [number, number, number] {
  const idx = (y * image.width + x) * 4;
  return [image.data[idx], image.data[idx + 1], image.data[idx + 2]];
}

function pixelsEqual(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let bestValue = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }
  return bestValue;
}

function gapsFromBoundaries(boundaries: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const gap = boundaries[i] - boundaries[i - 1];
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

function detectBlockWidth(image: ImageBuffer): number | null {
  const changeCounts = new Array(image.width).fill(0);
  for (let y = 0; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      if (!pixelsEqual(getPixel(image, x, y), getPixel(image, x - 1, y))) {
        changeCounts[x]++;
      }
    }
  }
  const threshold = image.height * 0.5;
  const boundaries = [0];
  for (let x = 1; x < image.width; x++) {
    if (changeCounts[x] >= threshold) boundaries.push(x);
  }
  boundaries.push(image.width);
  // If no interior boundaries were found (only start and end), return null
  if (boundaries.length <= 2) return null;
  return mode(gapsFromBoundaries(boundaries));
}

function detectBlockHeight(image: ImageBuffer): number | null {
  const changeCounts = new Array(image.height).fill(0);
  for (let x = 0; x < image.width; x++) {
    for (let y = 1; y < image.height; y++) {
      if (!pixelsEqual(getPixel(image, x, y), getPixel(image, x, y - 1))) {
        changeCounts[y]++;
      }
    }
  }
  const threshold = image.width * 0.5;
  const boundaries = [0];
  for (let y = 1; y < image.height; y++) {
    if (changeCounts[y] >= threshold) boundaries.push(y);
  }
  boundaries.push(image.height);
  // If no interior boundaries were found (only start and end), return null
  if (boundaries.length <= 2) return null;
  return mode(gapsFromBoundaries(boundaries));
}

export function detectBlockSize(image: ImageBuffer): BlockSize | null {
  const blockWidth = detectBlockWidth(image);
  const blockHeight = detectBlockHeight(image);
  if (blockWidth === null || blockHeight === null) return null;
  return { blockWidth, blockHeight };
}
