import Anthropic from '@anthropic-ai/sdk';
import type { Report } from '@testpilot/shared';

const client = new Anthropic();
const SONNET_MODEL = 'claude-sonnet-4-6';

export interface SynthesizerInput {
  sourceCode: string;
  className: string;
  goal: string;
  testFile: string;
  testCases: string[];
  passRate: number;
  coverage: {
    lineCoverage: number;
    branchCoverage: number;
    methodCoverage: number;
  };
}

export interface SynthesizerOutput {
  report: Report;
  tokensUsed: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are a TDD synthesizer. Write a Red-Green-Refactor report for a completed TDD cycle.
Output ONLY a JSON object with these fields:
{
  "redPhase": "description of what failed initially and why",
  "greenPhase": "description of what was fixed to make all tests pass",
  "refactorSuggestions": ["specific suggestion 1", "specific suggestion 2"]
}
Be specific — reference actual method names, line numbers, and test case names.`;

export async function runSynthesizer(input: SynthesizerInput): Promise<SynthesizerOutput> {
  const { sourceCode, className, goal, testFile, testCases, passRate, coverage } = input;
  const start = Date.now();

  const caseList = testCases.map((tc, i) => `${i + 1}. ${tc}`).join('\n');

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Java class (${className}):\n\`\`\`java\n${sourceCode}\n\`\`\`\n\nGoal: ${goal}\n\nTest cases:\n${caseList}\n\nFinal test file:\n\`\`\`java\n${testFile}\n\`\`\`\n\nResults: ${(passRate * 100).toFixed(0)}% pass rate, ${(coverage.lineCoverage * 100).toFixed(1)}% line coverage\n\nWrite the Red-Green-Refactor report.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Synthesizer: Sonnet returned no text content block');
  }

  const raw = textBlock.text.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, '$1').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Synthesizer: Could not parse response as JSON — got: ${textBlock.text}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Synthesizer: Response is not a JSON object');
  }

  const result = parsed as Record<string, unknown>;

  if (typeof result['redPhase'] !== 'string') {
    throw new Error('Synthesizer: Response missing redPhase field');
  }
  if (typeof result['greenPhase'] !== 'string') {
    throw new Error('Synthesizer: Response missing greenPhase field');
  }

  const refactorSuggestions = Array.isArray(result['refactorSuggestions'])
    ? (result['refactorSuggestions'] as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];

  const report: Report = {
    testFile,
    passRate,
    coverage: coverage.lineCoverage,
    redPhase: result['redPhase'],
    greenPhase: result['greenPhase'],
    refactorSuggestions,
  };

  return {
    report,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    durationMs: Date.now() - start,
  };
}
