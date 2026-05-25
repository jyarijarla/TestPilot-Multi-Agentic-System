import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentTimeline from './AgentTimeline';

const STEPS = [
  { agent: 'planner', model: 'haiku', input: 'goal', output: '["test 1"]', tokensUsed: 300, durationMs: 450 },
  { agent: 'generator', model: 'sonnet', input: '', output: 'class Test {}', tokensUsed: 1200, durationMs: 1800 },
  { agent: 'executor', model: 'none', input: 'class Test {}', output: 'BUILD SUCCESS', tokensUsed: 0, durationMs: 12000 },
];

describe('AgentTimeline', () => {
  it('renders nothing meaningful when steps is empty', () => {
    const { container } = render(<AgentTimeline steps={[]} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('renders each step agent name', () => {
    render(<AgentTimeline steps={STEPS} />);
    expect(screen.getByText('planner')).toBeInTheDocument();
    expect(screen.getByText('generator')).toBeInTheDocument();
    expect(screen.getByText('executor')).toBeInTheDocument();
  });

  it('renders each step model badge', () => {
    render(<AgentTimeline steps={STEPS} />);
    expect(screen.getByText('haiku')).toBeInTheDocument();
    expect(screen.getByText('sonnet')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('renders duration for each step', () => {
    render(<AgentTimeline steps={STEPS} />);
    expect(screen.getByText(/450\s*ms/i)).toBeInTheDocument();
    expect(screen.getByText(/1800\s*ms/i)).toBeInTheDocument();
  });

  it('renders token count when tokensUsed is non-zero', () => {
    render(<AgentTimeline steps={STEPS} />);
    expect(screen.getByText(/300\s*tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/1200\s*tokens/i)).toBeInTheDocument();
  });
});
