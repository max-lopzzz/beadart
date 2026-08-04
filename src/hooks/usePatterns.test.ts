import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { resetDbForTests } from '../lib/storage/db';
import { usePatterns } from './usePatterns';
import { Pattern } from '../types/pattern';
import { Palette } from '../types/palette';

const palette: Palette = {
  id: 'default-bead-palette',
  name: 'Test',
  isBuiltIn: false,
  colors: [
    { name: 'A1', hex: '#ff0000' },
    { name: 'A2', hex: '#00ff00' },
    { name: 'B1', hex: '#0000ff' },
  ],
};

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
    rows: 1,
    cols: 1,
    cellColors: [['A1']],
    paletteId: 'default-bead-palette',
    completedColors: [],
    thumbnail: '',
    ...overrides,
  };
}

describe('usePatterns', () => {
  it('starts empty and lists a saved pattern after addPattern', async () => {
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.patterns).toEqual([]);

    await act(async () => {
      await result.current.addPattern(makePattern());
    });
    expect(result.current.patterns).toEqual([makePattern()]);
  });

  it('removePattern deletes a pattern', async () => {
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern());
    });
    await act(async () => {
      await result.current.removePattern('pattern-1');
    });
    expect(result.current.patterns).toEqual([]);
  });

  it('toggleColorCompleted updates completedColors on the pattern in state', async () => {
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern());
    });
    await act(async () => {
      await result.current.toggleColorCompleted('pattern-1', 'A1', true);
    });
    expect(result.current.patterns[0].completedColors).toEqual(['A1']);
  });

  it('replaceColor updates cellColors on the pattern in state', async () => {
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const { result } = renderHook(() => usePatterns({ renderThumbnail }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern());
    });
    await act(async () => {
      await result.current.replaceColor('pattern-1', 'A1', 'B1', palette);
    });
    expect(result.current.patterns[0].cellColors).toEqual([['B1']]);
  });

  it('replaceColor regenerates the thumbnail so it reflects the edited colors', async () => {
    // pattern.thumbnail is a pre-rendered snapshot taken once at creation
    // time (see NewPatternWizard). If a color edit doesn't regenerate it,
    // the home screen keeps showing the old, pre-edit image even though the
    // pattern's actual data is fresh - the bug this test guards against.
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,updated-thumb');
    const { result } = renderHook(() => usePatterns({ renderThumbnail }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern({ thumbnail: 'data:image/png;base64,original' }));
    });
    await act(async () => {
      await result.current.replaceColor('pattern-1', 'A1', 'B1', palette);
    });
    expect(result.current.patterns[0].thumbnail).toBe('data:image/png;base64,updated-thumb');
    expect(renderThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pattern-1', cellColors: [['B1']] }),
      palette,
      { maxSize: 200 },
    );
  });

  it('renamePattern updates the name on the pattern in state', async () => {
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern());
    });
    await act(async () => {
      await result.current.renamePattern('pattern-1', 'New Name');
    });
    expect(result.current.patterns[0].name).toBe('New Name');
  });

  it('setCellsColor updates every cell in the batch on the pattern in state', async () => {
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const { result } = renderHook(() => usePatterns({ renderThumbnail }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(makePattern({ cellColors: [['A1', 'A2']], cols: 2 }));
    });
    await act(async () => {
      await result.current.setCellsColor(
        'pattern-1',
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        'B1',
        palette,
      );
    });
    expect(result.current.patterns[0].cellColors).toEqual([['B1', 'B1']]);
  });

  it('setCellsColor regenerates the thumbnail so it reflects the edited cells', async () => {
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,updated-thumb');
    const { result } = renderHook(() => usePatterns({ renderThumbnail }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPattern(
        makePattern({ cellColors: [['A1', 'A2']], cols: 2, thumbnail: 'data:image/png;base64,original' }),
      );
    });
    await act(async () => {
      await result.current.setCellsColor('pattern-1', [{ row: 0, col: 0 }], 'B1', palette);
    });
    expect(result.current.patterns[0].thumbnail).toBe('data:image/png;base64,updated-thumb');
    expect(renderThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pattern-1', cellColors: [['B1', 'A2']] }),
      palette,
      { maxSize: 200 },
    );
  });
});
