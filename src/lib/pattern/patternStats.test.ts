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
});

describe('completionPercent', () => {
  it('returns 0 when no colors are completed', () => {
    expect(completionPercent(makePattern(), palette)).toBe(0);
  });

  it('returns a rounded percentage of completed distinct colors', () => {
    const pattern = makePattern({ completedColors: ['A1'] });
    expect(completionPercent(pattern, palette)).toBe(33);
  });

  it('returns 100 when every distinct color is completed', () => {
    const pattern = makePattern({ completedColors: ['A1', 'A2', 'A3'] });
    expect(completionPercent(pattern, palette)).toBe(100);
  });
});
