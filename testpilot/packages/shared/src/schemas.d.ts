import { z } from 'zod';
export declare const RunStatusSchema: z.ZodEnum<["PENDING", "RUNNING", "CHECKPOINT", "COMPLETE", "FAILED"]>;
export declare const AgentNameSchema: z.ZodEnum<["planner", "generator", "executor", "evaluator", "synthesizer"]>;
export declare const ModelNameSchema: z.ZodEnum<["haiku", "sonnet", "none"]>;
export declare const StepSchema: z.ZodObject<{
    agent: z.ZodEnum<["planner", "generator", "executor", "evaluator", "synthesizer"]>;
    model: z.ZodEnum<["haiku", "sonnet", "none"]>;
    input: z.ZodString;
    output: z.ZodString;
    tokensUsed: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
    model: "haiku" | "sonnet" | "none";
    input: string;
    output: string;
    durationMs: number;
    tokensUsed?: number | undefined;
}, {
    agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
    model: "haiku" | "sonnet" | "none";
    input: string;
    output: string;
    durationMs: number;
    tokensUsed?: number | undefined;
}>;
export declare const ReportSchema: z.ZodObject<{
    testFile: z.ZodString;
    passRate: z.ZodNumber;
    coverage: z.ZodNumber;
    redPhase: z.ZodString;
    greenPhase: z.ZodString;
    refactorSuggestions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    testFile: string;
    passRate: number;
    coverage: number;
    redPhase: string;
    greenPhase: string;
    refactorSuggestions: string[];
}, {
    testFile: string;
    passRate: number;
    coverage: number;
    redPhase: string;
    greenPhase: string;
    refactorSuggestions: string[];
}>;
export declare const RunSchema: z.ZodObject<{
    id: z.ZodString;
    goal: z.ZodString;
    sourceCode: z.ZodString;
    status: z.ZodEnum<["PENDING", "RUNNING", "CHECKPOINT", "COMPLETE", "FAILED"]>;
    steps: z.ZodArray<z.ZodObject<{
        agent: z.ZodEnum<["planner", "generator", "executor", "evaluator", "synthesizer"]>;
        model: z.ZodEnum<["haiku", "sonnet", "none"]>;
        input: z.ZodString;
        output: z.ZodString;
        tokensUsed: z.ZodOptional<z.ZodNumber>;
        durationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
        model: "haiku" | "sonnet" | "none";
        input: string;
        output: string;
        durationMs: number;
        tokensUsed?: number | undefined;
    }, {
        agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
        model: "haiku" | "sonnet" | "none";
        input: string;
        output: string;
        durationMs: number;
        tokensUsed?: number | undefined;
    }>, "many">;
    retryCount: z.ZodNumber;
    report: z.ZodOptional<z.ZodObject<{
        testFile: z.ZodString;
        passRate: z.ZodNumber;
        coverage: z.ZodNumber;
        redPhase: z.ZodString;
        greenPhase: z.ZodString;
        refactorSuggestions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        testFile: string;
        passRate: number;
        coverage: number;
        redPhase: string;
        greenPhase: string;
        refactorSuggestions: string[];
    }, {
        testFile: string;
        passRate: number;
        coverage: number;
        redPhase: string;
        greenPhase: string;
        refactorSuggestions: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "RUNNING" | "CHECKPOINT" | "COMPLETE" | "FAILED";
    id: string;
    goal: string;
    sourceCode: string;
    steps: {
        agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
        model: "haiku" | "sonnet" | "none";
        input: string;
        output: string;
        durationMs: number;
        tokensUsed?: number | undefined;
    }[];
    retryCount: number;
    report?: {
        testFile: string;
        passRate: number;
        coverage: number;
        redPhase: string;
        greenPhase: string;
        refactorSuggestions: string[];
    } | undefined;
}, {
    status: "PENDING" | "RUNNING" | "CHECKPOINT" | "COMPLETE" | "FAILED";
    id: string;
    goal: string;
    sourceCode: string;
    steps: {
        agent: "planner" | "generator" | "executor" | "evaluator" | "synthesizer";
        model: "haiku" | "sonnet" | "none";
        input: string;
        output: string;
        durationMs: number;
        tokensUsed?: number | undefined;
    }[];
    retryCount: number;
    report?: {
        testFile: string;
        passRate: number;
        coverage: number;
        redPhase: string;
        greenPhase: string;
        refactorSuggestions: string[];
    } | undefined;
}>;
//# sourceMappingURL=schemas.d.ts.map