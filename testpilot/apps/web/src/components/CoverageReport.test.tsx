import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CoverageReport from './CoverageReport';

describe('CoverageReport', () => {
  it('renders line coverage as a percentage', () => {
    render(<CoverageReport lineCoverage={0.92} branchCoverage={0.85} methodCoverage={1.0} />);
    expect(screen.getByText(/92\.0%/)).toBeInTheDocument();
  });

  it('renders branch coverage as a percentage', () => {
    render(<CoverageReport lineCoverage={0.92} branchCoverage={0.85} methodCoverage={1.0} />);
    expect(screen.getByText(/85\.0%/)).toBeInTheDocument();
  });

  it('renders method coverage as a percentage', () => {
    render(<CoverageReport lineCoverage={0.92} branchCoverage={0.85} methodCoverage={1.0} />);
    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
  });

  it('applies a passing indicator when line coverage meets the threshold', () => {
    render(<CoverageReport lineCoverage={0.75} branchCoverage={0.5} methodCoverage={0.9} />);
    const lineEl = screen.getByTestId('line-coverage');
    expect(lineEl).toHaveAttribute('data-passing', 'true');
  });

  it('applies a failing indicator when line coverage is below the threshold', () => {
    render(<CoverageReport lineCoverage={0.5} branchCoverage={0.3} methodCoverage={0.6} />);
    const lineEl = screen.getByTestId('line-coverage');
    expect(lineEl).toHaveAttribute('data-passing', 'false');
  });
});
