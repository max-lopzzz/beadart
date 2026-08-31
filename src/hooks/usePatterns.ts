import { useCallback, useEffect, useState } from 'react';

import { Pattern } from '../types/pattern';
import { Palette } from '../types/palette';
import { renderPatternToDataUrl } from '../lib/image/renderPattern';

import {
  CellPosition,
  deletePattern,
  listPatterns,
  renamePattern as renamePatternInStorage,
  replaceColorInPattern,
  savePattern,
  setCellsColor as setCellsColorInStorage,
  setColorCompleted,
  setShareSlug,
} from '../lib/storage/patternsRepo';

import {
  deleteSyncedPattern,
  syncPattern,
} from '../lib/account/accountRepo';

interface UsePatternsOptions {
  renderThumbnail?: typeof renderPatternToDataUrl;
}

export function usePatterns({
  renderThumbnail = renderPatternToDataUrl,
}: UsePatternsOptions = {}) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPatterns(await listPatterns());
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    const handlePatternsUpdated = () => {
      void refresh();
    };

    window.addEventListener(
      'beadart-patterns-updated',
      handlePatternsUpdated,
    );

    return () => {
      window.removeEventListener(
        'beadart-patterns-updated',
        handlePatternsUpdated,
      );
    };
  }, [refresh]);

  const addPattern = useCallback(
    async (pattern: Pattern) => {
      await savePattern(pattern);
      await syncPattern(pattern);
      await refresh();
    },
    [refresh],
  );

  const removePattern = useCallback(
    async (id: string) => {
      await deletePattern(id);
      await deleteSyncedPattern(id);
      await refresh();
    },
    [refresh],
  );

  const toggleColorCompleted = useCallback(
    async (
      patternId: string,
      colorName: string,
      completed: boolean,
    ) => {
      const updated = await setColorCompleted(
        patternId,
        colorName,
        completed,
      );

      await syncPattern(updated);
      await refresh();
    },
    [refresh],
  );

  const replaceColor = useCallback(
    async (
      patternId: string,
      fromColor: string,
      toColor: string,
      palette: Palette,
    ) => {
      const updated = await replaceColorInPattern(
        patternId,
        fromColor,
        toColor,
      );

      const thumbnail = renderThumbnail(updated, palette, {
        maxSize: 200,
      });

      const finalPattern = {
        ...updated,
        thumbnail,
      };

      await savePattern(finalPattern);
      await syncPattern(finalPattern);
      await refresh();

      return finalPattern;
    },
    [refresh, renderThumbnail],
  );

  const renamePattern = useCallback(
    async (patternId: string, name: string) => {
      const updated = await renamePatternInStorage(patternId, name);

      await syncPattern(updated);
      await refresh();
    },
    [refresh],
  );

  const setShare = useCallback(
    async (patternId: string, shareSlug: string | null) => {
      const updated = await setShareSlug(patternId, shareSlug);

      await syncPattern(updated);
      await refresh();
    },
    [refresh],
  );

  const setCellsColor = useCallback(
    async (
      patternId: string,
      cells: CellPosition[],
      colorName: string,
      palette: Palette,
    ) => {
      const updated = await setCellsColorInStorage(
        patternId,
        cells,
        colorName,
      );

      const thumbnail = renderThumbnail(updated, palette, {
        maxSize: 200,
      });

      const finalPattern = {
        ...updated,
        thumbnail,
      };

      await savePattern(finalPattern);
      await syncPattern(finalPattern);
      await refresh();

      return finalPattern;
    },
    [refresh, renderThumbnail],
  );

  return {
    patterns,
    loading,
    addPattern,
    removePattern,
    toggleColorCompleted,
    replaceColor,
    renamePattern,
    setCellsColor,
    setShare,
  };
}
