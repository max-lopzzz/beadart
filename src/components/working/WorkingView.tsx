import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { ProgressBar } from '../shared/Progress';

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
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
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

  const toggleActiveColor = (colorName: string) => {
    setActiveColors((prev) => {
      const next = new Set(prev);
      if (next.has(colorName)) {
        next.delete(colorName);
      } else {
        next.add(colorName);
      }
      return next;
    });
  };

  const handleExport = () => {
    setExportUrl(
      renderExport(pattern, palette, {
        onlyColors: activeColors.size > 0 ? Array.from(activeColors) : undefined,
      }),
    );
  };

  return (
    <div className="container">
      <div className="working-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Back
        </button>
        <div className="working-title">
          <h2>{pattern.name}</h2>
        </div>
        <div className="working-progress">
          <ProgressBar percent={percent} />
          <span className="working-progress-label">{percent}% complete</span>
        </div>
      </div>
      <div className="working-layout">
        <div className="pixel-grid-wrap surface" style={{ padding: 'var(--space-3)' }}>
          <table>
            <tbody>
              {pattern.cellColors.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((colorName, colIndex) => {
                    const dimmed = activeColors.size > 0 && !activeColors.has(colorName);
                    return (
                      <td key={colIndex}>
                        <div
                          className="pixel-cell"
                          aria-label={`cell ${rowIndex}-${colIndex}, color ${colorName}`}
                          data-dimmed={dimmed ? 'true' : 'false'}
                          style={{
                            width: 22,
                            height: 22,
                            backgroundColor: dimmed ? 'var(--border)' : hexByName.get(colorName),
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="surface" style={{ padding: 'var(--space-3)' }}>
          <div className="legend-header">
            <p className="hint" style={{ margin: 0 }}>
              Click one or more colors to show only those.
            </p>
            {activeColors.size > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setActiveColors(new Set())}>
                Show all
              </button>
            )}
          </div>
          <ul className="legend-list">
            {counts.map((color) => {
              const isActive = activeColors.has(color.name);
              return (
                <li key={color.name} className="legend-row">
                  <input
                    type="checkbox"
                    aria-label={`mark ${color.name} complete`}
                    checked={pattern.completedColors.includes(color.name)}
                    onChange={(e) => toggleColorCompleted(pattern.id, color.name, e.target.checked)}
                  />
                  <button
                    className="legend-swatch-btn"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => toggleActiveColor(color.name)}
                  >
                    <span
                      className="bead bead-sm"
                      aria-hidden="true"
                      data-hex={color.hex}
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.name} × {color.count}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="export-row">
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>
              Export image
            </button>
            {exportUrl && (
              <a href={exportUrl} download={`${pattern.name}.png`}>
                Download image
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
