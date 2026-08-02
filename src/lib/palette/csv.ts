import { PaletteColor } from '../../types/palette';

export interface ParseResult {
  colors: PaletteColor[];
  errors: string[];
}

const HEX_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function parsePaletteCsv(csvText: string): ParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { colors: [], errors: ['CSV is empty'] };
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const colorIdx = header.indexOf('color');

  if (nameIdx === -1 || colorIdx === -1) {
    return { colors: [], errors: ['CSV header must contain "Name" and "Color" columns'] };
  }

  const colors: PaletteColor[] = [];
  const errors: string[] = [];
  const seenNames = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    const name = cells[nameIdx];
    const hex = cells[colorIdx];

    if (!name) {
      errors.push(`Row ${rowNumber}: missing name`);
      continue;
    }
    if (!hex || !HEX_PATTERN.test(hex)) {
      errors.push(`Row ${rowNumber}: invalid color "${hex ?? ''}"`);
      continue;
    }
    if (seenNames.has(name)) {
      errors.push(`Row ${rowNumber}: duplicate name "${name}"`);
      continue;
    }

    seenNames.add(name);
    colors.push({ name, hex: hex.toLowerCase() });
  }

  return { colors, errors };
}
