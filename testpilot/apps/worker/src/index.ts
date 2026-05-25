import { app } from './app.js';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { runLoop } from './loop.js';

const dbUrl = (process.env.DATABASE_URL ?? '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT ?? 3001;
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(redisUrl.password ? { username: redisUrl.username || 'default', password: redisUrl.password } : {}),
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
};

new Worker(
  'runs',
  async (job) => {
    const { runId } = job.data as { runId: string };

    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (!run) return;

    await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING' } });

    const result = await runLoop({
      sourceCode: run.sourceCode,
      className: (/\bclass\s+(\w+)/.exec(run.sourceCode))?.[1] ?? 'UnknownClass',
      goal: run.goal,
    });

    if (result.status === 'FAILED') {
      console.error(`[run ${runId}] pipeline FAILED:`, result.error);
    }

    for (const step of result.steps) {
      await prisma.step.create({
        data: {
          runId,
          agent: step.agent,
          model: step.model,
          input: step.input,
          output: step.output,
          tokensUsed: step.tokensUsed,
          durationMs: step.durationMs,
        },
      });
    }

    const finalStatus = result.status === 'FAILED' ? 'FAILED' : 'CHECKPOINT';
    await prisma.run.update({
      where: { id: runId },
      data: { status: finalStatus, retryCount: result.retryCount },
    });
  },
  { connection: redisConnection },
);

app.listen(PORT, () => {
  console.log(`TestPilot worker listening on :${PORT}`);
});
