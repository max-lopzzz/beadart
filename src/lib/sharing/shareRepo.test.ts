import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  buildSharedSummary,
  buildOverviewSummary,
  fetchSharedPattern,
  fetchSharedOverview,
} from './shareRepo';

import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, slug) => ({ collection, slug })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock('./firebaseClient', () => ({
  getSharedPatternsDb: vi.fn(() => ({ mocked: true })),
}));

import { getDoc } from 'firebase/firestore';

const mockedGetDoc = vi.mocked(getDoc);

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
    updatedAt: '2026-01-01T00:00:00.000Z',
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

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('fetchSharedPattern', () => {
  it('returns a valid shared pattern document', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'Shared Pattern',
        thumbnail: 'data:image/png;base64,abc',
        percent: 50,
        colors: [
          {
            name: 'Red',
            hex: '#ff0000',
            total: 2,
            done: true,
          },
          {
            name: 'Blue',
            hex: '#0000ff',
            total: 2,
            done: false,
          },
        ],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedPattern('slug-1')).resolves.toEqual({
      slug: 'slug-1',
      name: 'Shared Pattern',
      thumbnail: 'data:image/png;base64,abc',
      percent: 50,
      colors: [
        {
          name: 'Red',
          hex: '#ff0000',
          total: 2,
          done: true,
        },
        {
          name: 'Blue',
          hex: '#0000ff',
          total: 2,
          done: false,
        },
      ],
      updatedAt: '2026-08-30T12:00:00.000Z',
    });
  });

  it('returns null when the shared pattern does not exist', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    } as never);

    await expect(fetchSharedPattern('missing')).resolves.toBeNull();
  });

  it('returns null when the shared pattern document is invalid', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'Broken Pattern',
        percent: '50',
      }),
    } as never);

    await expect(fetchSharedPattern('broken')).resolves.toBeNull();
  });

  it('returns null when a color entry is invalid', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'Broken Pattern',
        thumbnail: '',
        percent: 50,
        colors: [
          {
            name: 'Red',
            hex: '#ff0000',
            total: 2,
            done: 'yes',
          },
        ],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedPattern('broken')).resolves.toBeNull();
  });

  it('rejects an out-of-range completion percent', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'Broken Pattern',
        thumbnail: '',
        percent: 150,
        colors: [],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedPattern('broken')).resolves.toBeNull();
  });
});

describe('fetchSharedOverview', () => {
  it('returns a valid shared overview document', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        patternCount: 2,
        beadsPlaced: 6,
        beadsTotal: 8,
        percent: 75,
        materials: [
          {
            name: 'Red',
            hex: '#ff0000',
            total: 4,
            remaining: 2,
          },
          {
            name: 'Blue',
            hex: '#0000ff',
            total: 4,
            remaining: 4,
          },
        ],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedOverview('overview-1')).resolves.toEqual({
      patternCount: 2,
      beadsPlaced: 6,
      beadsTotal: 8,
      percent: 75,
      materials: [
        {
          name: 'Red',
          hex: '#ff0000',
          total: 4,
          remaining: 2,
        },
        {
          name: 'Blue',
          hex: '#0000ff',
          total: 4,
          remaining: 4,
        },
      ],
      updatedAt: '2026-08-30T12:00:00.000Z',
    });
  });

  it('returns null when the overview does not exist', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    } as never);

    await expect(fetchSharedOverview('missing')).resolves.toBeNull();
  });

  it('returns null when the overview document is invalid', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        patternCount: 'two',
        beadsPlaced: 6,
        beadsTotal: 8,
        percent: 75,
        materials: [],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedOverview('broken')).resolves.toBeNull();
  });

  it('returns null when remaining beads exceed the total', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        patternCount: 1,
        beadsPlaced: 0,
        beadsTotal: 4,
        percent: 0,
        materials: [
          {
            name: 'Red',
            hex: '#ff0000',
            total: 4,
            remaining: 5,
          },
        ],
        updatedAt: '2026-08-30T12:00:00.000Z',
      }),
    } as never);

    await expect(fetchSharedOverview('broken')).resolves.toBeNull();
  });
});