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
