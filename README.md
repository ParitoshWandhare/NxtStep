# NxtStep — AI Interview Platform

> Practice real interviews · Get AI feedback · Discover your perfect role

NxtStep is a full-stack AI-powered interview preparation platform. It conducts realistic mock interviews through a real-time question-and-answer flow, evaluates answers across five professional dimensions using an LLM, produces a detailed scorecard with radar charts, and recommends career roles matched to the candidate's demonstrated strengths.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Real-Time Events](#real-time-events-socketio)
- [Scoring Model](#scoring-model)
- [Recommendation Engine](#recommendation-engine)
- [Proctoring System](#proctoring-system)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Docker](#docker)

---

## Features

- **AI-Generated Questions** — Role-specific, difficulty-calibrated questions generated in real-time via OpenRouter / OpenAI (or any compatible endpoint)
- **Five-Dimension Evaluation** — Every answer is scored on Technical, Problem Solving, Communication, Confidence, and Concept Depth (0–10 each)
- **Adaptive Follow-ups** — Weak answers trigger targeted follow-up questions that probe missing keywords and identified gaps
- **Live Scorecard** — Aggregated scorecard with radar + bar charts pushed to the browser via Socket.IO the moment the session completes
- **Role Recommendations** — 45 curated role templates matched by a weighted algorithm (skill, level, preference, resume) and AI-enriched with descriptions and interview tips
- **Anti-Cheat Proctoring** — Tab-switch detection with configurable warning and termination thresholds
- **Personalised News Feed** — Tech news from TechCrunch, Wired, Hacker News, GNews, NewsAPI — scored by recency, popularity, and collaborative signals
- **Email Verification** — OTP-based email verification on registration; forgot-password flow with signed reset links
- **Dark / Light Theme** — System-preference-aware with manual toggle

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5.4 |
| Framework | Express 4 (Helmet, CORS, Compression, Morgan) |
| Database | MongoDB 7 via Mongoose 8 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| AI | OpenRouter (provider-agnostic adapter with circuit breaker + retry) |
| Real-time | Socket.IO 4 with JWT auth middleware |
| Auth | JWT HS256 (scoped + ephemeral tokens), bcrypt, OTP |
| Email | Nodemailer with HTML templates |
| Validation | Zod on every route |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (custom design system, dark mode) |
| State | Redux Toolkit (auth, interview, ui slices) |
| Data Fetching | TanStack React Query v5 |
| Real-time | Socket.IO client |
| Charts | Recharts (radar + bar) |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 (lazy-loaded pages, route guards) |

---

## Architecture

### Session Flow

```
User configures role + difficulty
        │
        ▼
POST /api/interview  ──►  Create InterviewSession in MongoDB
                          Enqueue GenerateQuestion job (BullMQ)
                                  │
                                  ▼
                         AI generates question
                         Inject into session
                         Emit  question:ready  (Socket.IO)
                                  │
                          User answers
                                  │
                                  ▼
POST /api/interview/:id/answer ──► Enqueue EvaluateAnswer job
                                           │
                                           ▼
                                  AI scores answer (5 dims)
                                  Persist Evaluation doc
                                  Emit  evaluation:complete
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                         Follow-up?              Next question?
                              │                         │
                              └────────────┬────────────┘
                                           │ (after 10 answers)
                                           ▼
                                  Session → "completed"
                                  Enqueue GenerateScorecard
                                           │
                                           ▼
                                  Aggregate all Evaluations
                                  Emit  scorecard:ready
                                  Enqueue RecommendRoles
                                           │
                                           ▼
                                  Match 45 role templates
                                  AI-enrich top 5 roles
                                  Emit  recommendations:ready
```

### Worker Pipeline

Five BullMQ queues process all async work:

| Queue | Worker | Chains to |
|---|---|---|
| `generate-question` | Calls AI, injects question into session | — |
| `evaluate-answer` | Scores answer, decides follow-up or next Q | `generate-question` |
| `generate-scorecard` | Aggregates evaluations | `recommend-roles` |
| `recommend-roles` | Matches + AI-enriches roles | — |
| `ingest-news` | RSS + GNews + NewsAPI ingestion | — (recurring) |

---

## Quick Start

### With Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/ParitoshWandhare/NxtStep.git
cd nxtstep-backend

# 2. Configure
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET, OPENROUTER_API_KEY

# 3. Start everything
docker compose up

# Include Mongo Express + BullMQ dashboard
docker compose --profile dev-tools up
```

- API: http://localhost:5000
- Frontend dev server: http://localhost:5173
- Mongo Express UI: http://localhost:8081
- BullMQ Dashboard: http://localhost:3001

### Manual Setup

**Backend**
```bash
cd nxtstep-backend
npm install
cp .env.example .env
npm run dev          # ts-node-dev with hot reload
```

**Frontend**
```bash
cd nxtstep-frontend
npm install
# create .env with VITE_API_URL=http://localhost:5000
npm run dev          # Vite on port 5173
```

> **AI Mock Mode** — if `OPENROUTER_API_KEY` is empty, the AI adapter automatically returns deterministic mock responses. The full interview flow works without any API credits.

---

## Environment Variables

All variables are Zod-validated at startup. Missing required variables terminate the process with a descriptive error.

### Core

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | *(required)* | MongoDB connection string |
| `JWT_SECRET` | *(required, ≥16 chars)* | HMAC secret for JWT signing |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `CLIENT_URL` | `http://localhost:5173` | Frontend origin for CORS |
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |

### AI Provider

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | *(empty = mock mode)* | AI provider API key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
| `OPENROUTER_DEFAULT_MODEL` | `mistralai/mistral-7b-instruct:free` | Model identifier |

### Session & Scoring

| Variable | Default | Description |
|---|---|---|
| `MAX_QUESTIONS_PER_SESSION` | `10` | Max questions per interview |
| `MAX_FOLLOWUPS_PER_QUESTION` | `2` | Max follow-ups per question |
| `TAB_SWITCH_TERMINATE_THRESHOLD` | `5` | Tab switches before termination |
| `SCORE_WEIGHT_TECHNICAL` | `0.35` | Technical dimension weight |
| `SCORE_WEIGHT_PROBLEM_SOLVING` | `0.25` | Problem solving weight |
| `SCORE_WEIGHT_COMMUNICATION` | `0.20` | Communication weight |
| `SCORE_WEIGHT_CONFIDENCE` | `0.10` | Confidence weight |
| `SCORE_WEIGHT_CONCEPT_DEPTH` | `0.10` | Concept depth weight |

### News

| Variable | Default | Description |
|---|---|---|
| `GNEWS_API_KEY` | *(optional)* | GNews API key |
| `NEWS_API_KEY` | *(optional)* | NewsAPI.org key |
| `NEWS_INGEST_INTERVAL_MS` | `600000` | Ingestion interval (10 min) |

### Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | *(optional)* | SMTP server host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(optional)* | SMTP username |
| `SMTP_PASS` | *(optional)* | SMTP password |
| `SMTP_FROM` | `noreply@nxtstep.app` | From address |

---

## API Reference

All protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | — | Create account; sends OTP email |
| `POST` | `/login` | — | Authenticate; returns JWT |
| `POST` | `/verify-email` | ✓ | Verify 6-digit OTP |
| `POST` | `/resend-otp` | ✓ | Resend OTP (rate-limited) |
| `POST` | `/forgot-password` | — | Send reset link |
| `POST` | `/reset-password` | — | Reset with token |
| `GET` | `/me` | ✓ | Get profile |
| `PATCH` | `/me` | ✓ | Update name / preferences |

### Interview — `/api/interview`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | ✓ | Start session |
| `GET` | `/` | ✓ | List sessions (paginated) |
| `GET` | `/:sessionId` | ✓ | Get full session |
| `GET` | `/:sessionId/status` | ✓ | Poll status |
| `POST` | `/:sessionId/answer` | ✓ | Submit answer |
| `POST` | `/:sessionId/proctoring` | ✓ | Log proctoring event |

### Scores & Recommendations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/scores/` | ✓ | All scorecards (paginated) |
| `GET` | `/api/scores/:sessionId` | ✓ | Session scorecard |
| `GET` | `/api/recommend/:sessionId` | ✓ | Role recommendations |
| `POST` | `/api/recommend/:sessionId/feedback` | ✓ | Rate a role |

### News & Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/news/` | optional | Personalised feed |
| `GET` | `/api/news/trending` | — | Top 10 trending (last 24h) |
| `POST` | `/api/news/feedback` | ✓ | Record click / save / dismiss |
| `GET` | `/api/health` | — | Health check |

---

## Real-Time Events (Socket.IO)

Connect with `{ auth: { token } }`. After connecting, join a session room:

```js
socket.emit('join:session', sessionId)
socket.emit('leave:session', sessionId)
```

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `question:ready` | `Question` object | New question generated |
| `evaluation:complete` | Scores + feedback | Answer evaluated |
| `scorecard:ready` | `Scorecard` object | Full scorecard ready |
| `recommendations:ready` | — | Roles computed |
| `session:terminated` | `{ reason }` | Proctoring violation |

---

## Scoring Model

Each answer is evaluated by the LLM across five dimensions:

| Dimension | Weight | What's measured |
|---|---|---|
| Technical | 35% | Correctness and depth of technical knowledge |
| Problem Solving | 25% | Structured thinking and reasoning |
| Communication | 20% | Clarity and articulation |
| Confidence | 10% | Delivery certainty and directness |
| Concept Depth | 10% | Understanding of underlying principles |

```
Overall = Technical×0.35 + ProblemSolving×0.25 + Communication×0.20
        + Confidence×0.10 + ConceptDepth×0.10
```

**Grades:** Exceptional (≥9.0) · Strong (≥7.5) · Good (≥6.0) · Fair (≥4.5) · Needs Work (<4.5)

The evaluator uses few-shot calibration examples to ensure consistent scoring across sessions.

---

## Recommendation Engine

After the scorecard is generated, all 45 role templates are scored using four signals:

| Signal | Weight | Logic |
|---|---|---|
| Skill Match | 50% | Maps role skills to scorecard dimensions; compares score vs role minimum threshold |
| Level Match | 20% | Checks if overall score falls in role's range (junior 0–5.5, mid 4.5–7.5, senior 6.5–10) |
| Preference Match | 15% | Overlap between user's saved role preferences and role title/category |
| Resume Match | 15% | Keyword scan of uploaded resume text against role skill names |

The top 5 roles above 0.40 are AI-enriched in parallel with a personalised description, a "why this fits you" sentence, and interview tips. Enrichment degrades gracefully — sensible defaults are used if the AI call fails.

**Role database:** 45 templates across 9 categories — frontend, backend, fullstack, data, ml, devops, mobile, qa, security — with salary ranges and growth paths.

---

## Proctoring System

| Event | Action |
|---|---|
| Tab switch | Logged; warning shown at switch 3; session terminated at switch 5 |
| Face absent | Logged to `cameraEvents` array on the session document |
| Termination | Session status → `terminated`; `session:terminated` emitted; scorecard still generated |

Thresholds are configurable via `TAB_SWITCH_WARN_THRESHOLD` and `TAB_SWITCH_TERMINATE_THRESHOLD`.

---

## Project Structure

```
nxtstep-backend/
├── src/
│   ├── ai/              # aiAdapter (circuit breaker, retry, mock), prompts (versioned, few-shot)
│   ├── config/          # env (Zod), database (MongoDB), redis (safe wrappers)
│   ├── controllers/     # Route handlers (thin — delegate to services)
│   ├── data/            # roleDatabase.ts — 45 role templates
│   ├── middleware/       # auth, errorHandler, rateLimiter, validate, upload
│   ├── models/          # User, InterviewSession, Evaluation, Scorecard, News, Recommendations
│   ├── modules/         # interviewEngine, evaluationEngine, recommendationEngine, newsEngine
│   ├── queues/          # BullMQ queue definitions and job data types
│   ├── routes/          # Express routers
│   ├── services/        # Business logic (authService, interviewService, scoringService, …)
│   ├── sockets/         # Socket.IO server + typed emit helpers
│   ├── utils/           # logger (Pino), jwt, apiResponse, email
│   ├── workers/         # BullMQ workers (evaluate, generateQuestion, scorecard, recommend, news)
│   ├── app.ts           # Express app setup
│   └── server.ts        # Entry point + graceful shutdown
├── scripts/
│   └── mongo-init.js    # MongoDB init script (collections + indexes)
├── Dockerfile
└── docker-compose.yml

nxtstep-frontend/
├── src/
│   ├── api/             # Axios client + typed API modules
│   ├── app/             # Redux store + typed hooks
│   ├── components/      # Layout (AppLayout, Sidebar, TopNav), UI primitives
│   ├── features/        # auth, interview, ui Redux slices
│   ├── hooks/           # useApi (React Query), useInterviewSocket, useTheme, …
│   ├── pages/           # All route pages (auth, dashboard, interview, scores, news, profile)
│   ├── router/          # React Router config with route guards
│   ├── types/           # Global TypeScript types
│   └── utils/           # cn(), formatters, score helpers, category icons
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

---

## Scripts

### Backend

```bash
npm run dev        # ts-node-dev with hot reload
npm run build      # TypeScript → dist/
npm start          # node dist/server.js
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Jest
```

### Frontend

```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # Type check + production build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
```

---

## Docker

```bash
# Development (with hot reload)
docker compose up

# Development + admin tools
docker compose --profile dev-tools up

# Production build
docker compose -f docker-compose.yml up --build -d
```

**Services:**

| Service | Port | Description |
|---|---|---|
| `app` | 5000 | NxtStep API |
| `mongo` | 27017 | MongoDB 7.0 |
| `redis` | 6379 | Redis 7.2 |
| `mongo-express` | 8081 | MongoDB web UI (dev-tools profile) |
| `bull-board` | 3001 | BullMQ dashboard (dev-tools profile) |

The Dockerfile uses a four-stage build (`base → development → builder → production`). The production image runs as a non-root user with a `HEALTHCHECK` on `/api/health`.

---

## Security

- **Helmet** — 11 security HTTP headers
- **CORS** — restricted to `CLIENT_URL` with explicit allowed methods
- **Rate Limiting** — global (200 req/min), auth (10 req/15 min), interview start (5 req/hour/user)
- **JWT Scoping** — standard tokens (7d) for API; ephemeral tokens (2h) scoped to a session
- **Passwords** — bcrypt with 12 salt rounds
- **OTP** — SHA-256 hashed before storage, 10-minute TTL, resend rate-limited
- **Input Validation** — Zod on every route; body parser resilience for mismatched Content-Type
- **Log Redaction** — Pino redacts Authorization headers, cookies, passwords, and reset tokens

---

## Feature Flags

| Variable | Default | Effect |
|---|---|---|
| `ENABLE_WORKERS` | `true` | Set `false` to disable all BullMQ workers |
| `ENABLE_NEWS_INGESTION` | `true` | Set `false` to skip news ingestion scheduling |
| `OPENROUTER_API_KEY` | *(empty)* | Empty = full mock mode, no API credits needed |

---

*Built with Node.js · TypeScript · Express · MongoDB · Redis · BullMQ · Socket.IO · React · Redux Toolkit · TanStack Query · Tailwind CSS · Recharts · Zod · Pino · Vite*
