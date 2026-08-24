import { useMemo, useState } from 'react';
import { ImageBuffer, detectBlockSize } from '../../lib/pixelart/blockDetect';
import { downsampleToGridByCount } from '../../lib/pixelart/downsample';
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
  const [linked, setLinked] = useState(true);

  const cols = parsePositiveInt(colsInput);
  const rows = parsePositiveInt(rowsInput);

  const previewGrid = useMemo(() => downsampleToGridByCount(image, cols, rows), [image, cols, rows]);
  // Canvas rendering can be unavailable (e.g. in a test environment without a
  // 2D context) — the preview is a visual aid, not required for the step to
  // function, so a failure here degrades to no preview rather than crashing
  // the whole page.
  let previewSrc: string | null;
  try {
    previewSrc = renderPreview(previewGrid);
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
    onGridReady(previewGrid);
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
