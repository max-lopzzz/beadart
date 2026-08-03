import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { completionPercent } from '../../lib/pattern/patternStats';
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

export function HomeScreen({ onOpenPattern, onNewPattern, onManagePalettes }: HomeScreenProps) {
  const { patterns, loading: patternsLoading } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

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
        <div className="pattern-grid">
          {patterns.map((pattern) => {
            const palette = palettes.find((p) => p.id === pattern.paletteId);
            const percent = palette ? completionPercent(pattern, palette) : 0;
            return (
              <button
                key={pattern.id}
                className="surface pattern-card"
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
                <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
                  {percent}% complete
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
