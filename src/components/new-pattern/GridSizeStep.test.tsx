import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridSizeStep } from './GridSizeStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

function makeCheckerboard(blockWidth: number, blockHeight: number, blocksX: number, blocksY: number): ImageBuffer {
  const width = blockWidth * blocksX;
  const height = blockHeight * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockWidth);
      const color = (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('GridSizeStep', () => {
  it('pre-fills the detected block size and shows the resulting grid dimensions', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    expect(screen.getByLabelText(/block width/i)).toHaveValue(3);
    expect(screen.getByLabelText(/block height/i)).toHaveValue(3);
    expect(screen.getByText(/2 × 2 pattern/i)).toBeInTheDocument();
  });

  it('shows a manual-entry warning when no grid can be detected', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4).fill(100);
    render(<GridSizeStep image={{ width, height, data }} onGridReady={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not auto-detect/i);
  });

  it('recomputes the grid dimensions when the block size is changed', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    const widthInput = screen.getByLabelText(/block width/i);
    await userEvent.clear(widthInput);
    await userEvent.type(widthInput, '2');

    expect(screen.getByText(/3 × 2 pattern/i)).toBeInTheDocument();
  });

  it('calls onGridReady with the downsampled grid when Continue is clicked', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const onGridReady = vi.fn();
    render(<GridSizeStep image={image} onGridReady={onGridReady} />);

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onGridReady).toHaveBeenCalledTimes(1);
    const grid = onGridReady.mock.calls[0][0];
    expect(grid).toEqual([
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }],
      [{ r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 0 }],
    ]);
  });
});
