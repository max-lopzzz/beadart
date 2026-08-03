import { useState } from 'react';
import { usePalettes } from '../../hooks/usePalettes';
import { parsePaletteCsv } from '../../lib/palette/csv';
import { Palette } from '../../types/palette';

interface PaletteManageScreenProps {
  onBack: () => void;
  createId?: () => string;
}

export function PaletteManageScreen({
  onBack,
  createId = () => crypto.randomUUID(),
}: PaletteManageScreenProps) {
  const { palettes, loading, importPalette, removePalette } = usePalettes();
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleImport = async () => {
    const result = parsePaletteCsv(csvText);
    setImportErrors(result.errors);
    if (result.colors.length === 0) return;
    await importPalette({
      id: createId(),
      name: csvName.trim() || 'Imported Palette',
      isBuiltIn: false,
      colors: result.colors,
    });
    setCsvText('');
    setCsvName('');
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await removePalette(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete palette');
    }
  };

  const confirmRename = async (palette: Palette) => {
    await importPalette({ ...palette, name: renameValue.trim() || palette.name });
    setRenamingId(null);
  };

  return (
    <div className="container-narrow">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back
      </button>
      <h2>Manage Palettes</h2>
      <ul className="palette-list">
        {palettes.map((palette) => (
          <li key={palette.id} className="surface palette-row">
            {renamingId === palette.id ? (
              <div className="rename-row">
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor={`rename-${palette.id}`}>Rename {palette.name}</label>
                  <input
                    id={`rename-${palette.id}`}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => confirmRename(palette)}>
                  Save name
                </button>
              </div>
            ) : (
              <>
                <div className="palette-swatch-strip" aria-hidden="true">
                  {palette.colors.slice(0, 5).map((color, i) => (
                    <span
                      key={i}
                      className="bead bead-md"
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
                <span className="palette-row-name">{palette.name}</span>
                <span className="palette-row-count">{palette.colors.length} colors</span>
                <div className="palette-row-actions">
                  {!palette.isBuiltIn && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setRenamingId(palette.id);
                        setRenameValue(palette.name);
                      }}
                    >
                      Rename
                    </button>
                  )}
                  {!palette.isBuiltIn && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(palette.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {deleteError && <p role="alert">{deleteError}</p>}

      <div className="surface" style={{ padding: 'var(--space-5)' }}>
        <h3>Import a palette</h3>
        <div className="field">
          <label htmlFor="palette-name-input">Palette name</label>
          <input
            id="palette-name-input"
            value={csvName}
            onChange={(e) => setCsvName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="palette-csv-input">Palette CSV (Name,Color)</label>
          <textarea
            id="palette-csv-input"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Name,Color\nA1,#fff4e6'}
          />
        </div>
        <button className="btn btn-primary" onClick={handleImport}>
          Import
        </button>
        {importErrors.length > 0 && (
          <ul role="alert">
            {importErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
