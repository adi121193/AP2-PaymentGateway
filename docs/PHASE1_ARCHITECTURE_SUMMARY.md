# FrameOS Phase 1 Architecture - Executive Summary

**Date:** 2025-10-20
**Architect:** System Architect Agent
**Status:** Design Complete - Ready for Implementation
**Target:** 10-week development cycle (8 agents at launch)

---

## Overview

This document summarizes the complete architecture design for **FrameOS Phase 1: Agent Marketplace and Orchestration Platform**. The platform builds on the existing AP2 Payment Gateway (C-Layer) to enable developers to publish AI agents and users to discover and execute them.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│         A-LAYER: MARKETPLACE                    │
│  Next.js Frontend + Agent Registry API          │
│  - Developer Portal                             │
│  - Agent Discovery                              │
│  - User Dashboard                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│      B-LAYER: ORCHESTRATION ENGINE              │
│  Docker-based Execution + BullMQ Queue          │
│  - Agent Sandboxing                             │
│  - Execution Monitoring                         │
│  - Resource Limits                              │
│  - Code Scanning                                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│    C-LAYER: PAYMENT GATEWAY (EXISTING)          │
│  ✅ Production Ready (174 tests, 94% coverage)  │
│  - PurchaseIntent → Mandate → Payment           │
│  - Stripe + Cashfree + x402                     │
└─────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Execution Model: **Docker Containers**

**Decision:** Use Docker containers for agent execution (not isolated Node.js processes)

**Why?**
- ✅ Strong kernel-level isolation (security first)
- ✅ Resource limits (CPU/memory) enforced by cgroups
- ✅ Network disabled (`--network=none`)
- ✅ Language agnostic (future: Python, Go, Rust)
- ✅ Industry standard (AWS Lambda, Vercel use containers)

**Trade-offs:**
- ❌ Higher startup overhead (~100ms vs. 10ms for processes)
- ❌ Requires Docker daemon on workers

**Implementation:**
```bash
docker run \
  --network=none \          # No network access
  --read-only \             # Read-only filesystem
  --tmpfs /tmp:size=100m \  # 100MB temp storage
  --cpus=1.0 \              # 1 vCPU limit
  --memory=512m \           # 512MB RAM limit
  --pids-limit=50 \         # Max 50 processes
  --cap-drop=ALL \          # Drop all capabilities
  agent-runtime:latest
```

### 2. Code Storage: **S3 (Cloudflare R2)**

**Decision:** Store agent code in S3-compatible storage (not GitHub or database)

**Why?**
- ✅ Cost-effective ($0.015/GB/month, **zero egress fees** with R2)
- ✅ Fast access (<200ms downloads)
- ✅ Built-in versioning
- ✅ Hash verification (SHA256)

**Structure:**
```
agents/agt_abc123/v1.0.0.tar.gz
agents/agt_abc123/v1.1.0.tar.gz
agents/agt_abc123/v1.2.0.tar.gz
```

### 3. Execution Pattern: **Asynchronous (Queue-Based)**

**Decision:** Use BullMQ job queue for async execution (not synchronous blocking)

