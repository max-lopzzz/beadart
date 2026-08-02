# Digital Pixel-Art App UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, usable app for the "digital pixel art image" path: Home screen, New Pattern wizard (upload → grid size → palette assignment → save), Working view (color-by-color build guide with completion tracking), and palette management — all on top of the Core Engine + Storage plan already merged to master. Deliberately excludes the photo/grid-detection path (Plan 3).

**Architecture:** React function components with plain `useState`-based navigation (no router library — a handful of screens don't justify one). All data flows through two hooks (`usePalettes`, `usePatterns`) that wrap the existing IndexedDB repos. Canvas/File-API image decoding is isolated into two small untested "browser adapter" functions; everything downstream of them (grid detection, downsampling, color matching, pattern stats) is pure and already unit-tested from the Core Engine plan, or newly unit-tested in this plan. No styling framework is introduced — plain CSS in one stylesheet, since visual polish is out of scope for this plan.

**Tech Stack:** React 19 (already installed), Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` (new, this plan), `jsdom` (new, this plan). Reuses `idb`/`fake-indexeddb` from the Core Engine plan.

## Global Constraints

- Fully client-side app — no backend/server. (Design spec §1)
- This plan covers ONLY the digital-image upload path. The photo/grid-detection path (draggable corners, OpenCV.js) is explicitly out of scope — Plan 3.
- Sidebar color list shows swatch + name + count (e.g. "■ A7 × 34") with a checkbox; clicking the color name (not the checkbox) filters the grid to only that color's cells; checking the checkbox marks the whole color complete. (Design spec §2, Working view)
- The default palette (`defaultPalette` from the Core Engine plan) is not deletable — `PaletteManageScreen` must not offer a delete action for `isBuiltIn: true` palettes, and `deletePalette` already throws if attempted. (Design spec §2, §4; Core Engine plan Task 9)
- Thumbnails are generated once at save time as a small canvas render, not re-rendered from the full grid on every Home screen visit. (Design spec §3)
- Canvas/File-API code (image decoding, thumbnail/export rendering) is not unit-tested — `jsdom` does not implement 2D canvas rendering. These adapters are verified manually in the browser (this plan's final task), while everything they feed into (grid detection, downsampling, color matching) already has unit test coverage.

---

### Task 1: React Testing Library + jsdom setup

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `vitest.setup.ts` (modify — add jest-dom import)
- Create: `src/App.test.tsx`

**Interfaces:**
- Produces: a working jsdom + React Testing Library test environment that every later component task in this plan relies on.

- [ ] **Step 1: Add test dependencies to `package.json`**

Add to `devDependencies` (alongside the existing entries — do not remove any):

```json
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1"
```

- [ ] **Step 2: Update `vitest.config.ts` to use jsdom**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 3: Update `vitest.setup.ts` to add jest-dom matchers**

```typescript
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: Install and verify the existing suite still passes under jsdom**

Run: `npm install && npm test`
Expected: all 31 existing tests still pass (jsdom is a superset environment for `Uint8ClampedArray`/`indexedDB`-based tests — nothing in the Core Engine plan depends on the `node` environment specifically).

- [ ] **Step 5: Write a smoke test for `src/App.test.tsx`**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Bead Art Helper/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the smoke test to verify it passes against the current placeholder `App.tsx`**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (the placeholder `App.tsx` from the Core Engine plan already renders "Bead Art Helper — coming soon", which matches `/Bead Art Helper/i`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/App.test.tsx
git commit -m "chore: add React Testing Library and jsdom test environment"
```

---

### Task 2: Pure pattern-building logic

**Files:**
- Create: `src/lib/pattern/buildPattern.ts`
- Test: `src/lib/pattern/buildPattern.test.ts`

**Interfaces:**
- Consumes: `RGB` from `src/lib/color/lab.ts`; `findNearestColor` from `src/lib/color/nearestMatch.ts`; `PaletteColor` from `src/types/palette.ts`.
- Produces: `buildCellColors(grid: RGB[][], palette: PaletteColor[]): string[][]` — used by Task 9 (palette-assignment wizard step) to turn a downsampled color grid into a `Pattern.cellColors` grid of palette color names.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { buildCellColors } from './buildPattern';
import { PaletteColor } from '../../types/palette';

describe('buildCellColors', () => {
  const palette: PaletteColor[] = [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ];

  it('maps each cell to its nearest palette color name', () => {
    const grid = [
      [{ r: 250, g: 5, b: 5 }, { r: 5, g: 5, b: 250 }],
      [{ r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 0 }],
    ];
    expect(buildCellColors(grid, palette)).toEqual([
      ['Red', 'Blue'],
      ['Blue', 'Red'],
    ]);
  });

  it('returns an empty grid for an empty input grid', () => {
    expect(buildCellColors([], palette)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pattern/buildPattern.test.ts`
Expected: FAIL — module `./buildPattern` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { RGB } from '../color/lab';
import { findNearestColor } from '../color/nearestMatch';
import { PaletteColor } from '../../types/palette';

export function buildCellColors(grid: RGB[][], palette: PaletteColor[]): string[][] {
  return grid.map((row) => row.map((rgb) => findNearestColor(rgb, palette).name));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pattern/buildPattern.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pattern/buildPattern.ts src/lib/pattern/buildPattern.test.ts
git commit -m "feat: add pure grid-to-pattern-colors mapping"
```

---

### Task 3: Pattern statistics (color counts and completion percent)

**Files:**
- Create: `src/lib/pattern/patternStats.ts`
- Test: `src/lib/pattern/patternStats.test.ts`

**Interfaces:**
- Consumes: `Pattern` from `src/types/pattern.ts`; `Palette`, `PaletteColor` from `src/types/palette.ts`.
- Produces: `ColorCount { name: string; hex: string; count: number }`, `colorCounts(pattern: Pattern, palette: Palette): ColorCount[]` (sorted by descending count, ties broken by name), `completionPercent(pattern: Pattern, palette: Palette): number` (0-100, rounded to nearest integer; 100 when the pattern has zero distinct colors) — used by Task 7 (`HomeScreen`, for the % complete on each pattern card) and Task 11 (`WorkingView`'s sidebar).

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pattern/patternStats.test.ts`
Expected: FAIL — module `./patternStats` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

export interface ColorCount {
  name: string;
  hex: string;
  count: number;
}

function hexFor(palette: Palette, colorName: string): string {
  return palette.colors.find((c) => c.name === colorName)?.hex ?? '#000000';
}

export function colorCounts(pattern: Pattern, palette: Palette): ColorCount[] {
  const counts = new Map<string, number>();
  for (const row of pattern.cellColors) {
    for (const name of row) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, hex: hexFor(palette, name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function completionPercent(pattern: Pattern, palette: Palette): number {
  const distinctColors = colorCounts(pattern, palette);
  if (distinctColors.length === 0) return 100;

  const completed = distinctColors.filter((c) =>
    pattern.completedColors.includes(c.name),
  ).length;

  return Math.round((completed / distinctColors.length) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pattern/patternStats.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pattern/patternStats.ts src/lib/pattern/patternStats.test.ts
git commit -m "feat: add pattern color-count and completion-percent stats"
```

---

### Task 4: Browser image adapters (load + render, not unit-tested)

**Files:**
- Create: `src/lib/image/loadImage.ts`
- Create: `src/lib/image/renderPattern.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `Pattern` from `src/types/pattern.ts`; `Palette` from `src/types/palette.ts`.
- Produces: `loadImageBuffer(file: File): Promise<ImageBuffer>` — used by Task 8 (`UploadStep`); `renderPatternToDataUrl(pattern: Pattern, palette: Palette, options?: { onlyColor?: string; maxSize?: number }): string` — used by Task 10 (thumbnail generation on save) and Task 11 (export/print, filtered by the active color).

This task has no automated tests: both functions depend on browser-only APIs (`Image`, `FileReader`, `HTMLCanvasElement.getContext('2d')`) that `jsdom` does not implement. They are verified manually in Task 13 (final manual verification) by running the app in a real browser. Every function these adapters call into (`Pattern`/`Palette` field access) is plain data access with no logic worth unit-testing in isolation.

- [ ] **Step 1: Create `src/lib/image/loadImage.ts`**

```typescript
import { ImageBuffer } from '../pixelart/blockDetect';

export function loadImageBuffer(file: File): Promise<ImageBuffer> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('loadImageBuffer: could not get 2D canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ width: imageData.width, height: imageData.height, data: imageData.data });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('loadImageBuffer: failed to load image file'));
    };

    img.src = url;
  });
}
```

- [ ] **Step 2: Create `src/lib/image/renderPattern.ts`**

```typescript
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

const CELL_SIZE_PX = 20;

export function renderPatternToDataUrl(
  pattern: Pattern,
  palette: Palette,
  options: { onlyColor?: string; maxSize?: number } = {},
): string {
  const canvas = document.createElement('canvas');
  canvas.width = pattern.cols * CELL_SIZE_PX;
  canvas.height = pattern.rows * CELL_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('renderPatternToDataUrl: could not get 2D canvas context');
  }

  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  for (let row = 0; row < pattern.rows; row++) {
    for (let col = 0; col < pattern.cols; col++) {
      const colorName = pattern.cellColors[row][col];
      const isDimmed = options.onlyColor !== undefined && colorName !== options.onlyColor;
      ctx.fillStyle = isDimmed ? '#e0e0e0' : (hexByName.get(colorName) ?? '#000000');
      ctx.fillRect(col * CELL_SIZE_PX, row * CELL_SIZE_PX, CELL_SIZE_PX, CELL_SIZE_PX);
    }
  }

  if (options.maxSize && canvas.width > options.maxSize) {
    const scaled = document.createElement('canvas');
    const scale = options.maxSize / canvas.width;
    scaled.width = Math.round(canvas.width * scale);
    scaled.height = Math.round(canvas.height * scale);
    const scaledCtx = scaled.getContext('2d');
    if (scaledCtx) {
      scaledCtx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return scaled.toDataURL('image/png');
    }
  }

  return canvas.toDataURL('image/png');
}
```

- [ ] **Step 3: Verify the project still compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/image/loadImage.ts src/lib/image/renderPattern.ts
git commit -m "feat: add browser canvas adapters for image loading and pattern rendering"
```

---

### Task 5: `usePalettes` hook

**Files:**
- Create: `src/hooks/usePalettes.ts`
- Test: `src/hooks/usePalettes.test.ts`

**Interfaces:**
- Consumes: `Palette` from `src/types/palette.ts`; `listPalettes`, `savePalette`, `deletePalette` from `src/lib/storage/palettesRepo.ts`; `ensureDefaultPalette` from `src/lib/storage/initStorage.ts`.
- Produces: `usePalettes(): { palettes: Palette[]; loading: boolean; importPalette(palette: Palette): Promise<void>; removePalette(id: string): Promise<void> }` — used by Task 7 (`HomeScreen`), Task 10 (`NewPatternWizard`), Task 11 (`WorkingView`), Task 12 (`PaletteManageScreen`).

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/usePalettes.test.ts`
Expected: FAIL — module `./usePalettes` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../types/palette';
import { deletePalette, listPalettes, savePalette } from '../lib/storage/palettesRepo';
import { ensureDefaultPalette } from '../lib/storage/initStorage';

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
      await refresh();
    },
    [refresh],
  );

  const removePalette = useCallback(
    async (id: string) => {
      await deletePalette(id);
      await refresh();
    },
    [refresh],
  );

  return { palettes, loading, importPalette, removePalette };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/usePalettes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePalettes.ts src/hooks/usePalettes.test.ts
git commit -m "feat: add usePalettes hook wrapping the palette repository"
```

---

### Task 6: `usePatterns` hook

**Files:**
- Create: `src/hooks/usePatterns.ts`
- Test: `src/hooks/usePatterns.test.ts`

**Interfaces:**
- Consumes: `Pattern` from `src/types/pattern.ts`; `listPatterns`, `savePattern`, `deletePattern`, `setColorCompleted` from `src/lib/storage/patternsRepo.ts`.
- Produces: `usePatterns(): { patterns: Pattern[]; loading: boolean; addPattern(pattern: Pattern): Promise<void>; removePattern(id: string): Promise<void>; toggleColorCompleted(patternId: string, colorName: string, completed: boolean): Promise<void> }` — used by Task 7 (`HomeScreen`), Task 10 (`NewPatternWizard`), Task 11 (`WorkingView`).

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/usePatterns.test.ts`
Expected: FAIL — module `./usePatterns` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { Pattern } from '../types/pattern';
import {
  deletePattern,
  listPatterns,
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

  return { patterns, loading, addPattern, removePattern, toggleColorCompleted };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/usePatterns.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePatterns.ts src/hooks/usePatterns.test.ts
git commit -m "feat: add usePatterns hook wrapping the pattern repository"
```

---

### Task 7: `HomeScreen` component

**Files:**
- Create: `src/components/home/HomeScreen.tsx`
- Test: `src/components/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `usePatterns` from `src/hooks/usePatterns.ts`; `usePalettes` from `src/hooks/usePalettes.ts`; `completionPercent` from `src/lib/pattern/patternStats.ts`.
- Produces: `HomeScreen(props: { onOpenPattern: (patternId: string) => void; onNewPattern: () => void; onManagePalettes: () => void }): JSX.Element` — used by Task 13 (`App.tsx`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette } from '../../lib/storage/palettesRepo';
import { savePattern } from '../../lib/storage/patternsRepo';
import { defaultPalette } from '../../lib/palette/defaultPalette';
import { HomeScreen } from './HomeScreen';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('HomeScreen', () => {
  it('shows an empty state when there are no patterns', async () => {
    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });

  it('lists saved patterns with their completion percent', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My First Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 2,
      cellColors: [[defaultPalette.colors[0].name, defaultPalette.colors[1].name]],
      paletteId: defaultPalette.id,
      completedColors: [defaultPalette.colors[0].name],
      thumbnail: '',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('calls onOpenPattern when a pattern card is clicked', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My First Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[defaultPalette.colors[0].name]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
    });

    const onOpenPattern = vi.fn();
    render(
      <HomeScreen onOpenPattern={onOpenPattern} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());

    await userEvent.click(screen.getByText('My First Pattern'));
    expect(onOpenPattern).toHaveBeenCalledWith('pattern-1');
  });

  it('calls onNewPattern and onManagePalettes when their buttons are clicked', async () => {
    const onNewPattern = vi.fn();
    const onManagePalettes = vi.fn();
    render(
      <HomeScreen
        onOpenPattern={vi.fn()}
        onNewPattern={onNewPattern}
        onManagePalettes={onManagePalettes}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new pattern/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /new pattern/i }));
    expect(onNewPattern).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /manage palettes/i }));
    expect(onManagePalettes).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/HomeScreen.test.tsx`
Expected: FAIL — module `./HomeScreen` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { completionPercent } from '../../lib/pattern/patternStats';

interface HomeScreenProps {
  onOpenPattern: (patternId: string) => void;
  onNewPattern: () => void;
  onManagePalettes: () => void;
}

export function HomeScreen({ onOpenPattern, onNewPattern, onManagePalettes }: HomeScreenProps) {
  const { patterns, loading: patternsLoading } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="home-header">
        <h1>Bead Art Helper</h1>
        <button onClick={onNewPattern}>+ New Pattern</button>
        <button onClick={onManagePalettes}>Manage Palettes</button>
      </div>
      {patterns.length === 0 ? (
        <p>No patterns yet. Create one to get started.</p>
      ) : (
        <ul className="pattern-list">
          {patterns.map((pattern) => {
            const palette = palettes.find((p) => p.id === pattern.paletteId);
            const percent = palette ? completionPercent(pattern, palette) : 0;
            return (
              <li key={pattern.id}>
                <button onClick={() => onOpenPattern(pattern.id)}>
                  {pattern.thumbnail && (
                    <img src={pattern.thumbnail} alt={pattern.name} width={80} height={80} />
                  )}
                  <span>{pattern.name}</span>
                  <span>{percent}% complete</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/HomeScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/HomeScreen.tsx src/components/home/HomeScreen.test.tsx
git commit -m "feat: add HomeScreen listing saved patterns with completion percent"
```

---

### Task 8: `UploadStep` and `GridSizeStep` components

**Files:**
- Create: `src/components/new-pattern/UploadStep.tsx`
- Test: `src/components/new-pattern/UploadStep.test.tsx`
- Create: `src/components/new-pattern/GridSizeStep.tsx`
- Test: `src/components/new-pattern/GridSizeStep.test.tsx`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `loadImageBuffer` from `src/lib/image/loadImage.ts`; `detectBlockSize` from `src/lib/pixelart/blockDetect.ts`; `downsampleToGrid` from `src/lib/pixelart/downsample.ts`; `RGB` from `src/lib/color/lab.ts`.
- Produces: `UploadStep(props: { onImageLoaded: (image: ImageBuffer) => void; loadImage?: (file: File) => Promise<ImageBuffer> }): JSX.Element`; `GridSizeStep(props: { image: ImageBuffer; onGridReady: (grid: RGB[][]) => void }): JSX.Element` — both used by Task 10 (`NewPatternWizard`).

Note: `UploadStep` takes `loadImage` as an optional prop defaulting to the real `loadImageBuffer` adapter, so production code always uses the real canvas-based loader, while tests can inject a fake one — this is how a canvas-dependent component gets real test coverage of its own logic without needing jsdom to implement canvas.

- [ ] **Step 1: Write the failing test for `UploadStep`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadStep } from './UploadStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

describe('UploadStep', () => {
  it('loads the selected file and calls onImageLoaded with the resulting image buffer', async () => {
    const fakeImage: ImageBuffer = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const loadImage = vi.fn().mockResolvedValue(fakeImage);
    const onImageLoaded = vi.fn();
    render(<UploadStep onImageLoaded={onImageLoaded} loadImage={loadImage} />);

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload image/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(onImageLoaded).toHaveBeenCalledWith(fakeImage));
    expect(loadImage).toHaveBeenCalledWith(file);
  });

  it('shows an error message when loading fails', async () => {
    const loadImage = vi.fn().mockRejectedValue(new Error('bad file'));
    render(<UploadStep onImageLoaded={vi.fn()} loadImage={loadImage} />);

    // Use an image-typed fixture, not a .txt/text-plain one: the input below has
    // accept="image/*", and @testing-library/user-event's upload() silently drops
    // files that don't match an input's accept attribute (no change event fires
    // at all) rather than letting the component's own error handling run. The
    // failure here is meant to come from the mocked rejection, not from MIME
    // filtering.
    const file = new File(['fake'], 'corrupted.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload image/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('bad file'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/UploadStep.test.tsx`
Expected: FAIL — module `./UploadStep` does not exist.

- [ ] **Step 3: Write `UploadStep.tsx`**

```typescript
import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { loadImageBuffer } from '../../lib/image/loadImage';

interface UploadStepProps {
  onImageLoaded: (image: ImageBuffer) => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
}

export function UploadStep({ onImageLoaded, loadImage = loadImageBuffer }: UploadStepProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const image = await loadImage(file);
      onImageLoaded(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    }
  };

  return (
    <div>
      <h2>Upload a digital pixel art image</h2>
      <label htmlFor="upload-image-input">Upload image</label>
      <input
        id="upload-image-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/UploadStep.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `GridSizeStep`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridSizeStep } from './GridSizeStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

function makeCheckerboard(blockWidth: number, blockHeight: number, blocksX: number, blocksY: number): ImageBuffer {
  const width = blockWidth * blocksX;
  const height = blockHeight * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockWidth);
      const color = (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('GridSizeStep', () => {
  it('pre-fills the detected block size and shows the resulting grid dimensions', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    expect(screen.getByLabelText(/block width/i)).toHaveValue(3);
    expect(screen.getByLabelText(/block height/i)).toHaveValue(3);
    expect(screen.getByText(/2 × 2 pattern/i)).toBeInTheDocument();
  });

  it('shows a manual-entry warning when no grid can be detected', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4).fill(100);
    render(<GridSizeStep image={{ width, height, data }} onGridReady={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not auto-detect/i);
  });

  it('recomputes the grid dimensions when the block size is changed', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    const widthInput = screen.getByLabelText(/block width/i);
    await userEvent.clear(widthInput);
    await userEvent.type(widthInput, '2');

    expect(screen.getByText(/3 × 2 pattern/i)).toBeInTheDocument();
  });

  it('calls onGridReady with the downsampled grid when Continue is clicked', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const onGridReady = vi.fn();
    render(<GridSizeStep image={image} onGridReady={onGridReady} />);

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onGridReady).toHaveBeenCalledTimes(1);
    const grid = onGridReady.mock.calls[0][0];
    expect(grid).toEqual([
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }],
      [{ r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 0 }],
    ]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/GridSizeStep.test.tsx`
Expected: FAIL — module `./GridSizeStep` does not exist.

- [ ] **Step 7: Write `GridSizeStep.tsx`**

```typescript
import { useState } from 'react';
import { ImageBuffer, detectBlockSize } from '../../lib/pixelart/blockDetect';
import { downsampleToGrid } from '../../lib/pixelart/downsample';
import { RGB } from '../../lib/color/lab';

interface GridSizeStepProps {
  image: ImageBuffer;
  onGridReady: (grid: RGB[][]) => void;
}

function parseBlockDimension(raw: string): number {
  const parsed = parseInt(raw, 10);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

export function GridSizeStep({ image, onGridReady }: GridSizeStepProps) {
  const detected = detectBlockSize(image);
  // The raw input text is tracked separately from the parsed numeric value so the
  // field can hold an empty string while the user is clearing/retyping it. Clamping
  // the value back to a number directly inside onChange (e.g.
  // `setBlockWidth(Math.max(1, Number(e.target.value) || 1))`) forces a controlled
  // input's displayed value back to "1" the instant it's cleared, so the next
  // keystroke appends onto that "1" instead of starting fresh (typing "2" after
  // clearing becomes "12", not "2").
  const [blockWidthInput, setBlockWidthInput] = useState(String(detected?.blockWidth ?? 1));
  const [blockHeightInput, setBlockHeightInput] = useState(String(detected?.blockHeight ?? 1));

  const blockWidth = parseBlockDimension(blockWidthInput);
  const blockHeight = parseBlockDimension(blockHeightInput);

  const cols = Math.ceil(image.width / blockWidth);
  const rows = Math.ceil(image.height / blockHeight);

  const handleContinue = () => {
    onGridReady(downsampleToGrid(image, blockWidth, blockHeight));
  };

  return (
    <div>
      <h2>Confirm grid size</h2>
      {!detected && (
        <p role="alert">Could not auto-detect a grid — please enter the block size manually.</p>
      )}
      <label htmlFor="block-width-input">Block width (px)</label>
      <input
        id="block-width-input"
        type="number"
        min={1}
        value={blockWidthInput}
        onChange={(e) => setBlockWidthInput(e.target.value)}
      />
      <label htmlFor="block-height-input">Block height (px)</label>
      <input
        id="block-height-input"
        type="number"
        min={1}
        value={blockHeightInput}
        onChange={(e) => setBlockHeightInput(e.target.value)}
      />
      <p>
        This will create a {cols} × {rows} pattern.
      </p>
      <button onClick={handleContinue}>Continue</button>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/GridSizeStep.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/new-pattern/UploadStep.tsx src/components/new-pattern/UploadStep.test.tsx src/components/new-pattern/GridSizeStep.tsx src/components/new-pattern/GridSizeStep.test.tsx
git commit -m "feat: add UploadStep and GridSizeStep wizard components"
```

---

### Task 9: `PaletteAssignStep` component

**Files:**
- Create: `src/components/new-pattern/PaletteAssignStep.tsx`
- Test: `src/components/new-pattern/PaletteAssignStep.test.tsx`

**Interfaces:**
- Consumes: `RGB` from `src/lib/color/lab.ts`; `Palette` from `src/types/palette.ts`; `buildCellColors` from `src/lib/pattern/buildPattern.ts`.
- Produces: `PaletteAssignStep(props: { grid: RGB[][]; palette: Palette; onConfirm: (cellColors: string[][]) => void }): JSX.Element` — used by Task 10 (`NewPatternWizard`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaletteAssignStep } from './PaletteAssignStep';
import { Palette } from '../../types/palette';
import { RGB } from '../../lib/color/lab';

describe('PaletteAssignStep', () => {
  const palette: Palette = {
    id: 'p1',
    name: 'Test',
    isBuiltIn: false,
    colors: [
      { name: 'Red', hex: '#ff0000' },
      { name: 'Blue', hex: '#0000ff' },
    ],
  };
  const grid: RGB[][] = [
    [
      { r: 250, g: 5, b: 5 },
      { r: 5, g: 5, b: 250 },
    ],
  ];

  it('auto-matches each cell to the nearest palette color and confirms with them unchanged', async () => {
    const onConfirm = vi.fn();
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    expect(onConfirm).toHaveBeenCalledWith([['Red', 'Blue']]);
  });

  it('lets the user override a cell color by clicking it then a replacement swatch', async () => {
    const onConfirm = vi.fn();
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByLabelText('swatch Blue'));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    expect(onConfirm).toHaveBeenCalledWith([['Blue', 'Blue']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/PaletteAssignStep.test.tsx`
Expected: FAIL — module `./PaletteAssignStep` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useState } from 'react';
import { RGB } from '../../lib/color/lab';
import { Palette } from '../../types/palette';
import { buildCellColors } from '../../lib/pattern/buildPattern';

interface PaletteAssignStepProps {
  grid: RGB[][];
  palette: Palette;
  onConfirm: (cellColors: string[][]) => void;
}

interface SelectedCell {
  row: number;
  col: number;
}

export function PaletteAssignStep({ grid, palette, onConfirm }: PaletteAssignStepProps) {
  const [cellColors, setCellColors] = useState<string[][]>(() =>
    buildCellColors(grid, palette.colors),
  );
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  const handleSwatchClick = (colorName: string) => {
    if (!selectedCell) return;
    setCellColors((prev) => {
      const next = prev.map((row) => [...row]);
      next[selectedCell.row][selectedCell.col] = colorName;
      return next;
    });
    setSelectedCell(null);
  };

  return (
    <div>
      <h2>Review pattern colors</h2>
      <table>
        <tbody>
          {cellColors.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((colorName, colIndex) => (
                <td key={colIndex}>
                  <button
                    aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                    style={{ backgroundColor: hexByName.get(colorName) }}
                    onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedCell && (
        <div role="group" aria-label="Choose a replacement color">
          {palette.colors.map((color) => (
            <button
              key={color.name}
              aria-label={`swatch ${color.name}`}
              style={{ backgroundColor: color.hex }}
              onClick={() => handleSwatchClick(color.name)}
            >
              {color.name}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => onConfirm(cellColors)}>Save Pattern</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/PaletteAssignStep.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/new-pattern/PaletteAssignStep.tsx src/components/new-pattern/PaletteAssignStep.test.tsx
git commit -m "feat: add PaletteAssignStep with per-cell color override"
```

---

### Task 10: `NewPatternWizard` container

**Files:**
- Create: `src/components/new-pattern/NewPatternWizard.tsx`
- Test: `src/components/new-pattern/NewPatternWizard.test.tsx`

**Interfaces:**
- Consumes: `UploadStep` from `./UploadStep`; `GridSizeStep` from `./GridSizeStep`; `PaletteAssignStep` from `./PaletteAssignStep`; `usePalettes` from `src/hooks/usePalettes.ts`; `usePatterns` from `src/hooks/usePatterns.ts`; `renderPatternToDataUrl` from `src/lib/image/renderPattern.ts`; `Pattern` from `src/types/pattern.ts`.
- Produces: `NewPatternWizard(props: { onDone: (patternId: string) => void; onCancel: () => void; loadImage?: (file: File) => Promise<ImageBuffer>; renderThumbnail?: typeof renderPatternToDataUrl; now?: () => string; createId?: () => string }): JSX.Element` — used by Task 13 (`App.tsx`).

This wizard always assigns colors against the built-in default palette (`palettes.find(p => p.isBuiltIn)`) — there is no palette-picker UI in this plan. A custom-palette picker is a natural follow-up once Task 12 (`PaletteManageScreen`) lets users import other palettes, but is out of scope here (YAGNI: no other palette exists to pick from until Task 12 ships).

The `loadImage`, `renderThumbnail`, `now`, and `createId` props all default to the real browser/runtime implementations in production, and exist so tests can drive the full upload→grid→palette→save flow deterministically without touching real canvas APIs or non-deterministic IDs/timestamps — the same dependency-injection pattern `UploadStep` (Task 8) already uses.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { listPatterns } from '../../lib/storage/patternsRepo';
import { NewPatternWizard } from './NewPatternWizard';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makeCheckerboardImage(): ImageBuffer {
  // 2x2 grid of 3x3-pixel red/blue blocks (6x6 total)
  const width = 6;
  const height = 6;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / 3);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / 3);
      const isRed = (blockX + blockY) % 2 === 0;
      const idx = (y * width + x) * 4;
      data[idx] = isRed ? 255 : 0;
      data[idx + 1] = 0;
      data[idx + 2] = isRed ? 0 : 255;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('NewPatternWizard', () => {
  it('walks upload -> grid -> palette -> name -> save, persisting the pattern', async () => {
    const image = makeCheckerboardImage();
    const loadImage = vi.fn().mockResolvedValue(image);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const onDone = vi.fn();

    render(
      <NewPatternWizard
        onDone={onDone}
        onCancel={vi.fn()}
        loadImage={loadImage}
        renderThumbnail={renderThumbnail}
        now={() => '2026-08-02T00:00:00.000Z'}
        createId={() => 'pattern-1'}
      />,
    );

    const file = new File(['fake'], 'pixel-art.png', { type: 'image/png' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByRole('button', { name: /save pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => screen.getByLabelText(/pattern name/i));
    await userEvent.type(screen.getByLabelText(/pattern name/i), 'My Pattern');
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pattern-1'));

    const saved = await listPatterns();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: 'pattern-1',
      name: 'My Pattern',
      rows: 2,
      cols: 2,
      thumbnail: 'data:image/png;base64,thumb',
    });
    expect(renderThumbnail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/NewPatternWizard.test.tsx`
Expected: FAIL — module `./NewPatternWizard` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { RGB } from '../../lib/color/lab';
import { Pattern } from '../../types/pattern';
import { usePalettes } from '../../hooks/usePalettes';
import { usePatterns } from '../../hooks/usePatterns';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { UploadStep } from './UploadStep';
import { GridSizeStep } from './GridSizeStep';
import { PaletteAssignStep } from './PaletteAssignStep';

type WizardStep =
  | { name: 'upload' }
  | { name: 'grid'; image: ImageBuffer }
  | { name: 'palette'; grid: RGB[][] }
  | { name: 'name'; cellColors: string[][] };

interface NewPatternWizardProps {
  onDone: (patternId: string) => void;
  onCancel: () => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
  renderThumbnail?: typeof renderPatternToDataUrl;
  now?: () => string;
  createId?: () => string;
}

export function NewPatternWizard({
  onDone,
  onCancel,
  loadImage,
  renderThumbnail = renderPatternToDataUrl,
  now = () => new Date().toISOString(),
  createId = () => crypto.randomUUID(),
}: NewPatternWizardProps) {
  const { palettes, loading: palettesLoading } = usePalettes();
  const { addPattern } = usePatterns();
  const [step, setStep] = useState<WizardStep>({ name: 'upload' });
  const [patternName, setPatternName] = useState('');

  if (palettesLoading) {
    return <div>Loading...</div>;
  }

  const palette = palettes.find((p) => p.isBuiltIn) ?? palettes[0];

  if (step.name === 'upload') {
    return (
      <UploadStep loadImage={loadImage} onImageLoaded={(image) => setStep({ name: 'grid', image })} />
    );
  }

  if (step.name === 'grid') {
    return (
      <GridSizeStep image={step.image} onGridReady={(grid) => setStep({ name: 'palette', grid })} />
    );
  }

  if (step.name === 'palette') {
    if (!palette) {
      return <p>No palette available.</p>;
    }
    return (
      <PaletteAssignStep
        grid={step.grid}
        palette={palette}
        onConfirm={(cellColors) => setStep({ name: 'name', cellColors })}
      />
    );
  }

  const handleSave = async () => {
    if (!palette) return;
    const rows = step.cellColors.length;
    const cols = step.cellColors[0]?.length ?? 0;
    const pattern: Pattern = {
      id: createId(),
      name: patternName.trim() || 'Untitled Pattern',
      createdAt: now(),
      rows,
      cols,
      cellColors: step.cellColors,
      paletteId: palette.id,
      completedColors: [],
      thumbnail: '',
    };
    pattern.thumbnail = renderThumbnail(pattern, palette, { maxSize: 200 });
    await addPattern(pattern);
    onDone(pattern.id);
  };

  return (
    <div>
      <h2>Name your pattern</h2>
      <label htmlFor="pattern-name-input">Pattern name</label>
      <input
        id="pattern-name-input"
        value={patternName}
        onChange={(e) => setPatternName(e.target.value)}
      />
      <button onClick={handleSave}>Save Pattern</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/NewPatternWizard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/new-pattern/NewPatternWizard.tsx src/components/new-pattern/NewPatternWizard.test.tsx
git commit -m "feat: add NewPatternWizard wiring upload through save"
```

---

### Task 11: `WorkingView` component

**Files:**
- Create: `src/components/working/WorkingView.tsx`
- Test: `src/components/working/WorkingView.test.tsx`

**Interfaces:**
- Consumes: `usePatterns` from `src/hooks/usePatterns.ts`; `usePalettes` from `src/hooks/usePalettes.ts`; `colorCounts`, `completionPercent` from `src/lib/pattern/patternStats.ts`; `renderPatternToDataUrl` from `src/lib/image/renderPattern.ts`.
- Produces: `WorkingView(props: { patternId: string; onBack: () => void; renderExport?: typeof renderPatternToDataUrl }): JSX.Element` — used by Task 13 (`App.tsx`).

Cells carry a `data-dimmed="true"|"false"` attribute (in addition to their background color) specifically so tests can assert the filter state without depending on how a hex color string round-trips through computed CSS (e.g. `#ff0000` vs `rgb(255, 0, 0)`), which is a common source of flaky style assertions.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette } from '../../lib/storage/palettesRepo';
import { savePattern } from '../../lib/storage/patternsRepo';
import { WorkingView } from './WorkingView';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

const palette: Palette = {
  id: 'p1',
  name: 'Test',
  isBuiltIn: false,
  colors: [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ],
};

const pattern: Pattern = {
  id: 'pattern-1',
  name: 'My Pattern',
  createdAt: '2026-08-02T00:00:00.000Z',
  rows: 1,
  cols: 2,
  cellColors: [['Red', 'Blue']],
  paletteId: 'p1',
  completedColors: [],
  thumbnail: '',
};

describe('WorkingView', () => {
  it('renders the color list with counts and completion percent', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Pattern')).toBeInTheDocument());
    expect(screen.getByText('Red × 1')).toBeInTheDocument();
    expect(screen.getByText('Blue × 1')).toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('marks a color complete via its checkbox and updates completion percent', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByLabelText(/mark red complete/i));
    await userEvent.click(screen.getByLabelText(/mark red complete/i));

    await waitFor(() => expect(screen.getByText('50% complete')).toBeInTheDocument());
  });

  it('filters the grid to only the clicked color, dimming the rest', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));

    expect(screen.getByLabelText('cell 0-0, color Red')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByLabelText('cell 0-1, color Blue')).toHaveAttribute('data-dimmed', 'true');
  });

  it('calls renderExport with the active color filter when Export is clicked', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    const renderExport = vi.fn().mockReturnValue('data:image/png;base64,export');
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} renderExport={renderExport} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));
    await userEvent.click(screen.getByRole('button', { name: /export image/i }));

    expect(renderExport).toHaveBeenCalledWith(pattern, palette, { onlyColor: 'Red' });
    expect(screen.getByRole('link', { name: /download image/i })).toHaveAttribute(
      'href',
      'data:image/png;base64,export',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/working/WorkingView.test.tsx`
Expected: FAIL — module `./WorkingView` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';

interface WorkingViewProps {
  patternId: string;
  onBack: () => void;
  renderExport?: typeof renderPatternToDataUrl;
}

export function WorkingView({
  patternId,
  onBack,
  renderExport = renderPatternToDataUrl,
}: WorkingViewProps) {
  const { patterns, loading: patternsLoading, toggleColorCompleted } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

  const pattern = patterns.find((p) => p.id === patternId);
  const palette = pattern ? palettes.find((p) => p.id === pattern.paletteId) : undefined;

  if (!pattern || !palette) {
    return <p>Pattern not found.</p>;
  }

  const counts = colorCounts(pattern, palette);
  const percent = completionPercent(pattern, palette);
  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  const handleExport = () => {
    setExportUrl(renderExport(pattern, palette, { onlyColor: activeColor ?? undefined }));
  };

  return (
    <div>
      <button onClick={onBack}>Back</button>
      <h2>{pattern.name}</h2>
      <p>{percent}% complete</p>
      <table>
        <tbody>
          {pattern.cellColors.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((colorName, colIndex) => {
                const dimmed = activeColor !== null && colorName !== activeColor;
                return (
                  <td key={colIndex}>
                    <div
                      aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                      data-dimmed={dimmed ? 'true' : 'false'}
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: dimmed ? '#e0e0e0' : hexByName.get(colorName),
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        {counts.map((color) => (
          <li key={color.name}>
            <input
              type="checkbox"
              aria-label={`mark ${color.name} complete`}
              checked={pattern.completedColors.includes(color.name)}
              onChange={(e) => toggleColorCompleted(pattern.id, color.name, e.target.checked)}
            />
            <button onClick={() => setActiveColor((prev) => (prev === color.name ? null : color.name))}>
              {color.name} × {color.count}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={handleExport}>Export image</button>
      {exportUrl && (
        <a href={exportUrl} download={`${pattern.name}.png`}>
          Download image
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/working/WorkingView.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/working/WorkingView.tsx src/components/working/WorkingView.test.tsx
git commit -m "feat: add WorkingView with color filtering, completion tracking, and export"
```

---

### Task 12: `PaletteManageScreen` component

**Files:**
- Create: `src/components/palettes/PaletteManageScreen.tsx`
- Test: `src/components/palettes/PaletteManageScreen.test.tsx`

**Interfaces:**
- Consumes: `usePalettes` from `src/hooks/usePalettes.ts`; `parsePaletteCsv` from `src/lib/palette/csv.ts`; `Palette` from `src/types/palette.ts`.
- Produces: `PaletteManageScreen(props: { onBack: () => void; createId?: () => string }): JSX.Element` — used by Task 13 (`App.tsx`). Renaming reuses `importPalette` (an id-keyed upsert) with the palette's existing `id` and a new `name` — there is no separate rename API in the storage layer.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette, listPalettes } from '../../lib/storage/palettesRepo';
import { PaletteManageScreen } from './PaletteManageScreen';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('PaletteManageScreen', () => {
  it('lists the built-in default palette without a delete button', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/default bead palette/i));
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('imports a valid CSV as a new custom palette and lists it', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} createId={() => 'custom-1'} />);
    await waitFor(() => screen.getByLabelText(/palette name/i));

    await userEvent.type(screen.getByLabelText(/palette name/i), 'My Colors');
    await userEvent.type(screen.getByLabelText(/palette csv/i), 'Name,Color{enter}X1,#123456');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText(/My Colors/)).toBeInTheDocument());
    expect(await listPalettes()).toContainEqual(
      expect.objectContaining({ id: 'custom-1', name: 'My Colors' }),
    );
  });

  it('shows row errors and does not import when the CSV has no valid rows', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/palette csv/i));

    await userEvent.type(screen.getByLabelText(/palette csv/i), 'Name,Color{enter}X1,notacolor');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid color/i));
  });

  it('deletes a custom palette', async () => {
    await savePalette({
      id: 'custom-1',
      name: 'Custom',
      isBuiltIn: false,
      colors: [{ name: 'X1', hex: '#123456' }],
    });
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/Custom/));

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText(/Custom/)).not.toBeInTheDocument());
  });

  it('renames a custom palette', async () => {
    await savePalette({
      id: 'custom-1',
      name: 'Custom',
      isBuiltIn: false,
      colors: [{ name: 'X1', hex: '#123456' }],
    });
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/Custom/));

    await userEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByLabelText(/rename custom/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(screen.getByText(/Renamed/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/palettes/PaletteManageScreen.test.tsx`
Expected: FAIL — module `./PaletteManageScreen` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useState } from 'react';
import { usePalettes } from '../../hooks/usePalettes';
import { parsePaletteCsv } from '../../lib/palette/csv';
import { Palette } from '../../types/palette';

interface PaletteManageScreenProps {
  onBack: () => void;
  createId?: () => string;
}

export function PaletteManageScreen({
  onBack,
  createId = () => crypto.randomUUID(),
}: PaletteManageScreenProps) {
  const { palettes, loading, importPalette, removePalette } = usePalettes();
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleImport = async () => {
    const result = parsePaletteCsv(csvText);
    setImportErrors(result.errors);
    if (result.colors.length === 0) return;
    await importPalette({
      id: createId(),
      name: csvName.trim() || 'Imported Palette',
      isBuiltIn: false,
      colors: result.colors,
    });
    setCsvText('');
    setCsvName('');
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await removePalette(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete palette');
    }
  };

  const confirmRename = async (palette: Palette) => {
    await importPalette({ ...palette, name: renameValue.trim() || palette.name });
    setRenamingId(null);
  };

  return (
    <div>
      <button onClick={onBack}>Back</button>
      <h2>Manage Palettes</h2>
      <ul>
        {palettes.map((palette) => (
          <li key={palette.id}>
            {renamingId === palette.id ? (
              <>
                <label htmlFor={`rename-${palette.id}`}>Rename {palette.name}</label>
                <input
                  id={`rename-${palette.id}`}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button onClick={() => confirmRename(palette)}>Save name</button>
              </>
            ) : (
              <>
                <span>
                  {palette.name} ({palette.colors.length} colors)
                </span>
                <button
                  onClick={() => {
                    setRenamingId(palette.id);
                    setRenameValue(palette.name);
                  }}
                >
                  Rename
                </button>
                {!palette.isBuiltIn && (
                  <button onClick={() => handleDelete(palette.id)}>Delete</button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {deleteError && <p role="alert">{deleteError}</p>}

      <h3>Import a palette</h3>
      <label htmlFor="palette-name-input">Palette name</label>
      <input id="palette-name-input" value={csvName} onChange={(e) => setCsvName(e.target.value)} />
      <label htmlFor="palette-csv-input">Palette CSV (Name,Color)</label>
      <textarea id="palette-csv-input" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
      <button onClick={handleImport}>Import</button>
      {importErrors.length > 0 && (
        <ul role="alert">
          {importErrors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/palettes/PaletteManageScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/palettes/PaletteManageScreen.tsx src/components/palettes/PaletteManageScreen.test.tsx
git commit -m "feat: add PaletteManageScreen with CSV import, rename, and delete"
```

---

### Task 13: `App.tsx` navigation shell

**Files:**
- Modify: `src/App.tsx` (replaces the Core Engine plan's placeholder)
- Modify: `src/App.test.tsx` (replaces the Task 1 smoke test with real navigation tests)
- Create: `src/index.css`
- Modify: `src/main.tsx` (import the new stylesheet)

**Interfaces:**
- Consumes: `HomeScreen` from `src/components/home/HomeScreen.tsx`; `NewPatternWizard` from `src/components/new-pattern/NewPatternWizard.tsx`; `WorkingView` from `src/components/working/WorkingView.tsx`; `PaletteManageScreen` from `src/components/palettes/PaletteManageScreen.tsx`.
- Produces: the app's only navigation state — a discriminated `Screen` union switched over in `App.tsx`. Nothing later in this plan consumes this (it's the top of the tree); this is the final task.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from './lib/storage/db';
import { savePalette } from './lib/storage/palettesRepo';
import { savePattern } from './lib/storage/patternsRepo';
import { defaultPalette } from './lib/palette/defaultPalette';
import App from './App';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('App', () => {
  it('renders the Home screen by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/bead art helper/i)).toBeInTheDocument());
  });

  it('navigates to the New Pattern wizard and back to Home', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /new pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /new pattern/i }));

    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });

  it('opens a saved pattern in the Working view and navigates back to Home', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[defaultPalette.colors[0].name]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
    });

    render(<App />);
    await waitFor(() => screen.getByText('My Pattern'));
    await userEvent.click(screen.getByText('My Pattern'));

    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new pattern/i })).toBeInTheDocument(),
    );
  });

  it('navigates to Manage Palettes and back to Home', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /manage palettes/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage palettes/i }));

    await waitFor(() => screen.getByText(/manage palettes/i));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — the current placeholder `App.tsx` renders static text with no buttons/navigation, so `getByRole('button', { name: /new pattern/i })` etc. never appear.

