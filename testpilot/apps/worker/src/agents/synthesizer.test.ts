import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { runSynthesizer } from './synthesizer.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REPORT_JSON = {
  redPhase: 'testNullInput and testEmptyArray failed initially — the sort method had no null guard and no early return for empty arrays.',
  greenPhase: 'All three tests pass after adding null check on line 3 and returning early when array length is 0.',
  refactorSuggestions: ['Extract swap logic into a private method', 'Add early-exit when no swaps occur in a pass'],
};

function mockResponse(payload: object, inputTokens = 600, outputTokens = 400) {
  mockCreate.mockResolvedValueOnce({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
}

const BASE_INPUT = {
  sourceCode: 'package com.example;\npublic class BubbleSort { public void sort(int[] a) {} }',
  className: 'BubbleSort',
  goal: 'Verify BubbleSort handles null, empty, and already-sorted arrays',
  testFile: 'package com.example;\nimport org.junit.jupiter.api.Test;\nclass BubbleSortTest { @Test void testNull() {} }',
  testCases: ['test null input throws NPE', 'test empty array returns unchanged', 'test sorted array unchanged'],
  passRate: 1.0,
  coverage: { lineCoverage: 0.92, branchCoverage: 0.85, methodCoverage: 1.0 },
};

// ─── Model selection ──────────────────────────────────────────────────────────

describe('synthesizer — model selection', () => {
  beforeEach(() => mockCreate.mockReset());

  it('calls Claude Sonnet (report writing needs the most capable model)', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('sonnet') }),
    );
  });

  it('does NOT call Haiku', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    const model: string = mockCreate.mock.calls[0][0].model;
    expect(model).not.toContain('haiku');
  });
});

// ─── Prompt completeness ──────────────────────────────────────────────────────

describe('synthesizer — prompt content', () => {
  beforeEach(() => mockCreate.mockReset());

  it('includes the source code in the prompt', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain('BubbleSort');
  });

  it('includes the test file in the prompt (synthesizer is allowed to see the full test file)', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain('BubbleSortTest');
  });

  it('includes the goal in the prompt', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain(BASE_INPUT.goal);
  });

  it('includes the test case descriptions in the prompt', async () => {
    mockResponse(REPORT_JSON);
    await runSynthesizer(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    for (const tc of BASE_INPUT.testCases) {
      expect(prompt).toContain(tc);
    }
  });
});

// ─── Report construction ──────────────────────────────────────────────────────

describe('synthesizer — report construction', () => {
  beforeEach(() => mockCreate.mockReset());

  it('sets report.redPhase from the JSON response', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.redPhase).toBe(REPORT_JSON.redPhase);
  });

  it('sets report.greenPhase from the JSON response', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.greenPhase).toBe(REPORT_JSON.greenPhase);
  });

  it('sets report.refactorSuggestions from the JSON response', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.refactorSuggestions).toEqual(REPORT_JSON.refactorSuggestions);
  });

  it('sets report.testFile directly from the input (not from Sonnet)', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.testFile).toBe(BASE_INPUT.testFile);
  });

  it('sets report.passRate from the input (not from Sonnet)', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.passRate).toBe(BASE_INPUT.passRate);
  });

  it('sets report.coverage to lineCoverage from the input (primary UI metric)', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.coverage).toBe(BASE_INPUT.coverage.lineCoverage);
  });

  it('accepts an empty refactorSuggestions array', async () => {
    mockResponse({ ...REPORT_JSON, refactorSuggestions: [] });
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.refactorSuggestions).toEqual([]);
  });

  it('filters non-string items out of refactorSuggestions', async () => {
    mockResponse({ ...REPORT_JSON, refactorSuggestions: ['good suggestion', 42, null, 'another good one'] });
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.refactorSuggestions).toEqual(['good suggestion', 'another good one']);
  });

  it('strips markdown ```json code blocks before parsing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(REPORT_JSON)}\n\`\`\`` }],
      usage: { input_tokens: 600, output_tokens: 400 },
    });
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.report.redPhase).toBe(REPORT_JSON.redPhase);
  });
});

// ─── Token and timing ─────────────────────────────────────────────────────────

describe('synthesizer — token and timing tracking', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns tokensUsed as sum of input and output tokens', async () => {
    mockResponse(REPORT_JSON, 600, 400);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.tokensUsed).toBe(1000);
  });

  it('returns a non-negative durationMs', async () => {
    mockResponse(REPORT_JSON);
    const result = await runSynthesizer(BASE_INPUT);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('synthesizer — error handling', () => {
  beforeEach(() => mockCreate.mockReset());

  it('throws when the response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Here is your report: great job!' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    await expect(runSynthesizer(BASE_INPUT)).rejects.toThrow(/JSON/i);
  });

  it('throws when redPhase is missing from the JSON', async () => {
    const { redPhase: _r, ...noRed } = REPORT_JSON;
    mockResponse(noRed);
    await expect(runSynthesizer(BASE_INPUT)).rejects.toThrow(/redPhase/i);
  });

  it('throws when greenPhase is missing from the JSON', async () => {
    const { greenPhase: _g, ...noGreen } = REPORT_JSON;
    mockResponse(noGreen);
    await expect(runSynthesizer(BASE_INPUT)).rejects.toThrow(/greenPhase/i);
  });

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'tu_1', name: 'fn', input: {} }],
      usage: { input_tokens: 50, output_tokens: 0 },
    });
    await expect(runSynthesizer(BASE_INPUT)).rejects.toThrow();
  });
});
