import { runPlanner } from './agents/planner.js';
import { runGenerator } from './agents/generator.js';
import { runExecutor } from './agents/executor.js';
import { runEvaluator } from './agents/evaluator.js';

export const MAX_RETRY = 2;

export interface LoopStep {
  agent: 'planner' | 'generator' | 'executor' | 'evaluator';
  model: 'haiku' | 'sonnet' | 'none';
  input: string;
  output: string;
  tokensUsed: number;
  durationMs: number;
}

export interface LoopResult {
  status: 'CHECKPOINT' | 'FAILED';
  steps: LoopStep[];
  retryCount: number;
  lastTestFile: string;
  testCases: string[];
  error?: string;
}

export async function runLoop(input: {
  sourceCode: string;
  className: string;
  goal: string;
}): Promise<LoopResult> {
  const { sourceCode, className, goal } = input;
  const steps: LoopStep[] = [];
  let retryCount = 0;
  let lastTestFile = '';
  let testCases: string[] = [];

  try {
    // ── Planner ────────────────────────────────────────────────────────────────
    const plannerOut = await runPlanner({ sourceCode, goal });
    testCases = plannerOut.testCases;
    steps.push({
      agent: 'planner',
      model: 'haiku',
      input: goal,
      output: JSON.stringify(testCases),
      tokensUsed: plannerOut.tokensUsed,
      durationMs: plannerOut.durationMs,
    });

    // ── Generate → Execute → Evaluate loop ────────────────────────────────────
    let retryFeedback: string | undefined;

    while (true) {
      const genOut = await runGenerator({ sourceCode, goal, testCases, className, retryFeedback });
      lastTestFile = genOut.testFile;
      steps.push({
        agent: 'generator',
        model: 'sonnet',
        input: retryFeedback ?? '',
        output: genOut.testFile,
        tokensUsed: genOut.tokensUsed,
        durationMs: genOut.durationMs,
      });

      const execOut = await runExecutor({ sourceCode, className, testCode: genOut.testFile });
      steps.push({
        agent: 'executor',
        model: 'none',
        input: genOut.testFile.slice(0, 200),
        output: execOut.stdout.slice(0, 500),
        tokensUsed: 0,
        durationMs: execOut.durationMs,
      });

      const failCount = execOut.exitCode !== 0 ? 1 : 0;
      const evalOut = await runEvaluator({
        passCount: failCount === 0 ? testCases.length : 0,
        failCount,
        failureSummary: execOut.stderr.slice(0, 500),
        coverage: execOut.coverage,
        uncoveredLines: [],
        goal,
        retryCount,
      });
      steps.push({
        agent: 'evaluator',
        model: 'haiku',
        input: execOut.stdout.slice(0, 200),
        output: JSON.stringify({ decision: evalOut.decision, feedback: evalOut.feedback }),
        tokensUsed: evalOut.tokensUsed,
        durationMs: evalOut.durationMs,
      });

      if (evalOut.decision === 'PASS' || retryCount >= MAX_RETRY) break;

      retryFeedback = evalOut.feedback;
      retryCount++;
    }

    return { status: 'CHECKPOINT', steps, retryCount, lastTestFile, testCases };
  } catch (error) {
    return {
      status: 'FAILED',
      steps,
      retryCount,
      lastTestFile,
      testCases,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
