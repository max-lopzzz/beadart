import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { listPatterns } from '../../lib/storage/patternsRepo';
import { NewPatternWizard } from './NewPatternWizard';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makeSplitImage(): ImageBuffer {
  // Left half solid white (background), right half solid red (foreground).
  const width = 12;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBackground = x < width / 2;
      const idx = (y * width + x) * 4;
      data[idx] = isBackground ? 255 : 255;
      data[idx + 1] = isBackground ? 255 : 0;
      data[idx + 2] = isBackground ? 255 : 0;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

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
  it('walks upload -> grid -> palette -> name -> save, persisting the pattern', async () => {
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

  it('has no Back button on the first step, and restores prior edits when navigating back', async () => {
    const image = makeCheckerboardImage();
    const loadImage = vi.fn().mockResolvedValue(image);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');

    render(
      <NewPatternWizard
        onDone={vi.fn()}
        onCancel={vi.fn()}
        loadImage={loadImage}
        renderThumbnail={renderThumbnail}
      />,
    );

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    const widthInput = screen.getByLabelText(/how many pixels wide/i);
    await userEvent.clear(widthInput);
    await userEvent.type(widthInput, '3');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByRole('button', { name: /save pattern/i }));
    const originalCell = document.querySelector('.assign-cell') as HTMLElement;
    const originalColor = originalCell.getAttribute('aria-label');
    await userEvent.click(originalCell);
    const swatches = screen
      .getAllByRole('button', { name: /^swatch / })
      .filter((s) => s.getAttribute('aria-label') !== 'swatch Empty');
    const overrideSwatch = swatches.find((s) => !originalColor?.endsWith(s.getAttribute('aria-label')!.replace('swatch ', '')))!;
    const overrideName = overrideSwatch.getAttribute('aria-label')!.replace('swatch ', '');
    await userEvent.click(overrideSwatch);

    await waitFor(() =>
      expect(screen.getByLabelText(`cell 0-0, color ${overrideName}`)).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => expect(screen.getByLabelText(/how many pixels wide/i)).toHaveValue(3));

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(`cell 0-0, color ${overrideName}`)).toBeInTheDocument(),
    );
  });

  it('offers to continue with the already-uploaded image when navigating all the way back to Upload', async () => {
    const image = makeCheckerboardImage();
    const loadImage = vi.fn().mockResolvedValue(image);

    render(
      <NewPatternWizard
        onDone={vi.fn()}
        onCancel={vi.fn()}
        loadImage={loadImage}
        renderThumbnail={vi.fn().mockReturnValue('data:image/png;base64,thumb')}
      />,
    );

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => screen.getByLabelText(/upload image/i));
    const continueButton = screen.getByRole('button', { name: /continue with (this|the uploaded) image/i });

    await userEvent.click(continueButton);

    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('applies a Remove background toggle change on re-Continue, even when cols/rows are unchanged from before', async () => {
    // Real bug: the palette-edit-preservation logic only compared grid
    // SHAPE (rows/cols) between the old and re-confirmed grid, not its
    // actual content - so toggling background removal without changing the
    // dimensions was a silent no-op, since the stale cellColors (computed
    // before the toggle) were kept unchanged.
    const image = makeSplitImage();
    const loadImage = vi.fn().mockResolvedValue(image);

    render(
      <NewPatternWizard
        onDone={vi.fn()}
        onCancel={vi.fn()}
        loadImage={loadImage}
        renderThumbnail={vi.fn().mockReturnValue('data:image/png;base64,thumb')}
      />,
    );

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    // Only the width field is touched - "Linked" is on by default, so this
    // also sets height to 1 (round(2 * 4/12)) via the aspect-ratio
    // calculation; separately touching the height field afterward would
    // recalculate width right back from it and defeat the point.
    await userEvent.clear(screen.getByLabelText(/how many pixels wide/i));
    await userEvent.type(screen.getByLabelText(/how many pixels wide/i), '2');
    await waitFor(() => expect(screen.getByLabelText(/how many pixels tall/i)).toHaveValue(1));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Reach the Palette step once without background removal, so the wizard
    // caches cellColors built from the un-processed grid. Waiting on "Back"
    // alone is ambiguous - Grid's own Back button is still in the DOM right
    // up until this re-renders, and Palette briefly shows "Loading..." (no
    // Back button at all) while palettes load - so wait for Palette's own
    // heading instead.
    await waitFor(() => screen.getByRole('heading', { name: /review pattern colors/i }));

    // Edit a cell so the wizard actually caches cellColors - onConfirm/
    // onCellColorsChange are what populate it, not merely visiting the step.
    await userEvent.click(document.querySelector('.assign-cell') as HTMLElement);
    const anyRealSwatch = screen
      .getAllByRole('button', { name: /^swatch / })
      .find((s) => s.getAttribute('aria-label') !== 'swatch Empty')!;
    await userEvent.click(anyRealSwatch);

    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => expect(screen.getByLabelText(/how many pixels wide/i)).toHaveValue(2));
    await userEvent.click(screen.getByLabelText(/remove background/i));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, empty (no bead)')).toBeInTheDocument(),
    );
  });
});
