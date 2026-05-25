import { useState } from 'react';
import { authFetch } from '../lib/authFetch';

interface GoalInputProps {
  onSuccess: (runId: string) => void;
}

export default function GoalInput({ onSuccess }: GoalInputProps) {
  const [sourceCode, setSourceCode] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = sourceCode.trim() !== '' && goal.trim() !== '' && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const res = await authFetch('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ goal, sourceCode }),
    });
    const data = (await res.json()) as { runId: string };
    setSubmitting(false);
    onSuccess(data.runId);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/[0.08] bg-bg-surface overflow-hidden"
    >
      <div className="p-5 border-b border-white/[0.06]">
        <label htmlFor="sourceCode" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Java source code
        </label>
        <textarea
          id="sourceCode"
          value={sourceCode}
          onChange={(e) => setSourceCode(e.target.value)}
          rows={12}
          placeholder="Paste your Java class here…"
          className="w-full bg-bg-primary border border-white/[0.06] rounded-lg p-3 text-sm font-mono text-zinc-200 resize-y focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-700 transition-colors"
        />
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div>
          <label htmlFor="goal" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Goal
          </label>
          <input
            id="goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Write tests for push, pop, peek, and isEmpty"
            className="w-full bg-bg-primary border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-700 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="self-end px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Run TDD'}
        </button>
      </div>
    </form>
  );
}