- [ ] **Step 3: Write `src/App.tsx`**

```typescript
import { useState } from 'react';
import { HomeScreen } from './components/home/HomeScreen';
import { NewPatternWizard } from './components/new-pattern/NewPatternWizard';
import { WorkingView } from './components/working/WorkingView';
import { PaletteManageScreen } from './components/palettes/PaletteManageScreen';

type Screen =
  | { name: 'home' }
  | { name: 'new-pattern' }
  | { name: 'working'; patternId: string }
  | { name: 'palettes' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'home') {
    return (
      <HomeScreen
        onOpenPattern={(patternId) => setScreen({ name: 'working', patternId })}
        onNewPattern={() => setScreen({ name: 'new-pattern' })}
        onManagePalettes={() => setScreen({ name: 'palettes' })}
      />
    );
  }

  if (screen.name === 'new-pattern') {
    return (
      <NewPatternWizard
        onDone={(patternId) => setScreen({ name: 'working', patternId })}
        onCancel={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'working') {
    return (
      <WorkingView patternId={screen.patternId} onBack={() => setScreen({ name: 'home' })} />
    );
  }

  return <PaletteManageScreen onBack={() => setScreen({ name: 'home' })} />;
}
```

- [ ] **Step 4: Create `src/index.css`**

```css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
}

button {
  cursor: pointer;
}

table {
  border-collapse: collapse;
}

td {
  padding: 0;
}
```

