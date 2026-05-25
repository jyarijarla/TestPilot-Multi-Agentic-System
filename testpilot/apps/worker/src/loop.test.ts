import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRunPlanner  = vi.hoisted(() => vi.fn());
const mockRunGenerator = vi.hoisted(() => vi.fn());
const mockRunExecutor  = vi.hoisted(() => vi.fn());
const mockRunEvaluator = vi.hoisted(() => vi.fn());

vi.mock('./agents/planner.js',   () => ({ runPlanner:   mockRunPlanner }));
vi.mock('./agents/generator.js', () => ({ runGenerator: mockRunGenerator }));
vi.mock('./agents/executor.js',  () => ({ runExecutor:  mockRunExecutor }));
vi.mock('./agents/evaluator.js', () => ({ runEvaluator: mockRunEvaluator }));

import { runLoop, MAX_RETRY } from './loop.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PLANNER_OUT = {
  testCases: ['test null input', 'test empty array'],
  tokensUsed: 150,
  durationMs: 200,
};

const GEN_OUT = {
  testFile: 'package com.example;\nclass BubbleSortTest { }',
  tokensUsed: 450,
  durationMs: 1200,
};

const EXEC_PASS = {
  exitCode: 0,
  stdout: 'BUILD SUCCESSFUL\n2 tests passed',
  stderr: '',
  coverage: { lineCoverage: 0.9, branchCoverage: 0.8, methodCoverage: 1.0 },
  durationMs: 28000,
};

const EXEC_FAIL = {
  exitCode: 1,
  stdout: 'BUILD FAILED\n1 test failed',
  stderr: 'testNullInput: expected NullPointerException but no exception was thrown',
  coverage: { lineCoverage: 0.5, branchCoverage: 0.3, methodCoverage: 0.8 },
  durationMs: 25000,
};

const EVAL_PASS  = { decision: 'PASS'  as const, feedback: '',                                tokensUsed: 80, durationMs: 300 };
const EVAL_RETRY = { decision: 'RETRY' as const, feedback: 'Add null guard on line 12',       tokensUsed: 80, durationMs: 300 };

const BASE = {
  sourceCode: 'package com.example;\npublic class BubbleSort { public void sort(int[] a) {} }',
  className: 'BubbleSort',
  goal: 'Verify BubbleSort handles null, empty, and sorted arrays',
};

function setupHappyPath() {
  mockRunPlanner.mockResolvedValue(PLANNER_OUT);
  mockRunGenerator.mockResolvedValue(GEN_OUT);
  mockRunExecutor.mockResolvedValue(EXEC_PASS);
  mockRunEvaluator.mockResolvedValue(EVAL_PASS);
}

function setupRetryThenPass() {
  mockRunPlanner.mockResolvedValue(PLANNER_OUT);
  mockRunGenerator.mockResolvedValue(GEN_OUT);
  mockRunExecutor
    .mockResolvedValueOnce(EXEC_FAIL)
    .mockResolvedValueOnce(EXEC_PASS);
  mockRunEvaluator
    .mockResolvedValueOnce(EVAL_RETRY)
    .mockResolvedValueOnce(EVAL_PASS);
}

