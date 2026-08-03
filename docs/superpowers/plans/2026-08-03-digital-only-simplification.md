# Digital-Only Simplification + UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the photo/OpenCV upload path entirely (digital pixel-art images become the only supported source), and fix two UX issues found during hands-on testing: `GridSizeStep` should ask for pixel-art dimensions directly instead of a source-pixel block size, and `PaletteAssignStep`'s grid cells should be square with a visible color-code label instead of stretched, unlabeled rectangles.

**Architecture:** Task 1 deletes the entire photo-path subsystem (components, OpenCV lib, dependency, vendoring script, test-infra polyfill) and restores `NewPatternWizard` to the single-path shape it had before that subsystem existed. Tasks 2-4 are independent UX fixes to the surviving digital-image flow, each touching one component (plus a small new pure helper for Task 3). Task 5 corrects the project's design spec so it no longer describes a photo path that doesn't exist.

**Tech Stack:** No new dependencies — this plan only removes one (`@techstark/opencv-js`) and modifies existing React/TypeScript/Vitest code.

## Global Constraints

- Full removal, not a hidden/disabled feature — no dead code, no unused dependency, no leftover test-infra additions that existed only to support the removed feature. (Design spec decision, confirmed with user)
- `GridSizeStep`'s new inputs ask for pixel-art dimensions (column/row counts) directly, not a source-pixel block size; auto-detection still runs and pre-fills these fields, converting its block-size result into a column/row count.
- `PaletteAssignStep`'s square-cell/visible-label fix applies to the main pattern grid only — the swatch picker (shown when a cell is selected) is unchanged.
- Text color on each grid cell is chosen by a luminance heuristic: `(0.299r + 0.587g + 0.114b) / 255`; result ≥ 0.5 → black text (`#000000`), below 0.5 → white text (`#ffffff`).
- The raw-string-state pattern for numeric inputs (tracking the input as a string, parsing separately) must be preserved wherever it already exists — do not reintroduce the controlled-input clamping bug this project fixed earlier by clamping a number directly inside `onChange`.

---

### Task 1: Remove the photo path entirely

**Files:**
- Delete: `src/components/new-pattern/SourceTypeStep.tsx`
- Delete: `src/components/new-pattern/SourceTypeStep.test.tsx`
- Delete: `src/components/new-pattern/CornerStep.tsx`
- Delete: `src/components/new-pattern/CornerStep.test.tsx`
- Delete: `src/lib/photo/opencv.ts`
- Delete: `src/lib/photo/quad.ts`
- Delete: `src/lib/photo/quad.test.ts`
- Delete: `src/lib/photo/cornerDetect.ts`
- Delete: `src/lib/photo/perspectiveWarp.ts`
- Delete: `src/lib/photo/sampleWarpedGrid.ts`
- Delete: `src/lib/photo/sampleWarpedGrid.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `vitest.setup.ts`
- Modify: `src/components/new-pattern/NewPatternWizard.tsx`
- Modify: `src/components/new-pattern/NewPatternWizard.test.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `NewPatternWizard`'s restored, simpler prop surface — `{ onDone, onCancel, loadImage?, renderThumbnail?, now?, createId? }` (no `detectCorners`/`sampleGrid`) — and its `WizardStep` union shrinks to `upload | grid | palette | name`. Nothing outside this task consumes anything from `src/lib/photo/` after this task, since that entire directory is deleted.

- [ ] **Step 1: Delete the photo-path source files**

```bash
git rm src/components/new-pattern/SourceTypeStep.tsx src/components/new-pattern/SourceTypeStep.test.tsx
git rm src/components/new-pattern/CornerStep.tsx src/components/new-pattern/CornerStep.test.tsx
git rm -r src/lib/photo/
```

- [ ] **Step 2: Remove the OpenCV dependency and postinstall script from `package.json`**

Remove this line from `dependencies`:

```json
    "@techstark/opencv-js": "^4.10.0-release.1",
```

Remove this line from `scripts`:

```json
    "postinstall": "mkdir -p public && cp node_modules/@techstark/opencv-js/dist/opencv.js public/opencv.js"
```

Run: `npm install` (removes the now-unlisted dependency from `node_modules` and updates `package-lock.json`)

- [ ] **Step 3: Remove the now-unused `public/opencv.js` gitignore entry and local file**

Remove this line from `.gitignore`:

```
public/opencv.js
```

