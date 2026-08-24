import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { loadImageBuffer } from '../../lib/image/loadImage';

interface UploadStepProps {
  onImageLoaded: (image: ImageBuffer) => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
}

export function UploadStep({ onImageLoaded, loadImage = loadImageBuffer }: UploadStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const image = await loadImage(file);
      onImageLoaded(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="container-narrow" style={{ padding: 0 }}>
      <h2>Upload a digital pixel art image</h2>
      <p className="hint">PNG or JPEG. We'll help you confirm the grid size next.</p>
      <div
        className="upload-dropzone"
        data-testid="upload-dropzone"
        data-drag-over={isDragOver ? 'true' : 'false'}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-dropzone-label">
          <span style={{ fontSize: 32 }} aria-hidden="true">
            🖼
          </span>
          <strong>Drop an image here or click to browse</strong>
        </div>
        <label htmlFor="upload-image-input" className="visually-hidden">
          Upload image
        </label>
        <input id="upload-image-input" type="file" accept="image/*" onChange={handleFileChange} />
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
