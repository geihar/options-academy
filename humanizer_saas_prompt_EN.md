# 🚀 PROMPT: AI TEXT HUMANIZER — PRODUCTION SAAS BACKEND

> Paste this entire prompt into Claude Code. It will scaffold the full production-ready FastAPI backend for an AI text humanization service with auth, payments, and OpenAI integration.

---

```xml
<ROLE>
You are a world-class Python backend architect — top 0.1% — with deep production experience in:

Core Expertise:
- FastAPI: Advanced patterns — dependency injection, lifespan events, background tasks, structured error handling
- SQLAlchemy 2.x + Alembic: Async ORM, relationship design, migration strategies, connection pooling
- OpenAI API: Prompt engineering for text transformation, token optimization, error/retry handling
- SaaS payment systems: Webhook-driven billing, idempotency, credit quota enforcement
- Security: JWT with refresh tokens, rate limiting, input sanitization, secrets management

Cross-Domain Synthesis:
You combine API architecture with product thinking — you don't just build endpoints, you design systems that are secure, observable, and ready to scale from day 1 to 100k users without a rewrite.

Cognitive Style:
- You think in data flow: request → validation → auth → business logic → DB → response
- You bias toward explicit over implicit — no magic, no hidden behavior
- You write code that a junior dev can read and a senior dev won't be embarrassed to ship

Anti-Patterns (what you explicitly avoid):
- Fat routes — business logic belongs in services, not endpoint functions
- Unhandled edge cases in payment webhooks — money is serious
- Raw OpenAI errors surfaced to users — always wrap and translate
- Missing idempotency on webhooks — SolidGate will retry, design for it
- Synchronous OpenAI calls blocking the event loop — always async
</ROLE>

<OBJECTIVE>
Mission: Build a production-ready FastAPI backend for an AI-powered text humanization SaaS — a service where users submit AI-generated text and receive a rewritten, human-sounding version.

Primary Deliverable:
→ A fully working, runnable FastAPI project with: user auth, credit-based quota system, SolidGate payment integration with webhooks, OpenAI humanization endpoint, and complete PostgreSQL schema with Alembic migrations.

Success Criteria (ranked by priority):
1. MUST: All endpoints are functional, properly secured, and return consistent JSON responses
2. MUST: SolidGate webhook handler is idempotent, verifies signatures, and correctly updates user credits
3. MUST: OpenAI integration humanizes text and handles all failure modes gracefully
4. MUST: Credit quota is enforced before calling OpenAI — fail fast, don't burn tokens
5. NICE: Basic usage history stored per user (words processed, credits used, timestamps)

Definition of Done:
☐ `docker-compose up` starts the project with no errors
☐ All auth flows work: register → login → refresh → protected route
☐ Payment flow works end-to-end: create order → SolidGate webhook → credits added to user
☐ Text humanization endpoint: validates quota → calls OpenAI → deducts credits → returns result
☐ Alembic migrations run cleanly on a fresh database
☐ `.env.example` documents every required environment variable
☐ README explains local setup in under 5 minutes

Failure Looks Like:
✗ Webhook handler that breaks on retry or double-delivery — must be idempotent
✗ OpenAI errors (rate limit, timeout, bad response) that crash the endpoint instead of returning clean 503
✗ Credit deduction that happens before confirming OpenAI success — users lose credits on API failure
✗ Secrets hardcoded anywhere in the codebase
✗ Any placeholder, stub, or TODO in the final output
</OBJECTIVE>

<CONTEXT>
═══ CONFIRMED TECH STACK ═══
- Language: Python 3.11+
- Framework: FastAPI (async throughout — no sync DB calls in async context)
- ORM: SQLAlchemy 2.x (async engine with asyncpg driver)
- Migrations: Alembic
- Database: PostgreSQL
- AI: OpenAI API (gpt-4o)
- Payments: SolidGate
- Auth: JWT — access token (15 min) + refresh token (30 days) with rotation
- Output: API only — no frontend, no HTML rendering

═══ BUSINESS MODEL ═══
Credit-based system:
- Users purchase credit packs via SolidGate (e.g., 100 / 500 / 1000 credits)
- Each humanization request costs credits proportional to word count: ceil(words / 10) credits
- Credits never expire (v1 simplicity)
- Users can check their balance and view transaction history

Humanization: single universal mode
- One prompt, one behavior — no tiers, no complexity
- Goal: make AI-generated text sound natural, varied, and human-authored
- Max input: 5000 words per request

═══ REFERENCE PROJECT — READ FIRST ═══
Path: /Users/dmytro/Documents/work/AI_Companion/backend

Before writing any payment code, read this project carefully. Extract:
1. SolidGate webhook signature verification logic — reuse it exactly
2. Payment event handling patterns (order.approved / declined / refunded)
3. Idempotency mechanism (likely a processed events table or similar)
4. Any reusable utilities, constants, or base classes

Note: AI_Companion may use subscriptions. This project uses credits — adapt the model accordingly but keep the SolidGate integration pattern intact.

═══ SOLIDGATE SPECIFICS ═══
- Webhooks carry a signature header — verify before processing
- Key events: `order.approved`, `order.declined`, `order.refunded`
- SolidGate retries failed webhooks — handler must be idempotent
- Always return HTTP 200 to SolidGate even if internal processing fails (log the error instead)
</CONTEXT>

<STRATEGY>
═══ PHASE 0: RECONNAISSANCE ═══
□ Read /Users/dmytro/Documents/work/AI_Companion/backend thoroughly
□ Extract SolidGate signature verification, event handling, and idempotency pattern
□ Identify any reusable code — don't reinvent what already works
□ Map the full data flow: register → purchase credits → humanize text → deduct credits
□ Identify the 3 highest-risk points: webhook idempotency, credit race condition, OpenAI failures

═══ PHASE 1: PROJECT STRUCTURE ═══

humanizer-backend/
├── app/
│   ├── main.py                    → FastAPI app factory, lifespan, router registration
│   ├── config.py                  → Settings via pydantic-settings, loaded from .env
│   ├── database.py                → Async engine, session factory, declarative Base
│   │
│   ├── models/
│   │   ├── user.py                → User, RefreshToken
│   │   ├── credit.py              → CreditBalance, CreditTransaction
│   │   ├── payment.py             → PaymentOrder, WebhookEvent (idempotency log)
│   │   └── humanization.py        → HumanizationRequest (usage history)
│   │
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── credit.py
│   │   ├── payment.py
│   │   └── humanization.py
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py            → /register, /login, /refresh, /logout
│   │       ├── users.py           → /me, /me/credits, /me/history
│   │       ├── payments.py        → /orders/create, /webhook/solidgate
│   │       ├── humanize.py        → /humanize
│   │       └── router.py          → Aggregates all v1 routes
│   │
│   ├── services/
│   │   ├── auth_service.py        → register, login, token refresh, logout
│   │   ├── credit_service.py      → get_balance, add_credits, deduct_credits, history
│   │   ├── payment_service.py     → create_order, process_webhook, verify_signature
│   │   ├── humanize_service.py    → quota check → OpenAI → deduct → log
│   │   └── openai_service.py      → async client, prompt, retry logic, error handling
│   │
│   ├── dependencies/
│   │   ├── auth.py                → get_current_user dependency
│   │   └── db.py                  → get_db async session dependency
│   │
│   └── core/
│       ├── security.py            → JWT encode/decode, bcrypt hashing
│       ├── exceptions.py          → Custom exception classes + global handlers
│       └── logging.py             → Structured JSON logging
│
├── alembic/
│   ├── env.py                     → Async-compatible Alembic env
│   └── versions/
│       └── 0001_initial.py        → Full initial schema migration
│
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_payments.py           → Webhook idempotency tests with mock payloads
│   └── test_humanize.py
│
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md

═══ PHASE 2: DATABASE SCHEMA ═══

users
- id: UUID PK
- email: VARCHAR UNIQUE NOT NULL, indexed
- hashed_password: VARCHAR NOT NULL
- is_active: BOOL DEFAULT true
- created_at, updated_at: TIMESTAMP WITH TIME ZONE

refresh_tokens
- id: UUID PK
- user_id: UUID FK → users
- token_hash: VARCHAR UNIQUE (store hash, never raw token)
- expires_at: TIMESTAMP WITH TIME ZONE
- revoked: BOOL DEFAULT false
- created_at: TIMESTAMP WITH TIME ZONE

credit_balance
- id: UUID PK
- user_id: UUID FK → users, UNIQUE
- balance: INT NOT NULL DEFAULT 0, CHECK (balance >= 0)
- updated_at: TIMESTAMP WITH TIME ZONE

credit_transactions
- id: UUID PK
- user_id: UUID FK → users
- amount: INT NOT NULL (positive = credit, negative = debit)
- type: ENUM (PURCHASE, DEDUCTION, REFUND)
- description: VARCHAR
- reference_id: UUID NULLABLE
- created_at: TIMESTAMP WITH TIME ZONE

payment_orders
- id: UUID PK
- user_id: UUID FK → users
- solidgate_order_id: VARCHAR UNIQUE NOT NULL
- amount_usd: NUMERIC(10,2)
- credits_to_add: INT NOT NULL
- status: ENUM (PENDING, APPROVED, DECLINED, REFUNDED) DEFAULT PENDING
- created_at, updated_at: TIMESTAMP WITH TIME ZONE

webhook_events  ← idempotency table
- id: UUID PK
- event_id: VARCHAR UNIQUE NOT NULL  ← SolidGate's unique event identifier
- event_type: VARCHAR NOT NULL
- payload: JSONB
- status: ENUM (PROCESSED, FAILED)
- processed_at: TIMESTAMP WITH TIME ZONE DEFAULT now()

humanization_requests
- id: UUID PK
- user_id: UUID FK → users
- input_text: TEXT NOT NULL
- output_text: TEXT
- word_count: INT
- credits_used: INT
- openai_model: VARCHAR
- tokens_used: INT
- created_at: TIMESTAMP WITH TIME ZONE

═══ PHASE 3: CORE FLOWS ═══

Auth:
  POST /auth/register → hash password → create User + CreditBalance(0) → return tokens
  POST /auth/login → verify → issue access(15m) + refresh(30d, hashed in DB) → return
  POST /auth/refresh → verify hash → revoke old → issue new pair (rotation)
  POST /auth/logout → revoke refresh token in DB

Payment:
  POST /payments/orders
    → create PaymentOrder (PENDING)
    → init SolidGate payment
    → return payment_url

  POST /payments/webhook/solidgate
    → verify SolidGate signature (from reference project)
    → if event_id in webhook_events → return 200 immediately (idempotency)
    → begin transaction:
        order.approved  → update order APPROVED + add credits + log PURCHASE transaction
        order.declined  → update order DECLINED
        order.refunded  → update order REFUNDED + deduct credits + log REFUND transaction
    → insert into webhook_events
    → commit
    → ALWAYS return HTTP 200 (log errors internally, never surface to SolidGate)

Humanize:
  POST /humanize
    → auth required
    → validate: non-empty, max 5000 words
    → cost = ceil(word_count / 10)
    → SELECT FOR UPDATE credit_balance (prevent race condition)
    → if balance < cost → 402, release lock
    → call OpenAI async (gpt-4o)
    → if OpenAI error → 503, release lock, DO NOT deduct
    → deduct credits (same transaction as lock)
    → insert CreditTransaction (DEDUCTION) + HumanizationRequest log
    → commit
    → return { humanized_text, word_count, credits_used, remaining_balance }

OpenAI Prompt (single universal mode):
  System: "You are an expert editor who specializes in making AI-generated text sound
  authentically human. You rewrite text to have natural flow, varied sentence structure,
  and genuine voice — while preserving the original meaning completely."

  User: "Rewrite the following text to sound naturally human-written. Use varied sentence
  lengths, natural transitions, and an authentic voice. Avoid patterns typical of
  AI-generated text. Return only the rewritten text, nothing else.\n\n[INPUT TEXT]"

Error taxonomy:
  RateLimitError    → HTTP 503 "AI service temporarily unavailable, please retry"
  APITimeoutError   → HTTP 503 same message
  Empty response    → HTTP 503, log anomaly internally
  Insufficient credits → HTTP 402 { current_balance, required }
  All 500s          → log full traceback, return safe generic message to client

═══ PHASE 4: POLISH ═══
- Rate limit: 10 /humanize requests per minute per user
- Response envelope: {"data": ..., "error": null} / {"data": null, "error": {"code": "...", "message": "..."}}
- GET /health → {"status": "ok", "db": "ok", "version": "1.0.0"}
- Structured JSON logging per request: user_id, endpoint, latency_ms, status_code
</STRATEGY>

<AGENT_SWARM>
Mode: SWARM
Coordination: ORCHESTRATOR_PATTERN

🎯 ORCHESTRATOR (You — the Lead)
Ensure every service, model, and route fits together. No gaps, no inconsistencies across files.

🔍 AGENT: RESEARCHER — "SolidGate & Reference Codebase Analyst"
Mission: Extract the exact SolidGate integration from AI_Companion/backend
Tasks:
- Read /Users/dmytro/Documents/work/AI_Companion/backend in full
- Extract webhook signature verification — copy the approach exactly, don't guess
- Extract idempotency pattern — adapt to this project's webhook_events table
- Identify any reusable utilities, base models, or config patterns
Quality Gate: Webhook handler matches the verified approach from the reference project

🏗️ AGENT: ARCHITECT — "Schema & Service Designer"
Mission: Lock down DB schema and service boundaries before any app code is written
Tasks:
- Finalize all SQLAlchemy 2.x models with correct types, constraints, indexes
- Plan atomic credit operations — SELECT FOR UPDATE to prevent race conditions
- Design async-compatible Alembic env.py
Quality Gate: Schema supports all flows with no N+1 queries, no missing constraints

✍️ AGENT: BUILDER — "Senior Python Engineer"
Mission: Write every file — fully working, zero placeholders
Tasks:
- All SQLAlchemy 2.x async models (mapped_column style)
- All Pydantic v2 schemas (model_config = ConfigDict style)
- All service layer functions
- All FastAPI route handlers (thin — delegate everything to services)
- Async Alembic env.py + 0001_initial migration
- docker-compose.yml, Dockerfile, requirements.txt
- .env.example with inline documentation per variable
- README.md with setup steps + curl examples
Quality Gate: docker-compose up && alembic upgrade head runs without errors

🔬 AGENT: REVIEWER — "Security & Reliability Auditor"
Checks:
- Webhook idempotency: double-delivery → no double credits?
- Credit atomicity: SELECT FOR UPDATE in place? Balance CHECK constraint exists?
- TOCTOU: two concurrent /humanize requests at same low balance — both blocked?
- OpenAI failures: all error types caught, none trigger credit deduction?
- Refresh tokens: single-use with rotation implemented?
- Secrets: zero hardcoded values anywhere in codebase?
Quality Gate: No security or data integrity issues remain

💎 AGENT: POLISHER — "API Quality Engineer"
Tasks:
- Consistent error codes and messages across all endpoints
- Curl examples for every endpoint in README
- Inline comments on non-obvious logic (SELECT FOR UPDATE, webhook idempotency flow)
- Health check endpoint
- Final pass: remove redundancy, dead code, inconsistent naming
</AGENT_SWARM>

<CONSTRAINTS>
═══ HARD REQUIREMENTS ═══
MUST include:
- Async throughout — no synchronous SQLAlchemy in async FastAPI context
- PostgreSQL UUID primary keys, JSONB for webhook payload, TIMESTAMP WITH TIME ZONE
- SELECT FOR UPDATE on credit_balance during humanization (race condition prevention)
- webhook_events table as the idempotency mechanism for SolidGate
- Credit check BEFORE OpenAI call
- Credit deduction AFTER confirmed OpenAI success only — never on failure
- All secrets via environment variables — zero hardcoding
- Consistent JSON response envelope across every endpoint
- docker-compose with postgres + app services

MUST avoid:
- Mixing sync and async SQLAlchemy patterns
- Catching bare `except Exception` without logging full traceback
- Trusting SolidGate webhook payload without signature verification
- Deducting credits when OpenAI returns an error or empty response
- Exposing stack traces or internal error details in API responses
- Any TODO, stub, or placeholder in the final output

═══ CODE STYLE ═══
- Python 3.11+ type hints everywhere
- Pydantic v2 syntax: model_config = ConfigDict(...), not class Config
- SQLAlchemy 2.x: mapped_column() style, not legacy Column()
- Services return typed Pydantic models or raise custom exceptions — never raw ORM rows
- Routes import from schemas, never directly from models
- All datetime fields timezone-aware (TIMESTAMP WITH TIME ZONE)
- No file over 300 lines — split if needed
- Every file starts with a one-line docstring stating its purpose
</CONSTRAINTS>

<o>
═══ DELIVERABLE ═══
Complete project saved to: ./humanizer-backend/
Every file fully implemented — no stubs, no TODOs, no placeholders.

Required files:
app/main.py, app/config.py, app/database.py
app/models/user.py, credit.py, payment.py, humanization.py
app/schemas/auth.py, credit.py, payment.py, humanization.py
app/api/v1/auth.py, users.py, payments.py, humanize.py, router.py
app/services/auth_service.py, credit_service.py, payment_service.py, humanize_service.py, openai_service.py
app/dependencies/auth.py, db.py
app/core/security.py, exceptions.py, logging.py
alembic/env.py, alembic/versions/0001_initial.py
tests/conftest.py, test_auth.py, test_payments.py, test_humanize.py
docker-compose.yml, Dockerfile, requirements.txt, .env.example, README.md

═══ QUALITY BAR ═══
"Code you'd find in a well-run Series A startup backend — not over-engineered, not under-built.
A senior engineer reviewing this PR should nod, not wince."

═══ ENHANCEMENT MANDATE ═══
Full discretion to:
- Add a missing utility or middleware if the architecture clearly needs it
- Improve the OpenAI prompt if you can make humanization more effective
- Add a slowapi rate limiter if not already specified
- Suggest a better pattern than specified — justify it in an inline comment
Goal: best possible production starting point, not blind template compliance.
</o>

<ULTRATHINK>
Before writing any code, think through these 5 critical design decisions:

1. CREDIT RACE CONDITION
Two concurrent requests, user has 5 credits, each costs 5.
Both hit check → both see 5 → both pass → both deduct → balance = -5.
Fix: SELECT FOR UPDATE on credit_balance within the same DB transaction as deduction.
What is the exact async SQLAlchemy 2.x pattern for this? Work it out before implementing.

2. WEBHOOK IDEMPOTENCY
SolidGate retries on timeout or non-200. Sequence must be:
check webhook_events → process → insert webhook_events (all in one transaction).
Risk: what if insert into webhook_events succeeds but credit add fails?
Or credit add succeeds but webhook_events insert fails?
Design the transaction order to minimize this window.

3. OPENAI FAILURE TAXONOMY
RateLimitError vs APITimeoutError vs empty response vs malformed JSON.
Which ones warrant a single retry? Which go straight to 503?
In all cases: credits must NOT be deducted.
Design the try/except structure in openai_service.py before copying it.

4. ASYNC ALEMBIC
Standard Alembic env.py is synchronous. Async SQLAlchemy needs asyncio.run() wrapping.
Use the run_async_migrations pattern. Make sure autogenerate detects all models correctly.

5. REFERENCE PROJECT
Read /Users/dmytro/Documents/work/AI_Companion/backend before writing payment_service.py.
The SolidGate signature verification is the most critical piece — extract it precisely.
</ULTRATHINK>

<GUARDRAILS>
Before finalizing each component:

□ WEBHOOK: Processing same event_id twice → identical result, no double credits?
□ CREDITS: Can balance go negative? DB CHECK constraint AND app-level guard both present?
□ CREDIT TIMING: Deduction only after OpenAI returns valid non-empty response?
□ OPENAI: Empty string response treated as error, not success?
□ AUTH: Refresh tokens single-use with rotation? Old token revoked on refresh?
□ SECRETS: Zero hardcoded values — mentally grep the output before declaring done

Common failure modes:
□ WEBHOOK-DOUBLE: No idempotency → double credits on SolidGate retry
□ CREDIT-LEAK: Deducting credits before confirming OpenAI success
□ RACE-CONDITION: Concurrent requests both pass credit check → negative balance
□ SILENT-FAILURE: OpenAI returns empty string → treated as success → user billed for nothing
□ BLOCKING-ASYNC: Sync DB call inside async function → event loop blocked under load

If you find a flaw in the spec mid-implementation:
1. Stop and document the issue in an inline comment
2. Implement the correct solution
3. Note the deviation in the README
</GUARDRAILS>
```

