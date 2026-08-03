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

  it('shows the color code as visible text on each square cell', () => {
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={vi.fn()} />);

    const redCell = screen.getByLabelText('cell 0-0, color Red');
    expect(redCell).toHaveTextContent('Red');
    expect(redCell).toHaveStyle({ width: '28px', height: '28px' });
  });

  it('uses dark text on a light background and light text on a dark background', () => {
    const bwPalette: Palette = {
      id: 'p2',
      name: 'BW',
      isBuiltIn: false,
      colors: [
        { name: 'White', hex: '#ffffff' },
        { name: 'Black', hex: '#000000' },
      ],
    };
    const bwGrid: RGB[][] = [
      [
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 },
      ],
    ];
    render(<PaletteAssignStep grid={bwGrid} palette={bwPalette} onConfirm={vi.fn()} />);

    expect(screen.getByLabelText('cell 0-0, color White')).toHaveAttribute(
      'data-text-color',
      '#000000',
    );
    expect(screen.getByLabelText('cell 0-1, color Black')).toHaveAttribute(
      'data-text-color',
      '#ffffff',
    );
  });
});
