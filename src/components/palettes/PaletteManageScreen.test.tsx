import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from '../../lib/storage/db';
import { savePalette, listPalettes } from '../../lib/storage/palettesRepo';
import { PaletteManageScreen } from './PaletteManageScreen';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('PaletteManageScreen', () => {
  it('lists the built-in default palette without a delete button', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/default bead palette/i));
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
  });

  it('imports a valid CSV as a new custom palette and lists it', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} createId={() => 'custom-1'} />);
    await waitFor(() => screen.getByLabelText(/palette name/i));

    await userEvent.type(screen.getByLabelText(/palette name/i), 'My Colors');
    await userEvent.type(screen.getByLabelText(/palette csv/i), 'Name,Color{enter}X1,#123456');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByText(/My Colors/)).toBeInTheDocument());
    expect(await listPalettes()).toContainEqual(
      expect.objectContaining({ id: 'custom-1', name: 'My Colors' }),
    );
  });

  it('shows row errors and does not import when the CSV has no valid rows', async () => {
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/palette csv/i));

    await userEvent.type(screen.getByLabelText(/palette csv/i), 'Name,Color{enter}X1,notacolor');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid color/i));
  });

  it('deletes a custom palette', async () => {
    await savePalette({
      id: 'custom-1',
      name: 'Custom',
      isBuiltIn: false,
      colors: [{ name: 'X1', hex: '#123456' }],
    });
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/Custom/));

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText(/Custom/)).not.toBeInTheDocument());
  });

  it('renames a custom palette', async () => {
    await savePalette({
      id: 'custom-1',
      name: 'Custom',
      isBuiltIn: false,
      colors: [{ name: 'X1', hex: '#123456' }],
    });
    render(<PaletteManageScreen onBack={vi.fn()} />);
    await waitFor(() => screen.getByText(/Custom/));

    await userEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByLabelText(/rename custom/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(screen.getByText(/Renamed/)).toBeInTheDocument());
  });
});
