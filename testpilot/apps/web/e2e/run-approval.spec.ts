import { test, expect } from '@playwright/test';

const CHECKPOINT_RUN = {
  id: 'run_cp',
  goal: 'Verify BubbleSort handles null and empty arrays',
  status: 'CHECKPOINT',
  retryCount: 1,
  steps: [
    { agent: 'planner', model: 'haiku', input: 'goal', output: '["test null","test empty"]', tokensUsed: 350, durationMs: 520 },
    { agent: 'generator', model: 'sonnet', input: '', output: 'class BubbleSortTest {}', tokensUsed: 1100, durationMs: 1650 },
    { agent: 'executor', model: 'none', input: 'class BubbleSortTest {}', output: 'BUILD SUCCESS', tokensUsed: 0, durationMs: 11200 },
    { agent: 'evaluator', model: 'haiku', input: 'BUILD SUCCESS', output: '{"decision":"PASS","feedback":""}', tokensUsed: 200, durationMs: 430 },
  ],
};

const FAKE_REPORT = {
  testFile: 'class BubbleSortTest { @Test void testNull() {} }',
  passRate: 1.0,
  coverage: 0.92,
  redPhase: 'testNull and testEmpty failed — no null guard or early return existed',
  greenPhase: 'Added null check on line 3 and early return for empty arrays; all tests pass',
  refactorSuggestions: ['Extract swap logic into a private helper', 'Add early-exit when no swaps occur in a pass'],
};

async function mockRunDetail(page: import('@playwright/test').Page) {
  await page.route(/\/api\/runs\/run_cp\/approve/, (route) =>
    route.fulfill({ json: { report: FAKE_REPORT } }),
  );
  await page.route(/\/api\/runs\/run_cp$/, (route) =>
    route.fulfill({ json: { run: CHECKPOINT_RUN } }),
  );
}

test.describe('RunDetail', () => {
  test('renders the run goal as a heading', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await expect(page.getByText('Verify BubbleSort handles null and empty arrays')).toBeVisible();
  });

  test('shows the CHECKPOINT status badge', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await expect(page.getByTestId('status-badge')).toHaveText('CHECKPOINT');
  });

  test('renders all four agent steps in the timeline', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await expect(page.getByText('planner')).toBeVisible();
    await expect(page.getByText('generator')).toBeVisible();
    await expect(page.getByText('executor')).toBeVisible();
    await expect(page.getByText('evaluator')).toBeVisible();
  });

  test('shows the Approve button when status is CHECKPOINT', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
  });
});

test.describe('Approval flow', () => {
  test('navigates to the Report page after approval', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await page.getByRole('button', { name: /approve/i }).click();
    await expect(page).toHaveURL(/\/runs\/run_cp\/report/);
  });

  test('Report page shows the Red-Green-Refactor breakdown', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await page.getByRole('button', { name: /approve/i }).click();
    await expect(page.getByTestId('red-phase')).toHaveText(FAKE_REPORT.redPhase);
    await expect(page.getByTestId('green-phase')).toHaveText(FAKE_REPORT.greenPhase);
    await expect(page.getByTestId('refactor-suggestion').first()).toBeVisible();
  });

  test('Report page shows pass rate and coverage', async ({ page }) => {
    await mockRunDetail(page);
    await page.goto('/runs/run_cp');
    await page.getByRole('button', { name: /approve/i }).click();
    await expect(page.getByTestId('pass-rate')).toHaveText('100%');
    await expect(page.getByTestId('coverage')).toHaveText('92.0%');
  });
});
