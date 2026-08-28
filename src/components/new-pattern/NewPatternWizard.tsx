import { ReactNode, useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { RGB } from '../../lib/color/lab';
import { Pattern } from '../../types/pattern';
import { usePalettes } from '../../hooks/usePalettes';
import { usePatterns } from '../../hooks/usePatterns';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { UploadStep } from './UploadStep';
import { GridSizeStep } from './GridSizeStep';
import { PaletteAssignStep } from './PaletteAssignStep';
import { StepIndicator } from '../shared/StepIndicator';

type StepName = 'upload' | 'grid' | 'palette' | 'name';

const STEP_ORDER: StepName[] = ['upload', 'grid', 'palette', 'name'];
const STEP_LABELS = ['Upload', 'Grid size', 'Palette', 'Name'];

// Collected across steps as the user moves forward. Kept flat (rather than
// nested inside a per-step discriminated union) so that navigating back
// never discards what was already entered — earlier steps stay populated
// and later ones just aren't shown yet.
interface WizardData {
  image: ImageBuffer | null;
  grid: RGB[][] | null;
  cellColors: string[][] | null;
}

const EMPTY_DATA: WizardData = { image: null, grid: null, cellColors: null };

interface NewPatternWizardProps {
  onDone: (patternId: string) => void;
  onCancel: () => void;
  loadImage?: (file: File) => Promise<ImageBuffer>;
  renderThumbnail?: typeof renderPatternToDataUrl;
  now?: () => string;
  createId?: () => string;
}

// Compares full content, not just dimensions: re-confirming the Grid step
// with the same cols/rows can still produce a genuinely different grid (e.g.
// toggling "Remove background" zeroes alpha on some cells without changing
// the shape at all) - a shape-only check would silently keep stale palette
// edits built from the old colors/alpha in that case.
function sameGrid(a: RGB[][] | null, b: RGB[][]): boolean {
  if (!a) return false;
  if (a.length !== b.length) return false;
  for (let row = 0; row < a.length; row++) {
    if (a[row].length !== b[row].length) return false;
    for (let col = 0; col < a[row].length; col++) {
      const cellA = a[row][col];
      const cellB = b[row][col];
      if (cellA.r !== cellB.r || cellA.g !== cellB.g || cellA.b !== cellB.b || cellA.a !== cellB.a) {
        return false;
      }
    }
  }
  return true;
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
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [patternName, setPatternName] = useState('');

  const stepName = STEP_ORDER[stepIndex];
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const onBack = stepIndex > 0 ? goBack : undefined;

  const shell = (children: ReactNode) => (
    <div className="container wizard-shell">
      <div className="wizard-header">
        <StepIndicator steps={STEP_LABELS} currentIndex={stepIndex} />
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {children}
    </div>
  );

  if (stepName === 'upload') {
    return shell(
      <>
        {data.image && (
          <div className="container-narrow" style={{ padding: 0, marginBottom: 'var(--space-4)' }}>
            <p className="hint">
              Already uploaded an image.{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setStepIndex(1)}
              >
                Continue with this image
              </button>
            </p>
          </div>
        )}
        <UploadStep
          loadImage={loadImage}
          onImageLoaded={(image) => {
            setData({ image, grid: null, cellColors: null });
            setStepIndex(1);
          }}
        />
      </>,
    );
  }

  if (stepName === 'grid') {
    if (!data.image) return <p>No image loaded.</p>;
    return shell(
      <GridSizeStep
        image={data.image}
        initialCols={data.grid ? data.grid[0].length : undefined}
        initialRows={data.grid ? data.grid.length : undefined}
        onBack={onBack}
        onGridReady={(grid) => {
          // Re-confirming an identical grid (e.g. the user went Back just to
          // check, then continued without changing anything) keeps whatever
          // palette edits were already made. Any real difference - a
          // different cell count, or the same size with different colors/
          // alpha (e.g. toggling "Remove background") - invalidates them,
          // since they were built from colors that no longer match.
          setData((prev) => ({
            ...prev,
            grid,
            cellColors: sameGrid(prev.grid, grid) ? prev.cellColors : null,
          }));
          setStepIndex(2);
        }}
      />,
    );
  }

  if (palettesLoading) {
    return <div>Loading...</div>;
  }

  const palette = palettes.find((p) => p.isBuiltIn) ?? palettes[0];

  if (stepName === 'palette') {
    if (!palette) {
      return <p>No palette available.</p>;
    }
    if (!data.grid) return <p>No grid available.</p>;
    return shell(
      <PaletteAssignStep
        grid={data.grid}
        palette={palette}
        onBack={onBack}
        initialCellColors={data.cellColors ?? undefined}
        onCellColorsChange={(cellColors) => setData((prev) => ({ ...prev, cellColors }))}
        onConfirm={(cellColors) => {
          setData((prev) => ({ ...prev, cellColors }));
          setStepIndex(3);
        }}
      />,
    );
  }

  const handleSave = async () => {
    if (!palette || !data.cellColors) return;
    const rows = data.cellColors.length;
    const cols = data.cellColors[0]?.length ?? 0;
    const pattern: Pattern = {
      id: createId(),
      name: patternName.trim() || 'Untitled Pattern',
      createdAt: now(),
      rows,
      cols,
      cellColors: data.cellColors,
      paletteId: palette.id,
      completedColors: [],
      thumbnail: '',
    };
    pattern.thumbnail = renderThumbnail(pattern, palette, { maxSize: 200 });
    await addPattern(pattern);
    onDone(pattern.id);
  };

  return shell(
    <div className="container-narrow" style={{ padding: 0 }}>
      <h2>Name your pattern</h2>
      <div className="field">
        <label htmlFor="pattern-name-input">Pattern name</label>
        <input
          id="pattern-name-input"
          value={patternName}
          onChange={(e) => setPatternName(e.target.value)}
          placeholder="e.g. Pixel Fox"
          autoFocus
        />
      </div>
      <div className="wizard-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          Save Pattern
        </button>
      </div>
    </div>,
  );
}
