import { useEffect, useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { renderPatternToDataUrl } from '../../lib/image/renderPattern';
import { findSimilarColors } from '../../lib/color/nearestMatch';
import { contrastTextColor } from '../../lib/color/contrast';
import { ZOOM_DEFAULT, isMajorLineStart, zoomIn, zoomOut } from '../../lib/pattern/gridDisplay';
import { EMPTY_CELL, Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { ProgressBar } from '../shared/Progress';

const DEFAULT_MAJOR_LINE_INTERVAL = 10;

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
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [majorLineIntervalInput, setMajorLineIntervalInput] = useState(
    String(DEFAULT_MAJOR_LINE_INTERVAL),
  );

  useEffect(() => {
    if (!gridEl || !pattern) return;

    const recompute = () => {
      const rect = gridEl.getBoundingClientRect();
      const availableWidth = gridEl.clientWidth;

      // In tests (and during the brief moment before layout is available),
      // clientWidth can be 0. Keep the default cell size instead of
      // collapsing the grid to the minimum size.
      if (availableWidth <= 0) return;

      const availableHeight = Math.max(120, window.innerHeight - rect.top - 24);
      const size = Math.floor(
        Math.min(
          availableWidth / pattern.cols,
          availableHeight / pattern.rows,
        ),
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
  const majorLineInterval = Math.max(0, parseInt(majorLineIntervalInput, 10) || 0);
  const displayCellSize = Math.round(cellSize * zoom);

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

    const updated = await replaceColor(
      pattern.id,
      replacingColor,
      newColorName,
      palette,
    );

    syncSharedPattern(updated, palette);
    setReplacingColor(null);
  };

  const handleRemoveColor = async (colorName: string) => {
    const confirmed = window.confirm(
      `Remove all ${colorName} beads from this pattern?`,
    );

    if (!confirmed) return;

    const cells: { row: number; col: number }[] = [];

    pattern.cellColors.forEach((row, rowIndex) => {
      row.forEach((cellColor, colIndex) => {
        if (cellColor === colorName) {
          cells.push({ row: rowIndex, col: colIndex });
        }
      });
    });

    if (cells.length === 0) return;

    const updated = await setCellsColor(
      pattern.id,
      cells,
      EMPTY_CELL,
      palette,
    );

    syncSharedPattern(updated, palette);
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

    const updated = await setCellsColor(
      pattern.id,
      cells,
      colorName,
      palette,
    );

    syncSharedPattern(updated, palette);
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
          <div className="grid-controls">
            <div className="grid-zoom-controls">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => zoomOut(z))}
              >
                −
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm mono"
                onClick={() => setZoom(ZOOM_DEFAULT)}
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => zoomIn(z))}
              >
                +
              </button>
            </div>
            <div className="field grid-major-line-field">
              <label htmlFor="major-line-interval-input">Major line every</label>
              <input
                id="major-line-interval-input"
                type="number"
                min={0}
                value={majorLineIntervalInput}
                onChange={(e) => setMajorLineIntervalInput(e.target.value)}
              />
              <span className="hint">cells</span>
            </div>
          </div>
          <div ref={setGridEl}>
          <table
            style={{
              margin: '0 auto',
              borderCollapse: 'collapse',
              borderSpacing: 0,
              tableLayout: 'fixed',
            }}
          >
            <tbody>
              {pattern.cellColors.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((colorName, colIndex) => {
                    const isEmpty = colorName === EMPTY_CELL;
                    const dimmed = !isEmpty && activeColors.size > 0 && !activeColors.has(colorName);
                    const isSelected = selectedCells.has(`${rowIndex}-${colIndex}`);
                    const hex = hexByName.get(colorName) ?? '#000000';
                    const cellStyle = {
                      width: displayCellSize,
                      height: displayCellSize,
                      backgroundColor: isEmpty ? undefined : dimmed ? 'var(--border)' : hex,
                    };
                    const cellLabel = isEmpty
                      ? `cell ${rowIndex}-${colIndex}, empty (no bead)`
                      : `cell ${rowIndex}-${colIndex}, color ${colorName}`;
                    const cellTitle = isEmpty ? 'No bead' : `${colorName} — ${hex.toUpperCase()}`;
                    const isMajorColStart = isMajorLineStart(colIndex, majorLineInterval);
                    const isMajorRowStart = isMajorLineStart(rowIndex, majorLineInterval);
                    return (
                      <td key={colIndex}>
                        {editMode ? (
                          <button
                            className="pixel-cell"
                            aria-label={cellLabel}
                            title={cellTitle}
                            data-empty={isEmpty ? 'true' : 'false'}
                            data-dimmed={dimmed ? 'true' : 'false'}
                            data-selected={isSelected ? 'true' : 'false'}
                            data-major-col-start={isMajorColStart ? 'true' : 'false'}
                            data-major-row-start={isMajorRowStart ? 'true' : 'false'}
                            style={cellStyle}
                            onClick={() => toggleCellSelection(rowIndex, colIndex)}
                          />
                        ) : (
                          <div
                            className="pixel-cell"
                            aria-label={cellLabel}
                            title={cellTitle}
                            data-empty={isEmpty ? 'true' : 'false'}
                            data-dimmed={dimmed ? 'true' : 'false'}
                            data-major-col-start={isMajorColStart ? 'true' : 'false'}
                            data-major-row-start={isMajorRowStart ? 'true' : 'false'}
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
                <button
                  className="bead-btn bead-btn-empty"
                  aria-label="Set selected cells to Empty"
                  title="No bead"
                  onClick={() => handleSetSelectedCellsColor(EMPTY_CELL)}
                >
                  ∅
                </button>
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

                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove ${color.name}`}
                      onClick={() => handleRemoveColor(color.name)}
                    >
                      Remove
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
