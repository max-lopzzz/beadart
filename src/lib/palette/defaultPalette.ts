import { parsePaletteCsv } from './csv';
import { DEFAULT_PALETTE_CSV } from './defaultPaletteCsv';
import { Palette } from '../../types/palette';

const parsed = parsePaletteCsv(DEFAULT_PALETTE_CSV);

if (parsed.errors.length > 0) {
  throw new Error(`Default palette CSV has invalid rows: ${parsed.errors.join('; ')}`);
}

export const DEFAULT_PALETTE_ID = 'default-bead-palette';

export const defaultPalette: Palette = {
  id: DEFAULT_PALETTE_ID,
  name: 'Default Bead Palette',
  isBuiltIn: true,
  colors: parsed.colors,
};
