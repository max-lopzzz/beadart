import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SharedPatternView } from './SharedPatternView';
import { fetchSharedPattern } from '../../lib/sharing/shareRepo';

vi.mock('../../lib/sharing/shareRepo', () => ({
  fetchSharedPattern: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchSharedPattern);

describe('SharedPatternView', () => {
  it('shows the pattern name, completion percent, and per-color status', async () => {
    mockedFetch.mockResolvedValue({
      slug: 'abc123',
      name: 'Cool Pattern',
      thumbnail: '',
      percent: 50,
      colors: [
        { name: 'Red', hex: '#ff0000', total: 2, done: true },
        { name: 'Blue', hex: '#0000ff', total: 2, done: false },
      ],
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    render(<SharedPatternView slug="abc123" />);

    await waitFor(() => screen.getByText('Cool Pattern'));
    expect(screen.getByText('50% complete')).toBeInTheDocument();
    expect(screen.getByText(/red × 2/i)).toBeInTheDocument();
    expect(screen.getByText(/blue × 2/i)).toBeInTheDocument();
    expect(screen.getAllByText('done')).toHaveLength(1);
    expect(screen.getAllByText('remaining')).toHaveLength(1);
  });

  it('shows a not-found message when the slug has no shared pattern', async () => {
    mockedFetch.mockResolvedValue(null);
    render(<SharedPatternView slug="missing" />);
    await waitFor(() => screen.getByText(/isn't shared anymore/i));
  });

  it('shows an error message when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));
    render(<SharedPatternView slug="abc123" />);
    await waitFor(() => screen.getByText(/couldn't load this pattern/i));
  });
});
