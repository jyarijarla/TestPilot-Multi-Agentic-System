import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RunDetail from './RunDetail';

const FAKE_RUN_PENDING = {
  id: 'run_abc',
  goal: 'Test BubbleSort null handling',
  status: 'PENDING',
  retryCount: 0,
  steps: [],
};

const FAKE_RUN_CHECKPOINT = {
  id: 'run_abc',
  goal: 'Test BubbleSort null handling',
  status: 'CHECKPOINT',
  retryCount: 1,
  steps: [
    { agent: 'planner', model: 'haiku', input: 'goal', output: '["test null"]', tokensUsed: 300, durationMs: 450 },
    { agent: 'generator', model: 'sonnet', input: '', output: 'class BubbleSortTest {}', tokensUsed: 1200, durationMs: 1800 },
  ],
};

function renderRunDetail(runId = 'run_abc') {
  return render(
    <MemoryRouter initialEntries={[`/runs/${runId}`]}>
      <Routes>
        <Route path="/runs/:id" element={<RunDetail />} />
        <Route path="/runs/:id/report" element={<div>Report Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockFetch(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('RunDetail', () => {
  it('fetches /api/runs/:id using the route param', async () => {
    mockFetch({ run: FAKE_RUN_PENDING });
    renderRunDetail('run_abc');
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/runs/run_abc'),
    );
  });

  it('renders the run goal', async () => {
    mockFetch({ run: FAKE_RUN_PENDING });
    renderRunDetail();
    expect(await screen.findByText('Test BubbleSort null handling')).toBeInTheDocument();
  });

  it('renders the status badge', async () => {
    mockFetch({ run: FAKE_RUN_PENDING });
    renderRunDetail();
    await screen.findByText('Test BubbleSort null handling');
    expect(screen.getByTestId('status-badge')).toHaveTextContent('PENDING');
  });

  it('renders agent names from the steps timeline', async () => {
    mockFetch({ run: FAKE_RUN_CHECKPOINT });
    renderRunDetail();
    expect(await screen.findByText('planner')).toBeInTheDocument();
    expect(screen.getByText('generator')).toBeInTheDocument();
  });

  it('shows the Approve button when status is CHECKPOINT', async () => {
    mockFetch({ run: FAKE_RUN_CHECKPOINT });
    renderRunDetail();
    expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
  });

  it('does not show the Approve button when status is not CHECKPOINT', async () => {
    mockFetch({ run: FAKE_RUN_PENDING });
    renderRunDetail();
    await screen.findByText('Test BubbleSort null handling');
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('calls POST /api/runs/:id/approve when Approve is clicked', async () => {
    const user = userEvent.setup();
    mockFetch({ run: FAKE_RUN_CHECKPOINT });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ report: { testFile: '', passRate: 1, coverage: 0.9, redPhase: 'r', greenPhase: 'g', refactorSuggestions: [] } }),
    } as Response);

    renderRunDetail();
    await user.click(await screen.findByRole('button', { name: /approve/i }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/runs/run_abc/approve',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
