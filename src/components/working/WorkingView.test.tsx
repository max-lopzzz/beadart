import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette } from '../../lib/storage/palettesRepo';
import { savePattern } from '../../lib/storage/patternsRepo';
import { WorkingView } from './WorkingView';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

const palette: Palette = {
  id: 'p1',
  name: 'Test',
  isBuiltIn: false,
  colors: [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ],
};

const pattern: Pattern = {
  id: 'pattern-1',
  name: 'My Pattern',
  createdAt: '2026-08-02T00:00:00.000Z',
  rows: 1,
  cols: 2,
  cellColors: [['Red', 'Blue']],
  paletteId: 'p1',
  completedColors: [],
  thumbnail: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('WorkingView', () => {
  it('renders the color list with counts and completion percent', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Pattern')).toBeInTheDocument());
    expect(screen.getByText('Red × 1')).toBeInTheDocument();
    expect(screen.getByText('Blue × 1')).toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('marks a color complete via its checkbox and updates completion percent', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByLabelText(/mark red complete/i));
    await userEvent.click(screen.getByLabelText(/mark red complete/i));

    await waitFor(() => expect(screen.getByText('50% complete')).toBeInTheDocument());
  });

  it('filters the grid to only the clicked color, dimming the rest', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));

    expect(screen.getByLabelText('cell 0-0, color Red')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByLabelText('cell 0-1, color Blue')).toHaveAttribute('data-dimmed', 'true');
  });

  it('shows multiple colors at once when more than one is selected', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Blue × 1'));

    expect(screen.getByLabelText('cell 0-0, color Red')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByLabelText('cell 0-1, color Blue')).toHaveAttribute('data-dimmed', 'false');
  });

  it('clears the filter when a selected color is clicked again', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));

    expect(screen.getByLabelText('cell 0-0, color Red')).toHaveAttribute('data-dimmed', 'false');
    expect(screen.getByLabelText('cell 0-1, color Blue')).toHaveAttribute('data-dimmed', 'false');
  });

  it('shows a color swatch for each color in the sidebar', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    const redSwatch = screen.getByText('Red × 1').querySelector('[data-hex]');
    expect(redSwatch).toHaveAttribute('data-hex', '#ff0000');

    const blueSwatch = screen.getByText('Blue × 1').querySelector('[data-hex]');
    expect(blueSwatch).toHaveAttribute('data-hex', '#0000ff');
  });

  it('shows similar palette colors to replace with when Replace is clicked', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByRole('button', { name: /replace red/i }));

    expect(screen.getByRole('button', { name: /replace with blue/i })).toBeInTheDocument();
  });

  it('replaces a color throughout the pattern when a similar option is chosen', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} renderThumbnail={renderThumbnail} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByRole('button', { name: /replace red/i }));
    await userEvent.click(screen.getByRole('button', { name: /replace with blue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, color Blue')).toBeInTheDocument(),
    );
    expect(screen.getByText('Blue × 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Red ×/)).not.toBeInTheDocument();
  });

  it('renames the pattern via the header rename control', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My Pattern')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByLabelText(/pattern name/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed Pattern');
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(screen.getByText('Renamed Pattern')).toBeInTheDocument());
    expect(screen.queryByText('My Pattern')).not.toBeInTheDocument();
  });

  it('lets you recolor a single selected cell in edit mode without affecting other cells of the same color', async () => {
    await savePalette(palette);
    await savePattern({ ...pattern, id: 'pattern-2', cellColors: [['Red', 'Red']] });
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    render(<WorkingView patternId="pattern-2" onBack={vi.fn()} renderThumbnail={renderThumbnail} />);

    await waitFor(() => screen.getByText('Red × 2'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByRole('button', { name: /set selected cells to blue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, color Blue')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('cell 0-1, color Red')).toBeInTheDocument();
  });

  it('lets you select multiple cells in edit mode and recolor them all at once', async () => {
    await savePalette(palette);
    await savePattern({
      ...pattern,
      id: 'pattern-3',
      rows: 2,
      cols: 2,
      cellColors: [
        ['Red', 'Blue'],
        ['Blue', 'Red'],
      ],
    });
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    render(<WorkingView patternId="pattern-3" onBack={vi.fn()} renderThumbnail={renderThumbnail} />);

    await waitFor(() => screen.getByText('Red × 2'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByLabelText('cell 1-1, color Red'));
    expect(screen.getByText('2 cells selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /set selected cells to blue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, color Blue')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('cell 1-1, color Blue')).toBeInTheDocument();
    expect(screen.getByLabelText('cell 0-1, color Blue')).toBeInTheDocument();
    expect(screen.getByLabelText('cell 1-0, color Blue')).toBeInTheDocument();
  });

  it('toggles a cell out of the selection when clicked again, and Clear selection deselects all', async () => {
    await savePalette(palette);
    await savePattern({ ...pattern, id: 'pattern-4', cellColors: [['Red', 'Blue']] });
    render(<WorkingView patternId="pattern-4" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByLabelText('cell 0-1, color Blue'));
    expect(screen.getByText('2 cells selected')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('cell 0-1, color Blue'));
    expect(screen.getByText('1 cell selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(screen.queryByText(/cell.*selected/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /set selected cells to/i }),
    ).not.toBeInTheDocument();
  });

  it('shift-clicking a cell selects every connected cell of the same color, and colors them all at once', async () => {
    await savePalette(palette);
    await savePattern({
      ...pattern,
      id: 'pattern-8',
      rows: 2,
      cols: 2,
      cellColors: [
        ['Red', 'Red'],
        ['Blue', 'Red'],
      ],
    });
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    render(<WorkingView patternId="pattern-8" onBack={vi.fn()} renderThumbnail={renderThumbnail} />);

    await waitFor(() => screen.getByText('Red × 3'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    fireEvent.click(screen.getByLabelText('cell 0-0, color Red'), { shiftKey: true });
    expect(screen.getByText('3 cells selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /set selected cells to blue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, color Blue')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('cell 0-1, color Blue')).toBeInTheDocument();
    expect(screen.getByLabelText('cell 1-1, color Blue')).toBeInTheDocument();
    expect(screen.getByLabelText('cell 1-0, color Blue')).toBeInTheDocument();
  });

  it('shift-click adds the same-color region to an existing selection rather than replacing it', async () => {
    await savePalette(palette);
    await savePattern({
      ...pattern,
      id: 'pattern-9',
      rows: 2,
      cols: 2,
      cellColors: [
        ['Red', 'Red'],
        ['Blue', 'Blue'],
      ],
    });
    render(<WorkingView patternId="pattern-9" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 2'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    await userEvent.click(screen.getByLabelText('cell 1-0, color Blue'));
    expect(screen.getByText('1 cell selected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('cell 0-0, color Red'), { shiftKey: true });
    expect(screen.getByText('3 cells selected')).toBeInTheDocument();
  });

  it('zooms the grid in and out via the zoom controls, and resets to fit', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

    await waitFor(() => screen.getByLabelText('cell 0-0, color Red'));
    const cell = screen.getByLabelText('cell 0-0, color Red');
    const initialWidth = cell.style.width;

    await userEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(screen.getByText('125%')).toBeInTheDocument();
    expect(cell.style.width).not.toBe(initialWidth);

    await userEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(cell.style.width).toBe(initialWidth);
  });

  it('marks every Nth row and column with a major gridline, based on the configured interval', async () => {
    await savePalette(palette);
    await savePattern({
      ...pattern,
      id: 'pattern-5',
      rows: 3,
      cols: 3,
      cellColors: [
        ['Red', 'Blue', 'Red'],
        ['Blue', 'Red', 'Blue'],
        ['Red', 'Blue', 'Red'],
      ],
    });
    render(<WorkingView patternId="pattern-5" onBack={vi.fn()} />);

    await waitFor(() => screen.getByLabelText('cell 0-0, color Red'));

    const intervalInput = screen.getByLabelText(/major line every/i);
    await userEvent.clear(intervalInput);
    await userEvent.type(intervalInput, '2');

    expect(screen.getByLabelText('cell 0-2, color Red')).toHaveAttribute(
      'data-major-col-start',
      'true',
    );
    expect(screen.getByLabelText('cell 2-0, color Red')).toHaveAttribute(
      'data-major-row-start',
      'true',
    );
    expect(screen.getByLabelText('cell 0-0, color Red')).toHaveAttribute(
      'data-major-col-start',
      'false',
    );
    expect(screen.getByLabelText('cell 0-1, color Blue')).toHaveAttribute(
      'data-major-col-start',
      'false',
    );
  });

  it('renders an empty (no-bead) cell distinctly, and excludes it from the color list', async () => {
    await savePalette(palette);
    await savePattern({ ...pattern, id: 'pattern-6', cellColors: [['Red', '']] });
    render(<WorkingView patternId="pattern-6" onBack={vi.fn()} />);

    await waitFor(() => screen.getByLabelText('cell 0-0, color Red'));
    expect(screen.getByLabelText('cell 0-1, empty (no bead)')).toBeInTheDocument();
    expect(screen.queryByText(/^ ×/)).not.toBeInTheDocument();
    expect(screen.getByText('Red × 1')).toBeInTheDocument();
  });

  it('lets an empty cell be filled in with a real color via edit mode, and a colored cell be cleared to empty', async () => {
    await savePalette(palette);
    await savePattern({ ...pattern, id: 'pattern-7', cellColors: [['Red', '']] });
    const renderThumbnail = vi.fn().mockReturnValue('data:image/png;base64,thumb');
    render(<WorkingView patternId="pattern-7" onBack={vi.fn()} renderThumbnail={renderThumbnail} />);

    await waitFor(() => screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));

    await userEvent.click(screen.getByLabelText('cell 0-1, empty (no bead)'));
    await userEvent.click(screen.getByRole('button', { name: /set selected cells to blue/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-1, color Blue')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByRole('button', { name: /set selected cells to empty/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, empty (no bead)')).toBeInTheDocument(),
    );
  });

  it('calls renderExport with the active color filter when Export is clicked', async () => {
    await savePalette(palette);
    await savePattern(pattern);
    const renderExport = vi.fn().mockReturnValue('data:image/png;base64,export');
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} renderExport={renderExport} />);

    await waitFor(() => screen.getByText('Red × 1'));
    await userEvent.click(screen.getByText('Red × 1'));
    await userEvent.click(screen.getByRole('button', { name: /export image/i }));

    expect(renderExport).toHaveBeenCalledWith(pattern, palette, { onlyColors: ['Red'] });
    expect(screen.getByRole('link', { name: /download image/i })).toHaveAttribute(
      'href',
      'data:image/png;base64,export',
    );
  });
});
