import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { listPatterns } from '../../lib/storage/patternsRepo';
import { NewPatternWizard } from './NewPatternWizard';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { Quad } from '../../lib/photo/quad';
import { RGB } from '../../lib/color/lab';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makeCheckerboardImage(): ImageBuffer {
  const width = 6;
  const height = 6;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / 3);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / 3);
      const isRed = (blockX + blockY) % 2 === 0;
      const idx = (y * width + x) * 4;
      data[idx] = isRed ? 255 : 0;
      data[idx + 1] = 0;
      data[idx + 2] = isRed ? 0 : 255;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('NewPatternWizard', () => {
  it('walks source-type -> digital -> upload -> grid -> palette -> name -> save, persisting the pattern', async () => {
    const image = makeCheckerboardImage();
    const loadImage = vi.fn().mockResolvedValue(image);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const onDone = vi.fn();

    render(
      <NewPatternWizard
        onDone={onDone}
        onCancel={vi.fn()}
        loadImage={loadImage}
        renderThumbnail={renderThumbnail}
        now={() => '2026-08-02T00:00:00.000Z'}
        createId={() => 'pattern-1'}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /digital pixel art image/i }));

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByRole('button', { name: /save pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => screen.getByLabelText(/pattern name/i));
    await userEvent.type(screen.getByLabelText(/pattern name/i), 'My Pattern');
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pattern-1'));

    const saved = await listPatterns();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: 'pattern-1',
      name: 'My Pattern',
      rows: 2,
      cols: 2,
      thumbnail: 'data:image/png;base64,thumb',
    });
  });

  it('walks source-type -> photo -> upload -> corners -> palette -> name -> save, persisting the pattern', async () => {
    const image: ImageBuffer = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4) };
    const loadImage = vi.fn().mockResolvedValue(image);
    const sampleQuad: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 200, y: 0 },
      bottomRight: { x: 200, y: 200 },
      bottomLeft: { x: 0, y: 200 },
    };
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    const resultGrid: RGB[][] = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 255, b: 0 },
        { r: 255, g: 255, b: 0 },
      ],
    ];
    const sampleGrid = vi.fn().mockResolvedValue(resultGrid);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const onDone = vi.fn();

    render(
      <NewPatternWizard
        onDone={onDone}
        onCancel={vi.fn()}
        loadImage={loadImage}
        detectCorners={detectCorners}
        sampleGrid={sampleGrid}
        renderThumbnail={renderThumbnail}
        now={() => '2026-08-02T00:00:00.000Z'}
        createId={() => 'pattern-1'}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /photo of a drawing/i }));

    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByLabelText('topLeft handle'));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByRole('button', { name: /save pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => screen.getByLabelText(/pattern name/i));
    await userEvent.type(screen.getByLabelText(/pattern name/i), 'Photo Pattern');
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pattern-1'));

    expect(sampleGrid).toHaveBeenCalledWith(image, sampleQuad, 10, 10);
    const saved = await listPatterns();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Photo Pattern');
  });
});
