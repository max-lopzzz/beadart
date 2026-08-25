# Digital-Only Simplification + UX Fixes — Design Spec

> Date: 2026-08-03
> Status: Approved for planning

## Purpose

Three changes based on hands-on testing of the app:

1. Remove the "photo of a drawing" upload path entirely — digital pixel-art images are the only supported source going forward.
2. Replace `GridSizeStep`'s "block width/height in source pixels" inputs with a more intuitive "how many pixels wide/tall is your pixel art" question (i.e. ask for column/row counts directly).
3. Fix `PaletteAssignStep`'s pattern grid: cells render as stretched rectangles with no visible label, making it unclear which color code is which. Cells should be square with the color code visible as text.

## 1. Remove the photo path (full removal)

**Delete:**
- `src/components/new-pattern/SourceTypeStep.tsx` + `.test.tsx`
- `src/components/new-pattern/CornerStep.tsx` + `.test.tsx`
- `src/lib/photo/` (entire directory: `opencv.ts`, `quad.ts` + `.test.ts`, `cornerDetect.ts`, `perspectiveWarp.ts`, `sampleWarpedGrid.ts` + `.test.ts`)
- `public/opencv.js` (vendored asset)

**Modify:**
- `package.json` — remove the `@techstark/opencv-js` dependency and the `postinstall` script that vendors it.
- `.gitignore` — remove the `public/opencv.js` entry (no longer produced by anything).
- `vitest.setup.ts` — remove the `PointerEvent` polyfill (it existed only for `CornerStep`'s drag-simulation tests; no other test uses pointer events).
- `src/components/new-pattern/NewPatternWizard.tsx` — remove the `source-type` and `corners` step variants and the `detectCorners`/`sampleGrid` props. The wizard's `WizardStep` union shrinks to `upload | grid | palette | name`, and it now starts at `{ name: 'upload' }` instead of `{ name: 'source-type' }`. `UploadStep`'s `onImageLoaded` always transitions to `{ name: 'grid', image }` (no branching).
- `src/components/new-pattern/NewPatternWizard.test.tsx` — remove the photo-path test; the remaining (digital) test no longer clicks a source-type button first, since the wizard opens directly on the upload step.
- `src/App.test.tsx` — the navigation test that currently clicks "Digital pixel art image" before cancelling goes back to waiting on the upload step directly (matching the wizard's restored single-path shape).
- `docs/superpowers/specs/2026-08-02-bead-art-helper-design.md` — remove the "Photo path" sections (algorithm description, error handling for detection failure, screens/flow steps that reference photos) so the design doc doesn't describe a feature that no longer exists. Keep everything about the digital-image path unchanged.

**Out of scope:** the already-merged `docs/superpowers/plans/2026-08-02-photo-grid-detection.md` implementation plan is left as-is (historical record of what was built and why) — only the *design spec* is corrected, not the plan history.

## 2. `GridSizeStep`: ask for pixel-art dimensions directly

**Current behavior:** shows "Block width (px)" / "Block height (px)", pre-filled from `detectBlockSize`'s guess (in source-image pixels), and derives `cols`/`rows` by dividing the image dimensions by the block size.

**New behavior:** ask "How many pixels wide is your pixel art?" / "How many pixels tall is your pixel art?" — i.e. the inputs become `cols`/`rows` directly (art-pixel counts, not source-pixel block sizes). Auto-detection still runs: `detectBlockSize`'s result is converted to an initial `cols`/`rows` guess (`Math.round(image.width / detected.blockWidth)`, same for height) and used to pre-fill the two inputs. If detection fails (returns `null`), the inputs default to a reasonable flat guess (e.g. `16`) with the existing "Could not auto-detect a grid" alert still shown.

**New pure function needed:** `downsampleToGridByCount(image: ImageBuffer, cols: number, rows: number): RGB[][]` in `src/lib/pixelart/downsample.ts`, alongside the existing `downsampleToGrid`. Rather than reusing `downsampleToGrid` by back-computing a `blockWidth = image.width / cols` (which risks an off-by-one from floating-point rounding when `downsampleToGrid` re-derives `cols` via `Math.ceil(image.width / blockWidth)`), the new function computes each cell's pixel boundaries directly from its index and the target count (`startX = Math.floor(col * image.width / cols)`, `endX = Math.floor((col + 1) * image.width / cols)`, same pattern for rows), guaranteeing exactly `cols × rows` cells with no rounding drift. `downsampleToGrid` itself is unchanged and untouched — nothing else in the app calls it after this change (only `GridSizeStep` did), but removing it is out of scope; it stays as an already-tested, working function.

The row/column inputs keep the existing raw-string-state pattern (avoiding the controlled-input clamping bug fixed earlier in this project).

## 3. `PaletteAssignStep`: square cells with visible color-code labels

**Current behavior:** each cell is a `<button>` with no explicit size and no text content, inside a `<td>` — table auto-sizing stretches cells into thin rectangles, and the color code is only in `aria-label` (not visible).

**New behavior:** each cell button gets a fixed `width`/`height` (28×28px) making it square regardless of table layout, and renders its color code as visible text content. Text color is computed per-cell from the background color's perceptual brightness (simple luminance heuristic: `(0.299r + 0.587g + 0.114b) / 255`; result ≥ 0.5 → black text, below 0.5 → white text) so the code stays readable against both light and dark bead colors. This is a small presentational helper local to `PaletteAssignStep.tsx` — not shared elsewhere, since nothing else currently needs it.

Scoped to the main grid only. The swatch picker (the list of palette colors shown when a cell is selected) already displays its color codes as visible button text and is unchanged.

## Testing

- `downsampleToGridByCount` gets a unit test mirroring `downsampleToGrid`'s existing checkerboard-fixture style, plus a case with a non-evenly-divisible image/count pair to confirm no cell is dropped or duplicated.
- `GridSizeStep`'s existing test suite is updated: assertions on "Block width/height" labels become assertions on the new "pixels wide/tall" labels; the "This will create a R × C pattern" text assertion stays (still shown), fed by the renamed inputs directly instead of a derived block size.
- `PaletteAssignStep`'s existing tests are updated to check for the visible color-code text (already implicitly checked via `getByLabelText`/`aria-label` in some assertions) plus a new assertion on the fixed square dimensions and/or the contrast-text-color logic for at least one light and one dark background color.
- `NewPatternWizard.test.tsx` loses its photo-path test; the digital-path test is simplified (no source-type click) and updated for the new `GridSizeStep` labels.
- `App.test.tsx`'s navigation test is updated to match the wizard's restored single-path shape.

## Out of Scope

- No changes to `WorkingView`, `HomeScreen`, `PaletteManageScreen`, or the storage/hooks layer.
- No re-introduction of a palette picker in the wizard (still uses the built-in palette only, per the existing design).
- No changes to the swatch picker's styling (per explicit scope decision — main grid only).
