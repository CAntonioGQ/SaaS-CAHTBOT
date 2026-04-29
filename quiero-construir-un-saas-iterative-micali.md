# Plan: Empleado IA para WhatsApp — SaaS Architecture

## Context

Greenfield SaaS product. Zero existing code in `c:\Users\cruza\SaaS CAHTBOT`. Goal: platform where any business deploys an AI WhatsApp agent in <5 min — lead capture, appointment booking, inventory lookup, human escalation, multi-tenant, billing.

---

## Architecture Decision

**Turborepo monorepo** with:
- `apps/web` → Next.js 14 (App Router) + TailwindCSS + shadcn/ui → deploy to Vercel
- `apps/api` → NestJS → deploy to Railway (persistent container — BullMQ workers + WhatsApp webhook reliability)
- `packages/prisma` → shared Prisma schema + client
- `packages/shared-types` → shared TypeScript interfaces
- `packages/ui` → shared shadcn/ui components

**Why NestJS over Next.js API Routes:** BullMQ workers need persistent process; Meta webhook ACK must be <5s; AI pipeline can exceed Vercel's 10s timeout.

---

## Auth Strategy (NO Clerk)

**NestJS Passport.js + JWT** stored in httpOnly cookie. No Clerk — too expensive for Latam SaaS with low pricing.

- NestJS: `@nestjs/passport` + `passport-local` + `passport-jwt` + `@nestjs/jwt` + `bcrypt`
- Next.js: stores JWT from NestJS in httpOnly cookie, passes as `Authorization: Bearer` to API
- Multi-tenant: `Organization` + `OrganizationMember` managed manually in DB
- **Migrate to Clerk later** once revenue justifies cost — model is identical

**Adds to Prisma schema:**
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  firstName     String?
  lastName      String?
  avatarUrl     String?
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  memberships   OrganizationMember[]
}
```
`OrganizationMember.clerkUserId` → renamed to `userId`, references `User.id`.
No `clerkOrgId` on Organization — use internal `id` only.

---

## AI Model Strategy (OpenRouter)

Single `OpenRouterService` client (`https://openrouter.ai/api/v1`) — OpenAI-compatible API.
Model selection by **organization plan tier**:

| Plan tier | Primary model | Fallback |
|-----------|--------------|---------|
| Free | `tencent/hy3-preview:free` | `deepseek/deepseek-chat-v3-0324` |
| Starter | `deepseek/deepseek-chat-v3-0324` | `tencent/hy3-preview:free` |
| Pro | `openai/gpt-4o` | `deepseek/deepseek-chat-v3-0324` |

- `Agent.modelTier` field: `FREE | STARTER | PRO` (default: FREE for trial)
- Fallback: if primary returns 429/5xx → retry with fallback model
- **Key stored in `OPENROUTER_API_KEY` env var — NEVER in repo**
- DeepSeek V3 = excellent function calling, great Spanish, ~$0.27/M tokens — safe default

Replace `openai.service.ts` + `claude.service.ts` → single `openrouter.service.ts`.

---

## Context / Memory Compression

Active window: **last 12 messages** (not 20).
Older context: `Conversation.summary` field (already in schema) = compressed summary.

**Pipeline:**
```
buildMessages(conversation, agent):
  1. system prompt
  2. if conversation.summary → { role: "system", content: "Previous context: " + summary }
  3. last 12 messages as user/assistant turns
  → ~70% token savings on long conversations
```

**Compression job (BullMQ):**
- Trigger: `messageCount % 15 === 0` (every 15th message)
- Job: `conversation-summary` queue → call DeepSeek cheap → update `Conversation.summary`
- Summarize messages 1..N-12, keep last 12 raw in context

---

## Folder Structure

