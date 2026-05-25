import { z } from 'zod';
export const RunStatusSchema = z.enum(['PENDING', 'RUNNING', 'CHECKPOINT', 'COMPLETE', 'FAILED']);
export const AgentNameSchema = z.enum(['planner', 'generator', 'executor', 'evaluator', 'synthesizer']);
export const ModelNameSchema = z.enum(['haiku', 'sonnet', 'none']);
export const StepSchema = z.object({
    agent: AgentNameSchema,
    model: ModelNameSchema,
    input: z.string(),
    output: z.string(),
    tokensUsed: z.number().int().min(1).optional(),
    durationMs: z.number().min(0),
});
export const ReportSchema = z.object({
    testFile: z.string().min(1),
    passRate: z.number().min(0).max(1),
    coverage: z.number().min(0).max(1),
    redPhase: z.string(),
    greenPhase: z.string(),
    refactorSuggestions: z.array(z.string()),
});
export const RunSchema = z.object({
    id: z.string().min(1),
    goal: z.string().min(1),
    sourceCode: z.string().min(1),
    status: RunStatusSchema,
    steps: z.array(StepSchema),
    retryCount: z.number().int().min(0).max(2),
    report: ReportSchema.optional(),
});
//# sourceMappingURL=schemas.js.map