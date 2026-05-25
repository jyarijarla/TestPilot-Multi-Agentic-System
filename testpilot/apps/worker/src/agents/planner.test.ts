import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted ensures mockCreate is available when vi.mock's factory runs (ESM hoisting requirement)
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { runPlanner } from './planner.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockResponse(text: string, inputTokens = 120, outputTokens = 45) {
  mockCreate.mockResolvedValueOnce({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
}

const SOURCE = `package com.example;
public class BubbleSort {
  public void sort(int[] arr) { /* ... */ }
}`;

const GOAL = 'Verify BubbleSort handles null input, empty arrays, and already-sorted arrays';

// ─── Model selection (cost control) ──────────────────────────────────────────

describe('planner — model selection', () => {
  beforeEach(() => mockCreate.mockReset());

  it('calls Claude Haiku, not Sonnet (cost control rule)', async () => {
    mockResponse('["test null input","test empty array","test sorted"]');
    await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('haiku') }),
    );
  });

  it('does NOT call Sonnet', async () => {
    mockResponse('["test null"]');
    await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    const calledModel: string = mockCreate.mock.calls[0][0].model;
    expect(calledModel).not.toContain('sonnet');
  });
});

// ─── Prompt completeness ──────────────────────────────────────────────────────

describe('planner — prompt content', () => {
  beforeEach(() => mockCreate.mockReset());

  it('includes the Java source code in the prompt', async () => {
    mockResponse('["test null"]');
    await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    const call = mockCreate.mock.calls[0][0];
    const promptText = JSON.stringify(call);
    expect(promptText).toContain('BubbleSort');
  });

  it('includes the goal in the prompt', async () => {
    mockResponse('["test null"]');
    await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    const call = mockCreate.mock.calls[0][0];
    const promptText = JSON.stringify(call);
    expect(promptText).toContain(GOAL);
  });
});

// ─── Output parsing ───────────────────────────────────────────────────────────

describe('planner — output parsing', () => {
  beforeEach(() => mockCreate.mockReset());

  it('parses a valid JSON array response into testCases', async () => {
    mockResponse('["test null input","test empty array","test already sorted"]');
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.testCases).toEqual([
      'test null input',
      'test empty array',
      'test already sorted',
    ]);
  });

  it('returns a single-item array when Haiku returns one test case', async () => {
    mockResponse('["test null input"]');
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.testCases).toHaveLength(1);
  });

  it('filters out non-string items in the response array', async () => {
    mockResponse('["test null",42,null,"test empty"]');
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.testCases).toEqual(['test null', 'test empty']);
  });

  it('filters out blank string items', async () => {
    mockResponse('["test null","   ","test empty"]');
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.testCases).toEqual(['test null', 'test empty']);
  });
});

// ─── Token tracking ───────────────────────────────────────────────────────────

describe('planner — token and timing tracking', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns tokensUsed as the sum of input and output tokens', async () => {
    mockResponse('["test null"]', 200, 80);
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.tokensUsed).toBe(280);
  });

  it('returns a positive durationMs', async () => {
    mockResponse('["test null"]');
    const result = await runPlanner({ sourceCode: SOURCE, goal: GOAL });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe('number');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('planner — error handling', () => {
  beforeEach(() => mockCreate.mockReset());

  it('throws when the response is not valid JSON', async () => {
    mockResponse('Sorry, I cannot help with that.');
    await expect(runPlanner({ sourceCode: SOURCE, goal: GOAL })).rejects.toThrow(/JSON/);
  });

  it('throws when the response is a JSON object instead of an array', async () => {
    mockResponse('{"testCases": ["test null"]}');
    await expect(runPlanner({ sourceCode: SOURCE, goal: GOAL })).rejects.toThrow(/array/i);
  });

  it('throws when the response array has no valid string items', async () => {
    mockResponse('[42, null, false, "  "]');
    await expect(runPlanner({ sourceCode: SOURCE, goal: GOAL })).rejects.toThrow();
  });

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'end_turn',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'fn', input: {} }],
      usage: { input_tokens: 50, output_tokens: 10 },
    });
    await expect(runPlanner({ sourceCode: SOURCE, goal: GOAL })).rejects.toThrow();
  });
});
