import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export const COVERAGE_THRESHOLD = 0.7;

export interface EvaluatorInput {
  passCount: number;
  failCount: number;
  failureSummary: string;
  coverage: {
    lineCoverage: number;
    branchCoverage: number;
    methodCoverage: number;
  };
  uncoveredLines: string[];
  goal: string;
  retryCount: number;
}

export interface EvaluatorOutput {
  decision: 'PASS' | 'RETRY';
  feedback: string;
  tokensUsed: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are a TDD evaluator. Analyze test execution results and provide corrective feedback for the test generator.
Output ONLY a JSON object: {"decision": "PASS" or "RETRY", "feedback": "..."}
Make the feedback specific and actionable — name the exact methods, lines, or conditions the generator must fix.`;

export async function runEvaluator(input: EvaluatorInput): Promise<EvaluatorOutput> {
  const { passCount, failCount, failureSummary, coverage, uncoveredLines, goal, retryCount } = input;
  const start = Date.now();

  // Structural check — skip AI when results are already acceptable
  if (failCount === 0 && coverage.lineCoverage >= COVERAGE_THRESHOLD) {
    return { decision: 'PASS', feedback: '', tokensUsed: 0, durationMs: Date.now() - start };
  }

  const uncoveredList = uncoveredLines.length > 0 ? uncoveredLines.join('\n') : 'none';

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Test results: ${passCount} passed, ${failCount} failed
Failure summary: ${failureSummary || 'none'}
Line coverage: ${(coverage.lineCoverage * 100).toFixed(1)}% (threshold: ${COVERAGE_THRESHOLD * 100}%)
Branch coverage: ${(coverage.branchCoverage * 100).toFixed(1)}%
Uncovered lines:\n${uncoveredList}
Goal: ${goal}
Current retry: ${retryCount}/2`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Evaluator: Haiku returned no text content block');
  }

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Evaluator: Could not parse response as JSON — got: ${textBlock.text}`);
  }

  if (typeof parsed !== 'object' || parsed === null || !('decision' in parsed)) {
    throw new Error('Evaluator: Response missing decision field');
  }

  const result = parsed as { decision: unknown; feedback?: unknown };
  if (result.decision !== 'PASS' && result.decision !== 'RETRY') {
    throw new Error(`Evaluator: Invalid decision value: ${String(result.decision)}`);
  }

  return {
    decision: result.decision,
    feedback: typeof result.feedback === 'string' ? result.feedback : '',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    durationMs: Date.now() - start,
  };
}
