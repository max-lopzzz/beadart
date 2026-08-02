import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { resetDbForTests } from '../lib/storage/db';
import { usePatterns } from './usePatterns';
import { Pattern } from '../types/pattern';

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
});
