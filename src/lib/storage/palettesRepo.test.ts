import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import { savePalette, getPalette, listPalettes, deletePalette } from './palettesRepo';
import { Palette } from '../../types/palette';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'palette-1',
    name: 'Test Palette',
    isBuiltIn: false,
    colors: [{ name: 'A1', hex: '#ff0000' }],
    ...overrides,
  };
}

describe('palettesRepo', () => {
  it('saves and retrieves a palette', async () => {
    const palette = makePalette();
    await savePalette(palette);
    expect(await getPalette('palette-1')).toEqual(palette);
  });

  it('lists all saved palettes', async () => {
    await savePalette(makePalette({ id: 'palette-1' }));
    await savePalette(makePalette({ id: 'palette-2', name: 'Second' }));
    const palettes = await listPalettes();
    expect(palettes.map((p) => p.id).sort()).toEqual(['palette-1', 'palette-2']);
  });

  it('deletes a custom palette', async () => {
    await savePalette(makePalette());
    await deletePalette('palette-1');
    expect(await getPalette('palette-1')).toBeUndefined();
  });

  it('refuses to delete a built-in palette', async () => {
    await savePalette(makePalette({ id: 'builtin-1', isBuiltIn: true }));
    await expect(deletePalette('builtin-1')).rejects.toThrow('built-in');
  });
});