**Why?**
- ✅ Scalable (API server doesn't block for 5 minutes)
- ✅ Retry logic with exponential backoff
- ✅ Priority support (paid users > free tier)
- ✅ Graceful degradation (queue fills up vs. requests failing)

**Flow:**
```
User: POST /agents/:id/execute
  ↓
API: Returns 202 Accepted with execution_id
API: Enqueues job in BullMQ
  ↓
User: Polls GET /executions/:id every 2 seconds
  ↓
Worker: Picks job from queue
Worker: Executes agent (5 min max)
Worker: Updates status to "success" or "failed"
  ↓
User: Sees result on next poll
```

### 4. Payment Flow: **Pre-Authorization + Post-Execution Charge**

**Decision:** Create mandate upfront, execute payment only on success

**Why?**
- ✅ Fair: User only pays if agent succeeds
- ✅ No refunds needed (payment never processed if agent fails)
- ✅ Guaranteed payment (mandate locks funds)

**Flow:**
```
User triggers execution
  ↓
Platform creates PurchaseIntent (C-Layer)
Platform creates Mandate (C-Layer) - Signed with Ed25519
  ↓
Execution queued (no payment yet)
  ↓
Agent executes (5 min max)
  ↓
If success: POST /execute (C-Layer charges user)
If failed: No payment (mandate expires)
```

### 5. Database: **Shared with C-Layer**

**Decision:** Use same PostgreSQL database (not separate database)

**Why?**
- ✅ Simpler infrastructure (one database to manage)
- ✅ Easy joins (executions + payments)
- ✅ Cost-effective (Neon pricing scales by storage, not DB count)

**New Models:**
- `Developer` - Agent creators
- `AgentDefinition` - Agent metadata
- `AgentVersion` - Versioned code references
- `AgentDeployment` - User-deployed instances
- `AgentExecution` - Execution logs
- `DeveloperRevenue` - Earnings tracking

### 6. Revenue Split: **70% Developer / 20% Platform / 10% Orchestrator**

**Decision:** 70/20/10 split (competitive with App Store's 70/30)

**Example (₹1.00 payment):**
```
User pays: ₹1.00
  ├─ Payment rail fee (Stripe): ₹0.05 (5%)
  ├─ Developer: ₹0.70 (70%)
  ├─ Platform: ₹0.20 (20%)
  └─ Orchestrator: ₹0.10 (10%) [if applicable]

Net margins: ₹0.15 (15%)
```

---

## Component Architecture

### A-Layer: Marketplace (Next.js Frontend)

**Purpose:** Agent discovery, developer portal, user dashboard

**Technology:**
- **Next.js 14** (App Router) - SEO-critical for marketplace pages
- **TypeScript 5.x**
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Query** - Data fetching
- **Zustand** - State management

**Pages:**
```
/                   → Landing page (SSG)
/agents             → Marketplace (ISR, revalidate every 1 hour)
/agents/:slug       → Agent details (SSR, dynamic)
/dashboard          → User dashboard (CSR, auth required)
/developer          → Developer portal (CSR, auth required)
/executions/:id     → Execution details (SSR, dynamic)
```

### B-Layer: Orchestration Engine (Node.js Backend)

**Purpose:** Agent execution, sandboxing, queue management

**Components:**

1. **Agent Execution Engine**
   - Fetch agent code from S3
   - Spin up Docker container with resource limits
   - Inject user inputs as environment variables
   - Run agent code (timeout: 5 min)
   - Capture stdout/stderr/exit code
   - Store execution record

2. **Sandbox Manager**
   - Manage Docker containers
   - Enforce security policies (no network, no filesystem)
   - Monitor resource usage (CPU, memory)
   - Kill runaway processes
   - Clean up containers after execution

3. **Code Scanner**
   - Static analysis (AST parsing)
   - Pattern detection (malicious code)
   - Dependency scanning
   - Flag suspicious code for manual review

4. **Execution Queue (BullMQ)**
   - Queue agent execution jobs
   - Prioritize jobs (paid users first)
   - Retry failed executions (3 attempts)
   - Handle concurrency limits (10 concurrent executions)

**Technology:**
- **Node.js 20+** - Runtime
- **Express 4.x** - API framework
- **Prisma 5.x** - ORM
- **BullMQ** - Job queue
- **Redis 7.x** - Queue storage + caching
- **Docker 24+** - Container runtime

### C-Layer: Payment Gateway (Existing)

**Status:** ✅ **Production Ready**
- 174 tests passing (94%+ coverage)
- Webhooks implemented
- Seed data loaded
- Stripe + Cashfree + x402 adapters

**No changes needed** - B-Layer integrates via existing API:
- `POST /purchase-intents`
- `POST /mandates`
- `POST /execute`
- `GET /receipts/:id`

---

## Database Schema Extensions

### New Models (6 models)

```prisma
// Developer who publishes agents
model Developer {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  company         String?
  password_hash   String
  status          String   @default("active")
  verified_email  Boolean  @default(false)
  total_revenue   Int      @default(0) // Denormalized

  agents          AgentDefinition[]
  revenue         DeveloperRevenue[]
}

// Agent metadata (marketplace listing)
model AgentDefinition {
  id                String   @id @default(cuid())
  developer_id      String
  name              String
  slug              String   @unique
  description       String
  category          String
  pricing_model     String
  price_amount      Int
  current_version   String

  // Stats (denormalized)
  total_executions  Int      @default(0)
  success_rate      Float    @default(0.0)
  rating            Float    @default(0.0)

  versions          AgentVersion[]
  deployments       AgentDeployment[]
  executions        AgentExecution[]
}

// Agent version (code + manifest)
model AgentVersion {
  id                String   @id @default(cuid())
  agent_id          String
  version           String   // Semantic version
  manifest          Json     // Full manifest
  code_s3_key       String   // S3 key for code
  code_hash         String   // SHA256 hash

  runtime_language  String   @default("nodejs")
  timeout_ms        Int      @default(300000)
  memory_mb         Int      @default(512)

  scan_passed       Boolean  @default(false)
  scan_report       Json?
}

// User deployment (user-specific config)
model AgentDeployment {
  id         String   @id @default(cuid())
  user_id    String   // References Agent.id (C-Layer)
  agent_id   String
  version    String
  config     Json     @default("{}")
  status     String   @default("configured")

  executions AgentExecution[]
}

// Execution log
model AgentExecution {
  id                 String    @id @default(cuid())
  deployment_id      String
  agent_id           String
  user_id            String

  // Payment linkage (C-Layer)
  purchase_intent_id String?
  mandate_id         String?
  payment_id         String?

  inputs             Json
  outputs            Json?

  status             String    @default("queued")
  started_at         DateTime?
  completed_at       DateTime?
  duration_ms        Int?

  stdout             String?   @db.Text
  stderr             String?   @db.Text
  error_message      String?
  exit_code          Int?
}

// Developer revenue tracking
model DeveloperRevenue {
  id             String    @id @default(cuid())
  developer_id   String
  agent_id       String?
  execution_id   String?

  amount         Int
  currency       String    @default("INR")

  status         String    @default("pending")
  paid_out_at    DateTime?
}
```

---

## API Specification Summary

### Base URL
```
Production: https://api.frameos.dev
Staging: https://api-staging.frameos.dev
Local: http://localhost:3000
```

### Authentication
All endpoints require JWT in `Authorization: Bearer <token>` header.

### Key Endpoints

#### Agent Registry

1. **GET /agents** - List all agents
   - Query params: `category`, `search`, `pricing_model`, `sort`, `page`, `limit`
   - Response: Paginated list of agents

2. **POST /agents/register** - Publish new agent (developer)
   - Requires: Idempotency-Key header
   - Body: Agent manifest + Base64-encoded code
   - Response: `agent_id`, `status: pending_review`

3. **GET /agents/:slug** - Get agent details
   - Response: Full agent metadata + manifest

4. **POST /agents/:id/deploy** - Deploy agent (user)
   - Body: `version`, `config` (user settings)
   - Response: `deployment_id`

5. **POST /agents/:id/execute** - Execute agent
   - Body: `deployment_id`, `inputs`
   - Response: `202 Accepted` with `execution_id`

#### Execution Monitoring

6. **GET /executions/:id** - Get execution status
   - Response: `queued` | `running` | `success` | `failed`
   - Polling required (every 2 seconds)

#### Developer Portal

7. **POST /developers/register** - Register developer
   - Body: `email`, `name`, `password`, `company`
   - Response: `developer_id`

8. **GET /developers/analytics** - Developer dashboard
   - Response: Revenue, executions, agent stats

**Full OpenAPI spec:** `/docs/api/agent-endpoints.yaml`

---

## Security Architecture

### 1. Code Security (Static Analysis)

**Dangerous Patterns Blocked:**
```typescript
const DANGEROUS_PATTERNS = [
  /require\(['"]fs['"]\)/,           // File system access
  /child_process/,                   // Shell execution
  /eval\(/,                          // Code injection
  /Function\(/,                      // Dynamic code
  /0x[0-9a-fA-F]{40}/,              // Ethereum addresses
  /bc1[a-zA-Z0-9]{39,59}/,          // Bitcoin addresses
];
```

**Action:** Reject agent if any pattern matches.

### 2. Runtime Sandboxing

**Docker Isolation Layers:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Container | Docker | Process isolation |
| Network | `--network=none` | No HTTP requests |
| Filesystem | `--read-only` | No writes (except /tmp) |
| CPU | `--cpus=1.0` | Max 1 vCPU |
| Memory | `--memory=512m` | Max 512MB RAM |
| Time | Process timeout | Kill after 5 min |

### 3. Data Security

**Sensitive Data Handling:**

| Data Type | Storage | Encryption | Access |
|-----------|---------|------------|--------|
| Agent code | S3 (private) | AES-256 at rest | Developer + Admin |
| User inputs | PostgreSQL | AES-256 (encrypted columns) | User + Execution engine |
| API keys | PostgreSQL | AES-256 + env vars | Injected at runtime |
| Logs | S3 (private) | AES-256 | User + Developer (sanitized) |

### 4. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /agents/register | 10 | 1 hour |
| POST /agents/:id/execute | 100 | 1 hour (per user) |
| GET /agents | 1000 | 1 hour |

---

## Scaling Strategy

### Phase 1 (MVP - 100 users)
```
Infrastructure:
- 1 API server (Railway, 2GB RAM)
- 2 Execution workers (Railway, 4GB RAM each)
- PostgreSQL (Neon, serverless)
- Redis (Railway, 1GB)
- S3 (Cloudflare R2)

Cost: ~$50/month
Max throughput: 20 executions/min
```

### Phase 2 (Growth - 1000 users)
```
Infrastructure:
- 3 API servers (load balanced)
- 10 Execution workers (auto-scaling)
- PostgreSQL read replicas
- Redis cluster (3 nodes)
- CDN for static assets

Cost: ~$300/month
Max throughput: 100 executions/min
```

### Phase 3 (Scale - 10,000+ users)
```
Infrastructure:
- Kubernetes cluster (10+ nodes)
- Firecracker VMs (stronger isolation)
- PostgreSQL sharding by user_id
- Redis Cluster (6+ nodes)
- Multi-region deployment

Cost: ~$2000/month
Max throughput: 500+ executions/min
```

---

## Technology Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14 | SEO, SSR, SSG, API routes |
| **Backend** | Node.js 20 + Express | Proven, scalable, TypeScript support |
| **Database** | PostgreSQL 14+ (Neon) | ACID, relations, JSON support |
| **ORM** | Prisma 5.x | Type-safe, migrations, dev experience |
| **Queue** | BullMQ + Redis | Purpose-built, retry logic, priority |
| **Execution** | Docker 24+ | Security, isolation, language agnostic |
| **Storage** | Cloudflare R2 | Cheap, fast, zero egress fees |
| **Hosting** | Railway (backend) + Vercel (frontend) | Auto-deploy, managed, affordable |
| **Monitoring** | Sentry + Prometheus | Error tracking, metrics |
| **Auth** | JWT (jose) | Stateless, standard |

---

## Implementation Roadmap (10 Weeks)

### Week 1-2: Foundation
- [ ] Database schema migration (extend C-Layer schema)
- [ ] Agent manifest Zod schema
- [ ] S3 integration (Cloudflare R2)
- [ ] BullMQ setup (Redis + queue)

### Week 3-4: Backend (B-Layer)
- [ ] Agent registration endpoint
- [ ] Code scanner implementation
- [ ] Docker execution engine
- [ ] Sandbox manager
- [ ] Execution queue worker

### Week 5-6: Frontend (A-Layer)
- [ ] Next.js app setup
- [ ] Marketplace UI (agent listings)
- [ ] Agent details page
- [ ] User dashboard
- [ ] Developer portal

### Week 7-8: Payment Integration
- [ ] Pre-authorization flow (C-Layer integration)
- [ ] Post-execution payment
- [ ] Revenue tracking
- [ ] Developer payout logic

### Week 9: Testing & Polish
- [ ] Unit tests (execution engine, code scanner)
- [ ] Integration tests (full execution flow)
- [ ] E2E tests (Playwright)
- [ ] Load testing (10 concurrent executions)

### Week 10: Launch Preparation
- [ ] Deploy to staging (Railway)
- [ ] Manual testing (3 native agents + 5 community agents)
- [ ] Documentation (developer guide, API docs)
- [ ] Launch 🚀

---

## Deliverables (Documentation)

All architecture documents have been created:

### 1. **Main Architecture Document**
**File:** `/docs/agent-runtime-architecture.md` (Complete)

Contents:
- Executive summary
- Architecture overview (ASCII diagrams)
- Component architecture
- Execution model
- Agent lifecycle
- Security architecture
- Payment integration
- Database schema
- API specification
- Scaling strategy
- Technology stack

### 2. **Agent Manifest Schema**
**File:** `/packages/domain/src/agent-manifest.ts` (Complete)

Contents:
- Zod schemas for all manifest fields
- TypeScript types
- Validation functions
- Example manifests (4 examples)
- Helper functions

### 3. **Database Schema Extensions**
**File:** `/packages/database/prisma/schema-extensions.prisma` (Complete)

Contents:
- 6 new models (Developer, AgentDefinition, AgentVersion, AgentDeployment, AgentExecution, DeveloperRevenue)
- All fields with types, constraints, indexes
- Relationships with C-Layer models
- Comprehensive comments

### 4. **Design Decisions Document**
**File:** `/docs/agent-runtime-decisions.md` (Complete)

Contents:
- 10 key design decisions
- Options considered
- Rationale for each choice
- Trade-offs accepted
- Implementation details

### 5. **OpenAPI Specification**
**File:** `/docs/api/agent-endpoints.yaml` (Complete)

Contents:
- 8 endpoint specifications
- Request/response schemas
- Authentication
- Error responses
- Examples

---

## Next Steps

### For Human Review:
1. **Review architecture documents** (all files in `/docs/`)
2. **Approve design decisions** (or request changes)
3. **Confirm technology choices** (Docker, BullMQ, Next.js, etc.)
4. **Set up infrastructure** (Railway, Neon, Cloudflare R2 accounts)

### For Development Team:
1. **Backend Developer:** Implement B-Layer (execution engine, queue, API)
2. **Frontend Developer:** Build A-Layer (marketplace, dashboards)
3. **DevOps Engineer:** Set up infrastructure (Docker, Redis, deployment)
4. **QA Tester:** Write tests, validate security

### Immediate Actions:
1. Run database migration to add new models
2. Set up Cloudflare R2 bucket for agent code
3. Configure Redis for BullMQ
4. Create first native agent (LinkedIn Outreach)

---

## Questions & Clarifications

If any part of the architecture is unclear, refer to:
- **Architecture deep dive:** `/docs/agent-runtime-architecture.md`
- **Design rationale:** `/docs/agent-runtime-decisions.md`
- **API examples:** `/docs/api/agent-endpoints.yaml`
- **Database schema:** `/packages/database/prisma/schema-extensions.prisma`
- **Agent manifest spec:** `/packages/domain/src/agent-manifest.ts`

---

**Architecture Status:** ✅ **COMPLETE - READY FOR IMPLEMENTATION**

**Total Design Time:** ~4 hours
**Documents Created:** 5 comprehensive files
**Lines of Documentation:** ~3,500 lines

---

**End of Executive Summary**
