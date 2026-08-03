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

type WizardStep =
  | { name: 'upload' }
  | { name: 'grid'; image: ImageBuffer }
  | { name: 'palette'; grid: RGB[][] }
  | { name: 'name'; cellColors: string[][] };

const STEP_LABELS = ['Upload', 'Grid size', 'Palette', 'Name'];
const STEP_INDEX: Record<WizardStep['name'], number> = {
  upload: 0,
  grid: 1,
  palette: 2,
  name: 3,
};

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

  const shell = (children: ReactNode) => (
    <div className="container wizard-shell">
      <div className="wizard-header">
        <StepIndicator steps={STEP_LABELS} currentIndex={STEP_INDEX[step.name]} />
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {children}
    </div>
  );

  if (step.name === 'upload') {
    return shell(
      <UploadStep loadImage={loadImage} onImageLoaded={(image) => setStep({ name: 'grid', image })} />,
    );
  }

  if (step.name === 'grid') {
    return shell(
      <GridSizeStep image={step.image} onGridReady={(grid) => setStep({ name: 'palette', grid })} />,
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
    return shell(
      <PaletteAssignStep
        grid={step.grid}
        palette={palette}
        onConfirm={(cellColors) => setStep({ name: 'name', cellColors })}
      />,
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
      <button className="btn btn-primary" onClick={handleSave}>
        Save Pattern
      </button>
    </div>,
  );
}
