import { ImageBuffer } from '../pixelart/blockDetect';

export function loadImageBuffer(file: File): Promise<ImageBuffer> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('loadImageBuffer: could not get 2D canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ width: imageData.width, height: imageData.height, data: imageData.data });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('loadImageBuffer: failed to load image file'));
    };

    img.src = url;
  });
}
