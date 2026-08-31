import { describe, it, expect } from 'vitest';
import { aggregateColorTotals } from './materialsSummary';
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregateColorTotals', () => {
  it('sums per-color counts across a single pattern, all incomplete by default', () => {
    const result = aggregateColorTotals([makePattern()], new Map([['p1', palette]]));
    expect(result).toEqual([
      { name: 'A1', hex: '#ff0000', total: 2, incomplete: 2 },
      { name: 'A2', hex: '#00ff00', total: 1, incomplete: 1 },
      { name: 'A3', hex: '#0000ff', total: 1, incomplete: 1 },
    ]);
  });

  it('excludes a color from the incomplete count once marked complete in that pattern', () => {
    const result = aggregateColorTotals(
      [makePattern({ completedColors: ['A1'] })],
      new Map([['p1', palette]]),
    );
    const a1 = result.find((r) => r.name === 'A1');
    expect(a1).toEqual({ name: 'A1', hex: '#ff0000', total: 2, incomplete: 0 });
  });

  it('sums totals for the same color across multiple patterns, tracking completion per pattern', () => {
    const patternA = makePattern({ id: 'pattern-a', completedColors: ['A1'] });
    const patternB = makePattern({ id: 'pattern-b', cellColors: [['A1', 'A2']] });
    const result = aggregateColorTotals([patternA, patternB], new Map([['p1', palette]]));

    const a1 = result.find((r) => r.name === 'A1');
    // 2 from patternA (complete, so 0 incomplete) + 1 from patternB (incomplete)
    expect(a1).toEqual({ name: 'A1', hex: '#ff0000', total: 3, incomplete: 1 });
  });

  it('skips patterns whose palette is not found', () => {
    const result = aggregateColorTotals([makePattern({ paletteId: 'missing' })], new Map());
    expect(result).toEqual([]);
  });

  it('sorts by incomplete count descending, then total descending, then name', () => {
    const patternA = makePattern({
      id: 'pattern-a',
      cellColors: [
        ['A2', 'A2'],
        ['A3', 'A1'],
      ],
    });
    const result = aggregateColorTotals([patternA], new Map([['p1', palette]]));
    expect(result.map((r) => r.name)).toEqual(['A2', 'A1', 'A3']);
  });
});
