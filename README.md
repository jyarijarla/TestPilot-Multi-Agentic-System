# TestPilot

You paste Java code and describe what you want tested. TestPilot figures out the test cases, writes them, runs them, and tells you how well your code holds up, and all without you touching a test file.

---

## What it does

When you submit a run, a pipeline of AI agents goes to work:

```
Planner → Generator → Executor → Evaluator → (retry if needed) → Report
```

1. **Planner** decides what tests to write based on your goal
2. **Generator** writes the actual JUnit 5 test file
3. **Executor** compiles and runs the tests with real Gradle + JaCoCo coverage
4. **Evaluator** checks if they passed — if not, it gives feedback and the generator tries again (up to 2 retries)
5. Once tests pass, you review and approve, then a **Synthesizer** writes your TDD report

The report breaks down pass rate, line coverage, and a Red → Green → Refactor narrative explaining what happened.

---

## Tech

- **Frontend** — React + Vite + Tailwind
- **Backend** — Node.js + Express + BullMQ job queue
- **AI** — Claude Haiku (planning/evaluation) + Claude Sonnet (code generation/report)
- **Queue** — Upstash Redis
- **Database** — Supabase PostgreSQL via Prisma
- **Test runner** — Gradle 8 + JUnit 5 + JaCoCo (runs directly, no Docker at runtime)
- **Auth** — Custom JWT (bcrypt + jsonwebtoken, no third-party auth service)
- **Deploy** — Vercel (frontend) + Render Docker (worker)

---

## Running locally

You'll need Node.js 22+, Gradle 8.14+ on your PATH with JDK 17 or 21, an Upstash Redis URL, a Supabase database, and an Anthropic API key.

```bash
git clone https://github.com/jyarijarla/TestPilot.git
cd TestPilot/testpilot
npm install
```

Create `apps/worker/.env` with:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=rediss://default:...@....upstash.io:6379
JWT_SECRET=anything-secret-here
PORT=3001
```

Then start both servers:

```bash
npm run dev:worker   # terminal 1
npm run dev:web      # terminal 2
```

Open `http://localhost:5173`, create an account, and submit a run.

---

## Architecture

```
Browser
  │  HTTP /api/*
  ▼
Express API ──── BullMQ ──── Upstash Redis
  │                │
  │         Pipeline Worker
  │           │         │
  │      Claude AI   Gradle
  │                    (runs tests in /tmp)
  ▼
Supabase PostgreSQL
```

---

## API

All routes except auth require `Authorization: Bearer <token>`.

| Method | Route | What it does |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account, get JWT |
| POST | `/api/auth/login` | Sign in, get JWT |
| POST | `/api/runs` | Submit source code + goal, starts pipeline |
| GET | `/api/runs` | List your runs |
| GET | `/api/runs/:id` | Get run status + agent steps |
| POST | `/api/runs/:id/approve` | Approve at checkpoint, triggers report |
| GET | `/api/runs/:id/report` | Fetch the saved report |

---

## Data model

```
User ──< Run ──< Step
              └── Report
```

A `Run` moves through: `PENDING → RUNNING → CHECKPOINT → COMPLETE` (or `FAILED`).
Each `Step` is one agent invocation. The `Report` is created when you approve.

---

## Deploying

**Worker on Render** — set Language to Docker, Root Directory to `testpilot`, Dockerfile Path to `apps/worker/Dockerfile`. Use Starter tier ($7/mo) — the free tier doesn't have enough memory for Gradle.

**Frontend on Vercel** — Root Directory `testpilot`, Build Command `npm run build --workspace=packages/shared && npm run build --workspace=apps/web`, Output Directory `apps/web/dist`. Then update `apps/web/vercel.json` with your Render URL so `/api/*` proxies to the worker.
