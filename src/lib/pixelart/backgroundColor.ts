import { ImageBuffer } from './blockDetect';
import { RGB, rgbToLab, deltaE76 } from '../color/lab';

// Group near-duplicate border colors together before counting, so JPEG
// compression noise or anti-aliasing along the very edge doesn't split one
// real background color into dozens of near-identical singleton buckets
// that each lose to a more solid-color foreground region.
const QUANTIZE_STEP = 8;

function quantize(value: number): number {
  return Math.round(value / QUANTIZE_STEP);
}

// A background almost always touches the image's outer border, whether or
// not it's also the single most common color overall - a foreground region
// (hair, a shirt) can easily cover more total pixels than a thin border.
// Sampling only the border pixels and taking the most common color there is
// robust to that, and cheap (border pixels only, not the whole image).
export function detectBackgroundColor(image: ImageBuffer): RGB {
  const buckets = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();

  const addPixel = (x: number, y: number) => {
    const idx = (y * image.width + x) * 4;
    const r = image.data[idx];
    const g = image.data[idx + 1];
    const b = image.data[idx + 2];
    const key = `${quantize(r)},${quantize(g)},${quantize(b)}`;
    const bucket = buckets.get(key) ?? { count: 0, sumR: 0, sumG: 0, sumB: 0 };
    bucket.count++;
    bucket.sumR += r;
    bucket.sumG += g;
    bucket.sumB += b;
    buckets.set(key, bucket);
  };

  for (let x = 0; x < image.width; x++) {
    addPixel(x, 0);
    if (image.height > 1) addPixel(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y++) {
    addPixel(0, y);
    if (image.width > 1) addPixel(image.width - 1, y);
  }

  let best: { count: number; sumR: number; sumG: number; sumB: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  // Unreachable for any image with at least one border pixel (width/height
  // >= 1), which detectBlockSize's caller already guarantees - kept for
  // type safety only.
  /* istanbul ignore next */
  if (!best) return { r: 255, g: 255, b: 255 };

  return {
    r: Math.round(best.sumR / best.count),
    g: Math.round(best.sumG / best.count),
    b: Math.round(best.sumB / best.count),
  };
}

// Perceptibly-different colors sit well above this on the deltaE76 scale
// (roughly: <2 is imperceptible, ~10 is "different at a glance"). This is
// deliberately a bit more forgiving than a plain palette-match, since a
// background region typically has more per-pixel noise (anti-aliased edges,
// export compression) than a flat design color does.
const BACKGROUND_MATCH_TOLERANCE = 15;

export function isBackgroundColor(
  color: RGB,
  background: RGB,
  tolerance = BACKGROUND_MATCH_TOLERANCE,
): boolean {
  return deltaE76(rgbToLab(color), rgbToLab(background)) <= tolerance;
}
