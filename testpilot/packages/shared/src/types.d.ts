export type RunStatus = 'PENDING' | 'RUNNING' | 'CHECKPOINT' | 'COMPLETE' | 'FAILED';
export type AgentName = 'planner' | 'generator' | 'executor' | 'evaluator' | 'synthesizer';
export type ModelName = 'haiku' | 'sonnet' | 'none';
export interface Step {
    agent: AgentName;
    model: ModelName;
    input: string;
    output: string;
    tokensUsed?: number;
    durationMs: number;
}
export interface Report {
    testFile: string;
    passRate: number;
    coverage: number;
    redPhase: string;
    greenPhase: string;
    refactorSuggestions: string[];
}
export interface Run {
    id: string;
    goal: string;
    sourceCode: string;
    status: RunStatus;
    steps: Step[];
    retryCount: number;
    report?: Report;
}
//# sourceMappingURL=types.d.ts.map