```
empleado-ia/
├── turbo.json
├── package.json                    # Root workspace
├── .env.example
├── docker-compose.yml              # Local: postgres, redis, api, web
├── packages/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── shared-types/src/
│   │   ├── agent.types.ts
│   │   ├── conversation.types.ts
│   │   ├── billing.types.ts
│   │   └── whatsapp.types.ts
│   └── ui/src/components/
├── apps/
│   ├── web/src/
│   │   ├── app/
│   │   │   ├── (auth)/login|register/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── agents/[agentId]/
│   │   │   │   ├── inbox/[conversationId]/
│   │   │   │   ├── leads/
│   │   │   │   ├── appointments/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/whatsapp|billing|team/
│   │   ├── components/agents|inbox|analytics|billing|layout/
│   │   ├── hooks/
│   │   └── lib/api-client.ts
│   └── api/src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/
│       ├── common/
│       │   ├── guards/jwt-auth.guard.ts
│       │   ├── guards/local-auth.guard.ts
│       │   ├── guards/subscription.guard.ts
│       │   ├── interceptors/tenant-context.interceptor.ts
│       │   ├── decorators/current-org.decorator.ts
│       │   ├── decorators/current-user.decorator.ts
│       │   └── services/tenant-base.service.ts
│       ├── config/env.validation.ts
│       └── modules/
│           ├── auth/                         # register, login, me, refresh
│           ├── organizations/
│           ├── agents/
│           ├── whatsapp/
│           │   └── guards/whatsapp-signature.guard.ts
│           ├── ai-pipeline/
│           │   ├── ai-pipeline.service.ts
│           │   ├── openrouter.service.ts     # single client for all models
│           │   ├── tool-executor.service.ts
│           │   └── tools/lead-capture|appointment-booking|inventory-lookup|human-escalation.tool.ts
│           ├── conversations/
│           │   └── sse.gateway.ts            # SSE for MVP; WebSocket upgrade in Phase 2
│           ├── messages/
│           ├── leads/
│           ├── appointments/
│           ├── contacts/
│           ├── analytics/
│           ├── billing/
│           │   └── stripe-webhook.controller.ts
│           └── queue/
│               ├── message-processor.processor.ts
│               └── conversation-summary.processor.ts  # memory compression worker
```

---

## Prisma Schema (key models — updated)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  firstName     String?
  lastName      String?
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  memberships   OrganizationMember[]
}

model Organization {
  id              String  @id @default(cuid())
  name            String
  slug            String  @unique
  whatsappPhoneId String?
  whatsappToken   String? // AES-256 encrypted
  webhookSecret   String
  timezone        String  @default("America/Mexico_City")
  // relations: members, agents, conversations, contacts, leads, appointments,
  //            webhookEvents, subscription, analytics, auditLogs
}

model OrganizationMember {
  id             String       @id @default(cuid())
  organizationId String
  userId         String       // references User.id (not Clerk)
  role           String       @default("member")
  organization   Organization @relation(...)
  user           User         @relation(...)
  @@unique([organizationId, userId])
}

model Agent {
  id               String      @id @default(cuid())
  organizationId   String
  name             String
  systemPrompt     String      @db.Text
  tone             AgentTone
  modelTier        ModelTier   @default(FREE)  // FREE|STARTER|PRO
  businessHours    Json
  temperature      Float       @default(0.3)
  leadCaptureEnabled     Boolean @default(true)
  appointmentEnabled     Boolean @default(false)
  humanEscalationEnabled Boolean @default(true)
  escalationKeywords     String[]
}

model Conversation {
  id               String             @id @default(cuid())
  organizationId   String
  agentId          String
  contactId        String
  assignedMemberId String?
  status           ConversationStatus
  summary          String?            @db.Text  // memory compression output
  messageCount     Int                @default(0)
}

model Message { ... }   // same as before
model Lead { ... }      // same as before
model Subscription { ... }  // same as before

enum ModelTier {
  FREE
  STARTER
  PRO
}
```

---

## AI Pipeline Flow (updated)

```
WhatsApp Cloud API
  → POST /whatsapp/webhook (HMAC verified)
  → HTTP 200 ACK immediately
  → Persist WebhookEvent
  → Enqueue BullMQ "message-processing" job
      ↓
