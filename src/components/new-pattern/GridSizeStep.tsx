import { useMemo, useState } from 'react';
import { ImageBuffer, detectBlockSize } from '../../lib/pixelart/blockDetect';
import { downsampleToGridByCount } from '../../lib/pixelart/downsample';
import { detectBackgroundColor, isBackgroundColor } from '../../lib/pixelart/backgroundColor';
import { renderRgbGridToDataUrl } from '../../lib/image/renderRgbGrid';
import { RGB } from '../../lib/color/lab';

interface GridSizeStepProps {
  image: ImageBuffer;
  onGridReady: (grid: RGB[][]) => void;
  onBack?: () => void;
  initialCols?: number;
  initialRows?: number;
  renderPreview?: (grid: RGB[][]) => string;
}

const DEFAULT_COUNT = 16;
const PREVIEW_MAX_SIZE_PX = 240;

function parsePositiveInt(raw: string): number {
  const parsed = parseInt(raw, 10);
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed);
}

export function GridSizeStep({
  image,
  onGridReady,
  onBack,
  initialCols,
  initialRows,
  renderPreview = (grid) => renderRgbGridToDataUrl(grid, { maxSize: PREVIEW_MAX_SIZE_PX }),
}: GridSizeStepProps) {
  const detected = detectBlockSize(image);
  const detectedCols = detected ? Math.round(image.width / detected.blockWidth) : null;
  const detectedRows = detected ? Math.round(image.height / detected.blockHeight) : null;

  // The raw input text is tracked separately from the parsed numeric value so the
  // field can hold an empty string while the user is clearing/retyping it — clamping
  // the value back to a number on every keystroke would fight controlled-input
  // reconciliation and corrupt what the user is in the middle of typing.
  const [colsInput, setColsInput] = useState(String(initialCols ?? detectedCols ?? DEFAULT_COUNT));
  const [rowsInput, setRowsInput] = useState(String(initialRows ?? detectedRows ?? DEFAULT_COUNT));
  // Restoring explicit dimensions (e.g. after Back) means the user already
  // chose this width/height deliberately — possibly not matching the image's
  // own aspect ratio. Starting linked would silently overwrite one field the
  // moment the other is touched, discarding that choice.
  const [linked, setLinked] = useState(initialCols === undefined && initialRows === undefined);
  const [removeBackground, setRemoveBackground] = useState(false);

  const cols = parsePositiveInt(colsInput);
  const rows = parsePositiveInt(rowsInput);

  const backgroundColor = useMemo(() => detectBackgroundColor(image), [image]);
  const rawGrid = useMemo(() => downsampleToGridByCount(image, cols, rows), [image, cols, rows]);
  // Applied after downsampling (not baked into rawGrid) so toggling doesn't
  // require re-sampling the source image, and so a cell's real per-pixel
  // transparency (from the source image itself, sampled by
  // downsampleToGridByCount) is never overridden back to opaque here - this
  // only ever adds background cells to what's already excluded, never
  // removes an exclusion.
  const finalGrid = useMemo(() => {
    if (!removeBackground) return rawGrid;
    return rawGrid.map((row) =>
      row.map((cell) => (isBackgroundColor(cell, backgroundColor) ? { ...cell, a: 0 } : cell)),
    );
  }, [rawGrid, removeBackground, backgroundColor]);

  // Canvas rendering can be unavailable (e.g. in a test environment without a
  // 2D context) — the preview is a visual aid, not required for the step to
  // function, so a failure here degrades to no preview rather than crashing
  // the whole page.
  let previewSrc: string | null;
  try {
    previewSrc = renderPreview(finalGrid);
  } catch {
    previewSrc = null;
  }

  const handleColsChange = (value: string) => {
    setColsInput(value);
    if (linked && value) {
      setRowsInput(String(Math.max(1, Math.round(Number(value) * image.height / image.width))));
    }
  };

  const handleRowsChange = (value: string) => {
    setRowsInput(value);
    if (linked && value) {
      setColsInput(String(Math.max(1, Math.round(Number(value) * image.width / image.height))));
    }
  };

  const handleContinue = () => {
    onGridReady(finalGrid);
  };

  return (
    <div className="container-narrow" style={{ padding: 0 }}>
      <h2>Confirm pixel art size</h2>
      {!detected && (
        <p role="alert">Could not auto-detect a grid — please enter the size manually.</p>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor="pixel-width-input">How many pixels wide is your pixel art?</label>
          <input
            id="pixel-width-input"
            type="number"
            min={1}
            value={colsInput}
            onChange={(e) => handleColsChange(e.target.value)}
          />
        </div>
        <button
          className="btn btn-ghost btn-sm lock-toggle"
          type="button"
          aria-pressed={linked}
          onClick={() => setLinked(!linked)}
        >
          {linked ? '🔒 Linked' : '🔓 Unlinked'}
        </button>
        <div className="field">
          <label htmlFor="pixel-height-input">How many pixels tall is your pixel art?</label>
          <input
            id="pixel-height-input"
            type="number"
            min={1}
            value={rowsInput}
            onChange={(e) => handleRowsChange(e.target.value)}
          />
        </div>
      </div>
      <label className="background-toggle-field" htmlFor="remove-background-toggle">
        <input
          id="remove-background-toggle"
          type="checkbox"
          checked={removeBackground}
          onChange={(e) => setRemoveBackground(e.target.checked)}
        />
        Remove background
        <span
          data-testid="background-swatch"
          className="bead bead-sm"
          aria-hidden="true"
          style={{
            backgroundColor: `rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`,
          }}
        />
      </label>
      <p className="hint mono">
        This will create a {cols} × {rows} pattern.
      </p>
      {previewSrc && (
        <div className="grid-preview">
          <img
            data-testid="grid-preview"
            className="grid-preview-image"
            src={previewSrc}
            alt={`Preview of the pixel art downsampled to ${cols} by ${rows} pixels`}
          />
        </div>
      )}
      {onBack ? (
        <div className="wizard-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Back
          </button>
          <button className="btn btn-primary" onClick={handleContinue}>
            Continue
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn-primary" onClick={handleContinue}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
