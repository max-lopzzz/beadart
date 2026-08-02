import { useState } from 'react';
import { ImageBuffer } from '../../lib/pixelart/blockDetect';
import { RGB } from '../../lib/color/lab';
import { Pattern } from '../../types/pattern';
import { usePalettes } from '../../hooks/usePalettes';
import { usePatterns } from '../../hooks/usePatterns';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { UploadStep } from './UploadStep';
import { GridSizeStep } from './GridSizeStep';
import { PaletteAssignStep } from './PaletteAssignStep';

type WizardStep =
  | { name: 'upload' }
  | { name: 'grid'; image: ImageBuffer }
  | { name: 'palette'; grid: RGB[][] }
  | { name: 'name'; cellColors: string[][] };

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

  if (palettesLoading) {
    return <div>Loading...</div>;
  }

  const palette = palettes.find((p) => p.isBuiltIn) ?? palettes[0];

  if (step.name === 'upload') {
    return (
      <UploadStep loadImage={loadImage} onImageLoaded={(image) => setStep({ name: 'grid', image })} />
    );
  }

  if (step.name === 'grid') {
    return (
      <GridSizeStep image={step.image} onGridReady={(grid) => setStep({ name: 'palette', grid })} />
    );
  }

  if (step.name === 'palette') {
    if (!palette) {
      return <p>No palette available.</p>;
    }
    return (
      <PaletteAssignStep
        grid={step.grid}
        palette={palette}
        onConfirm={(cellColors) => setStep({ name: 'name', cellColors })}
      />
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
