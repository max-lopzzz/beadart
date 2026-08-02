import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadStep } from './UploadStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

describe('UploadStep', () => {
  it('loads the selected file and calls onImageLoaded with the resulting image buffer', async () => {
    const fakeImage: ImageBuffer = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const loadImage = vi.fn().mockResolvedValue(fakeImage);
    const onImageLoaded = vi.fn();
    render(<UploadStep onImageLoaded={onImageLoaded} loadImage={loadImage} />);

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload image/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(onImageLoaded).toHaveBeenCalledWith(fakeImage));
    expect(loadImage).toHaveBeenCalledWith(file);
  });

  it('shows an error message when loading fails', async () => {
    const loadImage = vi.fn().mockRejectedValue(new Error('bad file'));
    render(<UploadStep onImageLoaded={vi.fn()} loadImage={loadImage} />);

    const file = new File(['fake'], 'not-an-image.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/upload image/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('bad file'));
  });
});