MessageProcessorProcessor
  1. Dedup by wamid
  2. Find org by whatsappPhoneId
  3. Find/create Contact
  4. Find/create Conversation
  5. Persist inbound Message, increment messageCount
  6. Check business hours → outsideHoursMsg if closed
  7. Check subscription limits
  8. Check if HUMAN_ACTIVE → skip AI, inbox only
  9. Check escalation keywords → EscalationTool
  10. AIPipelineService.run()
       - buildMessages():
           { role: "system", content: agent.systemPrompt }
           if conversation.summary → { role: "system", content: "Contexto previo: " + summary }
           last 12 messages as user/assistant (NOT 20)
       - Select model by agent.modelTier (FREE/STARTER/PRO)
       - Call OpenRouterService with tool definitions:
           capture_lead, book_appointment, check_inventory, escalate_to_human
       - If tool_call → ToolExecutorService.execute() → second call for natural language response
       - If 429/5xx → fallback model (next tier down)
  11. Persist outbound Message (tokens, model, latency)
  12. WhatsAppCloudService.sendMessage()
  13. Update DailyAnalytics
  14. If messageCount % 15 === 0 → enqueue "conversation-summary" job
  15. Emit SSE event for realtime inbox

ConversationSummaryProcessor (BullMQ):
  - Fetch messages older than last 12
  - Call DeepSeek (cheap) → summarize in Spanish
  - Update Conversation.summary
  - Delete old messages OR keep for audit (config flag)
```

---

## Multi-Tenant Isolation

- Every DB table: `organizationId` non-nullable, indexed
- `TenantContextInterceptor`: extracts `organizationId` from JWT payload → `AsyncLocalStorage`
- `TenantBaseService`: `this.orgId` getter, all services extend it
- All Prisma queries: `where: { ..., organizationId: this.orgId }` — 404 for cross-tenant
- Storage paths: `{bucket}/{organizationId}/{conversationId}/{messageId}/{file}`

---

## Key API Endpoints

```
# Auth (NO Clerk)
POST /auth/register        # create user + org
POST /auth/login           # returns JWT in httpOnly cookie
POST /auth/logout
GET  /auth/me
POST /auth/refresh

# Organizations
GET  /organizations/current
PATCH /organizations/current
GET  /organizations/members
POST /organizations/invite   # email invite with token

# Agents
GET|POST /agents
GET|PATCH|DELETE /agents/:id
PATCH /agents/:id/status
POST  /agents/:id/test

# WhatsApp
GET|POST /whatsapp/webhook
POST     /whatsapp/send

# Conversations
GET  /conversations
GET  /conversations/:id
POST /conversations/:id/escalate
POST /conversations/:id/resolve
POST /conversations/:id/assign
GET  /conversations/stream      # SSE (WebSocket upgrade = Phase 2)

# Messages
GET|POST /conversations/:id/messages

