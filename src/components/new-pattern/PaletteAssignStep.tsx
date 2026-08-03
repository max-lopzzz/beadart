import { useState } from 'react';
import { RGB } from '../../lib/color/lab';
import { Palette } from '../../types/palette';
import { buildCellColors } from '../../lib/pattern/buildPattern';

interface PaletteAssignStepProps {
  grid: RGB[][];
  palette: Palette;
  onConfirm: (cellColors: string[][]) => void;
}

interface SelectedCell {
  row: number;
  col: number;
}

const CELL_SIZE_PX = 28;

function hexToRgbChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function contrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgbChannels(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance >= 0.5 ? '#000000' : '#ffffff';
}

export function PaletteAssignStep({ grid, palette, onConfirm }: PaletteAssignStepProps) {
  const [cellColors, setCellColors] = useState<string[][]>(() =>
    buildCellColors(grid, palette.colors),
  );
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  const handleSwatchClick = (colorName: string) => {
    if (!selectedCell) return;
    setCellColors((prev) => {
      const next = prev.map((row) => [...row]);
      next[selectedCell.row][selectedCell.col] = colorName;
      return next;
    });
    setSelectedCell(null);
  };

  return (
    <div>
      <h2>Review pattern colors</h2>
      <p className="hint">Click any cell to swap its color, then confirm below.</p>
      <div className="assign-grid-wrap surface" style={{ padding: 'var(--space-3)' }}>
        <table>
          <tbody>
            {cellColors.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((colorName, colIndex) => {
                  const hex = hexByName.get(colorName) ?? '#000000';
                  const textColor = contrastTextColor(hex);
                  const isSelected =
                    selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  return (
                    <td key={colIndex}>
                      <button
                        className="assign-cell"
                        aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                        data-text-color={textColor}
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                        style={{
                          width: CELL_SIZE_PX,
                          height: CELL_SIZE_PX,
                          padding: 0,
                          backgroundColor: hex,
                          color: textColor,
                          fontSize: 9,
                        }}
                      >
                        {colorName}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCell && (
        <div className="swatch-picker" role="group" aria-label="Choose a replacement color">
          {palette.colors.map((color) => (
            <button
              key={color.name}
              className="bead-btn"
              aria-label={`swatch ${color.name}`}
              style={{ backgroundColor: color.hex, color: contrastTextColor(color.hex) }}
              onClick={() => handleSwatchClick(color.name)}
            >
              {color.name}
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-primary" onClick={() => onConfirm(cellColors)}>
        Save Pattern
      </button>
    </div>
  );
}
