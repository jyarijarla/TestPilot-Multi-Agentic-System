import { test, expect } from '@playwright/test';

const BASE_RUNS = [
  { id: 'run_1', goal: 'Test BubbleSort null handling', status: 'CHECKPOINT', retryCount: 1, createdAt: '2026-05-14T00:00:00Z' },
  { id: 'run_2', goal: 'Test MergeSort performance', status: 'PENDING', retryCount: 0, createdAt: '2026-05-14T01:00:00Z' },
];

test.describe('Dashboard', () => {
  test('shows empty state when there are no runs', async ({ page }) => {
    await page.route(/\/api\/runs$/, (route) => route.fulfill({ json: { runs: [] } }));

    await page.goto('/dashboard');
    await expect(page.getByText(/no runs/i)).toBeVisible();
  });

  test('shows a list of runs with their goal and status badge', async ({ page }) => {
    await page.route(/\/api\/runs$/, (route) => route.fulfill({ json: { runs: BASE_RUNS } }));

    await page.goto('/dashboard');
    await expect(page.getByText('Test BubbleSort null handling')).toBeVisible();
    await expect(page.getByText('Test MergeSort performance')).toBeVisible();
    await expect(page.getByTestId('status-badge')).toHaveCount(2);
  });

  test('shows the GoalInput form when New Run is clicked', async ({ page }) => {
    await page.route(/\/api\/runs$/, (route) => route.fulfill({ json: { runs: [] } }));

    await page.goto('/dashboard');
    await expect(page.getByText(/no runs/i)).toBeVisible();
    await page.getByRole('button', { name: /new run/i }).click();
    await expect(page.getByLabel(/java source/i)).toBeVisible();
    await expect(page.getByLabel(/goal/i)).toBeVisible();
  });

  test('POSTs to /api/runs and reloads the list after submitting GoalInput', async ({ page }) => {
    const newRun = { id: 'run_new', goal: 'Test LinkedList insert', status: 'PENDING', retryCount: 0, createdAt: '2026-05-14T02:00:00Z' };
    let listCallCount = 0;

    await page.route(/\/api\/runs$/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: { runId: newRun.id } });
      } else {
        listCallCount++;
        route.fulfill({ json: { runs: listCallCount === 1 ? [] : [newRun] } });
      }
    });

    await page.goto('/dashboard');
    await expect(page.getByText(/no runs/i)).toBeVisible();
    await page.getByRole('button', { name: /new run/i }).click();
    await page.getByLabel(/java source/i).fill('public class LinkedList {}');
    await page.getByLabel(/goal/i).fill('Test LinkedList insert');
    await page.getByRole('button', { name: /run tdd/i }).click();

    await expect(page.getByText('Test LinkedList insert')).toBeVisible();
  });

  test('navigates to RunDetail when a run is clicked', async ({ page }) => {
    await page.route(/\/api\/runs$/, (route) => route.fulfill({ json: { runs: BASE_RUNS } }));
    await page.route(/\/api\/runs\/run_1$/, (route) =>
      route.fulfill({ json: { run: { ...BASE_RUNS[0], steps: [] } } }),
    );

    await page.goto('/dashboard');
    await page.getByText('Test BubbleSort null handling').click();
    await expect(page).toHaveURL(/\/runs\/run_1/);
  });
});