Run: `rm -f public/opencv.js && rmdir public 2>/dev/null; true` (removes the local vendored file; it was never committed to git, so no `git rm` is needed — this is just local cleanup. The `rmdir` removes the now-empty `public/` directory if nothing else is in it; the trailing `; true` keeps the command from failing if the directory isn't empty or doesn't exist.)

- [ ] **Step 4: Remove the `PointerEvent` polyfill from `vitest.setup.ts`**

It existed only to support `CornerStep`'s drag-simulation tests, which are deleted in this task. Replace the full file with:

```typescript
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: Replace `src/components/new-pattern/NewPatternWizard.tsx`**

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

  if (step.name === 'upload') {
    return (
      <div>
        <UploadStep loadImage={loadImage} onImageLoaded={(image) => setStep({ name: 'grid', image })} />
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  if (step.name === 'grid') {
    return (
      <div>
        <GridSizeStep image={step.image} onGridReady={(grid) => setStep({ name: 'palette', grid })} />
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  if (palettesLoading) {
    return <div>Loading...</div>;
  }

  const palette = palettes.find((p) => p.isBuiltIn) ?? palettes[0];

  if (step.name === 'palette') {
    if (!palette) {
      return <p>No palette available.</p>;
    }
    return (
      <div>
        <PaletteAssignStep
          grid={step.grid}
          palette={palette}
          onConfirm={(cellColors) => setStep({ name: 'name', cellColors })}
        />
        <button onClick={onCancel}>Cancel</button>
      </div>
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

- [ ] **Step 6: Replace `src/components/new-pattern/NewPatternWizard.test.tsx`**

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
  });
});
```

- [ ] **Step 7: Fix `src/App.test.tsx`'s navigation test**

The wizard now opens directly on the upload step (no source-type choice). In `src/App.test.tsx`, replace:

```typescript
    await waitFor(() => screen.getByRole('button', { name: /digital pixel art image/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
```

with:

```typescript
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
```

- [ ] **Step 8: Run the full test suite and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests pass (fewer than before, since photo-path tests are gone), no type errors, no references anywhere to `src/lib/photo/`, `SourceTypeStep`, or `CornerStep`.

- [ ] **Step 9: Verify the production build no longer includes OpenCV**

Run: `npm run build && ls dist/opencv.js`
Expected: build succeeds; `ls dist/opencv.js` reports "No such file or directory" (confirming the ~10MB asset is gone from the shipped app).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove the photo upload path, restore digital-only wizard"
```

---

### Task 2: Add `downsampleToGridByCount`

**Files:**
- Modify: `src/lib/pixelart/downsample.ts`
- Modify: `src/lib/pixelart/downsample.test.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `./blockDetect`; `RGB` from `../color/lab` (both already imported in this file for the existing `downsampleToGrid`).
- Produces: `downsampleToGridByCount(image: ImageBuffer, cols: number, rows: number): RGB[][]` — used by Task 3 (`GridSizeStep`). Unlike `downsampleToGrid` (which takes a block size and derives `cols`/`rows` from it via `Math.ceil`), this function takes the cell count directly and computes each cell's pixel boundaries from its index, guaranteeing exactly `cols × rows` cells with no rounding drift from converting a count to a block size and back. `downsampleToGrid` itself is unchanged — this is a new, additional export, not a replacement.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/pixelart/downsample.test.ts` (alongside the existing `describe('downsampleToGrid', ...)` block — add a new `import` and a new `describe` block, don't remove anything):

```typescript
import { downsampleToGridByCount } from './downsample';
```

```typescript
describe('downsampleToGridByCount', () => {
  it('averages each cell to a single color, matching downsampleToGrid for an evenly-divisible case', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const grid = downsampleToGridByCount(image, 2, 2);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 0 },
      ],
    ]);
  });

  it('produces exactly the requested cols x rows with no dropped or duplicated pixels for a non-evenly-divisible count', () => {
    const image = makeSolidColor(10, 10, [100, 150, 200]);
    const grid = downsampleToGridByCount(image, 3, 3);

    expect(grid.length).toBe(3);
    for (const row of grid) {
      expect(row.length).toBe(3);
      for (const cell of row) {
        expect(cell).toEqual({ r: 100, g: 150, b: 200 });
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pixelart/downsample.test.ts`
Expected: FAIL — `downsampleToGridByCount` is not exported from `./downsample`.

