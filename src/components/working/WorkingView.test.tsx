import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    render(<WorkingView patternId="pattern-1" onBack={vi.fn()} />);

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

  it('lets you recolor a single cell in edit mode without affecting other cells of the same color', async () => {
    await savePalette(palette);
    await savePattern({ ...pattern, id: 'pattern-2', cellColors: [['Red', 'Red']] });
    render(<WorkingView patternId="pattern-2" onBack={vi.fn()} />);

    await waitFor(() => screen.getByText('Red × 2'));
    await userEvent.click(screen.getByRole('button', { name: /edit cells/i }));
    await userEvent.click(screen.getByLabelText('cell 0-0, color Red'));
    await userEvent.click(screen.getByRole('button', { name: /set cell to blue/i }));

    await waitFor(() =>
      expect(screen.getByLabelText('cell 0-0, color Blue')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('cell 0-1, color Red')).toBeInTheDocument();
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