# Leads, Appointments, Contacts — full CRUD
# Analytics — overview, time series, per-agent, lead funnel, AI costs
# Billing — plans, subscription, Stripe checkout/portal/webhook
```

---

## Security

- `JwtAuthGuard` on all routes except `/health`, `/auth/login`, `/auth/register`, `/whatsapp/webhook`, `/billing/webhook`
- WhatsApp webhook: HMAC-SHA256 `X-Hub-Signature-256` via `timingSafeEqual`
- Stripe webhook: `stripe.webhooks.constructEvent()` on raw body
- Passwords: bcrypt with cost factor 12
- JWT: HS256 with `AUTH_SECRET`, 7d access token + 30d refresh token
- Rate limiting: 100 req/min global, 5/min on `/auth/login` (brute force), 1000/min WhatsApp webhook
- Zod validation all DTOs
- WhatsApp tokens: AES-256-GCM encrypted at rest
- OPENROUTER_API_KEY: env var only, never in responses or logs
- CORS allowlist, Helmet, 1MB request limit

---

## Roadmap

### Phase 1 — MVP (Weeks 1–4)
| Week | Deliverables |
|------|--------------|
| 1 | Turborepo + Docker Compose + Prisma schema + NestJS skeleton + JWT auth (register/login/me) |
| 2 | Agent CRUD + UI, WhatsApp webhook verify + receive + HMAC, BullMQ setup |
| 3 | AI Pipeline (OpenRouter + DeepSeek/free models + tool calling + memory compression), WhatsApp send, Inbox UI + SSE |
| 4 | Human escalation, Lead capture, Stripe billing, Subscription guard, Basic analytics, Deploy |

### Phase 2 — Growth (Weeks 5–8)
- Appointment booking + calendar UI
- Inventory lookup (configurable webhook URL)
- Multi-agent per org
- Team inbox + conversation assignment
- Media (images/audio) + Whisper transcription
- Detailed analytics (time series, cost tracking)
- Message templates (Meta approved)
- Onboarding wizard
- **SSE → WebSocket upgrade for inbox**
- Daily email digest (Resend)

### Phase 3 — Scale
- RAG: PDF/DOCX → pgvector → contextual retrieval
- Public API + Zapier/n8n
- OpenTelemetry → Grafana + Sentry
- Read replica for analytics
- White-label (custom domain per org)
- Multi-language auto-detection
- **Optional: migrate to Clerk** if revenue justifies cost
- SOC 2 Type II prep

---

## Implementation Order

1. `docker-compose.yml` + `turbo.json` + root `package.json`
2. `packages/prisma/schema.prisma` (full schema — source of truth)
3. `apps/api` NestJS skeleton: main.ts, app.module, prisma service, env validation
4. `apps/api` common layer: JWT auth guard, tenant interceptor, subscription guard, tenant-base service
5. `apps/api` auth module: register, login, logout, me, refresh (Passport.js + bcrypt + JWT)
6. `apps/api` organizations module
7. `apps/api` agents module (CRUD)
8. `apps/api` WhatsApp module (webhook verify + receive + HMAC guard + cloud send)
9. `apps/api` queue module (BullMQ + MessageProcessor + SummaryProcessor)
10. `apps/api` AI pipeline (OpenRouter single client + model tier selection + ToolExecutor + 4 tools)
11. `apps/api` conversations + messages + SSE gateway
12. `apps/api` leads + appointments + contacts
13. `apps/api` analytics + billing (Stripe)
14. `apps/web` Next.js: auth pages → dashboard → agents → inbox → leads → analytics → billing

## Critical Files (create first)
- `packages/prisma/schema.prisma`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/common/interceptors/tenant-context.interceptor.ts`
- `apps/api/src/modules/whatsapp/whatsapp.controller.ts`
- `apps/api/src/modules/ai-pipeline/openrouter.service.ts`
- `apps/api/src/modules/ai-pipeline/ai-pipeline.service.ts`
- `apps/api/src/modules/queue/message-processor.processor.ts`
- `apps/api/src/modules/queue/conversation-summary.processor.ts`

## Verification
- `docker compose up` → Postgres + Redis + API + Web start
- `POST /auth/register` → creates User + Organization + trial Subscription
- `POST /auth/login` → returns JWT cookie
- `GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=yyy` → returns challenge
- Incoming WhatsApp message → in inbox within 3s, AI responds within 5s
- After 15 messages → `Conversation.summary` populated
- Lead captured when AI calls `capture_lead` tool
- Cross-tenant resource access → 404

## Environment Variables (.env.example)
```
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/empleadoia

# Redis
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# OpenRouter (AI)
OPENROUTER_API_KEY=sk-or-v1-...   # NEVER commit real key

# WhatsApp Meta Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# Storage
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# App
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
```
