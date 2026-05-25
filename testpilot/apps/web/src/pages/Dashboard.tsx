import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoalInput from '../components/GoalInput';
import { authFetch } from '../lib/authFetch';


interface RunSummary {
  id: string;
  goal: string;
  status: string;
  retryCount: number;
  createdAt: string;
}

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  PENDING:    { label: 'Pending',    dot: 'bg-zinc-500',     text: 'text-zinc-400' },
  RUNNING:    { label: 'Running',    dot: 'bg-amber-400',    text: 'text-amber-400' },
  CHECKPOINT: { label: 'Review',     dot: 'bg-sky-400',      text: 'text-sky-400' },
  COMPLETE:   { label: 'Complete',   dot: 'bg-emerald-400',  text: 'text-emerald-400' },
  FAILED:     { label: 'Failed',     dot: 'bg-red-400',      text: 'text-red-400' },
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function Dashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const load = () =>
    authFetch('/api/runs')
      .then((r) => r.json() as Promise<{ runs: RunSummary[] }>)
      .then((data) => { setRuns(data.runs); setLoading(false); });

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSuccess = (runId: string) => {
    setShowForm(false);
    navigate(`/runs/${runId}`);
  };

  return (
    <div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-base font-semibold text-zinc-50">Runs</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Run'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-6">
            <GoalInput onSuccess={handleSuccess} />
          </div>
        )}

        {/* Runs */}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">No runs yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Submit a Java class to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Recent runs</p>
            {runs.map((run) => {
              const s = STATUS[run.status] ?? STATUS.PENDING;
              return (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg bg-bg-surface border border-white/[0.06] hover:border-white/[0.12] hover:bg-bg-elevated transition-all group"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <span className="flex-1 text-sm text-zinc-200 group-hover:text-zinc-50 truncate transition-colors">
                    {run.goal}
                  </span>
                  <span className={`text-xs font-medium shrink-0 ${s.text}`} data-testid="status-badge">
                    {s.label}
                  </span>
                  <span className="text-xs text-zinc-600 shrink-0 w-16 text-right">
                    {timeAgo(run.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
