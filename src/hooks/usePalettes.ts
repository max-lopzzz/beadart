import { useCallback, useEffect, useState } from 'react';

import { Palette } from '../types/palette';

import {
  deletePalette,
  listPalettes,
  savePalette,
} from '../lib/storage/palettesRepo';

import { ensureDefaultPalette } from '../lib/storage/initStorage';

import {
  deleteSyncedPalette,
  syncPalette,
} from '../lib/account/accountRepo';

export function usePalettes() {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPalettes(await listPalettes());
  }, []);

  useEffect(() => {
    (async () => {
      await ensureDefaultPalette();
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const importPalette = useCallback(
    async (palette: Palette) => {
      await savePalette(palette);
      await syncPalette(palette);
      await refresh();
    },
    [refresh],
  );

  const removePalette = useCallback(
    async (id: string) => {
      await deletePalette(id);
      await deleteSyncedPalette(id);
      await refresh();
    },
    [refresh],
  );

  return {
    palettes,
    loading,
    importPalette,
    removePalette,
  };
}
