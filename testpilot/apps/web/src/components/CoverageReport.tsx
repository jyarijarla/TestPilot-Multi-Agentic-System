const THRESHOLD = 0.7;

interface CoverageReportProps {
  lineCoverage: number;
  branchCoverage: number;
  methodCoverage: number;
}

function Bar({ label, value, testId }: { label: string; value: number; testId: string }) {
  const pct = value * 100;
  const passing = value >= THRESHOLD;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span
          data-testid={testId}
          data-passing={String(passing)}
          className={`font-mono font-medium ${passing ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${passing ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CoverageReport({ lineCoverage, branchCoverage, methodCoverage }: CoverageReportProps) {
  return (
    <div className="flex flex-col gap-4 p-5 bg-bg-surface rounded-xl border border-white/[0.06]">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Coverage</p>
      <Bar label="Line" value={lineCoverage} testId="line-coverage" />
      <Bar label="Branch" value={branchCoverage} testId="branch-coverage" />
      <Bar label="Method" value={methodCoverage} testId="method-coverage" />
    </div>
  );
}
