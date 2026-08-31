import { describe, it, expect, vi, afterEach } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';

import { SharedOverviewView } from './SharedOverviewView';

import { fetchSharedOverview } from '../../lib/sharing/shareRepo';

vi.mock('../../lib/sharing/shareRepo', () => ({
  fetchSharedOverview: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchSharedOverview);

afterEach(() => {
  vi.clearAllMocks();
});

describe('SharedOverviewView', () => {
  it('shows overview progress, pattern count, bead totals, and materials', async () => {
    mockedFetch.mockResolvedValue({
      patternCount: 2,
      beadsPlaced: 6,
      beadsTotal: 8,
      percent: 75,
      materials: [
        {
          name: 'Blue',
          hex: '#0000ff',
          total: 4,
          remaining: 4,
        },
        {
          name: 'Red',
          hex: '#ff0000',
          total: 4,
          remaining: 2,
        },
      ],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedOverviewView slug="overview-123" />);

    await waitFor(() => screen.getByText('Bead art progress'));

    expect(screen.getByText(/2 patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/6 \/ 8 beads placed/i)).toBeInTheDocument();

    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('4 left')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('shows singular pattern when there is only one pattern', async () => {
    mockedFetch.mockResolvedValue({
      patternCount: 1,
      beadsPlaced: 4,
      beadsTotal: 4,
      percent: 100,
      materials: [
        {
          name: 'Red',
          hex: '#ff0000',
          total: 4,
          remaining: 0,
        },
      ],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedOverviewView slug="overview-123" />);

    await waitFor(() => screen.getByText('Bead art progress'));

    expect(screen.getByText(/1 pattern ·/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 4 beads placed/i)).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('shows a not-found message when the slug has no shared overview', async () => {
    mockedFetch.mockResolvedValue(null);

    render(<SharedOverviewView slug="missing" />);

    await waitFor(() =>
      screen.getByText(/this overview isn't shared anymore/i),
    );
  });

  it('shows an error message when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));

    render(<SharedOverviewView slug="overview-123" />);

    await waitFor(() =>
      screen.getByText(/couldn't load this overview/i),
    );
  });

  it('shows no materials list when the overview has no materials', async () => {
    mockedFetch.mockResolvedValue({
      patternCount: 0,
      beadsPlaced: 0,
      beadsTotal: 0,
      percent: 100,
      materials: [],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedOverviewView slug="empty-overview" />);

    await waitFor(() => screen.getByText('Bead art progress'));

    expect(screen.getByText(/0 patterns ·/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 0 beads placed/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
