import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CornerStep } from './CornerStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { Quad } from '../../lib/photo/quad';
import { RGB } from '../../lib/color/lab';

function makeImage(width: number, height: number): ImageBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

const sampleQuad: Quad = {
  topLeft: { x: 10, y: 10 },
  topRight: { x: 190, y: 10 },
  bottomRight: { x: 190, y: 190 },
  bottomLeft: { x: 10, y: 190 },
};

describe('CornerStep', () => {
  it('shows a detecting message before corner detection resolves', () => {
    const detectCorners = vi.fn().mockReturnValue(new Promise(() => {}));
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    expect(screen.getByText(/detecting grid/i)).toBeInTheDocument();
  });

  it('renders a draggable handle for each detected corner', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('topLeft handle')).toBeInTheDocument());
    expect(screen.getByLabelText('topRight handle')).toBeInTheDocument();
    expect(screen.getByLabelText('bottomRight handle')).toBeInTheDocument();
    expect(screen.getByLabelText('bottomLeft handle')).toBeInTheDocument();
  });

  it('falls back to the image bounding box when detection finds nothing', async () => {
    const detectCorners = vi.fn().mockResolvedValue(null);
    render(
      <CornerStep
        image={makeImage(200, 100)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('topLeft handle')).toBeInTheDocument());
    // Image is 200x100, narrower than the max display width, so scale is 1:1.
    expect(screen.getByLabelText('topLeft handle')).toHaveStyle({ left: '-8px', top: '-8px' });
    expect(screen.getByLabelText('bottomRight handle')).toHaveStyle({ left: '192px', top: '92px' });
  });

  it('dragging a handle updates its position', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('topLeft handle'));

    const handle = screen.getByLabelText('topLeft handle');
    const container = handle.parentElement!;
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.pointerDown(handle);
    fireEvent.pointerMove(container, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(container);

    expect(handle).toHaveStyle({ left: '42px', top: '52px' });
  });

  it('calls sampleGrid with the entered rows/cols and confirms with the resulting grid', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    const resultGrid: RGB[][] = [[{ r: 1, g: 2, b: 3 }]];
    const sampleGrid = vi.fn().mockResolvedValue(resultGrid);
    const onGridReady = vi.fn();
    const image = makeImage(200, 200);
    render(
      <CornerStep
        image={image}
        onGridReady={onGridReady}
        detectCorners={detectCorners}
        sampleGrid={sampleGrid}
      />,
    );
    await waitFor(() => screen.getByLabelText('topLeft handle'));

    const rowsInput = screen.getByLabelText(/rows/i);
    await userEvent.clear(rowsInput);
    await userEvent.type(rowsInput, '5');
    const colsInput = screen.getByLabelText(/columns/i);
    await userEvent.clear(colsInput);
    await userEvent.type(colsInput, '6');

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(onGridReady).toHaveBeenCalledWith(resultGrid));
    expect(sampleGrid).toHaveBeenCalledWith(image, sampleQuad, 5, 6);
  });
});
