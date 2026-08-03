# Photo Grid Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the photo path to the New Pattern wizard: photograph a hand-drawn grid, auto-detect its four corners, let the user drag them into place and adjust row/column counts, then perspective-warp and sample the grid into the same `RGB[][]` shape the digital-image path already produces — converging back into the existing, already-built palette-assignment/save flow.

**Architecture:** Isolate every OpenCV.js-dependent operation (loading the WASM runtime, corner/line detection, perspective warp) behind small adapter functions, exactly like the Core Engine and Digital App UI plans isolated canvas/File-API code — these are not unit-tested (jsdom has no WASM/canvas-decode support for this), and are verified manually in this plan's final task. Everything else — quadrilateral geometry, coordinate scaling/clamping, and sampling an *already-warped* flat image into a color grid — is pure logic with full unit test coverage. The wizard gains one new initial step (choose "Digital image" vs "Photo of a drawing"); both branches reuse the existing `UploadStep`, and both converge on the existing `PaletteAssignStep` and save flow untouched.

**Tech Stack:** `@techstark/opencv-js` (new dependency — an ESM/TS-friendly npm distribution of OpenCV.js's WASM build, dynamically imported so its ~10MB payload is never loaded for users who only use the digital-image path). Reuses React 19, Vitest, `@testing-library/react` from the prior two plans.

## Global Constraints

- Fully client-side app — no backend/server. (Design spec §1)
- OpenCV.js is loaded via `@techstark/opencv-js`, dynamically imported (`await import(...)`) inside the loader module, never as a static top-level import — so it is only fetched/compiled when a user actually chooses the photo path. (Design spec §1, performance)
- Corner/line detection and perspective warp are OpenCV-dependent adapters with **no automated tests** — verified manually in this plan's final task, per the same convention established in the Digital App UI plan's Task 4 (`loadImageBuffer`, `renderPatternToDataUrl`). Everything downstream or independent of OpenCV (geometry helpers, warped-grid sampling, corner-drag UI state) has full unit/component test coverage.
- When corner auto-detection fails or is inconclusive, fall back to the user manually placing all 4 corners (starting from the image's own bounding box) rather than blocking the flow. (Design spec §4, error handling)
- The photo path must produce the exact same `RGB[][]` grid shape the digital-image path already produces (`downsampleToGrid`'s return type), so it can feed directly into the existing `PaletteAssignStep` with zero changes to that component.
- Do not modify `PaletteAssignStep`, the wizard's `name`/save step, `WorkingView`, `HomeScreen`, or `PaletteManageScreen` — this plan only adds a new initial wizard step and a new grid-acquisition step; everything past color-grid acquisition is already built and out of scope.

---

### Task 1: OpenCV.js dependency and loader module

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `src/lib/photo/opencv.ts`
- Create (gitignored, regenerated on `npm install`): `public/opencv.js`

**Interfaces:**
- Produces: `loadOpenCv(): Promise<OpenCvModule>` — a memoized loader that appends a `<script>` tag for the vendored `/opencv.js` static asset and resolves once its WASM runtime has finished initializing. Used by Task 4 (`cornerDetect.ts`) and Task 5 (`perspectiveWarp.ts`).

**Important — this task's original design (dynamic `import('@techstark/opencv-js')`) does not work and must not be used.** During this task's own manual verification, `import('@techstark/opencv-js')` was found to hang indefinitely — never resolving, never throwing — when loaded through Vite's dependency pre-bundling (esbuild). The Emscripten-generated UMD/CJS glue code's Node-vs-browser environment detection appears to misfire under esbuild's CJS interop shims (consistent with `vite build` separately warning that this package's `fs`/`path`/`crypto` requires were "externalized for browser compatibility" — a sign the bundler is treating parts of it as Node-targeted code). This was confirmed by isolating the exact same `opencv.js` file in a minimal static HTML page with a plain `<script>` tag, which resolved in under a second — proving the OpenCV.js build itself and the ready-detection logic are both fine; only loading it *through the bundler's module system* is broken.

**The fix, and what this task actually builds:** vendor the compiled `opencv.js` (from `node_modules/@techstark/opencv-js/dist/opencv.js`) as a static asset at `public/opencv.js`, regenerated automatically by a `postinstall` script on every `npm install` (not committed to git — same treatment as `node_modules`, since it's a deterministic byproduct of the pinned dependency version) — and load it at runtime by appending a real `<script>` element to `document.head`, never via `import()`. The `@techstark/opencv-js` npm dependency is kept only as the pinned source `postinstall` copies from; nothing in the app imports it as a module.

This task has no automated test — loading and initializing a real WASM module is exactly the kind of browser-only side effect this plan's Global Constraints exclude from Vitest coverage. Instead, verify it manually (see Step 5) — this is what caught the `import()` hang above before Tasks 4/5/7 could be built on top of a broken foundation.

- [ ] **Step 1: Add the dependency and postinstall script**

Add to `package.json`'s `dependencies` (alongside the existing entries):

```json
    "@techstark/opencv-js": "^4.10.0-release.1"
```

Add a `postinstall` script to `package.json`'s `scripts` (alongside the existing entries):

```json
    "postinstall": "cp node_modules/@techstark/opencv-js/dist/opencv.js public/opencv.js"
```

Add `public/opencv.js` to `.gitignore` (alongside the existing entries):

```
public/opencv.js
```

Run: `npm install` (this both installs the dependency and runs the new `postinstall` script, which should copy the file into place)

Expected: `ls public/opencv.js` shows a ~10MB file now exists.

- [ ] **Step 2: Create `src/lib/photo/opencv.ts`**

```typescript
// OpenCvModule is intentionally loosely typed: this whole module is a
// browser/WASM adapter with no automated test coverage (see Global
// Constraints) — callers should treat it as `any`-shaped and rely on manual
// verification, not the type checker, to catch misuse here.
type OpenCvModule = any;

// Loaded via a plain <script> tag against the vendored /opencv.js static
// asset (see public/opencv.js), NOT via `import('@techstark/opencv-js')`.
// A dynamic import of that package hangs indefinitely when it goes through
// Vite's dependency pre-bundling (esbuild) — the Emscripten-generated
// UMD/CJS glue code's Node-vs-browser environment detection appears to
// misfire under esbuild's CJS interop shims (Vite's build step separately
// externalizes this package's `fs`/`path`/`crypto` requires for browser
// compatibility, which are consistent with it taking a broken Node-style
// code path). Loading the same file via a real <script> tag — bypassing
// the bundler's module system entirely — was verified to work reliably.
const OPENCV_SCRIPT_URL = '/opencv.js';

let cvPromise: Promise<OpenCvModule> | null = null;

export function loadOpenCv(): Promise<OpenCvModule> {
  if (!cvPromise) {
    cvPromise = new Promise<OpenCvModule>((resolve, reject) => {
      const existing = (window as unknown as { cv?: OpenCvModule }).cv;
      if (existing && existing.Mat) {
        resolve(existing);
        return;
      }

      const script = document.createElement('script');
      script.src = OPENCV_SCRIPT_URL;
      script.onerror = () => reject(new Error(`loadOpenCv: failed to load ${OPENCV_SCRIPT_URL}`));
      script.onload = () => {
        const cv = (window as unknown as { cv?: OpenCvModule }).cv;
        if (!cv) {
          reject(new Error('loadOpenCv: script loaded but did not set window.cv'));
          return;
        }
        if (cv.Mat) {
          resolve(cv);
        } else {
          cv.onRuntimeInitialized = () => resolve(cv);
        }
      };
      document.head.appendChild(script);
    });
  }
  return cvPromise;
}
```

- [ ] **Step 3: Verify the project still compiles and the existing suite passes**

Run: `npx tsc -b && npm test`
Expected: no type errors; all existing tests (70 at this point) still pass (this task adds no new automated tests of its own).

- [ ] **Step 4: Verify the production build includes the vendored asset**

Run: `npm run build && ls dist/opencv.js`
Expected: build succeeds, and `dist/opencv.js` exists (Vite copies everything under `public/` verbatim into `dist/`) — this is what the real deployed app will serve.

- [ ] **Step 5: Manually verify the loader resolves with a working OpenCV module in a real browser**

Run: `npm run dev`, open the dev server in a browser, and temporarily add this to `src/main.tsx` (above the `createRoot(...)` call), then remove it once verified:

```typescript
import { loadOpenCv } from './lib/photo/opencv';

loadOpenCv()
  .then((cv) =>
    console.log(
      'OpenCV ready: Mat=' + typeof cv.Mat + ' imread=' + typeof cv.imread +
      ' matFromImageData=' + typeof cv.matFromImageData + ' Canny=' + typeof cv.Canny +
      ' getPerspectiveTransform=' + typeof cv.getPerspectiveTransform +
      ' warpPerspective=' + typeof cv.warpPerspective,
    ),
  )
  .catch((err) => console.error('OpenCV load failed:', err));
```

Expected: the console logs `OpenCV ready: Mat=function imread=function matFromImageData=function Canny=function getPerspectiveTransform=function warpPerspective=function` — confirming every OpenCV method Tasks 4 and 5 need is present and callable. If this doesn't appear within a reasonable time, or the browser tab becomes unresponsive, do not assume the fix is broken without further isolation — cross-check against a minimal static HTML page loading the same `public/opencv.js` via a plain `<script>` tag outside of Vite/React entirely (this was how the `import()` hang was originally distinguished from a real OpenCV.js problem). If that isolated test also fails, the loader itself needs further investigation; if it succeeds while the in-app test doesn't, the discrepancy may be specific to the test environment rather than the code, and can reasonably be deferred to Task 9's full end-to-end verification once the whole photo path exists to exercise it through real user interaction.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json src/lib/photo/opencv.ts
git commit -m "feat: add OpenCV.js dependency and vendored script-tag loader"
```

---

### Task 2: Pure quad geometry and coordinate scaling helpers

**Files:**
- Create: `src/lib/photo/quad.ts`
- Test: `src/lib/photo/quad.test.ts`

**Interfaces:**
- Produces: `Point { x: number; y: number }`, `Quad { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }`, `defaultQuad(width: number, height: number): Quad`, `clampPoint(point: Point, width: number, height: number): Point`, `computeDisplayScale(imageWidth: number, maxDisplayWidth: number): number`, `toDisplayPoint(point: Point, scale: number): Point`, `toImagePoint(point: Point, scale: number): Point` — `Quad` is used by Task 4 (`cornerDetect.ts`) and Task 5 (`perspectiveWarp.ts`) as their shared corner type; all of these functions (including `defaultQuad` for the `null`-fallback case) are used by Task 7 (`CornerStep`) for the draggable-corner overlay's coordinate math.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  defaultQuad,
  clampPoint,
  computeDisplayScale,
  toDisplayPoint,
  toImagePoint,
} from './quad';

describe('defaultQuad', () => {
  it('returns the four corners of the image bounding box', () => {
    expect(defaultQuad(100, 50)).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomRight: { x: 100, y: 50 },
      bottomLeft: { x: 0, y: 50 },
    });
  });
});

describe('clampPoint', () => {
  it('leaves an in-bounds point unchanged', () => {
    expect(clampPoint({ x: 50, y: 20 }, 100, 50)).toEqual({ x: 50, y: 20 });
  });

  it('clamps a point below zero up to zero', () => {
    expect(clampPoint({ x: -10, y: -5 }, 100, 50)).toEqual({ x: 0, y: 0 });
  });

  it('clamps a point beyond the bounds down to the max', () => {
    expect(clampPoint({ x: 200, y: 999 }, 100, 50)).toEqual({ x: 100, y: 50 });
  });
});

describe('computeDisplayScale', () => {
  it('returns 1 (no upscaling) when the image is already narrower than the max', () => {
    expect(computeDisplayScale(400, 600)).toBe(1);
  });

  it('returns a fraction that scales a wider image down to the max width', () => {
    expect(computeDisplayScale(1200, 600)).toBe(0.5);
  });
});

describe('toDisplayPoint / toImagePoint', () => {
  it('scales a point down for display and back up for image coordinates', () => {
    const imagePoint = { x: 400, y: 200 };
    const scale = 0.5;
    const displayPoint = toDisplayPoint(imagePoint, scale);
    expect(displayPoint).toEqual({ x: 200, y: 100 });
    expect(toImagePoint(displayPoint, scale)).toEqual(imagePoint);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/photo/quad.test.ts`
Expected: FAIL — module `./quad` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export function defaultQuad(width: number, height: number): Quad {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: width, y: 0 },
    bottomRight: { x: width, y: height },
    bottomLeft: { x: 0, y: height },
  };
}

export function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height),
  };
}

