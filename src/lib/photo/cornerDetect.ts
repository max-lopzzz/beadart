import { ImageBuffer } from '../pixelart/blockDetect';
import { Point, Quad } from './quad';
import { loadOpenCv } from './opencv';

function orderQuadPoints(points: Point[]): Quad {
  const byY = [...points].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = byY.slice(2, 4).sort((a, b) => a.x - b.x);
  return {
    topLeft: top[0],
    topRight: top[1],
    bottomLeft: bottom[0],
    bottomRight: bottom[1],
  };
}

export async function detectCorners(image: ImageBuffer): Promise<Quad | null> {
  const cv = await loadOpenCv();

  const src = cv.matFromImageData({
    width: image.width,
    height: image.height,
    data: image.data,
  });
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.Canny(blurred, edges, 50, 150);
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  let bestQuad: Quad | null = null;
  let bestArea = 0;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const perimeter = cv.arcLength(contour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > bestArea) {
        bestArea = area;
        const points: Point[] = [];
        for (let p = 0; p < 4; p++) {
          points.push({ x: approx.data32S[p * 2], y: approx.data32S[p * 2 + 1] });
        }
        bestQuad = orderQuadPoints(points);
      }
    }

    approx.delete();
    contour.delete();
  }

  src.delete();
  gray.delete();
  blurred.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();

  // Require the detected quad to cover a reasonable fraction of the photo —
  // a tiny 4-sided contour (a stray mark, a corner of a shadow) is not a
  // credible detection of "the grid drawing" and should fall back to manual
  // placement instead of confidently returning garbage.
  const minArea = image.width * image.height * 0.1;
  if (!bestQuad || bestArea < minArea) {
    return null;
  }

  return bestQuad;
}
