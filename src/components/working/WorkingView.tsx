import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';

interface WorkingViewProps {
  patternId: string;
  onBack: () => void;
  renderExport?: typeof renderPatternToDataUrl;
}

export function WorkingView({
  patternId,
  onBack,
  renderExport = renderPatternToDataUrl,
}: WorkingViewProps) {
  const { patterns, loading: patternsLoading, toggleColorCompleted } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

  const pattern = patterns.find((p) => p.id === patternId);
  const palette = pattern ? palettes.find((p) => p.id === pattern.paletteId) : undefined;

  if (!pattern || !palette) {
    return <p>Pattern not found.</p>;
  }

  const counts = colorCounts(pattern, palette);
  const percent = completionPercent(pattern, palette);
  const hexByName = new Map(palette.colors.map((c) => [c.name, c.hex]));

  const handleExport = () => {
    setExportUrl(renderExport(pattern, palette, { onlyColor: activeColor ?? undefined }));
  };

  return (
    <div>
      <button onClick={onBack}>Back</button>
      <h2>{pattern.name}</h2>
      <p>{percent}% complete</p>
      <table>
        <tbody>
          {pattern.cellColors.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((colorName, colIndex) => {
                const dimmed = activeColor !== null && colorName !== activeColor;
                return (
                  <td key={colIndex}>
                    <div
                      aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                      data-dimmed={dimmed ? 'true' : 'false'}
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: dimmed ? '#e0e0e0' : hexByName.get(colorName),
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        {counts.map((color) => (
          <li key={color.name}>
            <input
              type="checkbox"
              aria-label={`mark ${color.name} complete`}
              checked={pattern.completedColors.includes(color.name)}
              onChange={(e) => toggleColorCompleted(pattern.id, color.name, e.target.checked)}
            />
            <button onClick={() => setActiveColor((prev) => (prev === color.name ? null : color.name))}>
              {color.name} × {color.count}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={handleExport}>Export image</button>
      {exportUrl && (
        <a href={exportUrl} download={`${pattern.name}.png`}>
          Download image
        </a>
      )}
    </div>
  );
}
