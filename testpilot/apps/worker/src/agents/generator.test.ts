import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { runGenerator } from './generator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JAVA_TEST_FILE = `package com.example;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BubbleSortTest {
    @Test
    void testNullInput() {
        assertThrows(NullPointerException.class, () -> new BubbleSort().sort(null));
    }
}`;

function mockResponse(text: string, inputTokens = 500, outputTokens = 300) {
  mockCreate.mockResolvedValueOnce({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
}

const BASE_INPUT = {
  sourceCode: `package com.example;\npublic class BubbleSort { public void sort(int[] a) {} }`,
  goal: 'Verify BubbleSort handles null, empty, and already-sorted arrays',
  testCases: ['test null input throws NPE', 'test empty array returns unchanged', 'test sorted array returns unchanged'],
  className: 'BubbleSort',
};

// ─── Model selection (cost control) ──────────────────────────────────────────

describe('generator — model selection', () => {
  beforeEach(() => mockCreate.mockReset());

  it('calls Claude Sonnet (authorized for generation — more capable model)', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('sonnet') }),
    );
  });

  it('does NOT call Haiku (Haiku is reserved for planner and evaluator)', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    const calledModel: string = mockCreate.mock.calls[0][0].model;
    expect(calledModel).not.toContain('haiku');
  });
});

// ─── Prompt completeness ──────────────────────────────────────────────────────

describe('generator — prompt content', () => {
  beforeEach(() => mockCreate.mockReset());

  it('includes the Java source code in the prompt', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain('BubbleSort');
  });

  it('includes the goal in the prompt', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain(BASE_INPUT.goal);
  });

  it('includes each test case description in the prompt', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    for (const tc of BASE_INPUT.testCases) {
      expect(prompt).toContain(tc);
    }
  });

  it('includes retryFeedback in the prompt when provided', async () => {
    mockResponse(JAVA_TEST_FILE);
    const feedback = 'testNullInput failed: expected NPE but got no exception';
    await runGenerator({ ...BASE_INPUT, retryFeedback: feedback });
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).toContain(feedback);
  });

  it('does NOT include retryFeedback text on a first-run (no feedback provided)', async () => {
    mockResponse(JAVA_TEST_FILE);
    await runGenerator(BASE_INPUT);
    const prompt = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(prompt).not.toContain('Previous attempt');
  });
});

// ─── Output parsing ───────────────────────────────────────────────────────────

describe('generator — output parsing', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns the Java code as testFile when no markdown wrapping', async () => {
    mockResponse(JAVA_TEST_FILE);
    const result = await runGenerator(BASE_INPUT);
    expect(result.testFile).toBe(JAVA_TEST_FILE);
  });

  it('strips ```java ... ``` markdown code blocks from the response', async () => {
    mockResponse(`\`\`\`java\n${JAVA_TEST_FILE}\n\`\`\``);
    const result = await runGenerator(BASE_INPUT);
    expect(result.testFile).toBe(JAVA_TEST_FILE);
  });

  it('strips plain ``` ... ``` code blocks without language tag', async () => {
    mockResponse(`\`\`\`\n${JAVA_TEST_FILE}\n\`\`\``);
    const result = await runGenerator(BASE_INPUT);
    expect(result.testFile).toBe(JAVA_TEST_FILE);
  });
});

// ─── Token and timing tracking ────────────────────────────────────────────────

describe('generator — token and timing tracking', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns tokensUsed as the sum of input and output tokens', async () => {
    mockResponse(JAVA_TEST_FILE, 500, 300);
    const result = await runGenerator(BASE_INPUT);
    expect(result.tokensUsed).toBe(800);
  });

  it('returns a non-negative durationMs', async () => {
    mockResponse(JAVA_TEST_FILE);
    const result = await runGenerator(BASE_INPUT);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe('number');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('generator — error handling', () => {
  beforeEach(() => mockCreate.mockReset());

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'fn', input: {} }],
      usage: { input_tokens: 50, output_tokens: 0 },
    });
    await expect(runGenerator(BASE_INPUT)).rejects.toThrow();
  });

  it('throws when the response is empty after stripping whitespace', async () => {
    mockResponse('   \n\n   ');
    await expect(runGenerator(BASE_INPUT)).rejects.toThrow();
  });

  it('throws when markdown stripping yields an empty string', async () => {
    mockResponse('```java\n\n```');
    await expect(runGenerator(BASE_INPUT)).rejects.toThrow();
  });
});
