import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockRunCreate = vi.hoisted(() => vi.fn());
const mockRunFindMany = vi.hoisted(() => vi.fn());
const mockRunFindUnique = vi.hoisted(() => vi.fn());
const mockRunUpdate = vi.hoisted(() => vi.fn());

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    run: {
      create: mockRunCreate,
      findMany: mockRunFindMany,
      findUnique: mockRunFindUnique,
      update: mockRunUpdate,
    },
  })),
}));

// ─── BullMQ mock ──────────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn());

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  Worker: vi.fn().mockImplementation(() => ({})),
}));

// ─── Synthesizer mock ─────────────────────────────────────────────────────────

const mockRunSynthesizer = vi.hoisted(() => vi.fn());

vi.mock('./agents/synthesizer.js', () => ({ runSynthesizer: mockRunSynthesizer }));

import { app } from './app.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_RUN = {
  id: 'run_abc123',
  goal: 'Test BubbleSort handles null and empty arrays',
  sourceCode: 'public class BubbleSort {}',
  status: 'PENDING',
  retryCount: 0,
  createdAt: new Date('2026-05-14T00:00:00Z'),
  updatedAt: new Date('2026-05-14T00:00:00Z'),
  steps: [],
};

const FAKE_REPORT_OUTPUT = {
  report: {
    testFile: 'class BubbleSortTest {}',
    passRate: 1.0,
    coverage: 0.92,
    redPhase: 'testNull failed — no null guard',
    greenPhase: 'Added null check on line 3',
    refactorSuggestions: ['Extract swap logic'],
  },
  tokensUsed: 1000,
  durationMs: 200,
};

// ─── POST /api/runs ───────────────────────────────────────────────────────────

