import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Report from './Report';

const FAKE_REPORT = {
  testFile: 'class BubbleSortTest {}',
  passRate: 1.0,
  coverage: 0.92,
  redPhase: 'testNullInput failed — no null guard existed',
  greenPhase: 'Added null check on line 3; all tests now pass',
  refactorSuggestions: ['Extract swap logic into a private method', 'Add early-exit when sorted'],
};

function renderReport(report = FAKE_REPORT) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/runs/run_abc/report', state: { report } }]}>
      <Routes>
        <Route path="/runs/:id/report" element={<Report />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Report', () => {
  it('shows an error message when no report is in route state', () => {
    render(
      <MemoryRouter initialEntries={['/runs/run_abc/report']}>
        <Routes>
          <Route path="/runs/:id/report" element={<Report />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/no report/i)).toBeInTheDocument();
  });

  it('renders the red phase description', () => {
    renderReport();
    expect(screen.getByTestId('red-phase')).toHaveTextContent(FAKE_REPORT.redPhase);
  });

  it('renders the green phase description', () => {
    renderReport();
    expect(screen.getByTestId('green-phase')).toHaveTextContent(FAKE_REPORT.greenPhase);
  });

  it('renders each refactor suggestion', () => {
    renderReport();
    const items = screen.getAllByTestId('refactor-suggestion');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Extract swap logic into a private method');
  });

  it('renders the formatted pass rate', () => {
    renderReport();
    expect(screen.getByTestId('pass-rate')).toHaveTextContent('100%');
  });

  it('renders the formatted line coverage', () => {
    renderReport();
    expect(screen.getByTestId('coverage')).toHaveTextContent('92.0%');
  });
});
