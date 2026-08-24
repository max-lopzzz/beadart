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

function gapsFromPositions(positions: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const gap = Math.round(positions[i] - positions[i - 1]);
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

// A drawn grid overlay produces a cluster of color-change boundaries at each
// block edge (entering the line, then leaving it back into the fill), not a
// single clean boundary - so the raw gaps split into a "small" group (steps
// within one edge's line-width smear) and a "large" group (the real spacing
// between edges). This finds the boundary value where that split happens:
// values at or below it belong inside one edge and should be merged;
// anything above is a distinct edge. A plain image with no grid overlay has
// only one gap value (no split to find); noise produces rare, low-share
// outliers that don't clear the "both sides meaningful" bar below. In
// either case this returns 0, meaning no merge is needed.
function findMergeDistance(gaps: number[]): number {
  const counts = new Map<number, number>();
  for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
  const distinct = [...counts.keys()].sort((a, b) => a - b);
  if (distinct.length < 2) return 0;

  let bestRatio = 1;
  let bestSplitValue = 0;
  let cumulative = 0;
  for (let i = 0; i < distinct.length - 1; i++) {
    cumulative += counts.get(distinct[i])!;
    const fraction = cumulative / gaps.length;
    // Both sides of the split need a meaningful share of all gaps - a
    // single rare noise-induced small gap shouldn't count as a real group.
    if (fraction < 0.15 || fraction > 0.85) continue;
    const ratio = distinct[i + 1] / distinct[i];
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestSplitValue = distinct[i];
    }
  }
  // Require a decisive jump (3x), not a gradual size variation that could
  // just be normal noise on a single true edge spacing.
  return bestRatio >= 3 ? bestSplitValue : 0;
}

function clusterBoundaries(boundaries: number[], mergeDistance: number): number[] {
  const clusters: number[][] = [[boundaries[0]]];
  for (let i = 1; i < boundaries.length; i++) {
    const current = clusters[clusters.length - 1];
    if (boundaries[i] - current[current.length - 1] <= mergeDistance) {
      current.push(boundaries[i]);
    } else {
      clusters.push([boundaries[i]]);
    }
  }
  return clusters.map((cluster) => cluster.reduce((sum, v) => sum + v, 0) / cluster.length);
}

function resolveBlockSize(boundaries: number[]): number | null {
  // If no interior boundaries were found (only start and end), give up.
  if (boundaries.length <= 2) return null;
  const mergeDistance = findMergeDistance(gapsFromPositions(boundaries));
  const positions = mergeDistance > 0 ? clusterBoundaries(boundaries, mergeDistance) : boundaries;
  return mode(gapsFromPositions(positions));
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
  return resolveBlockSize(boundaries);
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
  return resolveBlockSize(boundaries);
}

export function detectBlockSize(image: ImageBuffer): BlockSize | null {
  const blockWidth = detectBlockWidth(image);
  const blockHeight = detectBlockHeight(image);
  if (blockWidth === null && blockHeight === null) return null;
  // Pixel art blocks are square in the overwhelming majority of real images.
  // If only one axis produced a boundary pattern (e.g. a background gradient
  // masks the other axis's edges), reuse that axis's block size for the
  // missing one instead of discarding a perfectly good partial detection.
  return {
    blockWidth: blockWidth ?? blockHeight!,
    blockHeight: blockHeight ?? blockWidth!,
  };
}
