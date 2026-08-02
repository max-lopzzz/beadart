import { usePatterns } from '../../hooks/usePatterns';
import { usePalettes } from '../../hooks/usePalettes';
import { completionPercent } from '../../lib/pattern/patternStats';

interface HomeScreenProps {
  onOpenPattern: (patternId: string) => void;
  onNewPattern: () => void;
  onManagePalettes: () => void;
}

export function HomeScreen({ onOpenPattern, onNewPattern, onManagePalettes }: HomeScreenProps) {
  const { patterns, loading: patternsLoading } = usePatterns();
  const { palettes, loading: palettesLoading } = usePalettes();

  if (patternsLoading || palettesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="home-header">
        <h1>Bead Art Helper</h1>
        <button onClick={onNewPattern}>+ New Pattern</button>
        <button onClick={onManagePalettes}>Manage Palettes</button>
      </div>
      {patterns.length === 0 ? (
        <p>No patterns yet. Create one to get started.</p>
      ) : (
        <ul className="pattern-list">
          {patterns.map((pattern) => {
            const palette = palettes.find((p) => p.id === pattern.paletteId);
            const percent = palette ? completionPercent(pattern, palette) : 0;
            return (
              <li key={pattern.id}>
                <button onClick={() => onOpenPattern(pattern.id)}>
                  {pattern.thumbnail && (
                    <img src={pattern.thumbnail} alt={pattern.name} width={80} height={80} />
                  )}
                  <span>{pattern.name}</span>
                  <span>{percent}% complete</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