- [ ] **Step 3: Add the implementation to `src/lib/pixelart/downsample.ts`**

Add this function to the file, below the existing `downsampleToGrid`:

```typescript
export function downsampleToGridByCount(image: ImageBuffer, cols: number, rows: number): RGB[][] {
  const grid: RGB[][] = [];

  for (let row = 0; row < rows; row++) {
    const startY = Math.floor((row * image.height) / rows);
    const endY = Math.floor(((row + 1) * image.height) / rows);
    const rowColors: RGB[] = [];

    for (let col = 0; col < cols; col++) {
      const startX = Math.floor((col * image.width) / cols);
      const endX = Math.floor(((col + 1) * image.width) / cols);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * image.width + x) * 4;
          sumR += image.data[idx];
          sumG += image.data[idx + 1];
          sumB += image.data[idx + 2];
          count++;
        }
      }

      rowColors.push({
        r: Math.round(sumR / count),
        g: Math.round(sumG / count),
        b: Math.round(sumB / count),
      });
    }
    grid.push(rowColors);
  }

  return grid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pixelart/downsample.test.ts`
Expected: PASS (4 tests: the 2 existing `downsampleToGrid` tests + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pixelart/downsample.ts src/lib/pixelart/downsample.test.ts
git commit -m "feat: add downsampleToGridByCount for exact cols x rows downsampling"
```

---

### Task 3: `GridSizeStep` — ask for pixel-art dimensions directly

**Files:**
- Modify: `src/components/new-pattern/GridSizeStep.tsx`
- Modify: `src/components/new-pattern/GridSizeStep.test.tsx`

**Interfaces:**
- Consumes: `ImageBuffer`, `detectBlockSize` from `src/lib/pixelart/blockDetect.ts`; `downsampleToGridByCount` from `src/lib/pixelart/downsample.ts` (Task 2); `RGB` from `src/lib/color/lab.ts`.
- Produces: `GridSizeStep(props: { image: ImageBuffer; onGridReady: (grid: RGB[][]) => void }): JSX.Element` — same props as before; only its internal UI and the function it calls to build the grid change. Still consumed by `NewPatternWizard` (Task 1) with no changes needed there.

- [ ] **Step 1: Write the failing test**

Replace `src/components/new-pattern/GridSizeStep.test.tsx` with:

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
  it('pre-fills the detected pixel dimensions and shows the resulting grid size', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    expect(screen.getByLabelText(/how many pixels wide/i)).toHaveValue(2);
    expect(screen.getByLabelText(/how many pixels tall/i)).toHaveValue(2);
    expect(screen.getByText(/2 × 2 pattern/i)).toBeInTheDocument();
  });

  it('shows a manual-entry warning when no grid can be detected', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4).fill(100);
    render(<GridSizeStep image={{ width, height, data }} onGridReady={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not auto-detect/i);
  });

  it('recomputes the grid size when the pixel width is changed', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    render(<GridSizeStep image={image} onGridReady={vi.fn()} />);

    const widthInput = screen.getByLabelText(/how many pixels wide/i);
    await userEvent.clear(widthInput);
    await userEvent.type(widthInput, '4');

    expect(screen.getByText(/4 × 2 pattern/i)).toBeInTheDocument();
  });

  it('calls onGridReady with the downsampled grid when Continue is clicked', async () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const onGridReady = vi.fn();
    render(<GridSizeStep image={image} onGridReady={onGridReady} />);

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onGridReady).toHaveBeenCalledTimes(1);
    const grid = onGridReady.mock.calls[0][0];
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 0 },
      ],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/GridSizeStep.test.tsx`
Expected: FAIL — the current component still renders "Block width (px)"/"Block height (px)" labels, so `getByLabelText(/how many pixels wide/i)` etc. don't match anything.

- [ ] **Step 3: Replace `src/components/new-pattern/GridSizeStep.tsx`**

```typescript
import { useState } from 'react';
import { ImageBuffer, detectBlockSize } from '../../lib/pixelart/blockDetect';
import { downsampleToGridByCount } from '../../lib/pixelart/downsample';
import { RGB } from '../../lib/color/lab';

interface GridSizeStepProps {
  image: ImageBuffer;
  onGridReady: (grid: RGB[][]) => void;
}

const DEFAULT_COUNT = 16;

function parsePositiveInt(raw: string): number {
  const parsed = parseInt(raw, 10);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

export function GridSizeStep({ image, onGridReady }: GridSizeStepProps) {
  const detected = detectBlockSize(image);
  const detectedCols = detected ? Math.round(image.width / detected.blockWidth) : null;
  const detectedRows = detected ? Math.round(image.height / detected.blockHeight) : null;

  // The raw input text is tracked separately from the parsed numeric value so the
  // field can hold an empty string while the user is clearing/retyping it — clamping
  // the value back to a number on every keystroke would fight controlled-input
  // reconciliation and corrupt what the user is in the middle of typing.
  const [colsInput, setColsInput] = useState(String(detectedCols ?? DEFAULT_COUNT));
  const [rowsInput, setRowsInput] = useState(String(detectedRows ?? DEFAULT_COUNT));

  const cols = parsePositiveInt(colsInput);
  const rows = parsePositiveInt(rowsInput);

  const handleContinue = () => {
    onGridReady(downsampleToGridByCount(image, cols, rows));
  };

  return (
    <div>
      <h2>Confirm pixel art size</h2>
      {!detected && (
        <p role="alert">Could not auto-detect a grid — please enter the size manually.</p>
      )}
      <label htmlFor="pixel-width-input">How many pixels wide is your pixel art?</label>
      <input
        id="pixel-width-input"
        type="number"
        min={1}
        value={colsInput}
        onChange={(e) => setColsInput(e.target.value)}
      />
      <label htmlFor="pixel-height-input">How many pixels tall is your pixel art?</label>
      <input
        id="pixel-height-input"
        type="number"
        min={1}
        value={rowsInput}
        onChange={(e) => setRowsInput(e.target.value)}
      />
      <p>
        This will create a {cols} × {rows} pattern.
      </p>
      <button onClick={handleContinue}>Continue</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/GridSizeStep.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests pass, no type errors. (`NewPatternWizard`'s test from Task 1 clicks "Continue" on this step without touching the inputs — confirm it still passes, since the auto-detected default for that test's 6×6/3×3-block checkerboard image is still `2 × 2`, matching what it expects.)

- [ ] **Step 6: Commit**

```bash
git add src/components/new-pattern/GridSizeStep.tsx src/components/new-pattern/GridSizeStep.test.tsx
git commit -m "feat: ask for pixel-art dimensions directly instead of block size"
```

---

### Task 4: `PaletteAssignStep` — square cells with visible color-code labels

**Files:**
- Modify: `src/components/new-pattern/PaletteAssignStep.tsx`
- Modify: `src/components/new-pattern/PaletteAssignStep.test.tsx`

**Interfaces:**
- Consumes: `RGB` from `src/lib/color/lab.ts`; `Palette` from `src/types/palette.ts`; `buildCellColors` from `src/lib/pattern/buildPattern.ts` (all unchanged from before).
- Produces: `PaletteAssignStep(props: { grid: RGB[][]; palette: Palette; onConfirm: (cellColors: string[][]) => void }): JSX.Element` — same props and behavior as before (auto-match, click-cell-then-click-swatch override, confirm); only the cell markup/styling changes. Still consumed by `NewPatternWizard` (Task 1) with no changes needed there.

Each cell gets a `data-text-color` attribute (in addition to its `style.color`) specifically so the test can assert on the computed contrast color without depending on how a hex string round-trips through computed CSS — the same pattern `WorkingView`'s `data-hex`/`data-dimmed` attributes already use elsewhere in this codebase, for the same reason.

- [ ] **Step 1: Write the failing test**

Replace `src/components/new-pattern/PaletteAssignStep.test.tsx` with:

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

  it('shows the color code as visible text on each square cell', () => {
    render(<PaletteAssignStep grid={grid} palette={palette} onConfirm={vi.fn()} />);

    const redCell = screen.getByLabelText('cell 0-0, color Red');
    expect(redCell).toHaveTextContent('Red');
    expect(redCell).toHaveStyle({ width: '28px', height: '28px' });
  });

  it('uses dark text on a light background and light text on a dark background', () => {
    const bwPalette: Palette = {
      id: 'p2',
      name: 'BW',
      isBuiltIn: false,
      colors: [
        { name: 'White', hex: '#ffffff' },
        { name: 'Black', hex: '#000000' },
      ],
    };
    const bwGrid: RGB[][] = [
      [
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 },
      ],
    ];
    render(<PaletteAssignStep grid={bwGrid} palette={bwPalette} onConfirm={vi.fn()} />);

    expect(screen.getByLabelText('cell 0-0, color White')).toHaveAttribute(
      'data-text-color',
      '#000000',
    );
    expect(screen.getByLabelText('cell 0-1, color Black')).toHaveAttribute(
      'data-text-color',
      '#ffffff',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/PaletteAssignStep.test.tsx`
Expected: FAIL — the current cells have no text content and no fixed size, so the two new tests fail (the first two tests, unchanged from before, still pass).

- [ ] **Step 3: Replace `src/components/new-pattern/PaletteAssignStep.tsx`**

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

const CELL_SIZE_PX = 28;

function hexToRgbChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function contrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgbChannels(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance >= 0.5 ? '#000000' : '#ffffff';
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
              {row.map((colorName, colIndex) => {
                const hex = hexByName.get(colorName) ?? '#000000';
                const textColor = contrastTextColor(hex);
                return (
                  <td key={colIndex}>
                    <button
                      aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                      data-text-color={textColor}
                      onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                      style={{
                        width: CELL_SIZE_PX,
                        height: CELL_SIZE_PX,
                        padding: 0,
                        border: '1px solid #999',
                        backgroundColor: hex,
                        color: textColor,
                        fontSize: 9,
                      }}
                    >
                      {colorName}
                    </button>
                  </td>
                );
              })}
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
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/new-pattern/PaletteAssignStep.tsx src/components/new-pattern/PaletteAssignStep.test.tsx
git commit -m "feat: render square cells with visible color-code labels in PaletteAssignStep"
```

---

### Task 5: Update the design spec to remove the photo path

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-bead-art-helper-design.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the Purpose section**

Replace:

```markdown
A tool to make fuse/perler bead art easier. The user photographs a hand-drawn
pixel art design (on grid paper) or supplies an existing digital pixel art
image. The app detects the grid, quantizes each cell to the nearest color in
a bead palette (starting from the user's own ~215-color CSV), and then acts
as a build guide: view the pattern one color at a time and check off colors
as they're completed.
```

with:

```markdown
A tool to make fuse/perler bead art easier. The user supplies a digital
pixel art image. The app detects the grid, quantizes each cell to the
nearest color in a bead palette (starting from the user's own ~215-color
CSV), and then acts as a build guide: view the pattern one color at a time
and check off colors as they're completed.
```

- [ ] **Step 2: Update the Approach section**

Replace:

```markdown
- **Canvas API** for image manipulation (drawing, sampling, cropping,
  downsampling).
- **OpenCV.js** (WASM) for the photo path: grid-line/quadrilateral detection
  and perspective warp.
- **IndexedDB** (via `idb` or similar) for storing patterns and palettes.
- **Deployment**: static build, deployable to any static host (Vercel /
  Netlify / GitHub Pages). No server, no database, no secrets.

Rejected alternatives:
- **Web frontend + backend (Python/OpenCV)** — adds hosting/deployment
  complexity for no real benefit; the manual-correction step already
  compensates for imperfect client-side detection.
- **No grid-line detection, corners-only** — pushes too much manual work
  onto the user for every photo; a decent auto-guess is achievable and
  worth building.
```

with:

```markdown
- **Canvas API** for image manipulation (drawing, sampling, cropping,
  downsampling).
- **IndexedDB** (via `idb` or similar) for storing patterns and palettes.
- **Deployment**: static build, deployable to any static host (Vercel /
  Netlify / GitHub Pages). No server, no database, no secrets.

Rejected alternatives:
- **Web frontend + backend (Python/OpenCV)** — adds hosting/deployment
  complexity for no real benefit.
- **Photo-of-a-drawing upload path** (OpenCV.js grid/corner detection and
  perspective warp) — built and shipped, then removed after hands-on
  testing; digital pixel art images cover the actual use case, and the
  OpenCV dependency added significant weight and complexity for a path
  that wasn't needed.
```

- [ ] **Step 3: Update the New Pattern flow section**

Replace:

```markdown
### New Pattern flow
1. **Upload** — choose a photo (grid drawing) or digital pixel art image;
   select which type it is.
2. **Grid Detection & Correction**
   - *Digital image path*: auto-detect block size, show pixelated preview,
     numeric override for rows/columns if the guess is wrong.
   - *Photo path*: overlay auto-detected quadrilateral as 4 draggable corner
     handles on the photo, plus +/- steppers for row/column count. Live
     preview of the perspective-warped, gridded result as corners/counts are
     adjusted.
3. **Palette assignment** — pick palette to match against (default: user's
   CSV). Show resulting pattern with each cell mapped to nearest palette
   color.
4. **Cell override** — click any cell to manually reassign its color from
   the palette.
5. **Save** — name the pattern, save to IndexedDB, land on Working view.
```

with:

```markdown
### New Pattern flow
1. **Upload** — choose a digital pixel art image.
2. **Grid size confirmation** — auto-detect the pixel-art dimensions (how
   many pixels wide/tall the artwork is), pre-filling that guess; numeric
   override if the guess is wrong.
3. **Palette assignment** — pick palette to match against (default: user's
   CSV). Show resulting pattern with each cell mapped to nearest palette
   color.
4. **Cell override** — click any cell to manually reassign its color from
   the palette.
5. **Save** — name the pattern, save to IndexedDB, land on Working view.
```

- [ ] **Step 4: Update the Data Flow & Detection Algorithm section**

Replace:

```markdown
## Data Flow & Detection Algorithm

### Digital pixel art path
1. Load image onto canvas.
2. Detect repeating pixel block size: scan rows/columns for color-change
   boundaries, find most common run-length (or use autocorrelation on pixel
   differences) → block width/height in source pixels.
3. Downsample: average (or median) color within each detected block → one
   RGB value per grid cell.
4. User can override detected row/column count; re-runs downsampling at the
   corrected grid size.

### Photo path
1. Load photo onto canvas, run through OpenCV.js: grayscale → adaptive
   threshold/Canny edge detection → Hough line transform to find dominant
   horizontal/vertical lines → intersect to estimate the grid's 4 outer
   corners and approximate row/column count.
2. Show corners as draggable handles over the photo; user nudges to match
   the real grid, adjusts row/column count with +/- steppers.
3. On confirm: perspective-warp (`cv.warpPerspective`) the photo flat using
   the 4 corners, divide into confirmed rows × columns, average color
   sampled from the center region of each cell (avoiding grid
   lines/shadows at cell edges).

### Color matching (both paths)
```

with:

```markdown
## Data Flow & Detection Algorithm

### Digital pixel art path
1. Load image onto canvas.
2. Detect repeating pixel block size: scan rows/columns for color-change
   boundaries, find most common run-length (or use autocorrelation on pixel
   differences) → block width/height in source pixels, converted to a
   pixel-art column/row count for display.
3. Downsample: average (or median) color within each cell → one RGB value
   per grid cell.
4. User can override the detected column/row count directly (asked as "how
   many pixels wide/tall is your pixel art", not a source-pixel block
   size); re-runs downsampling at the corrected grid size.

### Color matching
```

- [ ] **Step 5: Update the Error Handling & Edge Cases section**

Replace:

```markdown
- **Bad photo (too blurry/dark for line detection)**: if OpenCV can't
  confidently find a quadrilateral, fall back to the user manually placing
  all 4 corners on the raw photo, rather than blocking the flow.
- **Non-rectangular photo crop / extreme perspective**: handled generically
  by the perspective warp, which doesn't assume a specific angle.
- **Ambiguous digital pixel-art block size** (anti-aliased or resized image
  with no clean blocks): fall back to a manual "enter grid size" numeric
  input.
```

with:

```markdown
- **Ambiguous digital pixel-art block size** (anti-aliased or resized image
  with no clean blocks): fall back to a manual "enter grid size" numeric
  input.
```

- [ ] **Step 6: Update the "Very large source images" edge case**

Replace:

```markdown
- **Very large source images**: downscale working canvas to a max dimension
  (e.g. 2000px) before processing, to keep OpenCV.js performant in-browser.
```

with:

```markdown
- **Very large source images**: downscale working canvas to a max dimension
  (e.g. 2000px) before processing, to keep in-browser image processing
  performant.
```

- [ ] **Step 7: Update the Testing Approach section**

Replace:

```markdown
- **Manual/visual verification**: OpenCV.js-dependent parts (corner
  detection, perspective warp) tested against real sample photos (varied
  angles/lighting) and digital pixel art images during development.
```

with:

```markdown
- **Manual/visual verification**: canvas-dependent parts (image loading,
  thumbnail/export rendering) tested against real digital pixel art images
  during development.
```

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-bead-art-helper-design.md
git commit -m "docs: remove photo path from the design spec"
```
