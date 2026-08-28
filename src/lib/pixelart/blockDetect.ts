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

// The most common individual gap is only the true grid unit when adjacent
// cells usually differ in color, as in an adversarial checkerboard. Real
// pixel art is dominated by solid multi-cell regions (hair, skin, a shirt),
// so most true-pixel-to-true-pixel boundaries produce no detectable color
// change at all - the gaps that DO get detected are typically several grid
// units wide (wherever the art's actual features happen to change color),
// and their most common individual value can easily be some multiple of the
// true unit rather than the unit itself. What every gap does still share is
// being an (approximate) integer multiple of that unit, so the largest value
// that evenly explains every observed gap - allowing a little slack for
// antialiasing/blur shifting a boundary by a pixel or two - recovers it
// correctly even when the unit itself never appears as a raw gap.
function estimateGridUnit(gaps: number[]): number | null {
  if (gaps.length === 0) return null;
  const minGap = Math.min(...gaps);
  for (let unit = minGap; unit >= 1; unit--) {
    const tolerance = Math.min(4, Math.max(1, Math.round(unit * 0.12)));
    const fitsAll = gaps.every((gap) => {
      const nearestMultiple = Math.round(gap / unit) * unit;
      return Math.abs(gap - nearestMultiple) <= tolerance;
    });
    if (fitsAll) return unit;
  }
  return null;
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
//
// A genuine drawn/hand-photographed grid line is always just a few pixels
// wide in absolute terms (every real example is 1-2px) - MAX_LINE_WIDTH caps
// the merge distance to that scale. Without this cap, realistic art (large
// solid-color regions rather than an alternating checkerboard) can produce
// its own bimodal gap split where the SMALL, frequent value is the true grid
// unit itself, not line-width noise - e.g. a 16px repeating unit next to a
// handful of much larger gaps where a solid region spans multiple cells.
// That's structurally identical to the drawn-line case (small+frequent vs
// large+rare) but means the opposite thing, and merging it away corrupts a
// real, meaningful spacing instead of collapsing an artifact.
const MAX_LINE_WIDTH = 4;

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
  return bestRatio >= 3 && bestSplitValue <= MAX_LINE_WIDTH ? bestSplitValue : 0;
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

// The first and last gap in a boundary list span from the canvas-edge
// sentinel (0 / image width) to the nearest REAL detected boundary. For
// full-bleed content that's a genuine block-width measurement, but for a
// sprite with background padding around it, it's just "however much margin
// there is" - unrelated to the repeating grid pitch. A large one-off padding
// gap can get misread as significant, so both the merge-distance decision
// and the final size estimate exclude them - falling back to the full gap
// list only when there aren't enough interior gaps to work with (e.g. a
// grid with just 2 blocks, where the only gap IS an edge gap).
function excludeEdgeGaps(gaps: number[]): number[] {
  return gaps.length > 2 ? gaps.slice(1, -1) : gaps;
}

function resolveBlockSize(boundaries: number[]): number | null {
  // If no interior boundaries were found (only start and end), give up.
  if (boundaries.length <= 2) return null;
  const mergeDistance = findMergeDistance(excludeEdgeGaps(gapsFromPositions(boundaries)));
  const positions = mergeDistance > 0 ? clusterBoundaries(boundaries, mergeDistance) : boundaries;
  const finalGaps = gapsFromPositions(positions);
  const estimateInput = excludeEdgeGaps(finalGaps);
  return estimateGridUnit(estimateInput.length > 0 ? estimateInput : finalGaps);
}

function maxOf(values: number[]): number {
  let max = 0;
  for (const v of values) if (v > max) max = v;
  return max;
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
  // Threshold relative to the strongest column's vote count, not the image's
  // full height: a sprite with background padding/margin around it (very
  // common for exported or AI-generated art) never has any column's changes
  // span half of the WHOLE canvas, even though they're just as consistent
  // across the sprite's own rows. A genuinely flat image (no edges anywhere)
  // has a max of 0, which would make every column pass an ">= 0" threshold,
  // so that case is guarded separately.
  const maxChangeCount = maxOf(changeCounts);
  if (maxChangeCount === 0) return null;
  const threshold = maxChangeCount * 0.5;
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
  const maxChangeCount = maxOf(changeCounts);
  if (maxChangeCount === 0) return null;
  const threshold = maxChangeCount * 0.5;
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
