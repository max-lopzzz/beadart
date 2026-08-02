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
  // field can hold an empty string while the user is clearing/retyping it — clamping
  // the value back to a number on every keystroke would fight controlled-input
  // reconciliation and corrupt what the user is in the middle of typing.
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
