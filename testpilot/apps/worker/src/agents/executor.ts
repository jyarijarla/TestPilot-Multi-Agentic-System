import { runInSandbox } from '../tools/docker.js';
import { parseJacocoCoverage, type CoverageSummary } from '../tools/gradle.js';

export interface ExecutorOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  coverage: CoverageSummary;
  durationMs: number;
}

const ZERO_COVERAGE: CoverageSummary = { lineCoverage: 0, branchCoverage: 0, methodCoverage: 0 };

export async function runExecutor(input: {
  sourceCode: string;
  className: string;
  testCode: string;
}): Promise<ExecutorOutput> {
  const start = Date.now();
  const result = await runInSandbox(input);

  let coverage = ZERO_COVERAGE;
  if (result.jacocoXml) {
    try {
      coverage = parseJacocoCoverage(result.jacocoXml);
    } catch {
      // Malformed XML — treat as zero coverage and let the evaluator handle it
    }
  }

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    coverage,
    durationMs: Date.now() - start,
  };
}
