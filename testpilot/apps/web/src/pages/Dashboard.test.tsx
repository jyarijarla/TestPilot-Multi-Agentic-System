import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const FAKE_RUNS = [
  { id: 'run_1', goal: 'Test BubbleSort', status: 'CHECKPOINT', retryCount: 0, createdAt: '2026-05-14T00:00:00Z' },
  { id: 'run_2', goal: 'Test MergeSort', status: 'PENDING', retryCount: 0, createdAt: '2026-05-14T01:00:00Z' },
];

function mockFetch(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('Dashboard', () => {
  it('fetches /api/runs on mount', async () => {
    mockFetch({ runs: [] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/runs'));
  });

  it('renders the goal of each run', async () => {
    mockFetch({ runs: FAKE_RUNS });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText('Test BubbleSort')).toBeInTheDocument();
    expect(screen.getByText('Test MergeSort')).toBeInTheDocument();
  });

  it('renders a status badge for each run', async () => {
    mockFetch({ runs: FAKE_RUNS });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByText('Test BubbleSort');
    const badges = screen.getAllByTestId('status-badge');
    expect(badges).toHaveLength(2);
  });

  it('shows empty state message when there are no runs', async () => {
    mockFetch({ runs: [] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText(/no runs/i)).toBeInTheDocument();
  });

  it('shows GoalInput form when the New Run button is clicked', async () => {
    const user = userEvent.setup();
    mockFetch({ runs: [] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByText(/no runs/i);
    await user.click(screen.getByRole('button', { name: /new run/i }));
    expect(screen.getByLabelText(/java source/i)).toBeInTheDocument();
  });
});
