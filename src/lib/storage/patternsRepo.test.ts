import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import {
  savePattern,
  getPattern,
  listPatterns,
  deletePattern,
  setColorCompleted,
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
});
