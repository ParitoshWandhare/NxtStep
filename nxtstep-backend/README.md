# NxtStep Backend

AI-powered interview platform — Node.js / TypeScript backend.

## Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express
- **Database**: MongoDB (Mongoose)
- **Cache / Queue**: Redis + BullMQ
- **AI**: OpenRouter / OpenAI / Local LLM (provider-agnostic)
- **Real-time**: Socket.IO
- **Auth**: JWT (RS256-style HS256 with scoped ephemeral tokens)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set MONGODB_URI, JWT_SECRET, AI_API_KEY

# 3. Start MongoDB + Redis (or use Docker)
docker compose up mongo redis -d

# 4. Run in development
npm run dev
```

## Docker (full stack)

```bash
# Start everything
docker compose up

# Include dev tools (Mongo Express UI + Bull Board)
docker compose --profile dev-tools up

# Production build
docker compose -f docker-compose.yml up --build -d
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT token |
| POST | `/api/auth/forgot-password` | — | Send reset email |
| POST | `/api/auth/reset-password` | — | Reset with token |
| GET | `/api/auth/me` | ✓ | Get profile |
| PATCH | `/api/auth/me` | ✓ | Update settings |
| POST | `/api/interview/start` | ✓ | Start session |
| GET | `/api/interview/` | ✓ | List sessions |
| GET | `/api/interview/:id` | ✓ | Get session |
| GET | `/api/interview/:id/status` | ✓ | Poll status |
| POST | `/api/interview/:id/answer` | ✓ | Submit answer |
| POST | `/api/interview/:id/proctoring` | ✓ | Log event |
| GET | `/api/scores/` | ✓ | All scorecards |
| GET | `/api/scores/:sessionId` | ✓ | Session scorecard |
| GET | `/api/recommend/:sessionId` | ✓ | Role recommendations |
| POST | `/api/recommend/:sessionId/feedback` | ✓ | Rate a role |
| GET | `/api/news/` | optional | Personalized feed |
| GET | `/api/news/trending` | — | Trending articles |
| POST | `/api/news/feedback` | ✓ | Click/save/dismiss |
| GET | `/api/health` | — | Health check |

## Socket.IO Events

**Client → Server**
- `join:session <sessionId>` — subscribe to session updates
- `leave:session <sessionId>` — unsubscribe

**Server → Client**
- `question:ready` — new question generated
- `evaluation:complete` — answer evaluated
- `scorecard:ready` — scorecard computed
- `recommendations:ready` — roles matched
- `session:terminated` — proctoring violation

## Environment Variables

See `.env.example` for the full list with descriptions.

## Project Structure

```
src/
├── ai/           aiAdapter, prompts
├── config/       env, database, redis
├── controllers/  all route handlers
├── data/         role database (45 roles)
├── middleware/   auth, errorHandler, rateLimiter, validate, upload
├── models/       User, InterviewSession, Evaluation, Scorecard, News, Recommendations
├── queues/       BullMQ queue definitions
├── routes/       all routers
├── services/     authService, interviewService, evaluationService,
│                 scoringService, recommendationService, newsService, newsIngestionService
├── sockets/      Socket.IO server
├── utils/        logger, jwt, apiResponse, email
├── workers/      evaluate, generateQuestion, scorecard, recommend, news
├── app.ts        Express app
└── server.ts     Entry point + graceful shutdown
```
