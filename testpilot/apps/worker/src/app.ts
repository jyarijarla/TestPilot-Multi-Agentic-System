import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Queue } from 'bullmq';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { runSynthesizer } from './agents/synthesizer.js';
import { requireAuth } from './middleware/auth.js';
import type { AuthRequest } from './middleware/auth.js';

const dbUrl = (process.env.DATABASE_URL ?? '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(redisUrl.password ? { username: redisUrl.username || 'default', password: redisUrl.password } : {}),
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
};
const runQueue = new Queue('runs', { connection: redisConnection });

export const app = express();
app.use(express.json());

// ─── POST /api/auth/register ─────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hash } });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  res.json({ token, user: { id: user.id, email: user.email } });
});

// ─── POST /api/runs ───────────────────────────────────────────────────────────

app.post('/api/runs', requireAuth, async (req, res) => {
  const { goal, sourceCode } = req.body as { goal?: string; sourceCode?: string };
  const userId = (req as AuthRequest).userId;

  if (!goal || typeof goal !== 'string' || goal.trim() === '') {
    res.status(400).json({ error: 'goal is required' });
    return;
  }
  if (!sourceCode || typeof sourceCode !== 'string' || sourceCode.trim() === '') {
    res.status(400).json({ error: 'sourceCode is required' });
    return;
  }

  const run = await prisma.run.create({
    data: { userId, goal, sourceCode, status: 'PENDING' },
  });

  await runQueue.add('run', { runId: run.id });

  res.status(202).json({ runId: run.id });
});

// ─── GET /api/runs ────────────────────────────────────────────────────────────

app.get('/api/runs', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const runs = await prisma.run.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ runs });
});

// ─── GET /api/runs/:id ────────────────────────────────────────────────────────

app.get('/api/runs/:id', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const run = await prisma.run.findUnique({
    where: { id: String(req.params['id']) },
    include: { steps: true },
  });

  if (!run || run.userId !== userId) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json({ run });
});

// ─── GET /api/runs/:id/report ─────────────────────────────────────────────────

app.get('/api/runs/:id/report', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const runId = String(req.params['id']);
  const run = await prisma.run.findUnique({ where: { id: runId } });

  if (!run || run.userId !== userId) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const report = await prisma.report.findUnique({ where: { runId } });

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  let refactorSuggestions: string[] = [];
  try {
    const parsed: unknown = JSON.parse(report.refactorSuggestions);
    if (Array.isArray(parsed)) refactorSuggestions = parsed.filter((s): s is string => typeof s === 'string');
  } catch { /* leave empty */ }

  res.json({
    report: {
      testFile: report.testFile,
      passRate: report.passRate,
      coverage: report.coverage,
      redPhase: report.redPhase,
      greenPhase: report.greenPhase,
      refactorSuggestions,
    },
  });
});

// ─── POST /api/runs/:id/approve ───────────────────────────────────────────────

app.post('/api/runs/:id/approve', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const runId = String(req.params['id']);
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { steps: true },
  });

  if (!run || run.userId !== userId) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  if (run.status !== 'CHECKPOINT') {
    res.status(409).json({ error: `Run is not at CHECKPOINT (current status: ${run.status})` });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps = ((run as any).steps ?? []) as Array<{ agent: string; output: string; model: string }>;
  const generatorSteps = steps.filter((s) => s.agent === 'generator');
  const testFile = generatorSteps.at(-1)?.output ?? '';

  const plannerStep = steps.find((s) => s.agent === 'planner');
  let testCases: string[] = [];
  if (plannerStep) {
    try {
      const parsed: unknown = JSON.parse(plannerStep.output);
      if (Array.isArray(parsed)) testCases = parsed.filter((x): x is string => typeof x === 'string');
    } catch { /* leave empty */ }
  }

  const classNameMatch = /\bclass\s+(\w+)/.exec(run.sourceCode);
  const className = classNameMatch?.[1] ?? 'UnknownClass';

  const synthResult = await runSynthesizer({
    sourceCode: run.sourceCode,
    className,
    goal: run.goal,
    testFile,
    testCases,
    passRate: 1.0,
    coverage: { lineCoverage: 0, branchCoverage: 0, methodCoverage: 0 },
  });

  await prisma.report.upsert({
    where: { runId: run.id },
    create: {
      runId: run.id,
      testFile: synthResult.report.testFile,
      passRate: synthResult.report.passRate,
      coverage: synthResult.report.coverage,
      redPhase: synthResult.report.redPhase,
      greenPhase: synthResult.report.greenPhase,
      refactorSuggestions: JSON.stringify(synthResult.report.refactorSuggestions),
    },
    update: {
      testFile: synthResult.report.testFile,
      passRate: synthResult.report.passRate,
      coverage: synthResult.report.coverage,
      redPhase: synthResult.report.redPhase,
      greenPhase: synthResult.report.greenPhase,
      refactorSuggestions: JSON.stringify(synthResult.report.refactorSuggestions),
    },
  });

  await prisma.run.update({ where: { id: run.id }, data: { status: 'COMPLETE' } });

  res.json({ report: synthResult.report });
});
