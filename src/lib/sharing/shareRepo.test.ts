import { describe, it, expect } from 'vitest';
import { buildSharedSummary, buildOverviewSummary } from './shareRepo';
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 2,
    cols: 2,
    cellColors: [
      ['Red', 'Red'],
      ['Blue', 'Blue'],
    ],
    paletteId: 'default-bead-palette',
    completedColors: ['Red'],
    thumbnail: 'data:image/png;base64,abc',
    ...overrides,
  };
}

const palette: Palette = {
  id: 'default-bead-palette',
  name: 'Default',
  isBuiltIn: true,
  colors: [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ],
};

describe('buildSharedSummary', () => {
  it('carries over name and thumbnail', () => {
    const summary = buildSharedSummary('slug-1', makePattern(), palette);
    expect(summary.slug).toBe('slug-1');
    expect(summary.name).toBe('Test Pattern');
    expect(summary.thumbnail).toBe('data:image/png;base64,abc');
  });

  it('computes completion percent from completed colors', () => {
    const summary = buildSharedSummary('slug-1', makePattern(), palette);
    expect(summary.percent).toBe(50);
  });

  it('marks each color as done or remaining with its cell count', () => {
    const summary = buildSharedSummary('slug-1', makePattern(), palette);
    expect(summary.colors).toEqual([
      { name: 'Blue', hex: '#0000ff', total: 2, done: false },
      { name: 'Red', hex: '#ff0000', total: 2, done: true },
    ]);
  });
});

describe('buildOverviewSummary', () => {
  const palettesById = new Map([[palette.id, palette]]);

  it('counts patterns and totals beads placed vs needed across all of them', () => {
    const patterns = [
      makePattern({ id: 'p1', completedColors: ['Red'] }),
      makePattern({ id: 'p2', completedColors: ['Red', 'Blue'] }),
    ];
    const summary = buildOverviewSummary(patterns, palettesById);
    expect(summary.patternCount).toBe(2);
    expect(summary.beadsTotal).toBe(8);
    expect(summary.beadsPlaced).toBe(6);
    expect(summary.percent).toBe(75);
  });

  it('returns 100% with no beads when there are no patterns', () => {
    const summary = buildOverviewSummary([], palettesById);
    expect(summary.patternCount).toBe(0);
    expect(summary.beadsTotal).toBe(0);
    expect(summary.percent).toBe(100);
  });

  it('aggregates remaining beads per color across patterns', () => {
    const patterns = [
      makePattern({ id: 'p1', completedColors: ['Red'] }),
      makePattern({ id: 'p2', completedColors: [] }),
    ];
    const summary = buildOverviewSummary(patterns, palettesById);
    expect(summary.materials).toEqual([
      { name: 'Blue', hex: '#0000ff', total: 4, remaining: 4 },
      { name: 'Red', hex: '#ff0000', total: 4, remaining: 2 },
    ]);
  });
});
