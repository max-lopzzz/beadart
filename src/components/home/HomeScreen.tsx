import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { colorCounts, completionPercent } from '../../lib/pattern/patternStats';
import { aggregateColorTotals } from '../../lib/pattern/materialsSummary';
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { ProgressRing } from '../shared/Progress';

interface HomeScreenProps {
  onOpenPattern: (patternId: string) => void;
  onNewPattern: () => void;
  onManagePalettes: () => void;
}

function WordmarkIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="wordmark-mark"
    >
      <circle cx="11" cy="12" r="8" fill="var(--coral)" />
      <circle cx="11" cy="12" r="2.6" fill="rgba(0,0,0,0.28)" />
      <circle cx="21" cy="20" r="8" fill="var(--teal)" />
      <circle cx="21" cy="20" r="2.6" fill="rgba(0,0,0,0.28)" />
    </svg>
  );
}

function patternUsesAnyColor(pattern: Pattern, palette: Palette | undefined, colors: Set<string>): boolean {
  if (colors.size === 0) return true;
  if (!palette) return false;
  return colorCounts(pattern, palette).some((c) => colors.has(c.name));
}

type SortOption = 'date-desc' | 'name-asc' | 'beads-desc' | 'completion-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Date added (newest)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'beads-desc', label: 'Bead count (most)' },
  { value: 'completion-asc', label: 'Completion (least done)' },
];

function sortPatterns(
  patterns: Pattern[],
  sortBy: SortOption,
  palettesById: Map<string, Palette>,
): Pattern[] {
  const percentOf = (pattern: Pattern): number => {
    const palette = palettesById.get(pattern.paletteId);
    return palette ? completionPercent(pattern, palette) : 0;
  };

  const sorted = [...patterns];
  switch (sortBy) {
    case 'date-desc':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'beads-desc':
      return sorted.sort((a, b) => b.rows * b.cols - a.rows * a.cols);
    case 'completion-asc':
      return sorted.sort((a, b) => percentOf(a) - percentOf(b));
    default:
      return sorted;
  }
}

export function HomeScreen({ onOpenPattern, onNewPattern, onManagePalettes }: HomeScreenProps) {
  const { patterns, loading: patternsLoading, removePattern } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedMaterialColors, setSelectedMaterialColors] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

  const palettesById = new Map(palettes.map((p) => [p.id, p]));
  const materials = aggregateColorTotals(patterns, palettesById);
  const filteredPatterns = patterns.filter((pattern) =>
    patternUsesAnyColor(pattern, palettesById.get(pattern.paletteId), selectedMaterialColors),
  );
  const visiblePatterns = sortPatterns(filteredPatterns, sortBy, palettesById);

  const toggleMaterialColor = (colorName: string) => {
    setSelectedMaterialColors((prev) => {
      const next = new Set(prev);
      if (next.has(colorName)) {
        next.delete(colorName);
      } else {
        next.add(colorName);
      }
      return next;
    });
  };

  return (
    <div className="container">
      <div className="app-header">
        <div>
          <h1 className="wordmark">
            <WordmarkIcon />
            Bead Art Helper
          </h1>
          <p className="tagline">Turn pixel art into a fuse-bead build guide.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={onManagePalettes}>
            Manage Palettes
          </button>
          <button className="btn btn-primary" onClick={onNewPattern}>
            + New Pattern
          </button>
        </div>
      </div>
      {patterns.length === 0 ? (
        <div className="empty-state">
          <WordmarkIcon size={48} />
          <p>No patterns yet. Create one to get started.</p>
        </div>
      ) : (
        <>
          <div className="pattern-toolbar">
            <label htmlFor="pattern-sort" className="pattern-toolbar-label">
              Sort by
            </label>
            <select
              id="pattern-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pattern-grid">
            {visiblePatterns.map((pattern) => {
            const palette = palettes.find((p) => p.id === pattern.paletteId);
            const percent = palette ? completionPercent(pattern, palette) : 0;
            const isDeleting = deletingId === pattern.id;
            return (
              <div key={pattern.id} className="surface pattern-card">
                <button
                  className="pattern-card-open"
                  onClick={() => onOpenPattern(pattern.id)}
                >
                  {pattern.thumbnail ? (
                    <img
                      className="pattern-card-thumb"
                      src={pattern.thumbnail}
                      alt={pattern.name}
                      width={80}
                      height={80}
                    />
                  ) : (
                    <div className="pattern-card-thumb-placeholder" />
                  )}
                  <div className="pattern-card-footer">
                    <span className="pattern-card-name">{pattern.name}</span>
                    <ProgressRing percent={percent} size={32} thickness={3} />
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}
                  >
                    {percent}% complete
                  </span>
                </button>
                {isDeleting ? (
                  <div className="pattern-card-confirm">
                    <span>Delete this pattern?</span>
                    <div className="pattern-card-confirm-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          await removePattern(pattern.id);
                          setDeletingId(null);
                        }}
                      >
                        Delete forever
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-icon-danger pattern-card-delete"
                    aria-label={`Delete ${pattern.name}`}
                    onClick={() => setDeletingId(pattern.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
      {materials.length > 0 && (
        <div className="materials-section">
          <div className="legend-header">
            <div>
              <h3 style={{ marginBottom: 'var(--space-1)' }}>Materials overview</h3>
              <p className="hint" style={{ margin: 0 }}>
                Click a color to see which patterns use it.
              </p>
            </div>
            {selectedMaterialColors.size > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedMaterialColors(new Set())}
              >
                Show all patterns
              </button>
            )}
          </div>
          <ul className="materials-list">
            {materials.map((color) => {
              const isActive = selectedMaterialColors.has(color.name);
              return (
                <li key={color.name}>
                  <button
                    className="materials-row"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => toggleMaterialColor(color.name)}
                  >
                    <span className="bead bead-md" style={{ backgroundColor: color.hex }} />
                    <span className="materials-row-name">
                      {color.name} × {color.total}
                    </span>
                    {color.incomplete > 0 ? (
                      <span className="materials-row-remaining">{color.incomplete} left</span>
                    ) : (
                      <span className="materials-row-done">all placed</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
