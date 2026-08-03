import { ImageBuffer } from '../pixelart/blockDetect';
import { Quad } from './quad';
import { loadOpenCv } from './opencv';

export async function warpPerspective(
  image: ImageBuffer,
  corners: Quad,
  outputWidth: number,
  outputHeight: number,
): Promise<ImageBuffer> {
  const cv = await loadOpenCv();

  const src = cv.matFromImageData({
    width: image.width,
    height: image.height,
    data: image.data,
  });

  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    corners.topLeft.x,
    corners.topLeft.y,
    corners.topRight.x,
    corners.topRight.y,
    corners.bottomRight.x,
    corners.bottomRight.y,
    corners.bottomLeft.x,
    corners.bottomLeft.y,
  ]);
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    outputWidth,
    0,
    outputWidth,
    outputHeight,
    0,
    outputHeight,
  ]);

  const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, transform, new cv.Size(outputWidth, outputHeight));

  // Copy the pixel data out into a plain, detached buffer before deleting
  // `dst` — its underlying memory is freed by `.delete()`, and `dst.data`
  // is only a view into that memory until then.
  const result: ImageBuffer = {
    width: outputWidth,
    height: outputHeight,
    data: new Uint8ClampedArray(dst.data),
  };

  src.delete();
  srcPoints.delete();
  dstPoints.delete();
  transform.delete();
  dst.delete();

  return result;
}