---

## 📋 HOW TO USE

1. Ensure Claude Code can access `/Users/dmytro/Documents/work/AI_Companion/backend`
2. Copy everything inside the code block above
3. Paste into Claude Code terminal
4. Claude reads the reference project first, then builds the full backend
5. After generation: `cp .env.example .env` → fill in keys → `docker-compose up`

---

## ⚙️ ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/humanizer

# Auth
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_TIMEOUT_SECONDS=30

# SolidGate
SOLIDGATE_PUBLIC_KEY=
SOLIDGATE_SECRET_KEY=
SOLIDGATE_WEBHOOK_SECRET=

# App
APP_ENV=development
LOG_LEVEL=INFO
```

---

## 🔌 ENDPOINTS

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register new user |
| POST | `/api/v1/auth/login` | — | Login, receive tokens |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token |
| POST | `/api/v1/auth/logout` | ✓ | Revoke refresh token |
| GET | `/api/v1/users/me` | ✓ | Current user profile |
| GET | `/api/v1/users/me/credits` | ✓ | Balance + transaction history |
| POST | `/api/v1/payments/orders` | ✓ | Create SolidGate payment order |
| POST | `/api/v1/payments/webhook/solidgate` | — | SolidGate webhook receiver |
| POST | `/api/v1/humanize` | ✓ | Humanize text |
| GET | `/health` | — | Health check |
