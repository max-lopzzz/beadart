import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette } from '../../lib/storage/palettesRepo';
import { savePattern } from '../../lib/storage/patternsRepo';
import { defaultPalette } from '../../lib/palette/defaultPalette';
import { HomeScreen } from './HomeScreen';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('HomeScreen', () => {
  it('shows an empty state when there are no patterns', async () => {
    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });

  it('lists saved patterns with their completion percent', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My First Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 2,
      cellColors: [[defaultPalette.colors[0].name, defaultPalette.colors[1].name]],
      paletteId: defaultPalette.id,
      completedColors: [defaultPalette.colors[0].name],
      thumbnail: '',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('calls onOpenPattern when a pattern card is clicked', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My First Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[defaultPalette.colors[0].name]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
    });

    const onOpenPattern = vi.fn();
    render(
      <HomeScreen onOpenPattern={onOpenPattern} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());

    await userEvent.click(screen.getByText('My First Pattern'));
    expect(onOpenPattern).toHaveBeenCalledWith('pattern-1');
  });

  it('calls onNewPattern and onManagePalettes when their buttons are clicked', async () => {
    const onNewPattern = vi.fn();
    const onManagePalettes = vi.fn();
    render(
      <HomeScreen
        onOpenPattern={vi.fn()}
        onNewPattern={onNewPattern}
        onManagePalettes={onManagePalettes}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new pattern/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /new pattern/i }));
    expect(onNewPattern).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /manage palettes/i }));
    expect(onManagePalettes).toHaveBeenCalled();
  });
});