function setupAlwaysRetry() {
  mockRunPlanner.mockResolvedValue(PLANNER_OUT);
  mockRunGenerator.mockResolvedValue(GEN_OUT);
  mockRunExecutor.mockResolvedValue(EXEC_FAIL);
  mockRunEvaluator.mockResolvedValue(EVAL_RETRY);
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('runLoop — happy path (PASS first try)', () => {
  beforeEach(() => {
    mockRunPlanner.mockReset();
    mockRunGenerator.mockReset();
    mockRunExecutor.mockReset();
    mockRunEvaluator.mockReset();
    setupHappyPath();
  });

  it('returns status CHECKPOINT when evaluator returns PASS', async () => {
    const result = await runLoop(BASE);
    expect(result.status).toBe('CHECKPOINT');
  });

  it('returns retryCount 0 on first-try pass', async () => {
    const result = await runLoop(BASE);
    expect(result.retryCount).toBe(0);
  });

  it('returns the generated test file in lastTestFile', async () => {
    const result = await runLoop(BASE);
    expect(result.lastTestFile).toBe(GEN_OUT.testFile);
  });

  it('returns test cases from planner in testCases', async () => {
    const result = await runLoop(BASE);
    expect(result.testCases).toEqual(PLANNER_OUT.testCases);
  });

  it('records exactly 4 steps: planner, generator, executor, evaluator', async () => {
    const result = await runLoop(BASE);
    expect(result.steps).toHaveLength(4);
  });

  it('planner step has agent "planner" and model "haiku"', async () => {
    const result = await runLoop(BASE);
    expect(result.steps[0].agent).toBe('planner');
    expect(result.steps[0].model).toBe('haiku');
  });

  it('generator step has agent "generator" and model "sonnet"', async () => {
    const result = await runLoop(BASE);
    expect(result.steps[1].agent).toBe('generator');
    expect(result.steps[1].model).toBe('sonnet');
  });

  it('executor step has agent "executor" and model "none"', async () => {
    const result = await runLoop(BASE);
    expect(result.steps[2].agent).toBe('executor');
    expect(result.steps[2].model).toBe('none');
  });

  it('evaluator step has agent "evaluator" and model "haiku"', async () => {
    const result = await runLoop(BASE);
    expect(result.steps[3].agent).toBe('evaluator');
    expect(result.steps[3].model).toBe('haiku');
  });
});

// ─── Retry path ───────────────────────────────────────────────────────────────

describe('runLoop — one retry then PASS', () => {
  beforeEach(() => {
    mockRunPlanner.mockReset();
    mockRunGenerator.mockReset();
    mockRunExecutor.mockReset();
    mockRunEvaluator.mockReset();
    setupRetryThenPass();
  });

  it('calls generator a second time with retryFeedback when evaluator returns RETRY', async () => {
    await runLoop(BASE);
    expect(mockRunGenerator).toHaveBeenCalledTimes(2);
    const secondCall = mockRunGenerator.mock.calls[1][0];
    expect(secondCall.retryFeedback).toBe(EVAL_RETRY.feedback);
  });

  it('returns retryCount 1 after one RETRY', async () => {
    const result = await runLoop(BASE);
    expect(result.retryCount).toBe(1);
  });

  it('records 7 steps after one retry (1 planner + 2*(gen+exec+eval))', async () => {
    const result = await runLoop(BASE);
    expect(result.steps).toHaveLength(7);
  });

  it('returns status CHECKPOINT after retry followed by PASS', async () => {
    const result = await runLoop(BASE);
    expect(result.status).toBe('CHECKPOINT');
  });
});

// ─── Max retry cap ────────────────────────────────────────────────────────────

describe('runLoop — max retry cap (evaluator always returns RETRY)', () => {
  beforeEach(() => {
    mockRunPlanner.mockReset();
    mockRunGenerator.mockReset();
    mockRunExecutor.mockReset();
    mockRunEvaluator.mockReset();
    setupAlwaysRetry();
  });

  it('generator is called MAX_RETRY + 1 times total', async () => {
    await runLoop(BASE);
    expect(mockRunGenerator).toHaveBeenCalledTimes(MAX_RETRY + 1);
  });

  it('returns retryCount equal to MAX_RETRY when cap is hit', async () => {
    const result = await runLoop(BASE);
    expect(result.retryCount).toBe(MAX_RETRY);
  });

  it('returns status CHECKPOINT (not FAILED) when max retries exhausted', async () => {
    const result = await runLoop(BASE);
    expect(result.status).toBe('CHECKPOINT');
  });

  it('records 1 + (MAX_RETRY + 1) * 3 steps when cap is hit', async () => {
    const result = await runLoop(BASE);
    expect(result.steps).toHaveLength(1 + (MAX_RETRY + 1) * 3);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('runLoop — error handling', () => {
  beforeEach(() => {
    mockRunPlanner.mockReset();
    mockRunGenerator.mockReset();
    mockRunExecutor.mockReset();
    mockRunEvaluator.mockReset();
  });

  it('returns status FAILED when planner throws', async () => {
    mockRunPlanner.mockRejectedValue(new Error('Haiku API timeout'));
    const result = await runLoop(BASE);
    expect(result.status).toBe('FAILED');
  });

  it('includes the error message in result when FAILED', async () => {
    mockRunPlanner.mockRejectedValue(new Error('Haiku API timeout'));
    const result = await runLoop(BASE);
    expect(result.error).toContain('Haiku API timeout');
  });

  it('returns status FAILED when generator throws', async () => {
    mockRunPlanner.mockResolvedValue(PLANNER_OUT);
    mockRunGenerator.mockRejectedValue(new Error('Sonnet returned empty response'));
    const result = await runLoop(BASE);
    expect(result.status).toBe('FAILED');
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

describe('runLoop — constants', () => {
  it('exports MAX_RETRY as 2 (hard cap from cost rules)', () => {
    expect(MAX_RETRY).toBe(2);
  });
});
