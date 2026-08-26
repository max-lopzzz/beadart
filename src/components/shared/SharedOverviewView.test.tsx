import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SharedOverviewView } from './SharedOverviewView';
import { fetchSharedOverview } from '../../lib/sharing/shareRepo';

vi.mock('../../lib/sharing/shareRepo', () => ({
  fetchSharedOverview: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchSharedOverview);

describe('SharedOverviewView', () => {
  it('shows pattern count, bead totals, and overall percent', async () => {
    mockedFetch.mockResolvedValue({
      patternCount: 3,
      beadsPlaced: 150,
      beadsTotal: 200,
      percent: 75,
      materials: [
        { name: 'Red', hex: '#ff0000', total: 100, remaining: 0 },
        { name: 'Blue', hex: '#0000ff', total: 100, remaining: 50 },
      ],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedOverviewView slug="abc123" />);

    await waitFor(() => screen.getByText(/3 patterns/i));
    expect(screen.getByText(/150 \/ 200 beads placed/i)).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.getByText('50 left')).toBeInTheDocument();
  });

  it('uses singular "pattern" for a count of one', async () => {
    mockedFetch.mockResolvedValue({
      patternCount: 1,
      beadsPlaced: 10,
      beadsTotal: 10,
      percent: 100,
      materials: [],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedOverviewView slug="abc123" />);
    await waitFor(() => screen.getByText(/1 pattern ·/i));
  });

  it('shows a not-found message when the overview is no longer shared', async () => {
    mockedFetch.mockResolvedValue(null);
    render(<SharedOverviewView slug="missing" />);
    await waitFor(() => screen.getByText(/isn't shared anymore/i));
  });

  it('shows an error message when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));
    render(<SharedOverviewView slug="abc123" />);
    await waitFor(() => screen.getByText(/couldn't load this overview/i));
  });
});