- [ ] **Step 5: Update `src/main.tsx` to import the stylesheet**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests across the Core Engine plan and this plan pass together.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/index.css src/main.tsx
git commit -m "feat: wire Home, New Pattern wizard, Working view, and palette management into App"
```

---

### Task 14: Manual end-to-end verification in a real browser

**Files:** none (verification only — no code changes expected unless this step surfaces a bug, in which case fix it in the relevant file from an earlier task and re-run this verification).

**Interfaces:** none — this task exercises the whole app built by Tasks 1-13 through a real browser, including the two canvas-based adapters (`loadImageBuffer`, `renderPatternToDataUrl`) that have no automated test coverage per this plan's Global Constraints.

This is the one task in this plan that isn't TDD — everything it exercises already has unit or component test coverage except the real canvas/File-API path, which can only be verified by actually running the app.

- [ ] **Step 1: Create a small test image**

Create a tiny digital pixel-art PNG to upload — e.g. a 4x4-pixel image (at least two distinct flat colors, no anti-aliasing) saved at a larger size with each source pixel blown up to an NxN block (e.g. exported/scaled to 40x40 total, 10px per block) so `detectBlockSize` has a real grid to find. Any image editor or a quick script works; save it somewhere accessible, e.g. `/tmp/test-pixel-art.png`.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` and open the printed local URL in a browser.

