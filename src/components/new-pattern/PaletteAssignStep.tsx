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
      <table>
        <tbody>
          {cellColors.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((colorName, colIndex) => (
                <td key={colIndex}>
                  <button
                    aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                    style={{ backgroundColor: hexByName.get(colorName) }}
                    onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedCell && (
        <div role="group" aria-label="Choose a replacement color">
          {palette.colors.map((color) => (
            <button
              key={color.name}
              aria-label={`swatch ${color.name}`}
              style={{ backgroundColor: color.hex }}
              onClick={() => handleSwatchClick(color.name)}
            >
              {color.name}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => onConfirm(cellColors)}>Save Pattern</button>
    </div>
  );
}
