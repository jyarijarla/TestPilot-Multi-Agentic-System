import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AgentTimeline from '../components/AgentTimeline';
import { authFetch } from '../lib/authFetch';

interface Step {
  agent: string;
  model: string;
  input: string;
  output: string;
  tokensUsed?: number;
  durationMs: number;
}

interface Run {
  id: string;
  goal: string;
  status: string;
  retryCount: number;
  steps: Step[];
}

const STATUS: Record<string, { label: string; classes: string }> = {
  PENDING:    { label: 'Pending',  classes: 'bg-zinc-800 text-zinc-400' },
  RUNNING:    { label: 'Running',  classes: 'bg-amber-400/10 text-amber-400' },
  CHECKPOINT: { label: 'Review',   classes: 'bg-sky-400/10 text-sky-400' },
  COMPLETE:   { label: 'Complete', classes: 'bg-emerald-400/10 text-emerald-400' },
  FAILED:     { label: 'Failed',   classes: 'bg-red-400/10 text-red-400' },
};

const NEXT_AGENT: Record<string, string> = {
  '':          'Planner',
  'planner':   'Generator',
  'generator': 'Executor',
  'executor':  'Evaluator',
  'evaluator': 'Generator',
};

function getNextAgentLabel(steps: Step[]): string {
  const last = steps.at(-1)?.agent ?? '';
  return NEXT_AGENT[last] ?? 'Working';
}

function parsePlannerOutput(steps: Step[]): string[] {
  const step = steps.find((s) => s.agent === 'planner');
  if (!step) return [];
  try {
    const parsed: unknown = JSON.parse(step.output);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch { /* ignore */ }
  return [];
}

function getLastGeneratorOutput(steps: Step[]): string {
  const generatorSteps = steps.filter((s) => s.agent === 'generator');
  return generatorSteps.at(-1)?.output ?? '';
}

export default function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [testCodeOpen, setTestCodeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchRun = () => {
      authFetch(`/api/runs/${id}`)
        .then((r) => r.json() as Promise<{ run: Run }>)
        .then((data) => {
          if (cancelled) return;
          setRun(data.run);
          setLoading(false);
        });
    };

    fetchRun();

    const interval = setInterval(() => {
      if (run && (run.status === 'CHECKPOINT' || run.status === 'COMPLETE' || run.status === 'FAILED')) return;
      fetchRun();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, run?.status]);

  const handleApprove = async () => {
    setApproving(true);
    const res = await authFetch(`/api/runs/${id}/approve`, { method: 'POST' });
    const data = (await res.json()) as { report: unknown };
    navigate(`/runs/${id}/report`, { state: { report: data.report } });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm text-zinc-500">Loading…</p>
    </div>
  );

  if (!run) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm text-zinc-400">Run not found.</p>
    </div>
  );

  const statusInfo = STATUS[run.status] ?? STATUS.PENDING;
  const isActive = run.status === 'PENDING' || run.status === 'RUNNING';
  const testPlan = parsePlannerOutput(run.steps);
  const generatedTest = getLastGeneratorOutput(run.steps);

  return (
    <div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-8">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <h1 className="text-base font-medium text-zinc-100 leading-snug">{run.goal}</h1>
          <span
            className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.classes}`}
            data-testid="status-badge"
          >
            {statusInfo.label}
          </span>
        </div>

        {run.retryCount > 0 && (
          <p className="text-xs text-zinc-600 mb-6">{run.retryCount} {run.retryCount === 1 ? 'retry' : 'retries'}</p>
        )}

        {/* Pipeline */}
        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Pipeline</p>
          <div className="bg-bg-surface rounded-xl border border-white/[0.06] px-5 py-4">
            {run.steps.length > 0 && <AgentTimeline steps={run.steps} />}

            {/* Live "currently running" row */}
            {isActive && (
              <div className={`flex gap-4 ${run.steps.length > 0 ? 'mt-1' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mt-[18px] shrink-0 bg-amber-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-3 py-3 flex-1">
                  <span className="text-sm font-medium text-zinc-400 w-24 shrink-0">
                    {getNextAgentLabel(run.steps)}
                  </span>
                  <span className="text-xs text-zinc-600 animate-pulse">running…</span>
                </div>
              </div>
            )}

            {/* Empty pending state */}
            {!isActive && run.steps.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No steps recorded.</p>
            )}
          </div>
        </div>

        {/* Checkpoint: review content */}
        {run.status === 'CHECKPOINT' && (
          <div className="flex flex-col gap-4 mb-6">
            {/* Test plan */}
            {testPlan.length > 0 && (
              <div className="bg-bg-surface rounded-xl border border-white/[0.06] p-5">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Test plan</p>
                <ol className="flex flex-col gap-2">
                  {testPlan.map((tc, i) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-300">
                      <span className="text-zinc-600 font-mono shrink-0">{i + 1}.</span>
                      <span>{tc}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Generated test code */}
            {generatedTest && (
              <div className="bg-bg-surface rounded-xl border border-white/[0.06] overflow-hidden">
                <button
                  onClick={() => setTestCodeOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Generated test file</span>
                  <span className="text-xs text-zinc-600">{testCodeOpen ? '↑ hide' : '↓ show'}</span>
                </button>
                {testCodeOpen && (
                  <pre className="px-5 pb-5 text-xs font-mono text-zinc-400 overflow-auto max-h-96 leading-relaxed whitespace-pre-wrap border-t border-white/[0.06]">
                    {generatedTest}
                  </pre>
                )}
              </div>
            )}

            {/* Approve */}
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-5">
              <p className="text-sm text-zinc-300 mb-1">All tests passed.</p>
              <p className="text-xs text-zinc-500 mb-4">Review the test plan and generated code above, then generate the TDD report.</p>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {approving ? 'Generating report…' : 'Approve & Generate Report'}
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {run.status === 'COMPLETE' && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="text-sm text-zinc-300 mb-4">Report is ready.</p>
            <Link
              to={`/runs/${id}/report`}
              className="inline-block px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors"
            >
              View Report →
            </Link>
          </div>
        )}

        {/* Failed */}
        {run.status === 'FAILED' && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-5">
            <p className="text-sm text-red-300">Pipeline failed. Check the steps above for errors.</p>
          </div>
        )}
      </div>
    </div>
  );
}
