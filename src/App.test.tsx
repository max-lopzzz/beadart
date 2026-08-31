import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDbForTests } from './lib/storage/db';
import { savePalette } from './lib/storage/palettesRepo';
import { savePattern } from './lib/storage/patternsRepo';
import { defaultPalette } from './lib/palette/defaultPalette';
import App from './App';

// SharedPatternView (lazily imported by App) pulls in the Firebase SDK,
// which has side effects that don't play well with the fake-indexeddb
// environment these tests share. Routing to it is exercised here; its own
// loading/error/ready states are covered by SharedPatternView.test.tsx
// against a mocked shareRepo.
vi.mock('./components/shared/SharedPatternView', () => ({
  SharedPatternView: ({ slug }: { slug: string }) => <p>Shared view for {slug}</p>,
}));

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('App', () => {
  it('renders the Home screen by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/bead art helper/i)).toBeInTheDocument());
  });

  it('navigates to the New Pattern wizard and back to Home', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /new pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /new pattern/i }));

    await waitFor(() => screen.getByLabelText(/upload image/i));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });

  it('opens a saved pattern in the Working view and navigates back to Home', async () => {
    await savePalette(defaultPalette);
    await savePattern({
      id: 'pattern-1',
      name: 'My Pattern',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[defaultPalette.colors[0].name]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<App />);
    await waitFor(() => screen.getByText('My Pattern'));
    await userEvent.click(screen.getByText('My Pattern'));

    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new pattern/i })).toBeInTheDocument(),
    );
  });

  it('renders the shared pattern view when a ?share= slug is present', async () => {
    window.history.pushState({}, '', '/?share=abc123');
    try {
      render(<App />);
      await waitFor(() =>
        expect(screen.getByText(/shared view for abc123/i)).toBeInTheDocument(),
      );
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('navigates to Manage Palettes and back to Home', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: /manage palettes/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage palettes/i }));

    await waitFor(() => screen.getByText(/manage palettes/i));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
  });
});
