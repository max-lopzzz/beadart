import { useCallback, useEffect, useState } from 'react';
import { Pattern } from '../types/pattern';
import {
  deletePattern,
  listPatterns,
  replaceColorInPattern,
  savePattern,
  setColorCompleted,
} from '../lib/storage/patternsRepo';

export function usePatterns() {
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

  const addPattern = useCallback(
    async (pattern: Pattern) => {
      await savePattern(pattern);
      await refresh();
    },
    [refresh],
  );

  const removePattern = useCallback(
    async (id: string) => {
      await deletePattern(id);
      await refresh();
    },
    [refresh],
  );

  const toggleColorCompleted = useCallback(
    async (patternId: string, colorName: string, completed: boolean) => {
      await setColorCompleted(patternId, colorName, completed);
      await refresh();
    },
    [refresh],
  );

  const replaceColor = useCallback(
    async (patternId: string, fromColor: string, toColor: string) => {
      await replaceColorInPattern(patternId, fromColor, toColor);
      await refresh();
    },
    [refresh],
  );

  return { patterns, loading, addPattern, removePattern, toggleColorCompleted, replaceColor };
}
