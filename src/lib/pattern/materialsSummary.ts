import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { colorCounts } from './patternStats';

export interface MaterialTotal {
  name: string;
  hex: string;
  total: number;
  incomplete: number;
}

export function aggregateColorTotals(
  patterns: Pattern[],
  palettesById: Map<string, Palette>,
): MaterialTotal[] {
  const totals = new Map<string, MaterialTotal>();

  for (const pattern of patterns) {
    const palette = palettesById.get(pattern.paletteId);
    if (!palette) continue;

    for (const color of colorCounts(pattern, palette)) {
      const existing = totals.get(color.name) ?? {
        name: color.name,
        hex: color.hex,
        total: 0,
        incomplete: 0,
      };
      existing.total += color.count;
      if (!pattern.completedColors.includes(color.name)) {
        existing.incomplete += color.count;
      }
      totals.set(color.name, existing);
    }
  }

  return Array.from(totals.values()).sort(
    (a, b) => b.incomplete - a.incomplete || b.total - a.total || a.name.localeCompare(b.name),
  );
}
