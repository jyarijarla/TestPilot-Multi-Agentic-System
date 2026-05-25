import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { authFetch } from '../lib/authFetch';

interface ReportData {
  testFile: string;
  passRate: number;
  coverage: number;
  redPhase: string;
  greenPhase: string;
  refactorSuggestions: string[];
}

export default function Report() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const stateReport = (location.state as { report?: ReportData } | null)?.report;
  const [report, setReport] = useState<ReportData | null>(stateReport ?? null);
  const [loading, setLoading] = useState(!stateReport);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    if (stateReport) return;
    authFetch(`/api/runs/${id}/report`)
      .then((r) => r.json() as Promise<{ report?: ReportData }>)
      .then((data) => { setReport(data.report ?? null); setLoading(false); });
  }, [id, stateReport]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm text-zinc-500">Loading report…</p>
    </div>
  );

  if (!report) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm text-zinc-500">No report found. Approve a run first.</p>
    </div>
  );

  const passRatePct = (report.passRate * 100).toFixed(0);
  const coveragePct = (report.coverage * 100).toFixed(1);
  const coveragePass = report.coverage >= 0.7;

  return (
    <div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to={`/runs/${id}`} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-8">
          ← Run detail
        </Link>

        <h1 className="text-xl font-semibold text-zinc-50 mb-8">TDD Report</h1>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-bg-surface rounded-xl border border-white/[0.06] p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Pass rate</p>
            <p data-testid="pass-rate" className="text-4xl font-bold text-emerald-400 font-mono">{passRatePct}%</p>
          </div>
          <div className="bg-bg-surface rounded-xl border border-white/[0.06] p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Line coverage</p>
            <p
              data-testid="coverage"
              className={`text-4xl font-bold font-mono ${coveragePass ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {coveragePct}%
            </p>
          </div>
        </div>

        {/* Phases */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="bg-bg-surface rounded-xl border border-white/[0.06] border-l-2 border-l-red-400 p-5">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Red phase</p>
            <p data-testid="red-phase" className="text-sm text-zinc-300 leading-relaxed">{report.redPhase}</p>
          </div>

          <div className="bg-bg-surface rounded-xl border border-white/[0.06] border-l-2 border-l-emerald-400 p-5">
            <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-3">Green phase</p>
            <p data-testid="green-phase" className="text-sm text-zinc-300 leading-relaxed">{report.greenPhase}</p>
          </div>

          {report.refactorSuggestions.length > 0 && (
            <div className="bg-bg-surface rounded-xl border border-white/[0.06] border-l-2 border-l-sky-400 p-5">
              <p className="text-xs font-medium text-sky-400 uppercase tracking-wider mb-3">Refactor suggestions</p>
              <ul className="flex flex-col gap-2.5">
                {report.refactorSuggestions.map((s, i) => (
                  <li key={i} data-testid="refactor-suggestion" className="flex gap-3 text-sm text-zinc-300">
                    <span className="text-sky-400 shrink-0 mt-px">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Test file collapsible */}
        {report.testFile && (
          <div className="bg-bg-surface rounded-xl border border-white/[0.06] overflow-hidden">
            <button
              onClick={() => setCodeOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Generated test file</span>
              <span className="text-xs text-zinc-600">{codeOpen ? '↑ hide' : '↓ show'}</span>
            </button>
            {codeOpen && (
              <pre className="px-5 pb-5 text-xs font-mono text-zinc-400 overflow-auto max-h-96 leading-relaxed whitespace-pre-wrap border-t border-white/[0.06]">
                {report.testFile}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
