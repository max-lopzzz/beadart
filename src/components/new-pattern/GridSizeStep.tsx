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
            onChange={(e) => setColsInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pixel-height-input">How many pixels tall is your pixel art?</label>
          <input
            id="pixel-height-input"
            type="number"
            min={1}
            value={rowsInput}
            onChange={(e) => setRowsInput(e.target.value)}
          />
        </div>
      </div>
      <p className="hint mono">
        This will create a {cols} × {rows} pattern.
      </p>
      <div style={{ marginTop: 'var(--space-5)' }}>
        <button className="btn btn-primary" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
