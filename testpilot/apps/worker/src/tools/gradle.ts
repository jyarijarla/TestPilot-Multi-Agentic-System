export interface CoverageSummary {
  lineCoverage: number;
  branchCoverage: number;
  methodCoverage: number;
}

// Finds the LAST occurrence of a counter type in JaCoCo XML.
// JaCoCo writes counters at method → class → package → report level in that order,
// so the last occurrence of each type is always the report-level aggregate total.
function extractLastCounter(
  xml: string,
  type: string,
): { missed: number; covered: number } | null {
  const re = new RegExp(`<counter\\s+type="${type}"\\s+missed="(\\d+)"\\s+covered="(\\d+)"`, 'g');
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = re.exec(xml)) !== null) last = match;
  if (!last) return null;
  return { missed: Number(last[1]), covered: Number(last[2]) };
}

function ratio(counter: { missed: number; covered: number } | null): number {
  if (!counter) return 0;
  const total = counter.missed + counter.covered;
  return total === 0 ? 0 : counter.covered / total;
}

export function parseJacocoCoverage(xml: string): CoverageSummary {
  const line = extractLastCounter(xml, 'LINE');
  if (!line) throw new Error('JaCoCo XML missing LINE counter — Gradle run may have failed');

  return {
    lineCoverage: ratio(line),
    branchCoverage: ratio(extractLastCounter(xml, 'BRANCH')),
    methodCoverage: ratio(extractLastCounter(xml, 'METHOD')),
  };
}
