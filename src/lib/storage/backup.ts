import { listPalettes, savePalette } from './palettesRepo';
import { listPatterns, savePattern } from './patternsRepo';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

export const BACKUP_VERSION = 1;
export const BACKUP_APP = 'beadart';

export interface BeadArtBackup {
  version: number;
  app: string;
  exportedAt: string;
  patterns: Pattern[];
  palettes: Palette[];
}

export async function createBackup(): Promise<BeadArtBackup> {
  const [patterns, palettes] = await Promise.all([
    listPatterns(),
    listPalettes(),
  ]);

  return {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    patterns,
    palettes,
  };
}

export async function exportBackup(): Promise<string> {
  const backup = await createBackup();

  return JSON.stringify(backup, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPalette(value: unknown): value is Palette {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.isBuiltIn === 'boolean' &&
    Array.isArray(value.colors) &&
    value.colors.every(
      (color) =>
        isRecord(color) &&
        typeof color.name === 'string' &&
        typeof color.hex === 'string',
    )
  );
}

function isPattern(value: unknown): value is Pattern {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.rows === 'number' &&
    typeof value.cols === 'number' &&
    Array.isArray(value.cellColors) &&
    value.cellColors.every(
      (row) =>
        Array.isArray(row) &&
        row.every((cell) => typeof cell === 'string'),
    ) &&
    typeof value.paletteId === 'string' &&
    Array.isArray(value.completedColors) &&
    value.completedColors.every((color) => typeof color === 'string') &&
    typeof value.thumbnail === 'string' &&
    (value.shareSlug === undefined || typeof value.shareSlug === 'string')
  );
}

export function validateBackup(value: unknown): value is BeadArtBackup {
  if (!isRecord(value)) return false;

  if (
    value.version !== BACKUP_VERSION ||
    value.app !== BACKUP_APP ||
    typeof value.exportedAt !== 'string' ||
    !Array.isArray(value.patterns) ||
    !Array.isArray(value.palettes)
  ) {
    return false;
  }

  return (
    value.patterns.every(isPattern) &&
    value.palettes.every(isPalette)
  );
}

export function parseBackup(json: string): BeadArtBackup {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The backup file is not valid JSON.');
  }

  if (!validateBackup(parsed)) {
    throw new Error(
      'This file is not a valid BeadArt backup or uses an unsupported backup version.',
    );
  }

  return parsed;
}

export async function restoreBackup(backup: BeadArtBackup): Promise<void> {
  if (!validateBackup(backup)) {
    throw new Error('Invalid BeadArt backup.');
  }

  /*
   * Restore patterns and palettes using the existing repositories.
   *
   * Validation happens before this function is called, so malformed
   * backup data never reaches IndexedDB.
   */
  await Promise.all([
    ...backup.patterns.map((pattern) => savePattern(pattern)),
    ...backup.palettes.map((palette) => savePalette(palette)),
  ]);
}

export async function importBackup(json: string): Promise<void> {
  const backup = parseBackup(json);
  await restoreBackup(backup);
}