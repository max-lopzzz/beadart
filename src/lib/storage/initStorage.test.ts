import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import { ensureDefaultPalette } from './initStorage';
import { getPalette } from './palettesRepo';
import { defaultPalette } from '../palette/defaultPalette';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('ensureDefaultPalette', () => {
  it('saves the default palette when none exists', async () => {
    await ensureDefaultPalette();
    expect(await getPalette(defaultPalette.id)).toEqual(defaultPalette);
  });

  it('does not overwrite an existing default palette', async () => {
    await ensureDefaultPalette();
    await ensureDefaultPalette();
    expect(await getPalette(defaultPalette.id)).toEqual(defaultPalette);
  });
});
