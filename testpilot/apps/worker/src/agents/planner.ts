import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export interface PlannerInput {
  sourceCode: string;
  goal: string;
}

export interface PlannerOutput {
  testCases: string[];
  tokensUsed: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are a TDD planner. Decompose a development goal into specific JUnit 5 test case descriptions.
Each description should name one concrete scenario — e.g. "returns empty list when input is null", "throws IllegalArgumentException for negative values".
Output ONLY a JSON array of strings. No explanation, no markdown, no code blocks. Just the raw JSON array.`;

export async function runPlanner(input: PlannerInput): Promise<PlannerOutput> {
  const { sourceCode, goal } = input;
  const start = Date.now();

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Java class:\n\`\`\`java\n${sourceCode}\n\`\`\`\n\nGoal: ${goal}\n\nReturn the JSON array of test case descriptions.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Planner: Haiku returned no text content block');
  }

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Planner: Could not parse response as JSON — got: ${textBlock.text}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Planner: Expected a JSON array but got ${typeof parsed}`);
  }

  const testCases = (parsed as unknown[]).filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );

  if (testCases.length === 0) {
    throw new Error('Planner: Response contained no valid test case descriptions');
  }

  return {
    testCases,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    durationMs: Date.now() - start,
  };
}
