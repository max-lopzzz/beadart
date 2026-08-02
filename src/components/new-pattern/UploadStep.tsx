import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { loadImageBuffer } from '../../lib/image/loadImage';

interface UploadStepProps {
  onImageLoaded: (image: ImageBuffer) => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
}

export function UploadStep({ onImageLoaded, loadImage = loadImageBuffer }: UploadStepProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const image = await loadImage(file);
      onImageLoaded(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    }
  };

  return (
    <div>
      <h2>Upload a digital pixel art image</h2>
      <label htmlFor="upload-image-input">Upload image</label>
      <input
        id="upload-image-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
