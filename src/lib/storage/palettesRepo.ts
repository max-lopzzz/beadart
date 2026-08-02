import { getDb } from './db';
import { Palette } from '../../types/palette';

export async function savePalette(palette: Palette): Promise<void> {
  const db = await getDb();
  await db.put('palettes', palette);
}

export async function getPalette(id: string): Promise<Palette | undefined> {
  const db = await getDb();
  return db.get('palettes', id);
}

export async function listPalettes(): Promise<Palette[]> {
  const db = await getDb();
  return db.getAll('palettes');
}

export async function deletePalette(id: string): Promise<void> {
  const db = await getDb();
  const palette = await db.get('palettes', id);
  if (palette?.isBuiltIn) {
    throw new Error(`Cannot delete built-in palette "${palette.name}"`);
  }
  await db.delete('palettes', id);
}
