import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  RunStatusSchema,
  AgentNameSchema,
  ModelNameSchema,
  StepSchema,
  ReportSchema,
  RunSchema,
} from './schemas.js';

// ─── RunStatusSchema ──────────────────────────────────────────────────────────

describe('RunStatusSchema', () => {
  it('accepts each valid status', () => {
    const valid = ['PENDING', 'RUNNING', 'CHECKPOINT', 'COMPLETE', 'FAILED'];
    for (const s of valid) {
      expect(RunStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects an unknown status string', () => {
    expect(() => RunStatusSchema.parse('CANCELLED')).toThrow(ZodError);
  });

  it('rejects non-string values', () => {
    expect(() => RunStatusSchema.parse(42)).toThrow(ZodError);
    expect(() => RunStatusSchema.parse(null)).toThrow(ZodError);
  });
});

// ─── AgentNameSchema ──────────────────────────────────────────────────────────

describe('AgentNameSchema', () => {
  it('accepts each valid agent name', () => {
    const valid = ['planner', 'generator', 'executor', 'evaluator', 'synthesizer'];
    for (const name of valid) {
      expect(AgentNameSchema.parse(name)).toBe(name);
    }
  });

  it('rejects an unknown agent name', () => {
    expect(() => AgentNameSchema.parse('reporter')).toThrow(ZodError);
  });
});

// ─── ModelNameSchema ──────────────────────────────────────────────────────────

describe('ModelNameSchema', () => {
  it('accepts haiku, sonnet, and none', () => {
    expect(ModelNameSchema.parse('haiku')).toBe('haiku');
    expect(ModelNameSchema.parse('sonnet')).toBe('sonnet');
    expect(ModelNameSchema.parse('none')).toBe('none');
  });

  it('rejects opus (not in cost-control allowlist)', () => {
    expect(() => ModelNameSchema.parse('opus')).toThrow(ZodError);
  });
});

// ─── StepSchema ───────────────────────────────────────────────────────────────

describe('StepSchema', () => {
  const validStep = {
    agent: 'planner',
    model: 'haiku',
    input: 'Decompose goal: add sorting to BubbleSort',
    output: '["test null input","test single element","test already sorted"]',
    durationMs: 342,
  };

  it('parses a valid step without tokensUsed', () => {
    const result = StepSchema.parse(validStep);
    expect(result.agent).toBe('planner');
    expect(result.tokensUsed).toBeUndefined();
  });

  it('parses a valid step with tokensUsed', () => {
    const result = StepSchema.parse({ ...validStep, tokensUsed: 180 });
    expect(result.tokensUsed).toBe(180);
  });

  it('rejects negative durationMs', () => {
    expect(() => StepSchema.parse({ ...validStep, durationMs: -1 })).toThrow(ZodError);
  });

  it('rejects negative tokensUsed', () => {
    expect(() => StepSchema.parse({ ...validStep, tokensUsed: -5 })).toThrow(ZodError);
  });

  it('rejects zero tokensUsed (cost tracking requires a real count if present)', () => {
    expect(() => StepSchema.parse({ ...validStep, tokensUsed: 0 })).toThrow(ZodError);
  });

  it('rejects missing required fields', () => {
    const { input: _removed, ...missingInput } = validStep;
    expect(() => StepSchema.parse(missingInput)).toThrow(ZodError);
  });

  it('rejects an invalid agent name inside a step', () => {
    expect(() => StepSchema.parse({ ...validStep, agent: 'unknown' })).toThrow(ZodError);
  });
});

// ─── ReportSchema ─────────────────────────────────────────────────────────────

describe('ReportSchema', () => {
  const validReport = {
    testFile: 'BubbleSortTest.java',
    passRate: 0.9,
    coverage: 0.85,
    redPhase: 'Three tests failed on first run: null input, empty array, sorted order',
    greenPhase: 'All tests pass after fixing null guard and loop boundary',
    refactorSuggestions: ['Extract comparator', 'Add early-exit optimisation'],
  };

  it('parses a valid report', () => {
    const result = ReportSchema.parse(validReport);
    expect(result.passRate).toBe(0.9);
  });

  it('accepts boundary passRate values 0 and 1', () => {
    expect(ReportSchema.parse({ ...validReport, passRate: 0 }).passRate).toBe(0);
    expect(ReportSchema.parse({ ...validReport, passRate: 1 }).passRate).toBe(1);
  });

  it('rejects passRate above 1', () => {
    expect(() => ReportSchema.parse({ ...validReport, passRate: 1.1 })).toThrow(ZodError);
  });

  it('rejects passRate below 0', () => {
    expect(() => ReportSchema.parse({ ...validReport, passRate: -0.1 })).toThrow(ZodError);
  });

  it('rejects coverage above 1', () => {
    expect(() => ReportSchema.parse({ ...validReport, coverage: 1.01 })).toThrow(ZodError);
  });

  it('accepts an empty refactorSuggestions array', () => {
    const result = ReportSchema.parse({ ...validReport, refactorSuggestions: [] });
    expect(result.refactorSuggestions).toEqual([]);
  });

  it('rejects a non-string item in refactorSuggestions', () => {
    expect(() =>
      ReportSchema.parse({ ...validReport, refactorSuggestions: [42] })
    ).toThrow(ZodError);
  });

  it('rejects empty testFile string', () => {
    expect(() => ReportSchema.parse({ ...validReport, testFile: '' })).toThrow(ZodError);
  });
});

// ─── RunSchema ────────────────────────────────────────────────────────────────

describe('RunSchema', () => {
  const validStep = {
    agent: 'generator',
    model: 'sonnet',
    input: 'Write tests',
    output: '@Test void testSort() {}',
    durationMs: 1200,
    tokensUsed: 450,
  };

  const validRun = {
    id: 'clx123abc',
    goal: 'Verify BubbleSort handles edge cases',
    sourceCode: 'public class BubbleSort { public void sort(int[] a) {} }',
    status: 'RUNNING',
    steps: [validStep],
    retryCount: 0,
  };

  it('parses a valid run without a report', () => {
    const result = RunSchema.parse(validRun);
    expect(result.status).toBe('RUNNING');
    expect(result.report).toBeUndefined();
  });

  it('parses a valid run with a report attached', () => {
    const report = {
      testFile: 'BubbleSortTest.java',
      passRate: 1,
      coverage: 0.95,
      redPhase: 'red',
      greenPhase: 'green',
      refactorSuggestions: [],
    };
    const result = RunSchema.parse({ ...validRun, report });
    expect(result.report?.passRate).toBe(1);
  });

  it('rejects retryCount above the hard cap of 2', () => {
    expect(() => RunSchema.parse({ ...validRun, retryCount: 3 })).toThrow(ZodError);
  });

  it('rejects negative retryCount', () => {
    expect(() => RunSchema.parse({ ...validRun, retryCount: -1 })).toThrow(ZodError);
  });

  it('rejects an empty goal string', () => {
    expect(() => RunSchema.parse({ ...validRun, goal: '' })).toThrow(ZodError);
  });

  it('rejects an empty sourceCode string', () => {
    expect(() => RunSchema.parse({ ...validRun, sourceCode: '' })).toThrow(ZodError);
  });

  it('rejects an empty id string', () => {
    expect(() => RunSchema.parse({ ...validRun, id: '' })).toThrow(ZodError);
  });

  it('rejects steps that contain an invalid step shape', () => {
    const badStep = { agent: 'planner', model: 'haiku', durationMs: 100 };
    expect(() => RunSchema.parse({ ...validRun, steps: [badStep] })).toThrow(ZodError);
  });
});
