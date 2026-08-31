import { describe, expect, it, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import {
  createBackup,
  exportBackup,
  importBackup,
  parseBackup,
  validateBackup,
} from './backup';
import { savePalette, listPalettes } from './palettesRepo';
import { savePattern, listPatterns } from './patternsRepo';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

const palette: Palette = {
  id: 'palette-1',
  name: 'Test Palette',
  isBuiltIn: false,
  colors: [
    {
      name: 'Red',
      hex: '#ff0000',
    },
  ],
};

const pattern: Pattern = {
  id: 'pattern-1',
  name: 'Test Pattern',
  createdAt: '2026-08-31T10:00:00.000Z',
  updatedAt: '2026-08-31T10:30:00.000Z',
  rows: 2,
  cols: 2,
  cellColors: [
    ['Red', ''],
    ['', 'Red'],
  ],
  paletteId: 'palette-1',
  completedColors: [],
  thumbnail: 'data:image/png;base64,test',
};

afterEach(async () => {
  await resetDbForTests();
});

describe('backup', () => {
  it('creates a backup containing patterns and palettes', async () => {
    await savePalette(palette);
    await savePattern(pattern);

    const backup = await createBackup();

    expect(backup.version).toBe(1);
    expect(backup.app).toBe('beadart');
    expect(backup.patterns).toEqual([pattern]);
    expect(backup.palettes).toEqual([palette]);
  });

  it('exports valid JSON', async () => {
    await savePalette(palette);
    await savePattern(pattern);

    const json = await exportBackup();

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);

    expect(validateBackup(parsed)).toBe(true);
  });

  it('parses a valid backup', () => {
    const json = JSON.stringify({
      version: 1,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [pattern],
      palettes: [palette],
    });

    expect(parseBackup(json)).toEqual({
      version: 1,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [pattern],
      palettes: [palette],
    });
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('not json')).toThrow(
      'The backup file is not valid JSON.',
    );
  });

  it('rejects unsupported backup versions', () => {
    const backup = {
      version: 999,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [],
      palettes: [],
    };

    expect(validateBackup(backup)).toBe(false);
  });

  it('rejects invalid patterns', () => {
    const backup = {
      version: 1,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [
        {
          id: 'broken',
        },
      ],
      palettes: [],
    };

    expect(validateBackup(backup)).toBe(false);
  });

  it('imports patterns and palettes', async () => {
    const json = JSON.stringify({
      version: 1,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [pattern],
      palettes: [palette],
    });

    await importBackup(json);

    expect(await listPatterns()).toEqual([pattern]);
    expect(await listPalettes()).toEqual([palette]);
  });

  it('does not modify the database when validation fails', async () => {
    await savePalette(palette);

    const invalidBackup = JSON.stringify({
      version: 999,
      app: 'beadart',
      exportedAt: '2026-08-31T10:00:00.000Z',
      patterns: [],
      palettes: [],
    });

    await expect(importBackup(invalidBackup)).rejects.toThrow();

    expect(await listPalettes()).toEqual([palette]);
    expect(await listPatterns()).toEqual([]);
  });
});