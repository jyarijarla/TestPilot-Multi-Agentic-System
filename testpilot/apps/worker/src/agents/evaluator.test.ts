import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { runEvaluator, COVERAGE_THRESHOLD } from './evaluator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockHaikuResponse(decision: 'PASS' | 'RETRY', feedback: string) {
  mockCreate.mockResolvedValueOnce({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ decision, feedback }) }],
    usage: { input_tokens: 80, output_tokens: 60 },
  });
}

const GOOD_COVERAGE = { lineCoverage: 0.9, branchCoverage: 0.8, methodCoverage: 1.0 };
const LOW_COVERAGE  = { lineCoverage: 0.5, branchCoverage: 0.4, methodCoverage: 0.8 };

const BASE_INPUT = {
  passCount: 3,
  failCount: 1,
  failureSummary: 'testNullInput: expected NullPointerException but no exception was thrown',
  coverage: LOW_COVERAGE,
  uncoveredLines: ['line 12: null guard', 'line 18: empty array check'],
  goal: 'Verify BubbleSort handles edge cases',
  retryCount: 0,
};

// ─── Model selection (cost control) ──────────────────────────────────────────

describe('evaluator — model selection', () => {
  beforeEach(() => mockCreate.mockReset());

  it('calls Claude Haiku (cost-control rule: evaluator must use Haiku)', async () => {
    mockHaikuResponse('RETRY', 'Add null guard on line 12');
    await runEvaluator(BASE_INPUT);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('haiku') }),
    );
  });

  it('does NOT call Sonnet', async () => {
    mockHaikuResponse('RETRY', 'Add null guard');
    await runEvaluator(BASE_INPUT);
    const calledModel: string = mockCreate.mock.calls[0][0].model;
    expect(calledModel).not.toContain('sonnet');
  });
});

// ─── Short-circuit: structural PASS without any AI call ───────────────────────

describe('evaluator — structural PASS (no AI call)', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns PASS immediately when all tests pass and coverage meets the threshold', async () => {
    const result = await runEvaluator({
      ...BASE_INPUT,
      failCount: 0,
      coverage: GOOD_COVERAGE,
    });
    expect(result.decision).toBe('PASS');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 0 tokensUsed when short-circuiting (no AI call was made)', async () => {
    const result = await runEvaluator({
      ...BASE_INPUT,
      failCount: 0,
      coverage: GOOD_COVERAGE,
    });
    expect(result.tokensUsed).toBe(0);
  });

  it('calls Haiku when failCount is 0 but coverage is below threshold', async () => {
    mockHaikuResponse('RETRY', 'Coverage too low — add tests for uncovered paths');
    await runEvaluator({ ...BASE_INPUT, failCount: 0, coverage: LOW_COVERAGE });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('calls Haiku when coverage meets threshold but tests are still failing', async () => {
    mockHaikuResponse('RETRY', 'Fix the failing assertion in testNullInput');
    await runEvaluator({ ...BASE_INPUT, failCount: 1, coverage: GOOD_COVERAGE });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('exports COVERAGE_THRESHOLD so the loop and UI can display the same value', () => {
    expect(typeof COVERAGE_THRESHOLD).toBe('number');
    expect(COVERAGE_THRESHOLD).toBeGreaterThan(0);
    expect(COVERAGE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});

// ─── Prompt content (cost-control: no test file allowed) ─────────────────────

describe('evaluator — prompt content', () => {
  beforeEach(() => mockCreate.mockReset());

  it('includes the failure summary in the prompt', async () => {
    mockHaikuResponse('RETRY', 'Fix the null guard');
    await runEvaluator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain('testNullInput');
  });

  it('includes uncovered lines in the prompt', async () => {
    mockHaikuResponse('RETRY', 'Add tests for lines 12 and 18');
    await runEvaluator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain('line 12');
    expect(prompt).toContain('line 18');
  });

  it('includes coverage percentage in the prompt', async () => {
    mockHaikuResponse('RETRY', 'Coverage too low');
    await runEvaluator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toMatch(/50|0\.5/); // line coverage 50%
  });

  it('includes the goal in the prompt', async () => {
    mockHaikuResponse('RETRY', 'Fix it');
    await runEvaluator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain(BASE_INPUT.goal);
  });
});

// ─── Output parsing ───────────────────────────────────────────────────────────

describe('evaluator — output parsing', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns RETRY decision and feedback from Haiku JSON response', async () => {
    mockHaikuResponse('RETRY', 'Add null check before accessing array elements on line 12');
    const result = await runEvaluator(BASE_INPUT);
    expect(result.decision).toBe('RETRY');
    expect(result.feedback).toBe('Add null check before accessing array elements on line 12');
  });

  it('returns PASS decision when Haiku says PASS', async () => {
    mockHaikuResponse('PASS', '');
    const result = await runEvaluator({ ...BASE_INPUT, failCount: 0, coverage: LOW_COVERAGE });
    expect(result.decision).toBe('PASS');
  });

  it('returns tokensUsed as sum of input and output tokens', async () => {
    mockHaikuResponse('RETRY', 'Fix it');
    const result = await runEvaluator(BASE_INPUT);
    expect(result.tokensUsed).toBe(140); // 80 + 60
  });

  it('returns a non-negative durationMs', async () => {
    mockHaikuResponse('RETRY', 'Fix it');
    const result = await runEvaluator(BASE_INPUT);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('evaluator — error handling', () => {
  beforeEach(() => mockCreate.mockReset());

  it('throws when Haiku returns non-JSON text', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot evaluate this.' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    await expect(runEvaluator(BASE_INPUT)).rejects.toThrow(/JSON/i);
  });

  it('throws when the JSON response has an invalid decision value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"decision":"SKIP","feedback":"hmm"}' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    await expect(runEvaluator(BASE_INPUT)).rejects.toThrow(/decision/i);
  });

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'tu_1', name: 'fn', input: {} }],
      usage: { input_tokens: 50, output_tokens: 0 },
    });
    await expect(runEvaluator(BASE_INPUT)).rejects.toThrow();
  });
});
