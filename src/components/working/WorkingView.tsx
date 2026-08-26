import { useEffect, useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { findSimilarColors } from '../../lib/color/nearestMatch';
import { contrastTextColor } from '../../lib/color/contrast';
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { ProgressBar } from '../shared/Progress';

function syncSharedPattern(pattern: Pattern, palette: Palette) {
  if (!pattern.shareSlug) return;
  import('../../lib/sharing/shareRepo')
    .then(({ publishPattern }) => publishPattern(pattern.shareSlug!, pattern, palette))
    .catch(() => {
      // Sharing is a best-effort layer on top of the local-first app; a failed
      // sync here shouldn't block the (already-saved) local edit.
    });
}

interface WorkingViewProps {
  patternId: string;
  onBack: () => void;
  renderExport?: typeof renderPatternToDataUrl;
  renderThumbnail?: typeof renderPatternToDataUrl;
}

export function WorkingView({
  patternId,
  onBack,
  renderExport = renderPatternToDataUrl,
  renderThumbnail = renderPatternToDataUrl,
}: WorkingViewProps) {
  const {
    patterns,
    loading: patternsLoading,
    toggleColorCompleted,
    replaceColor,
    renamePattern,
    setCellsColor,
  } = usePatterns({ renderThumbnail });
  const { palettes, loading: palettesLoading } = usePalettes();
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [replacingColor, setReplacingColor] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const pattern = patterns.find((p) => p.id === patternId);
  // A state-backed callback ref (rather than a plain useRef) so the sizing
  // effect below re-runs exactly when this element actually mounts — with
  // patterns/palettes loading independently, the render where pattern.rows
  // first becomes defined isn't always the same render where this div (and
  // the working view generally, gated on palette too) first appears, so a
  // plain ref could stay null while a rows/cols-only dependency array never
  // changes again.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(22);

  useEffect(() => {
    if (!gridEl || !pattern) return;

    const recompute = () => {
      const rect = gridEl.getBoundingClientRect();
      const availableWidth = gridEl.clientWidth;
      const availableHeight = Math.max(120, window.innerHeight - rect.top - 24);
      const size = Math.floor(
        Math.min(availableWidth / pattern.cols, availableHeight / pattern.rows),
      );
      setCellSize(Math.max(6, Math.min(28, size)));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(gridEl);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [gridEl, pattern?.rows, pattern?.cols]);

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

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

  const handleRename = async () => {
    const name = renameValue.trim() || pattern.name;
    await renamePattern(pattern.id, name);
    syncSharedPattern({ ...pattern, name }, palette);
    setIsRenaming(false);
  };

  const handleToggleColorCompleted = async (colorName: string, completed: boolean) => {
    await toggleColorCompleted(pattern.id, colorName, completed);
    const completedColors = completed
      ? [...pattern.completedColors, colorName]
      : pattern.completedColors.filter((name) => name !== colorName);
    syncSharedPattern({ ...pattern, completedColors }, palette);
  };

  const handleReplace = async (newColorName: string) => {
    if (!replacingColor) return;
    await replaceColor(pattern.id, replacingColor, newColorName, palette);
    setReplacingColor(null);
  };

  const toggleCellSelection = (row: number, col: number) => {
    const key = `${row}-${col}`;
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSetSelectedCellsColor = async (colorName: string) => {
    const cells = Array.from(selectedCells, (key) => {
      const [row, col] = key.split('-').map(Number);
      return { row, col };
    });
    await setCellsColor(pattern.id, cells, colorName, palette);
    setSelectedCells(new Set());
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
          {isRenaming ? (
            <div className="field-row" style={{ alignItems: 'flex-end', margin: 0 }}>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label htmlFor="pattern-rename-input">Pattern name</label>
                <input
                  id="pattern-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleRename}>
                Save name
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsRenaming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="working-title-row">
              <h2>{pattern.name}</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRenameValue(pattern.name);
                  setIsRenaming(true);
                }}
              >
                Rename
              </button>
            </div>
          )}
        </div>
        <div className="working-progress">
          <ProgressBar percent={percent} />
          <span className="working-progress-label">{percent}% complete</span>
        </div>
      </div>
      <div className="working-layout">
        <div className="pixel-grid-wrap surface" style={{ padding: 'var(--space-3)' }}>
          <div className="legend-header">
            <p className="hint" style={{ margin: 0 }}>
              {editMode ? 'Click a cell to change its color.' : 'Made a mistake on a cell?'}
            </p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditMode((prev) => !prev);
                setSelectedCells(new Set());
              }}
            >
              {editMode ? 'Done editing' : 'Edit cells'}
            </button>
          </div>
          <div ref={setGridEl}>
          <table style={{ margin: '0 auto' }}>
            <tbody>
              {pattern.cellColors.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((colorName, colIndex) => {
                    const dimmed = activeColors.size > 0 && !activeColors.has(colorName);
                    const isSelected = selectedCells.has(`${rowIndex}-${colIndex}`);
                    const hex = hexByName.get(colorName) ?? '#000000';
                    const cellStyle = {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: dimmed ? 'var(--border)' : hex,
                      borderColor: dimmed ? undefined : contrastTextColor(hex),
                    };
                    const cellLabel = `cell ${rowIndex}-${colIndex}, color ${colorName}`;
                    const cellTitle = `${colorName} — ${hex.toUpperCase()}`;
                    return (
                      <td key={colIndex}>
                        {editMode ? (
                          <button
                            className="pixel-cell"
                            aria-label={cellLabel}
                            title={cellTitle}
                            data-dimmed={dimmed ? 'true' : 'false'}
                            data-selected={isSelected ? 'true' : 'false'}
                            style={cellStyle}
                            onClick={() => toggleCellSelection(rowIndex, colIndex)}
                          />
                        ) : (
                          <div
                            className="pixel-cell"
                            aria-label={cellLabel}
                            title={cellTitle}
                            data-dimmed={dimmed ? 'true' : 'false'}
                            style={cellStyle}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {selectedCells.size > 0 && (
            <div className="cell-edit-panel">
              <div className="legend-header">
                <p className="hint" style={{ margin: 0 }}>
                  {selectedCells.size} cell{selectedCells.size === 1 ? '' : 's'} selected
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedCells(new Set())}
                >
                  Clear selection
                </button>
              </div>
              <div
                className="swatch-picker"
                role="group"
                aria-label="Choose a color for the selected cells"
              >
                {palette.colors.map((option) => (
                  <button
                    key={option.name}
                    className="bead-btn"
                    aria-label={`Set selected cells to ${option.name}`}
                    style={{ backgroundColor: option.hex, color: contrastTextColor(option.hex) }}
                    onClick={() => handleSetSelectedCellsColor(option.name)}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              const isReplacing = replacingColor === color.name;
              return (
                <li key={color.name} className="legend-row-group">
                  <div className="legend-row">
                    <input
                      type="checkbox"
                      aria-label={`mark ${color.name} complete`}
                      checked={pattern.completedColors.includes(color.name)}
                      onChange={(e) => handleToggleColorCompleted(color.name, e.target.checked)}
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
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Replace ${color.name}`}
                      onClick={() => setReplacingColor(isReplacing ? null : color.name)}
                    >
                      Replace
                    </button>
                  </div>
                  {isReplacing && (
                    <div className="swatch-picker" role="group" aria-label="Choose a similar color">
                      {findSimilarColors(
                        { name: color.name, hex: color.hex },
                        palette.colors,
                      ).map((option) => (
                        <button
                          key={option.name}
                          className="bead-btn"
                          aria-label={`Replace with ${option.name}`}
                          style={{
                            backgroundColor: option.hex,
                            color: contrastTextColor(option.hex),
                          }}
                          onClick={() => handleReplace(option.name)}
                        >
                          {option.name}
                        </button>
                      ))}
                    </div>
                  )}
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