export function computeDisplayScale(imageWidth: number, maxDisplayWidth: number): number {
  return Math.min(1, maxDisplayWidth / imageWidth);
}

export function toDisplayPoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

export function toImagePoint(point: Point, scale: number): Point {
  return { x: point.x / scale, y: point.y / scale };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/photo/quad.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo/quad.ts src/lib/photo/quad.test.ts
git commit -m "feat: add pure quad geometry and display-scaling helpers"
```

---

### Task 3: Pure center-inset sampling of an already-warped grid

**Files:**
- Create: `src/lib/photo/sampleWarpedGrid.ts`
- Test: `src/lib/photo/sampleWarpedGrid.test.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `RGB` from `src/lib/color/lab.ts`.
- Produces: `sampleWarpedGrid(image: ImageBuffer, rows: number, cols: number): RGB[][]` — used by Task 7 (`CornerStep`), composed with Task 5's `warpPerspective` to turn a photo into the same `RGB[][]` shape the digital-image path already produces.

Unlike `downsampleToGrid` (Core Engine plan), which averages an entire cell, this function averages only the **center-inset** region of each cell — a fixed 30% margin on every side — because a perspective-warped photo of a hand-drawn grid has real grid lines and shadows near each cell's edges that would otherwise pollute the average color.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { sampleWarpedGrid } from './sampleWarpedGrid';
import { ImageBuffer } from '../pixelart/blockDetect';
import { RGB } from '../color/lab';

function makeGridWithBorders(
  cellSize: number,
  rows: number,
  cols: number,
  colors: RGB[][],
  borderColor: RGB,
): ImageBuffer {
  const width = cellSize * cols;
  const height = cellSize * rows;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cellSize);
    const localY = y % cellSize;
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / cellSize);
      const localX = x % cellSize;
      const isBorder = localX < 2 || localX >= cellSize - 2 || localY < 2 || localY >= cellSize - 2;
      const color = isBorder ? borderColor : colors[row][col];
      const idx = (y * width + x) * 4;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('sampleWarpedGrid', () => {
  it('averages only the center-inset region of each cell, ignoring a 2px border of noise', () => {
    const colors: RGB[][] = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 255, b: 0 },
        { r: 255, g: 255, b: 0 },
      ],
    ];
    const image = makeGridWithBorders(10, 2, 2, colors, { r: 0, g: 0, b: 0 });

    expect(sampleWarpedGrid(image, 2, 2)).toEqual(colors);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/photo/sampleWarpedGrid.test.ts`
Expected: FAIL — module `./sampleWarpedGrid` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { ImageBuffer } from '../pixelart/blockDetect';
import { RGB } from '../color/lab';

const INSET_FRACTION = 0.3;

export function sampleWarpedGrid(image: ImageBuffer, rows: number, cols: number): RGB[][] {
  const cellWidth = image.width / cols;
  const cellHeight = image.height / rows;

  const grid: RGB[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowColors: RGB[] = [];
    for (let col = 0; col < cols; col++) {
      const cellStartX = col * cellWidth;
      const cellStartY = row * cellHeight;
      const insetX = cellWidth * INSET_FRACTION;
      const insetY = cellHeight * INSET_FRACTION;

      const startX = Math.floor(cellStartX + insetX);
      const endX = Math.ceil(cellStartX + cellWidth - insetX);
      const startY = Math.floor(cellStartY + insetY);
      const endY = Math.ceil(cellStartY + cellHeight - insetY);

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

Run: `npx vitest run src/lib/photo/sampleWarpedGrid.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo/sampleWarpedGrid.ts src/lib/photo/sampleWarpedGrid.test.ts
git commit -m "feat: add center-inset color sampling for a warped grid image"
```

---

### Task 4: OpenCV-based corner detection

**Files:**
- Create: `src/lib/photo/cornerDetect.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `Quad` from `src/lib/photo/quad.ts`; `loadOpenCv` from `src/lib/photo/opencv.ts`.
- Produces: `detectCorners(image: ImageBuffer): Promise<Quad | null>` — used by Task 7 (`CornerStep`) to pre-fill the draggable corner overlay; returns `null` when no confident quadrilateral is found, which `CornerStep` handles by falling back to `defaultQuad` (Task 2) per the Global Constraints' manual-fallback requirement.

**Implementation note — a deliberate deviation from the design spec's literal algorithm description:** the design spec describes "Canny edge detection → Hough line transform → intersect to estimate corners." This task instead uses **contour detection + polygon approximation** (grayscale → blur → Canny → `findContours` → `approxPolyDP` → pick the largest 4-sided contour) — the standard "document scanner" technique for finding a photographed rectangle's corners. It achieves the same functional goal (a `Quad` from a photo) with less code and fewer failure modes than manually classifying Hough lines into horizontal/vertical groups and computing pairwise intersections. This task does **not** attempt to estimate a row/column count from line spacing (the design spec's "approximate row/column count") — that estimation step is skipped as an unnecessary complexity given the user already has full manual control over row/column count via steppers in `CornerStep` (Task 7), which start from a reasonable fixed default rather than a computed guess.

This task has no automated test — it is entirely OpenCV/WASM-driven image processing on real photo pixels, which cannot be meaningfully faked in Vitest. It is verified manually in Task 9 against real photos.

- [ ] **Step 1: Write `src/lib/photo/cornerDetect.ts`**

```typescript
import { ImageBuffer } from '../pixelart/blockDetect';
import { Point, Quad } from './quad';
import { loadOpenCv } from './opencv';

function orderQuadPoints(points: Point[]): Quad {
  const byY = [...points].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = byY.slice(2, 4).sort((a, b) => a.x - b.x);
  return {
    topLeft: top[0],
    topRight: top[1],
    bottomLeft: bottom[0],
    bottomRight: bottom[1],
  };
}

export async function detectCorners(image: ImageBuffer): Promise<Quad | null> {
  const cv = await loadOpenCv();

  const src = cv.matFromImageData({
    width: image.width,
    height: image.height,
    data: image.data,
  });
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.Canny(blurred, edges, 50, 150);
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  let bestQuad: Quad | null = null;
  let bestArea = 0;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const perimeter = cv.arcLength(contour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > bestArea) {
        bestArea = area;
        const points: Point[] = [];
        for (let p = 0; p < 4; p++) {
          points.push({ x: approx.data32S[p * 2], y: approx.data32S[p * 2 + 1] });
        }
        bestQuad = orderQuadPoints(points);
      }
    }

    approx.delete();
    contour.delete();
  }

  src.delete();
  gray.delete();
  blurred.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();

  // Require the detected quad to cover a reasonable fraction of the photo —
  // a tiny 4-sided contour (a stray mark, a corner of a shadow) is not a
  // credible detection of "the grid drawing" and should fall back to manual
  // placement instead of confidently returning garbage.
  const minArea = image.width * image.height * 0.1;
  if (!bestQuad || bestArea < minArea) {
    return null;
  }

  return bestQuad;
}
```

- [ ] **Step 2: Verify the project still compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/photo/cornerDetect.ts
git commit -m "feat: add OpenCV-based grid corner detection from a photo"
```

---

### Task 5: OpenCV-based perspective warp

**Files:**
- Create: `src/lib/photo/perspectiveWarp.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `Quad` from `src/lib/photo/quad.ts`; `loadOpenCv` from `src/lib/photo/opencv.ts`.
- Produces: `warpPerspective(image: ImageBuffer, corners: Quad, outputWidth: number, outputHeight: number): Promise<ImageBuffer>` — flattens the quadrilateral region of `image` bounded by `corners` into a rectangular `outputWidth`×`outputHeight` image. Used by Task 7 (`CornerStep`), composed with Task 3's `sampleWarpedGrid`.

This task has no automated test, for the same reason as Task 4 — real OpenCV/WASM image processing. Verified manually in Task 9.

- [ ] **Step 1: Write `src/lib/photo/perspectiveWarp.ts`**

```typescript
import { ImageBuffer } from '../pixelart/blockDetect';
import { Quad } from './quad';
import { loadOpenCv } from './opencv';

export async function warpPerspective(
  image: ImageBuffer,
  corners: Quad,
  outputWidth: number,
  outputHeight: number,
): Promise<ImageBuffer> {
  const cv = await loadOpenCv();

  const src = cv.matFromImageData({
    width: image.width,
    height: image.height,
    data: image.data,
  });

  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    corners.topLeft.x,
    corners.topLeft.y,
    corners.topRight.x,
    corners.topRight.y,
    corners.bottomRight.x,
    corners.bottomRight.y,
    corners.bottomLeft.x,
    corners.bottomLeft.y,
  ]);
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    outputWidth,
    0,
    outputWidth,
    outputHeight,
    0,
    outputHeight,
  ]);

  const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, transform, new cv.Size(outputWidth, outputHeight));

  // Copy the pixel data out into a plain, detached buffer before deleting
  // `dst` — its underlying memory is freed by `.delete()`, and `dst.data`
  // is only a view into that memory until then.
  const result: ImageBuffer = {
    width: outputWidth,
    height: outputHeight,
    data: new Uint8ClampedArray(dst.data),
  };

  src.delete();
  srcPoints.delete();
  dstPoints.delete();
  transform.delete();
  dst.delete();

  return result;
}
```

- [ ] **Step 2: Verify the project still compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/photo/perspectiveWarp.ts
git commit -m "feat: add OpenCV-based perspective warp from quad corners to a flat image"
```

---

### Task 6: `SourceTypeStep` component

**Files:**
- Create: `src/components/new-pattern/SourceTypeStep.tsx`
- Test: `src/components/new-pattern/SourceTypeStep.test.tsx`

**Interfaces:**
- Produces: `SourceTypeStep(props: { onSelect: (sourceType: 'digital' | 'photo') => void }): JSX.Element` — used by Task 8 (`NewPatternWizard`) as the wizard's new first step.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceTypeStep } from './SourceTypeStep';

describe('SourceTypeStep', () => {
  it('calls onSelect with "digital" when the digital option is clicked', async () => {
    const onSelect = vi.fn();
    render(<SourceTypeStep onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /digital pixel art image/i }));

    expect(onSelect).toHaveBeenCalledWith('digital');
  });

  it('calls onSelect with "photo" when the photo option is clicked', async () => {
    const onSelect = vi.fn();
    render(<SourceTypeStep onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /photo of a drawing/i }));

    expect(onSelect).toHaveBeenCalledWith('photo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/SourceTypeStep.test.tsx`
Expected: FAIL — module `./SourceTypeStep` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
interface SourceTypeStepProps {
  onSelect: (sourceType: 'digital' | 'photo') => void;
}

export function SourceTypeStep({ onSelect }: SourceTypeStepProps) {
  return (
    <div>
      <h2>What are you uploading?</h2>
      <button onClick={() => onSelect('digital')}>Digital pixel art image</button>
      <button onClick={() => onSelect('photo')}>Photo of a drawing</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/SourceTypeStep.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/new-pattern/SourceTypeStep.tsx src/components/new-pattern/SourceTypeStep.test.tsx
git commit -m "feat: add SourceTypeStep for choosing digital image vs photo"
```

---

### Task 7: `CornerStep` component

**Files:**
- Create: `src/components/new-pattern/CornerStep.tsx`
- Test: `src/components/new-pattern/CornerStep.test.tsx`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `RGB` from `src/lib/color/lab.ts`; `Point`, `Quad`, `defaultQuad`, `clampPoint`, `computeDisplayScale`, `toDisplayPoint`, `toImagePoint` from `src/lib/photo/quad.ts`; `detectCorners` from `src/lib/photo/cornerDetect.ts`; `warpPerspective` from `src/lib/photo/perspectiveWarp.ts`; `sampleWarpedGrid` from `src/lib/photo/sampleWarpedGrid.ts`.
- Produces: `CornerStep(props: { image: ImageBuffer; onGridReady: (grid: RGB[][]) => void; detectCorners?: (image: ImageBuffer) => Promise<Quad | null>; sampleGrid?: (image: ImageBuffer, corners: Quad, rows: number, cols: number) => Promise<RGB[][]> }): JSX.Element` — used by Task 8 (`NewPatternWizard`).

This component's row/column number inputs use the same raw-string-state pattern as `GridSizeStep` (Digital App UI plan, Task 8) — tracking `rowsInput`/`colsInput` as strings and parsing them separately from the controlled value — to avoid the exact controlled-input clamping bug discovered and fixed there (clamping directly inside `onChange` corrupts the field when a user clears it and retypes).

The `detectCorners` and `sampleGrid` props both default to the real OpenCV-based implementations (`sampleGrid`'s real default composes `warpPerspective` + `sampleWarpedGrid`), and exist purely for testability — this is the same dependency-injection pattern used throughout the Digital App UI plan for canvas/crypto/Date side effects. Drawing the photo onto the preview `<canvas>` is wrapped in a `ctx` null-check (jsdom returns `null` from `getContext('2d')`), so the drag/stepper/continue logic is fully testable even though the visual paint itself silently no-ops under test — verified for real only in Task 9.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CornerStep } from './CornerStep';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { Quad } from '../../lib/photo/quad';
import { RGB } from '../../lib/color/lab';

function makeImage(width: number, height: number): ImageBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

const sampleQuad: Quad = {
  topLeft: { x: 10, y: 10 },
  topRight: { x: 190, y: 10 },
  bottomRight: { x: 190, y: 190 },
  bottomLeft: { x: 10, y: 190 },
};

describe('CornerStep', () => {
  it('shows a detecting message before corner detection resolves', () => {
    const detectCorners = vi.fn().mockReturnValue(new Promise(() => {}));
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    expect(screen.getByText(/detecting grid/i)).toBeInTheDocument();
  });

  it('renders a draggable handle for each detected corner', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('topLeft handle')).toBeInTheDocument());
    expect(screen.getByLabelText('topRight handle')).toBeInTheDocument();
    expect(screen.getByLabelText('bottomRight handle')).toBeInTheDocument();
    expect(screen.getByLabelText('bottomLeft handle')).toBeInTheDocument();
  });

  it('falls back to the image bounding box when detection finds nothing', async () => {
    const detectCorners = vi.fn().mockResolvedValue(null);
    render(
      <CornerStep
        image={makeImage(200, 100)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('topLeft handle')).toBeInTheDocument());
    // Image is 200x100, narrower than the max display width, so scale is 1:1.
    expect(screen.getByLabelText('topLeft handle')).toHaveStyle({ left: '-8px', top: '-8px' });
    expect(screen.getByLabelText('bottomRight handle')).toHaveStyle({ left: '192px', top: '92px' });
  });

  it('dragging a handle updates its position', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    render(
      <CornerStep
        image={makeImage(200, 200)}
        onGridReady={vi.fn()}
        detectCorners={detectCorners}
        sampleGrid={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('topLeft handle'));

    const handle = screen.getByLabelText('topLeft handle');
    const container = handle.parentElement!;
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.pointerDown(handle);
    fireEvent.pointerMove(container, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(container);

    expect(handle).toHaveStyle({ left: '42px', top: '52px' });
  });

  it('calls sampleGrid with the entered rows/cols and confirms with the resulting grid', async () => {
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    const resultGrid: RGB[][] = [[{ r: 1, g: 2, b: 3 }]];
    const sampleGrid = vi.fn().mockResolvedValue(resultGrid);
    const onGridReady = vi.fn();
    const image = makeImage(200, 200);
    render(
      <CornerStep
        image={image}
        onGridReady={onGridReady}
        detectCorners={detectCorners}
        sampleGrid={sampleGrid}
      />,
    );
    await waitFor(() => screen.getByLabelText('topLeft handle'));

    const rowsInput = screen.getByLabelText(/rows/i);
    await userEvent.clear(rowsInput);
    await userEvent.type(rowsInput, '5');
    const colsInput = screen.getByLabelText(/columns/i);
    await userEvent.clear(colsInput);
    await userEvent.type(colsInput, '6');

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(onGridReady).toHaveBeenCalledWith(resultGrid));
    expect(sampleGrid).toHaveBeenCalledWith(image, sampleQuad, 5, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/CornerStep.test.tsx`
Expected: FAIL — module `./CornerStep` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { useEffect, useRef, useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { RGB } from '../../lib/color/lab';
import {
  Point,
  Quad,
  defaultQuad,
  clampPoint,
  computeDisplayScale,
  toDisplayPoint,
  toImagePoint,
} from '../../lib/photo/quad';
import { detectCorners as detectCornersReal } from '../../lib/photo/cornerDetect';
import { warpPerspective } from '../../lib/photo/perspectiveWarp';
import { sampleWarpedGrid } from '../../lib/photo/sampleWarpedGrid';

const MAX_DISPLAY_WIDTH = 600;
const CELL_SAMPLE_SIZE = 50;
const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;

type CornerKey = keyof Quad;

interface CornerStepProps {
  image: ImageBuffer;
  onGridReady: (grid: RGB[][]) => void;
  detectCorners?: (image: ImageBuffer) => Promise<Quad | null>;
  sampleGrid?: (image: ImageBuffer, corners: Quad, rows: number, cols: number) => Promise<RGB[][]>;
}

function parsePositiveInt(raw: string): number {
  const parsed = parseInt(raw, 10);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

async function sampleGridReal(
  image: ImageBuffer,
  corners: Quad,
  rows: number,
  cols: number,
): Promise<RGB[][]> {
  const warped = await warpPerspective(
    image,
    corners,
    cols * CELL_SAMPLE_SIZE,
    rows * CELL_SAMPLE_SIZE,
  );
  return sampleWarpedGrid(warped, rows, cols);
}

export function CornerStep({
  image,
  onGridReady,
  detectCorners = detectCornersReal,
  sampleGrid = sampleGridReal,
}: CornerStepProps) {
  const [corners, setCorners] = useState<Quad | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [rowsInput, setRowsInput] = useState(String(DEFAULT_ROWS));
  const [colsInput, setColsInput] = useState(String(DEFAULT_COLS));
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState<CornerKey | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rows = parsePositiveInt(rowsInput);
  const cols = parsePositiveInt(colsInput);
  const scale = computeDisplayScale(image.width, MAX_DISPLAY_WIDTH);
  const displayWidth = image.width * scale;
  const displayHeight = image.height * scale;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectCorners(image);
      if (cancelled) return;
      setCorners(detected ?? defaultQuad(image.width, image.height));
      setDetecting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [image, detectCorners]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }, [image]);

  if (detecting || !corners) {
    return <div>Detecting grid…</div>;
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const displayPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const imagePoint = clampPoint(toImagePoint(displayPoint, scale), image.width, image.height);
    setCorners({ ...corners, [dragging]: imagePoint });
  };

  const handleContinue = async () => {
    setProcessing(true);
    const grid = await sampleGrid(image, corners, rows, cols);
    onGridReady(grid);
  };

  const cornerEntries = Object.entries(corners) as [CornerKey, Point][];

  return (
    <div>
      <h2>Adjust the grid corners</h2>
      <div
        style={{ position: 'relative', width: displayWidth, height: displayHeight }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragging(null)}
      >
        <canvas
          ref={canvasRef}
          width={image.width}
          height={image.height}
          style={{ width: displayWidth, height: displayHeight }}
        />
        {cornerEntries.map(([key, point]) => {
          const displayPoint = toDisplayPoint(point, scale);
          return (
            <div
              key={key}
              role="button"
              aria-label={`${key} handle`}
              onPointerDown={() => setDragging(key)}
              style={{
                position: 'absolute',
                left: displayPoint.x - 8,
                top: displayPoint.y - 8,
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: 'red',
                cursor: 'grab',
              }}
            />
          );
        })}
      </div>
      <label htmlFor="photo-rows-input">Rows</label>
      <input
        id="photo-rows-input"
        type="number"
        min={1}
        value={rowsInput}
        onChange={(e) => setRowsInput(e.target.value)}
      />
      <label htmlFor="photo-cols-input">Columns</label>
      <input
        id="photo-cols-input"
        type="number"
        min={1}
        value={colsInput}
        onChange={(e) => setColsInput(e.target.value)}
      />
      <button onClick={handleContinue} disabled={processing}>
        {processing ? 'Processing…' : 'Continue'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/CornerStep.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/new-pattern/CornerStep.tsx src/components/new-pattern/CornerStep.test.tsx
git commit -m "feat: add CornerStep with draggable corner overlay for the photo path"
```

---

### Task 8: Wire `SourceTypeStep` and `CornerStep` into `NewPatternWizard`

**Files:**
- Modify: `src/components/new-pattern/NewPatternWizard.tsx`
- Modify: `src/components/new-pattern/NewPatternWizard.test.tsx`

**Interfaces:**
- Consumes: `SourceTypeStep` from `./SourceTypeStep` (Task 6); `CornerStep` from `./CornerStep` (Task 7); `Quad` from `src/lib/photo/quad.ts`; everything the wizard already consumed from the Digital App UI plan (`UploadStep`, `GridSizeStep`, `PaletteAssignStep`, `usePalettes`, `usePatterns`, `renderPatternToDataUrl`).
- Produces: `NewPatternWizard` gains two new optional props, `detectCorners?` and `sampleGrid?`, forwarded straight through to `CornerStep` — the same dependency-injection forwarding the wizard already does for `UploadStep`'s `loadImage`. This is what lets the photo-path wizard test stay fast and deterministic instead of exercising real OpenCV.js.

The wizard's step flow becomes: `source-type` → `upload` (shared by both source types) → `grid` (digital) **or** `corners` (photo) → `palette` (shared, unchanged) → `name` (shared, unchanged). Only the first three steps are new or modified; `palette` and `name` are untouched.

- [ ] **Step 1: Update the failing/passing test file**

Replace `src/components/new-pattern/NewPatternWizard.test.tsx` with:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { listPatterns } from '../../lib/storage/patternsRepo';
import { NewPatternWizard } from './NewPatternWizard';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { Quad } from '../../lib/photo/quad';
import { RGB } from '../../lib/color/lab';

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
  it('walks source-type -> digital -> upload -> grid -> palette -> name -> save, persisting the pattern', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /digital pixel art image/i }));

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

  it('walks source-type -> photo -> upload -> corners -> palette -> name -> save, persisting the pattern', async () => {
    const image: ImageBuffer = { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4) };
    const loadImage = vi.fn().mockResolvedValue(image);
    const sampleQuad: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 200, y: 0 },
      bottomRight: { x: 200, y: 200 },
      bottomLeft: { x: 0, y: 200 },
    };
    const detectCorners = vi.fn().mockResolvedValue(sampleQuad);
    const resultGrid: RGB[][] = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 255, b: 0 },
        { r: 255, g: 255, b: 0 },
      ],
    ];
    const sampleGrid = vi.fn().mockResolvedValue(resultGrid);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    const onDone = vi.fn();

    render(
      <NewPatternWizard
        onDone={onDone}
        onCancel={vi.fn()}
        loadImage={loadImage}
        detectCorners={detectCorners}
        sampleGrid={sampleGrid}
        renderThumbnail={renderThumbnail}
        now={() => '2026-08-02T00:00:00.000Z'}
        createId={() => 'pattern-1'}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /photo of a drawing/i }));

    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.upload(screen.getByLabelText(/upload image/i), file);

    await waitFor(() => screen.getByLabelText('topLeft handle'));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByRole('button', { name: /save pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => screen.getByLabelText(/pattern name/i));
    await userEvent.type(screen.getByLabelText(/pattern name/i), 'Photo Pattern');
    await userEvent.click(screen.getByRole('button', { name: /save pattern/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('pattern-1'));

    expect(sampleGrid).toHaveBeenCalledWith(image, sampleQuad, 10, 10);
    const saved = await listPatterns();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Photo Pattern');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/new-pattern/NewPatternWizard.test.tsx`
Expected: FAIL — the current wizard has no `source-type` step, so `getByRole('button', { name: /digital pixel art image/i })` never appears.

- [ ] **Step 3: Replace `src/components/new-pattern/NewPatternWizard.tsx`**

```typescript
import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { RGB } from '../../lib/color/lab';
import { Quad } from '../../lib/photo/quad';
import { Pattern } from '../../types/pattern';
import { usePalettes } from '../../hooks/usePalettes';
import { usePatterns } from '../../hooks/usePatterns';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { SourceTypeStep } from './SourceTypeStep';
import { UploadStep } from './UploadStep';
import { GridSizeStep } from './GridSizeStep';
import { CornerStep } from './CornerStep';
import { PaletteAssignStep } from './PaletteAssignStep';

type WizardStep =
  | { name: 'source-type' }
  | { name: 'upload'; sourceType: 'digital' | 'photo' }
  | { name: 'grid'; image: ImageBuffer }
  | { name: 'corners'; image: ImageBuffer }
  | { name: 'palette'; grid: RGB[][] }
  | { name: 'name'; cellColors: string[][] };

interface NewPatternWizardProps {
  onDone: (patternId: string) => void;
  onCancel: () => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
  detectCorners?: (image: ImageBuffer) => Promise<Quad | null>;
  sampleGrid?: (image: ImageBuffer, corners: Quad, rows: number, cols: number) => Promise<RGB[][]>;
  renderThumbnail?: typeof renderPatternToDataUrl;
  now?: () => string;
  createId?: () => string;
}

export function NewPatternWizard({
  onDone,
  onCancel,
  loadImage,
  detectCorners,
  sampleGrid,
  renderThumbnail = renderPatternToDataUrl,
  now = () => new Date().toISOString(),
  createId = () => crypto.randomUUID(),
}: NewPatternWizardProps) {
  const { palettes, loading: palettesLoading } = usePalettes();
  const { addPattern } = usePatterns();
  const [step, setStep] = useState<WizardStep>({ name: 'source-type' });
  const [patternName, setPatternName] = useState('');

  if (palettesLoading) {
    return <div>Loading...</div>;
  }

  const palette = palettes.find((p) => p.isBuiltIn) ?? palettes[0];

  if (step.name === 'source-type') {
    return (
      <div>
        <SourceTypeStep onSelect={(sourceType) => setStep({ name: 'upload', sourceType })} />
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  if (step.name === 'upload') {
    return (
      <div>
        <UploadStep
          loadImage={loadImage}
          onImageLoaded={(image) =>
            setStep(
              step.sourceType === 'digital' ? { name: 'grid', image } : { name: 'corners', image },
            )
          }
        />
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

  if (step.name === 'corners') {
    return (
      <div>
        <CornerStep
          image={step.image}
          onGridReady={(grid) => setStep({ name: 'palette', grid })}
          detectCorners={detectCorners}
          sampleGrid={sampleGrid}
        />
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/new-pattern/NewPatternWizard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Fix the now-broken `App.test.tsx` navigation test**

Running the full suite at this point will fail one test in `src/App.test.tsx`: `'navigates to the New Pattern wizard and back to Home'` currently waits for `screen.getByLabelText(/upload image/i)` immediately after clicking "+ New Pattern", but the wizard now opens on the new `source-type` step first. Since that step also renders a Cancel button (added in Step 3 above), the simplest fix is to assert on the source-type step's own content and cancel from there — no need to also pick a source type just to test that Cancel returns to Home. In `src/App.test.tsx`, replace:

```typescript
    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
```

with:

```typescript
    await waitFor(() => screen.getByRole('button', { name: /digital pixel art image/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
```

- [ ] **Step 6: Run the full test suite and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests pass, including the fixed `App.test.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/new-pattern/NewPatternWizard.tsx src/components/new-pattern/NewPatternWizard.test.tsx src/App.test.tsx
git commit -m "feat: add source-type selection and photo corner-detection branch to the wizard"
```

---

### Task 9: Manual end-to-end verification in a real browser

**Files:** none (verification only — no code changes expected unless this step surfaces a bug, in which case fix it in the relevant file from an earlier task and re-run this verification).

**Interfaces:** none — this task exercises the whole photo path built by Tasks 1-8 through a real browser, including every OpenCV.js-dependent piece (`loadOpenCv`, `detectCorners`, `warpPerspective`) that has no automated test coverage per this plan's Global Constraints.

This is the one task in this plan that isn't TDD — it's the safety net for the entire OpenCV-dependent subsystem. The same approach (manual browser verification as the final task, no code changes expected) was used for the Digital App UI plan's canvas adapters and passed cleanly on the first try; this task follows the same pattern for the harder photo/corner-detection path. Note that Task 1's own manual verification already surfaced and fixed one real bug in this subsystem (the OpenCV.js loading approach) — this task is the point where that fix, plus everything built on top of it, gets exercised together for the first time through actual user interaction.

- [ ] **Step 1: Create a synthetic "photo" test image**

A real phone photo of a hand-drawn grid works best if you have one available — use that instead of the steps below if so. Otherwise, create a synthetic stand-in that simulates one: a colored grid rendered inside a non-axis-aligned quadrilateral (to simulate a camera angle) on a neutral background, so both corner detection and the perspective warp have something real to do. For example, using Python with Pillow:

```python
from PIL import Image, ImageDraw

# Background representing a desk/table surface
photo = Image.new('RGB', (800, 600), (180, 170, 150))
draw = ImageDraw.Draw(photo)

# A quadrilateral (simulating a slightly angled camera view of a grid on
# paper) with a 5x5 grid of colored cells drawn inside it via a perspective
# mapping — for a quick approximation, draw the grid as a skewed polygon
# per cell using PIL's polygon fill, going row by row, column by column,
# interpolating the four corners of the whole grid to get each cell's four
# corners. Corners of the overall grid quadrilateral, clockwise from top-left:
corners = [(150, 100), (650, 130), (620, 480), (120, 460)]

def lerp(p0, p1, t):
    return (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)

def cell_corner(row, col, rows, cols):
    top = lerp(corners[0], corners[1], col / cols)
    bottom = lerp(corners[3], corners[2], col / cols)
    left_edge = lerp(top, bottom, row / rows)
    top2 = lerp(corners[0], corners[1], (col + 1) / cols)
    bottom2 = lerp(corners[3], corners[2], (col + 1) / cols)
    right_edge = lerp(top2, bottom2, row / rows)
    left_edge2 = lerp(top, bottom, (row + 1) / rows)
    right_edge2 = lerp(top2, bottom2, (row + 1) / rows)
    return [left_edge, right_edge, right_edge2, left_edge2]

rows, cols = 5, 5
palette_colors = [(230, 60, 60), (60, 140, 230), (250, 220, 60), (60, 200, 100), (240, 240, 240)]
for r in range(rows):
    for c in range(cols):
        color = palette_colors[(r + c) % len(palette_colors)]
        draw.polygon(cell_corner(r, c, rows, cols), fill=color, outline=(30, 30, 30))

photo.save('/tmp/test-grid-photo.png')
```

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` and open the printed local URL in a browser.

- [ ] **Step 3: Walk through the full photo-path flow**

1. From the Home screen, click "+ New Pattern".
2. Confirm the new "What are you uploading?" step appears with "Digital pixel art image" and "Photo of a drawing" options.
3. Click "Photo of a drawing", then upload the test image from Step 1.
4. Confirm a brief "Detecting grid…" message appears, then the photo displays with 4 draggable corner handles. Whether or not detection found the grid precisely, confirm the handles are visible and sitting at plausible positions (either roughly on the grid's corners, or at the image's own bounding box if detection fell back).
5. Drag each handle to align precisely with the true corners of the drawn grid in the test image (or the physical photo's grid, if using a real one).
6. Set the row/column count to match the actual grid (5 and 5, if using the Step 1 test image); confirm the number inputs accept clearing and retyping without corrupting the value (this exercises the same input pattern fixed in the Digital App UI plan).
7. Click "Continue"; confirm a brief "Processing…" state, then the Review step appears showing a grid of colored cells.
8. Compare the reviewed colors against the test image's actual cell colors (row-by-row, per the `palette_colors` cycle in Step 1's script, if using the generated image) — confirm they're a reasonable match. Perfect per-cell accuracy isn't expected from a synthetic/skewed test image, but the overall color pattern should clearly correspond to the source grid, not be scrambled or uniformly wrong.
9. Click a cell, confirm the swatch picker appears (same interaction as the digital path), pick a different color, confirm it updates.
10. Click "Save Pattern", name it, click "Save Pattern" again; confirm you land on the Working view showing the expected grid and sidebar.
11. Click "Back"; confirm the Home screen lists the new pattern with a thumbnail.
12. Repeat steps 1-3 but click "Digital pixel art image" this time (with any digital test image from the Digital App UI plan's manual verification) and confirm that path still works unchanged — this plan's `source-type` step must not have broken it.

- [ ] **Step 4: Record the result**

If every step in Step 3 behaves as described, note in the commit message (Step 5) which image was used and that all steps passed. If anything fails — corner detection consistently unusable, warp producing a garbled/wrong-orientation image, cell colors bearing no relation to the source, dragging misbehaving, or the digital path regressing — fix the underlying file (identify which earlier task's component or adapter is responsible) and re-run this task's Step 3 from the beginning before proceeding.

- [ ] **Step 5: Commit** (only if Step 3/4 required a code fix; otherwise there is nothing to commit for this task)

```bash
git add -A
git commit -m "fix: <describe the bug found during manual photo-path verification>"
```
