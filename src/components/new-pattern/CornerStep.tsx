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
    // TS 5.7+ made typed arrays generic over their backing buffer, and
    // `lib.dom`'s `ImageData` constructor only accepts the `ArrayBuffer`
    // specialization — `image.data`'s inferred `ArrayBufferLike` type doesn't
    // structurally match even though it's a plain Uint8ClampedArray at
    // runtime. Cast to the specialization the constructor expects.
    ctx.putImageData(
      new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height),
      0,
      0,
    );
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