describe('POST /api/runs', () => {
  beforeEach(() => {
    mockRunCreate.mockReset();
    mockQueueAdd.mockReset();
  });

  it('returns 202 with runId when given valid goal and sourceCode', async () => {
    mockRunCreate.mockResolvedValueOnce(FAKE_RUN);
    mockQueueAdd.mockResolvedValueOnce({ id: 'job_1' });

    const res = await request(app)
      .post('/api/runs')
      .send({ goal: FAKE_RUN.goal, sourceCode: FAKE_RUN.sourceCode });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ runId: FAKE_RUN.id });
  });

  it('calls prisma.run.create with goal, sourceCode, and PENDING status', async () => {
    mockRunCreate.mockResolvedValueOnce(FAKE_RUN);
    mockQueueAdd.mockResolvedValueOnce({ id: 'job_1' });

    await request(app)
      .post('/api/runs')
      .send({ goal: FAKE_RUN.goal, sourceCode: FAKE_RUN.sourceCode });

    expect(mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          goal: FAKE_RUN.goal,
          sourceCode: FAKE_RUN.sourceCode,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('enqueues a BullMQ job with the new runId', async () => {
    mockRunCreate.mockResolvedValueOnce(FAKE_RUN);
    mockQueueAdd.mockResolvedValueOnce({ id: 'job_1' });

    await request(app)
      .post('/api/runs')
      .send({ goal: FAKE_RUN.goal, sourceCode: FAKE_RUN.sourceCode });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ runId: FAKE_RUN.id }),
    );
  });

  it('returns 400 when goal is missing', async () => {
    const res = await request(app)
      .post('/api/runs')
      .send({ sourceCode: FAKE_RUN.sourceCode });

    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceCode is missing', async () => {
    const res = await request(app)
      .post('/api/runs')
      .send({ goal: FAKE_RUN.goal });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/runs').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when goal is an empty string', async () => {
    const res = await request(app)
      .post('/api/runs')
      .send({ goal: '', sourceCode: FAKE_RUN.sourceCode });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/runs ────────────────────────────────────────────────────────────

describe('GET /api/runs', () => {
  beforeEach(() => mockRunFindMany.mockReset());

  it('returns 200 with a runs array', async () => {
    mockRunFindMany.mockResolvedValueOnce([FAKE_RUN]);

    const res = await request(app).get('/api/runs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('runs');
    expect(Array.isArray(res.body.runs)).toBe(true);
  });

  it('includes all runs returned by prisma', async () => {
    mockRunFindMany.mockResolvedValueOnce([FAKE_RUN, { ...FAKE_RUN, id: 'run_xyz' }]);

    const res = await request(app).get('/api/runs');

    expect(res.body.runs).toHaveLength(2);
  });

  it('returns empty array when no runs exist', async () => {
    mockRunFindMany.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/runs');

    expect(res.status).toBe(200);
    expect(res.body.runs).toEqual([]);
  });
});

// ─── GET /api/runs/:id ────────────────────────────────────────────────────────

describe('GET /api/runs/:id', () => {
  beforeEach(() => mockRunFindUnique.mockReset());

  it('returns 200 with the run when found', async () => {
    mockRunFindUnique.mockResolvedValueOnce(FAKE_RUN);

    const res = await request(app).get(`/api/runs/${FAKE_RUN.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('run');
    expect(res.body.run.id).toBe(FAKE_RUN.id);
  });

  it('includes steps in the run detail', async () => {
    const runWithSteps = { ...FAKE_RUN, steps: [{ id: 'step_1', agent: 'planner' }] };
    mockRunFindUnique.mockResolvedValueOnce(runWithSteps);

    const res = await request(app).get(`/api/runs/${FAKE_RUN.id}`);

    expect(res.body.run.steps).toHaveLength(1);
  });

  it('returns 404 when run does not exist', async () => {
    mockRunFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/runs/nonexistent');

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/runs/:id/approve ───────────────────────────────────────────────

describe('POST /api/runs/:id/approve', () => {
  beforeEach(() => {
    mockRunFindUnique.mockReset();
    mockRunUpdate.mockReset();
    mockRunSynthesizer.mockReset();
  });

  it('returns 404 when run does not exist', async () => {
    mockRunFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/runs/nonexistent/approve');

    expect(res.status).toBe(404);
  });

  it('returns 409 when run status is not CHECKPOINT', async () => {
    mockRunFindUnique.mockResolvedValueOnce({ ...FAKE_RUN, status: 'PENDING' });

    const res = await request(app).post(`/api/runs/${FAKE_RUN.id}/approve`);

    expect(res.status).toBe(409);
  });

  it('calls runSynthesizer when run is at CHECKPOINT', async () => {
    const checkpointRun = {
      ...FAKE_RUN,
      status: 'CHECKPOINT',
      goal: FAKE_RUN.goal,
      sourceCode: FAKE_RUN.sourceCode,
      steps: [
        { agent: 'generator', output: 'class BubbleSortTest {}', model: 'sonnet' },
        { agent: 'planner', output: JSON.stringify(['test null', 'test empty']), model: 'haiku' },
      ],
    };
    mockRunFindUnique.mockResolvedValueOnce(checkpointRun);
    mockRunSynthesizer.mockResolvedValueOnce(FAKE_REPORT_OUTPUT);
    mockRunUpdate.mockResolvedValueOnce({ ...checkpointRun, status: 'COMPLETE' });

    const res = await request(app).post(`/api/runs/${FAKE_RUN.id}/approve`);

    expect(mockRunSynthesizer).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('returns 200 with the report after approval', async () => {
    const checkpointRun = {
      ...FAKE_RUN,
      status: 'CHECKPOINT',
      steps: [
        { agent: 'generator', output: 'class BubbleSortTest {}', model: 'sonnet' },
        { agent: 'planner', output: JSON.stringify(['test null']), model: 'haiku' },
      ],
    };
    mockRunFindUnique.mockResolvedValueOnce(checkpointRun);
    mockRunSynthesizer.mockResolvedValueOnce(FAKE_REPORT_OUTPUT);
    mockRunUpdate.mockResolvedValueOnce({ ...checkpointRun, status: 'COMPLETE' });

    const res = await request(app).post(`/api/runs/${FAKE_RUN.id}/approve`);

    expect(res.body).toHaveProperty('report');
    expect(res.body.report.passRate).toBe(1.0);
  });

  it('updates run status to COMPLETE after synthesizer finishes', async () => {
    const checkpointRun = {
      ...FAKE_RUN,
      status: 'CHECKPOINT',
      steps: [
        { agent: 'generator', output: 'class BubbleSortTest {}', model: 'sonnet' },
        { agent: 'planner', output: JSON.stringify(['test null']), model: 'haiku' },
      ],
    };
    mockRunFindUnique.mockResolvedValueOnce(checkpointRun);
    mockRunSynthesizer.mockResolvedValueOnce(FAKE_REPORT_OUTPUT);
    mockRunUpdate.mockResolvedValueOnce({ ...checkpointRun, status: 'COMPLETE' });

    await request(app).post(`/api/runs/${FAKE_RUN.id}/approve`);

    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FAKE_RUN.id },
        data: expect.objectContaining({ status: 'COMPLETE' }),
      }),
    );
  });

  it('does NOT call runSynthesizer when status is not CHECKPOINT', async () => {
    mockRunFindUnique.mockResolvedValueOnce({ ...FAKE_RUN, status: 'RUNNING' });

    await request(app).post(`/api/runs/${FAKE_RUN.id}/approve`);

    expect(mockRunSynthesizer).not.toHaveBeenCalled();
  });
});
