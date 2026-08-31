import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetDbForTests } from '../../lib/storage/db';
import { savePalette } from '../../lib/storage/palettesRepo';
import { savePattern } from '../../lib/storage/patternsRepo';
import { defaultPalette } from '../../lib/palette/defaultPalette';
import { HomeScreen } from './HomeScreen';

vi.mock('../../lib/sharing/config', () => ({
  isSharingConfigured: vi.fn(),
}));

vi.mock('../../lib/sharing/shareRepo', () => ({
  publishOverview: vi.fn(),
  unpublishOverview: vi.fn(),
}));

import { isSharingConfigured } from '../../lib/sharing/config';
import { publishOverview, unpublishOverview } from '../../lib/sharing/shareRepo';

const mockedIsSharingConfigured = vi.mocked(isSharingConfigured);
const mockedPublishOverview = vi.mocked(publishOverview);
const mockedUnpublishOverview = vi.mocked(unpublishOverview);

beforeEach(() => {
  mockedIsSharingConfigured.mockReturnValue(true);

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  }
});

afterEach(async () => {
  vi.restoreAllMocks();

  resetDbForTests();

  window.localStorage.removeItem('beadart.overviewShareSlug');

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
    expect(screen.queryByText(/materials overview/i)).not.toBeInTheDocument();
  });

  it('shows a materials overview totaling color usage across all patterns', async () => {
    await savePalette(defaultPalette);
    const colorA = defaultPalette.colors[0].name;
    const colorB = defaultPalette.colors[1].name;
    await savePattern({
      id: 'pattern-1',
      name: 'Pattern One',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 2,
      cols: 2,
      cellColors: [
        [colorA, colorA],
        [colorB, colorA],
      ],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await savePattern({
      id: 'pattern-2',
      name: 'Pattern Two',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[colorA]],
      paletteId: defaultPalette.id,
      completedColors: [colorA],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/materials overview/i)).toBeInTheDocument());

    // colorA: 3 (incomplete) from Pattern One + 1 (complete) from Pattern Two = 4 total, 3 left
    expect(screen.getByText(`${colorA} × 4`)).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();

    // colorB: 1 total, 1 left
    expect(screen.getByText(`${colorB} × 1`)).toBeInTheDocument();
  });

  it('shows the share-overview button disabled with a setup hint when sharing is not configured', async () => {
  mockedIsSharingConfigured.mockReturnValue(false);

  window.localStorage.removeItem('beadart.overviewShareSlug');

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
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  render(
    <HomeScreen
      onOpenPattern={vi.fn()}
      onNewPattern={vi.fn()}
      onManagePalettes={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByText(/materials overview/i)).toBeInTheDocument(),
  );

  expect(
    screen.getByRole('button', { name: /^share overview$/i }),
  ).toBeDisabled();

  expect(
    screen.getAllByText(/set up sharing \(see readme\)/i).length,
  ).toBeGreaterThan(0);
});

  it('filters the pattern grid to patterns using a clicked material color', async () => {
    await savePalette(defaultPalette);
    const colorA = defaultPalette.colors[0].name;
    const colorB = defaultPalette.colors[1].name;
    await savePattern({
      id: 'pattern-1',
      name: 'Pattern One',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[colorA]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await savePattern({
      id: 'pattern-2',
      name: 'Pattern Two',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[colorB]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Pattern One')).toBeInTheDocument());
    expect(screen.getByText('Pattern Two')).toBeInTheDocument();

    await userEvent.click(screen.getByText(`${colorA} × 1`));

    expect(screen.getByText('Pattern One')).toBeInTheDocument();
    expect(screen.queryByText('Pattern Two')).not.toBeInTheDocument();
  });

  it('shows all patterns again after clearing the material color filter', async () => {
    await savePalette(defaultPalette);
    const colorA = defaultPalette.colors[0].name;
    const colorB = defaultPalette.colors[1].name;
    await savePattern({
      id: 'pattern-1',
      name: 'Pattern One',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[colorA]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await savePattern({
      id: 'pattern-2',
      name: 'Pattern Two',
      createdAt: '2026-08-02T00:00:00.000Z',
      rows: 1,
      cols: 1,
      cellColors: [[colorB]],
      paletteId: defaultPalette.id,
      completedColors: [],
      thumbnail: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Pattern One')).toBeInTheDocument());

    await userEvent.click(screen.getByText(`${colorA} × 1`));
    expect(screen.queryByText('Pattern Two')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show all patterns/i }));
    expect(screen.getByText('Pattern One')).toBeInTheDocument();
    expect(screen.getByText('Pattern Two')).toBeInTheDocument();
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
      updatedAt: '2026-01-01T00:00:00.000Z',
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
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const onOpenPattern = vi.fn();
    render(
      <HomeScreen onOpenPattern={onOpenPattern} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());

    await userEvent.click(screen.getByText('My First Pattern'));
    expect(onOpenPattern).toHaveBeenCalledWith('pattern-1');
  });

  it('asks for confirmation before deleting, and cancel keeps the pattern', async () => {
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
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const onOpenPattern = vi.fn();
    render(
      <HomeScreen onOpenPattern={onOpenPattern} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete my first pattern/i }));
    expect(onOpenPattern).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('button', { name: /delete forever/i })).not.toBeInTheDocument();
    expect(screen.getByText('My First Pattern')).toBeInTheDocument();
  });

  it('deletes a pattern once the deletion is confirmed', async () => {
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
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(<HomeScreen onOpenPattern={vi.fn()} onNewPattern={vi.fn()} onManagePalettes={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('My First Pattern')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /delete my first pattern/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() =>
      expect(screen.queryByText('My First Pattern')).not.toBeInTheDocument(),
    );
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

it('publishes the materials overview when share overview is clicked', async () => {
  await savePalette(defaultPalette);

  const color = defaultPalette.colors[0].name;

  await savePattern({
    id: 'pattern-1',
    name: 'My First Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 1,
    cols: 1,
    cellColors: [[color]],
    paletteId: defaultPalette.id,
    completedColors: [],
    thumbnail: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const randomUUID = vi
    .spyOn(crypto, 'randomUUID')
    .mockReturnValue('00000000-0000-4000-8000-000000000001');

  render(
    <HomeScreen
      onOpenPattern={vi.fn()}
      onNewPattern={vi.fn()}
      onManagePalettes={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^share overview$/i })).toBeInTheDocument(),
  );

  await userEvent.click(screen.getByRole('button', { name: /^share overview$/i }));

  await waitFor(() =>
    expect(mockedPublishOverview).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pattern-1',
          name: 'My First Pattern',
        }),
      ]),
      expect.any(Map),
    ),
  );

  expect(screen.getByRole('button', { name: /stop sharing overview/i })).toBeInTheDocument();
  expect(window.localStorage.getItem('beadart.overviewShareSlug')).toBe(
    '00000000-0000-4000-8000-000000000001',
  );

  randomUUID.mockRestore();
});

it('copies the overview share link', async () => {
  await savePalette(defaultPalette);

  const color = defaultPalette.colors[0].name;

  await savePattern({
    id: 'pattern-1',
    name: 'My First Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 1,
    cols: 1,
    cellColors: [[color]],
    paletteId: defaultPalette.id,
    completedColors: [],
    thumbnail: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  window.localStorage.setItem(
    'beadart.overviewShareSlug',
    'overview-slug',
  );

  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue(undefined);

  render(
    <HomeScreen
      onOpenPattern={vi.fn()}
      onNewPattern={vi.fn()}
      onManagePalettes={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /copy link/i }),
    ).toBeInTheDocument(),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /copy link/i }),
  );

  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}${window.location.pathname}?overview=overview-slug`,
  );

  expect(
    screen.getByRole('button', { name: /copied!/i }),
  ).toBeInTheDocument();
});

it('stops sharing the materials overview', async () => {
  await savePalette(defaultPalette);

  const color = defaultPalette.colors[0].name;

  await savePattern({
    id: 'pattern-1',
    name: 'My First Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 1,
    cols: 1,
    cellColors: [[color]],
    paletteId: defaultPalette.id,
    completedColors: [],
    thumbnail: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  window.localStorage.setItem('beadart.overviewShareSlug', 'overview-slug');

  render(
    <HomeScreen
      onOpenPattern={vi.fn()}
      onNewPattern={vi.fn()}
      onManagePalettes={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /stop sharing overview/i }),
    ).toBeInTheDocument(),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /stop sharing overview/i }),
  );

  await waitFor(() =>
    expect(mockedUnpublishOverview).toHaveBeenCalledWith('overview-slug'),
  );

  expect(window.localStorage.getItem('beadart.overviewShareSlug')).toBeNull();
  expect(screen.getByRole('button', { name: /^share overview$/i })).toBeInTheDocument();
});

it('shows an error when publishing the overview fails', async () => {
  await savePalette(defaultPalette);

  const color = defaultPalette.colors[0].name;

  await savePattern({
    id: 'pattern-1',
    name: 'My First Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 1,
    cols: 1,
    cellColors: [[color]],
    paletteId: defaultPalette.id,
    completedColors: [],
    thumbnail: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  mockedPublishOverview.mockRejectedValueOnce(new Error('network down'));

  const randomUUID = vi
    .spyOn(crypto, 'randomUUID')
    .mockReturnValue('00000000-0000-4000-8000-000000000001');

  render(
    <HomeScreen
      onOpenPattern={vi.fn()}
      onNewPattern={vi.fn()}
      onManagePalettes={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^share overview$/i })).toBeInTheDocument(),
  );

  await userEvent.click(screen.getByRole('button', { name: /^share overview$/i }));

  await waitFor(() =>
    expect(
      screen.getByText(/could not share the overview/i),
    ).toBeInTheDocument(),
  );

  expect(window.localStorage.getItem('beadart.overviewShareSlug')).toBeNull();

  randomUUID.mockRestore();
});