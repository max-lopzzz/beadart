import { describe, it, expect } from 'vitest';
import { colorCounts, completionPercent } from './patternStats';
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

const palette: Palette = {
  id: 'p1',
  name: 'Test',
  isBuiltIn: false,
  colors: [
    { name: 'A1', hex: '#ff0000' },
    { name: 'A2', hex: '#00ff00' },
    { name: 'A3', hex: '#0000ff' },
  ],
};

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 2,
    cols: 2,
    cellColors: [
      ['A1', 'A1'],
      ['A2', 'A3'],
    ],
    paletteId: 'p1',
    completedColors: [],
    thumbnail: '',
    ...overrides,
  };
}

describe('colorCounts', () => {
  it('counts occurrences of each color used in the pattern, sorted by count desc', () => {
    const pattern = makePattern();
    expect(colorCounts(pattern, palette)).toEqual([
      { name: 'A1', hex: '#ff0000', count: 2 },
      { name: 'A2', hex: '#00ff00', count: 1 },
      { name: 'A3', hex: '#0000ff', count: 1 },
    ]);
  });

  it('excludes empty (no-bead) cells from the count', () => {
    const pattern = makePattern({
      cellColors: [
        ['A1', ''],
        ['', 'A3'],
      ],
    });
    expect(colorCounts(pattern, palette)).toEqual([
      { name: 'A1', hex: '#ff0000', count: 1 },
      { name: 'A3', hex: '#0000ff', count: 1 },
    ]);
  });
});

describe('completionPercent', () => {
  it('returns 0 when no colors are completed', () => {
    expect(completionPercent(makePattern(), palette)).toBe(0);
  });

  it('weighs completion by bead count, not distinct color count', () => {
    // A1 covers 2 of the pattern's 4 cells, so completing it alone is 50%,
    // not 33% (which is what 1-of-3-distinct-colors would give).
    const pattern = makePattern({ completedColors: ['A1'] });
    expect(completionPercent(pattern, palette)).toBe(50);
  });

  it('weighs a single-cell color less than a color covering most of the pattern', () => {
    const pattern = makePattern({ completedColors: ['A2'] });
    expect(completionPercent(pattern, palette)).toBe(25);
  });

  it('returns 100 when every distinct color is completed', () => {
    const pattern = makePattern({ completedColors: ['A1', 'A2', 'A3'] });
    expect(completionPercent(pattern, palette)).toBe(100);
  });

  it('ignores empty (no-bead) cells when weighing completion, not just when counting colors', () => {
    // 2 real beads (A1) out of 3 cells total, 1 of which is empty - percent
    // should be based on the 2 real beads, not the cell grid's raw size.
    const pattern = makePattern({
      cellColors: [
        ['A1', 'A1'],
        ['', ''],
      ],
      completedColors: ['A1'],
    });
    expect(completionPercent(pattern, palette)).toBe(100);
  });
});
