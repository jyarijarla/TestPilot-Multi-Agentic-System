import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const SONNET_MODEL = 'claude-sonnet-4-6';

export interface GeneratorInput {
  sourceCode: string;
  goal: string;
  testCases: string[];
  className: string;
  retryFeedback?: string;
}

export interface GeneratorOutput {
  testFile: string;
  tokensUsed: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are a TDD test generator. Write a complete, compilable JUnit 5 test file for the given Java class.
Rules:
- Use the exact package and class name from the source file
- Name the test class <ClassName>Test
- Implement every test case described
- Use @Test from org.junit.jupiter.api.Test
- Use assertEquals, assertThrows, assertNull, etc. from org.junit.jupiter.api.Assertions.*
- Output ONLY the Java source code. No explanation, no markdown, no code blocks.`;

function extractCode(text: string): string {
  const match = text.match(/```(?:java)?\s*\n([\s\S]*?)\n```/);
  if (match) return match[1].trim();
  return text.trim();
}

export async function runGenerator(input: GeneratorInput): Promise<GeneratorOutput> {
  const { sourceCode, goal, testCases, className, retryFeedback } = input;
  const start = Date.now();

  const caseList = testCases.map((tc, i) => `${i + 1}. ${tc}`).join('\n');
  let userContent = `Java class (${className}):\n\`\`\`java\n${sourceCode}\n\`\`\`\n\nGoal: ${goal}\n\nTest cases to implement:\n${caseList}`;

  if (retryFeedback) {
    userContent += `\n\nPrevious attempt failed. Fix these issues:\n${retryFeedback}`;
  }

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Generator: Sonnet returned no text content block');
  }

  const testFile = extractCode(textBlock.text);
  if (!testFile) {
    throw new Error('Generator: Sonnet returned an empty test file');
  }

  return {
    testFile,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    durationMs: Date.now() - start,
  };
}
