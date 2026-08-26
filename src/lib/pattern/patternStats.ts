import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

export interface ColorCount {
  name: string;
  hex: string;
  count: number;
}

function hexFor(palette: Palette, colorName: string): string {
  return palette.colors.find((c) => c.name === colorName)?.hex ?? '#000000';
}

export function colorCounts(pattern: Pattern, palette: Palette): ColorCount[] {
  const counts = new Map<string, number>();
  for (const row of pattern.cellColors) {
    for (const name of row) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, hex: hexFor(palette, name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function completionPercent(pattern: Pattern, palette: Palette): number {
  const counts = colorCounts(pattern, palette);
  const totalBeads = counts.reduce((sum, c) => sum + c.count, 0);
  if (totalBeads === 0) return 100;

  const placedBeads = counts
    .filter((c) => pattern.completedColors.includes(c.name))
    .reduce((sum, c) => sum + c.count, 0);

  return Math.round((placedBeads / totalBeads) * 100);
}
