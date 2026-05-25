import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalInput from './GoalInput';

const SOURCE = 'public class BubbleSort';
const GOAL = 'Verify BubbleSort handles null and empty arrays';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('GoalInput', () => {
  it('renders a textarea for Java source code', () => {
    render(<GoalInput onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/java source/i)).toBeInTheDocument();
  });

  it('renders an input for the goal', () => {
    render(<GoalInput onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/goal/i)).toBeInTheDocument();
  });

  it('submit button is disabled when both fields are empty', () => {
    render(<GoalInput onSuccess={vi.fn()} />);
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('submit button is disabled when only one field is filled', async () => {
    const user = userEvent.setup();
    render(<GoalInput onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/java source/i), SOURCE);
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('calls POST /api/runs with goal and sourceCode on submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runId: 'run_abc' }),
    } as Response);

    render(<GoalInput onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/java source/i), SOURCE);
    await user.type(screen.getByLabelText(/goal/i), GOAL);
    await user.click(screen.getByRole('button', { name: /run/i }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ goal: GOAL, sourceCode: SOURCE }),
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith('run_abc');
  });
});
