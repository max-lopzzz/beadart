import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import {
  savePattern,
  getPattern,
  listPatterns,
  deletePattern,
  setColorCompleted,
  replaceColorInPattern,
  renamePattern,
  setCellsColor,
  setShareSlug,
} from './patternsRepo';
import { Pattern } from '../../types/pattern';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 2,
    cols: 2,
    cellColors: [
      ['A1', 'A2'],
      ['A3', 'A4'],
    ],
    paletteId: 'default-bead-palette',
    completedColors: [],
    thumbnail: 'data:image/png;base64,',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('patternsRepo', () => {
  it('saves and retrieves a pattern', async () => {
    const pattern = makePattern();
    await savePattern(pattern);
    expect(await getPattern('pattern-1')).toEqual(pattern);
  });

  it('lists all saved patterns', async () => {
    await savePattern(makePattern({ id: 'pattern-1' }));
    await savePattern(makePattern({ id: 'pattern-2', name: 'Second' }));
    const patterns = await listPatterns();
    expect(patterns.map((p) => p.id).sort()).toEqual(['pattern-1', 'pattern-2']);
  });

  it('deletes a pattern', async () => {
    await savePattern(makePattern());
    await deletePattern('pattern-1');
    expect(await getPattern('pattern-1')).toBeUndefined();
  });

  it('marks a color as completed and un-completed', async () => {
    await savePattern(makePattern());
    const afterComplete = await setColorCompleted('pattern-1', 'A1', true);
    expect(afterComplete.completedColors).toEqual(['A1']);
    const afterUncomplete = await setColorCompleted('pattern-1', 'A1', false);
    expect(afterUncomplete.completedColors).toEqual([]);
  });

  it('throws when marking a color complete on a missing pattern', async () => {
    await expect(setColorCompleted('missing', 'A1', true)).rejects.toThrow('not found');
  });

  it('replaces every occurrence of a color throughout the pattern', async () => {
    await savePattern(makePattern({ cellColors: [['A1', 'A2'], ['A1', 'A1']] }));
    const updated = await replaceColorInPattern('pattern-1', 'A1', 'B1');
    expect(updated.cellColors).toEqual([
      ['B1', 'A2'],
      ['B1', 'B1'],
    ]);
  });

  it('drops the replaced color from completedColors, keeping the target color as-is', async () => {
    await savePattern(makePattern({ completedColors: ['A1', 'A3'] }));
    const updated = await replaceColorInPattern('pattern-1', 'A1', 'A2');
    expect(updated.completedColors.sort()).toEqual(['A3']);
  });

  it('throws when replacing a color on a missing pattern', async () => {
    await expect(replaceColorInPattern('missing', 'A1', 'B1')).rejects.toThrow('not found');
  });

  it('renames a pattern', async () => {
    await savePattern(makePattern());
    const updated = await renamePattern('pattern-1', 'New Name');
    expect(updated.name).toBe('New Name');
    expect(await getPattern('pattern-1')).toMatchObject({ name: 'New Name' });
  });

  it('throws when renaming a missing pattern', async () => {
    await expect(renamePattern('missing', 'New Name')).rejects.toThrow('not found');
  });

  it('sets and clears a share slug', async () => {
    await savePattern(makePattern());
    const shared = await setShareSlug('pattern-1', 'abc123');
    expect(shared.shareSlug).toBe('abc123');
    const unshared = await setShareSlug('pattern-1', null);
    expect(unshared.shareSlug).toBeUndefined();
  });

  it('throws when setting a share slug on a missing pattern', async () => {
    await expect(setShareSlug('missing', 'abc123')).rejects.toThrow('not found');
  });

  it('sets the color of a single cell without affecting others', async () => {
    await savePattern(makePattern({ cellColors: [['A1', 'A2'], ['A3', 'A4']] }));
    const updated = await setCellsColor('pattern-1', [{ row: 0, col: 1 }], 'B1');
    expect(updated.cellColors).toEqual([
      ['A1', 'B1'],
      ['A3', 'A4'],
    ]);
  });

  it('sets the color of every cell in a batch at once, leaving the rest untouched', async () => {
    await savePattern(makePattern({ cellColors: [['A1', 'A2'], ['A3', 'A4']] }));
    const updated = await setCellsColor(
      'pattern-1',
      [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
      'B1',
    );
    expect(updated.cellColors).toEqual([
      ['B1', 'A2'],
      ['A3', 'B1'],
    ]);
  });

  it('throws when setting cell colors on a missing pattern', async () => {
    await expect(setCellsColor('missing', [{ row: 0, col: 0 }], 'A1')).rejects.toThrow(
      'not found',
    );
  });
});
