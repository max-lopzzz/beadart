import { describe, it, expect, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import { resetDbForTests } from '../lib/storage/db';
import { usePalettes } from './usePalettes';
import { defaultPalette } from '../lib/palette/defaultPalette';
import { Palette } from '../types/palette';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('usePalettes', () => {
  it('loads the default palette on mount', async () => {
    const { result } = renderHook(() => usePalettes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.palettes).toHaveLength(1);
    expect(result.current.palettes[0].id).toBe(defaultPalette.id);
  });

  it('importPalette adds a new palette and removePalette deletes it', async () => {
    const { result } = renderHook(() => usePalettes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const custom: Palette = {
      id: 'custom-1',
      name: 'Custom',
      isBuiltIn: false,
      colors: [{ name: 'X1', hex: '#123456' }],
    };
    await act(async () => {
      await result.current.importPalette(custom);
    });
    expect(result.current.palettes.map((p) => p.id)).toContain('custom-1');

    await act(async () => {
      await result.current.removePalette('custom-1');
    });
    expect(result.current.palettes.map((p) => p.id)).not.toContain('custom-1');
  });

  it('removePalette rejects when trying to delete the built-in palette', async () => {
    const { result } = renderHook(() => usePalettes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.removePalette(defaultPalette.id)).rejects.toThrow('built-in');
  });
});
