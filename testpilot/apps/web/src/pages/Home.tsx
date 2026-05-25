import { Link } from 'react-router-dom';

const steps = [
  {
    name: 'Planner',
    description: 'Reads your Java class and goal, then breaks it down into specific test scenarios.',
  },
  {
    name: 'Generator',
    description: 'Writes a JUnit 5 test file from scratch targeting each planned scenario.',
  },
  {
    name: 'Executor',
    description: 'Compiles and runs the tests in an isolated Docker container with JaCoCo coverage.',
  },
  {
    name: 'Evaluator',
    description: 'Checks pass rate and coverage. If below threshold, gives the generator targeted feedback and retries.',
  },
  {
    name: 'Synthesizer',
    description: 'Once you approve, writes a Red-Green-Refactor narrative explaining the full TDD cycle.',
  },
];

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">AI-assisted TDD</span>
        </div>

        <h1 className="text-3xl font-semibold text-zinc-50 leading-tight tracking-tight mb-4">
          Write better tests,<br />faster.
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-8 max-w-md">
          TestPilot takes your Java class and a plain-English goal, then runs a
          multi-agent pipeline to write, execute, and evaluate JUnit tests on your
          behalf — with coverage tracking and a full TDD report at the end.
        </p>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors"
        >
          Go to runs →
        </Link>
      </div>

      {/* How it works */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-6">How it works</p>

        <ol className="relative flex flex-col gap-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <li key={step.name} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-bg-surface border border-white/[0.08] flex items-center justify-center shrink-0 mt-1">
                    <span className="text-xs font-mono text-zinc-500">{i + 1}</span>
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-zinc-800 my-1" />}
                </div>
                <div className={`pb-6 ${isLast ? '' : ''}`}>
                  <p className="text-sm font-medium text-zinc-200 mb-1">{step.name}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Footer note */}
      <div className="mt-12 pt-8 border-t border-white/[0.06]">
        <p className="text-xs text-zinc-600">
          Runs are stored in Supabase. The executor spins up a <span className="font-mono">gradle:8.5-jdk21</span> container locally — Docker Desktop must be running.
        </p>
      </div>
    </div>
  );
}
