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

// Real source images (JPEG screenshots/photos of a pattern, or a browser
// color-managing a wide-gamut profile) carry a few units of per-pixel noise
// even within a single flat design color. Requiring exact equality treats
// that noise as a boundary everywhere, so the detected "block size" degenerates
// to 1px. A small tolerance absorbs compression noise while still treating a
// genuine jump between two distinct design colors (usually 50+ per channel)
// as a real boundary.
const NOISE_TOLERANCE = 24;

function pixelsSimilar(a: [number, number, number], b: [number, number, number]): boolean {
  return (
    Math.abs(a[0] - b[0]) <= NOISE_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= NOISE_TOLERANCE &&
    Math.abs(a[2] - b[2]) <= NOISE_TOLERANCE
  );
}

// A drawn grid overlay produces two color-change boundaries per block
// (entering the line, then leaving it back into the fill), so the line
// width and the fill width each show up as their own gap value with
// close to the same count - not necessarily exactly equal, since real
// source images (JPEG noise, uneven crop margins) rarely repeat a pattern
// with zero variation across the whole image. If the second-most-common
// gap comes within this fraction of the top one, treat it as this
// two-boundary-per-block pattern and sum the pair for the true block
// pitch; neither value alone is the block's pixel size.
const TIED_GAP_RATIO = 0.7;

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Ties broken by the larger value: relevant only as a base-case tiebreak
  // below, since two genuinely different single-boundary-per-block gaps
  // tying by chance is not the common case this is guarding against.
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const [topValue, topCount] = sorted[0];
  if (sorted.length >= 2) {
    const [secondValue, secondCount] = sorted[1];
    if (secondCount >= topCount * TIED_GAP_RATIO) {
      return topValue + secondValue;
    }
  }
  return topValue;
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
      if (!pixelsSimilar(getPixel(image, x, y), getPixel(image, x - 1, y))) {
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
      if (!pixelsSimilar(getPixel(image, x, y), getPixel(image, x, y - 1))) {
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