- [ ] **Step 3: Walk through the full flow**

1. Confirm the Home screen loads showing "No patterns yet."
2. Click "+ New Pattern", upload the test image from Step 1.
3. Confirm the Grid Size step shows a plausible detected block width/height (matching the image's actual block size) and the correct "R × C pattern" text; adjust the numbers and confirm the count updates live.
4. Click Continue, confirm the Review step shows a grid of colored cells corresponding to the source image's colors, mapped to bead names from the default palette.
5. Click a cell, confirm a swatch picker appears; pick a different color and confirm the cell updates.
6. Click "Save Pattern", type a name, click "Save Pattern" again.
7. Confirm you land on the Working view showing the correct grid, the sidebar listing each color used with counts, and 0% complete.
8. Click a color's name in the sidebar; confirm the grid dims every cell except that color.
9. Check that color's checkbox; confirm the completion percentage updates and the color is visually marked done.
10. Click "Export image"; confirm a "Download image" link appears and that clicking it downloads (or opens) a PNG matching the filtered view.
11. Click "Back"; confirm the Home screen now shows the saved pattern's thumbnail, name, and updated completion percent.
12. Click "Manage Palettes"; confirm the default palette is listed with no delete button; paste a small custom CSV (e.g. `Name,Color\nZ1,#123456`), name it, click Import, and confirm it appears in the list with a working Rename and Delete.

- [ ] **Step 4: Record the result**

If every step in Step 3 behaves as described, note in the commit message (Step 5) which image was used and that all steps passed. If anything fails, fix the underlying file (identify which earlier task's component or adapter is responsible) and re-run this task's Step 3 from the beginning before proceeding.

- [ ] **Step 5: Commit** (only if Step 3/4 required a code fix; otherwise there is nothing to commit for this task)

```bash
git add -A
git commit -m "fix: <describe the bug found during manual end-to-end verification>"
```
