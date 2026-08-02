import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaletteAssignStep } from './PaletteAssignStep';
import { Palette } from '../../types/palette';
import { RGB } from '../../lib/color/lab';

describe('PaletteAssignStep', () => {
  const palette: Palette = {
    id: 'p1',
    name: 'Test',
    isBuiltIn: false,
    colors: [
      { name: 'Red', hex: '#ff0000' },
      { name: 'Blue', hex: '#0000ff' },
    ],
  };
  const grid: RGB[][] = [
    [
      { r: 250, g: 5, b: 5 },
      { r: 5, g: 5, b: 250 },
    ],
  ];

  it('auto-matches each cell to the nearest palette color and confirms with them unchanged', async () => {
    const onConfirm = vi.fn();
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    expect(onConfirm).toHaveBeenCalledWith([['Red', 'Blue']]);
  });

  it('lets the user override a cell color by clicking it then a replacement swatch', async () => {
    const onConfirm = vi.fn();
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByLabelText('swatch Blue'));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    expect(onConfirm).toHaveBeenCalledWith([['Blue', 'Blue']]);
  });
});
