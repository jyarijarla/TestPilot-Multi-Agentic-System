interface Step {
  agent: string;
  model: string;
  input: string;
  output: string;
  tokensUsed?: number;
  durationMs: number;
}

interface AgentTimelineProps {
  steps: Step[];
}

const AGENT_CONFIG: Record<string, { label: string; color: string }> = {
  planner:    { label: 'Planner',    color: 'bg-sky-400' },
  generator:  { label: 'Generator',  color: 'bg-violet-400' },
  executor:   { label: 'Executor',   color: 'bg-amber-400' },
  evaluator:  { label: 'Evaluator',  color: 'bg-orange-400' },
  synthesizer:{ label: 'Synthesizer',color: 'bg-emerald-400' },
};

const MODEL_LABEL: Record<string, string> = {
  haiku:  'Haiku',
  sonnet: 'Sonnet',
  none:   '',
};

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function AgentTimeline({ steps }: AgentTimelineProps) {
  return (
    <ol className="relative flex flex-col gap-0">
      {steps.map((step, i) => {
        const cfg = AGENT_CONFIG[step.agent] ?? { label: step.agent, color: 'bg-zinc-500' };
        const isLast = i === steps.length - 1;

        return (
          <li key={i} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-[18px] shrink-0 ${cfg.color}`} />
              {!isLast && <div className="w-px flex-1 bg-zinc-800 mt-1 mb-1" />}
            </div>

            {/* Content */}
            <div className={`flex items-center gap-3 py-3 ${!isLast ? 'pb-4' : ''} flex-1 min-w-0`}>
              <span className="text-sm font-medium text-zinc-200 w-24 shrink-0">{cfg.label}</span>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                {MODEL_LABEL[step.model] && (
                  <span className="text-xs text-zinc-500 font-mono bg-zinc-800/60 px-2 py-0.5 rounded">
                    {MODEL_LABEL[step.model]}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono shrink-0">
                <span>{fmt(step.durationMs)}</span>
                {step.tokensUsed != null && step.tokensUsed > 0 && (
                  <span>{step.tokensUsed.toLocaleString()} tok</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
