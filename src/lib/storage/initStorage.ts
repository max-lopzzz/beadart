import { defaultPalette } from '../palette/defaultPalette';
import { getPalette, savePalette } from './palettesRepo';

export async function ensureDefaultPalette(): Promise<void> {
  const existing = await getPalette(defaultPalette.id);
  if (!existing) {
    await savePalette(defaultPalette);
  }
}
