# FrameOS: Strategic Execution Plan
## Agent Task Delegation & 24-Month Roadmap

**Status:** ✅ CEO APPROVED
**Date:** 2025-10-20
**Mission:** Build the Visa for AI agents in 24 months

---

## Available Agent Team

Based on CLAUDE.md specifications, we have 8 specialized agents:

| Agent | Primary Role | Key Strengths |
|-------|-------------|---------------|
| **System Architect** | Architecture & Design | Data models, API specs, system boundaries, tech stack decisions |
| **Backend Developer** | Implementation | REST APIs, business logic, database operations, service integration |
| **Frontend Developer** | UI/UX Implementation | React/Next.js, responsive design, state management, API integration |
| **DevOps Engineer** | Infrastructure | CI/CD, Docker, deployment, monitoring, cloud platforms |
| **QA Tester** | Quality Assurance | Unit tests, integration tests, test coverage, bug identification |
| **Code Reviewer** | Code Quality | Security review, best practices, performance optimization |
| **Project Manager** | Coordination | Planning, tracking, documentation, milestone management |
| **AI Agent Developer** | Agent Systems | LLM integration, agent orchestration, tool use, function calling |

---

# PHASE 0: Foundation Hardening (Weeks 1-2)
**Objective:** Make AP2 Gateway production-ready
**Status:** 🔴 CRITICAL PATH - Must complete before Phase 1

---

## Week 1: Bug Fixes & Testing

### 🔧 **Backend Developer** - TypeScript Error Fixes
**Priority:** P0 (Blocker)
**Time Estimate:** 4 hours

**Tasks:**
1. Fix X402 interface mismatch (packages/rails/src/x402.ts:22)
   - Update `executePayment` signature to match RailAdapter interface
   - Remove `vendorConfig` parameter or make it optional in base interface

2. Fix Stripe API version (packages/rails/src/stripe.ts:15)
   - Change `"2024-12-18.acacia"` to `"2023-10-16"`
   - Or update type definition to accept newer versions

3. Fix X402 error handling (packages/rails/src/x402.ts:68,76,77)
   - Add proper type guards for `errorBody` and `responseData`
   - Example: `if (errorBody && typeof errorBody === 'object' && 'message' in errorBody)`

4. Fix receipt chain nullability (packages/receipts/src/chain.ts:78-82)
   - Add null checks before accessing `receipt` properties
   - Example: `if (!receipt) throw new Error('Receipt not found')`

**Acceptance Criteria:**
- ✅ `npm run typecheck` returns 0 errors
- ✅ `npm run build` compiles successfully
- ✅ All type definitions resolve correctly

**Deliverables:**
- Pull request with fixes
- Updated type definitions

---

### 🧪 **QA Tester** - Unit Test Implementation
**Priority:** P0 (Blocker)
**Time Estimate:** 12 hours

**Tasks:**
1. **Policy Gate Tests** (`tests/unit/policy-gate.test.ts`)
   - 3 positive cases:
     - Valid vendor in allowlist passes
     - Amount under cap passes
     - Daily spending under limit passes
   - 3 negative cases:
     - Vendor not in allowlist fails
     - Amount over cap fails
     - Daily limit exceeded fails

2. **Mandate Signer Tests** (`tests/unit/mandate-signer.test.ts`)
   - 3 positive cases:
     - Valid Ed25519 signature generation
     - Signature verification succeeds
     - Mandate hash generation is deterministic
   - 3 negative cases:
     - Invalid key fails gracefully
     - Tampered signature fails verification
     - Expired mandate rejected

3. **Cashfree Utils Tests** (`tests/unit/cashfree-utils.test.ts`)
   - 3 positive cases:
     - Minor to major conversion (25000 → 250.00)
     - Major to minor conversion (250.00 → 25000)
     - Credential masking works
   - 3 negative cases:
     - Invalid amount throws error
     - Negative amounts rejected
     - Floating point precision handled

4. **Stripe Adapter Tests** (`tests/unit/stripe-adapter.test.ts`)
   - Mock Stripe API calls
   - Test payment intent creation
   - Test webhook signature verification

5. **X402 Adapter Tests** (`tests/unit/x402-adapter.test.ts`)
   - Mock HTTP calls to vendor endpoints
   - Test payment execution flow
   - Test retry logic

**Acceptance Criteria:**
- ✅ 90%+ code coverage on `packages/domain` and `packages/rails`
- ✅ All tests pass: `npm test`
- ✅ Coverage report generated: `npm run test:coverage`

**Deliverables:**
- 5 test files with 15+ test cases
- Coverage report (HTML + JSON)
- Test documentation in `/docs/testing-guide.md`

---

### 👁️ **Code Reviewer** - Security Audit
**Priority:** P1
**Time Estimate:** 4 hours

**Tasks:**
1. Review TypeScript fixes from Backend Developer
2. Review test implementation from QA Tester
3. Security checklist verification:
   - ✅ No secrets in code or logs
   - ✅ Webhook signatures verified
   - ✅ SQL injection prevention (Prisma parameterized queries)
   - ✅ Input validation on all endpoints
   - ✅ Error messages non-sensitive
4. Performance review:
   - Database query optimization
   - N+1 query detection
   - Caching opportunities

**Acceptance Criteria:**
- ✅ Security checklist 100% complete
- ✅ Zero critical or high vulnerabilities
- ✅ Code review approval on all PRs

**Deliverables:**
- Security audit report
- Code review comments (GitHub PR reviews)

---

## Week 2: Deployment & Integration

### 🔧 **Backend Developer** - Webhook Handlers
**Priority:** P0
**Time Estimate:** 6 hours

**Tasks:**
1. **Stripe Webhook Handler** (`apps/api/src/routes/webhooks/stripe.ts`)
   ```typescript
   POST /webhooks/stripe
   - Verify signature using STRIPE_WEBHOOK_SECRET
   - Handle events: payment_intent.succeeded, payment_intent.failed
   - Update Payment status in database
   - Generate Receipt with hash chain
   - Return 200 OK (prevent retries)
   ```

2. **Cashfree Webhook Handler** (`apps/api/src/routes/webhooks/cashfree.ts`)
   ```typescript
   POST /webhooks/cashfree
   - Verify HMAC-SHA256 signature
   - Handle events: PAYMENT_SUCCESS, PAYMENT_FAILED
   - Update Payment status in database
   - Generate Receipt with hash chain
   - Return 200 OK
   ```

3. **Webhook Router** (`apps/api/src/routes/webhooks/index.ts`)
   - Register both webhook endpoints
   - Add rate limiting (100 req/min per IP)
   - Add request logging

**Acceptance Criteria:**
- ✅ Webhooks verify signatures correctly
- ✅ Payment status updates persisted
- ✅ Receipts generated with correct hash chain
- ✅ Idempotent handling (duplicate webhooks ignored)

**Deliverables:**
- 3 new route files
- Integration with existing Receipt service

---

### 🗄️ **Backend Developer** - Database Seed Script
**Priority:** P1
**Time Estimate:** 2 hours

**Tasks:**
1. Create `packages/database/prisma/seed.ts`
2. Seed data:
   - 3 test agents (LOW, MEDIUM, HIGH risk tiers)
   - 3 policies (different caps and allowlists)
   - 5 purchase intents (various statuses)
   - 2 mandates (1 active, 1 expired)
   - 3 payments (settled, pending, failed)
   - 5 receipts (with proper hash chain)
   - 2 vendor x402 endpoints
3. Run script: `npm run db:seed`

**Acceptance Criteria:**
- ✅ Script runs without errors
- ✅ All tables populated with test data
- ✅ Foreign key relationships valid
- ✅ Hash chains correct (verified by nightly job)

**Deliverables:**
- `prisma/seed.ts` script
- README section on seeding database

---

### 🚀 **DevOps Engineer** - Production Deployment
**Priority:** P0
**Time Estimate:** 8 hours

**Tasks:**
1. **Railway Staging Setup**
   - Create new Railway project: `frameos-api-staging`
   - Configure environment variables:
     ```bash
     NODE_ENV=production
     DATABASE_URL=postgresql://... (Neon staging)
     CASHFREE_APP_ID=TEST...
     CASHFREE_SECRET_KEY=TEST...
     STRIPE_SECRET_KEY=sk_test_... (optional)
     MANDATE_SIGN_KEY=<generate>
     JWT_SECRET=<generate>
     ALLOWED_ORIGINS=https://app-staging.frameos.dev
     ```
   - Link GitHub repo for auto-deploy
   - Configure build command: `npm run build`
   - Configure start command: `npm run start --workspace=apps/api`

2. **Database Migration**
   - Run on Railway: `npm run db:migrate:deploy`
   - Run seed: `npm run db:seed`
   - Verify tables created: `npm run db:studio`

3. **Health Check**
   - Hit `/healthz` endpoint
   - Verify response: `{"status":"healthy"}`

4. **Domain Setup**
   - Configure custom domain: `api-staging.frameos.dev`
   - Add SSL certificate (Railway auto-provision)

5. **Monitoring Setup**
   - Install Sentry SDK (error tracking)
   - Install PostHog SDK (analytics)
   - Configure log forwarding (Railway → Datadog/Logtail)

**Acceptance Criteria:**
- ✅ API accessible at https://api-staging.frameos.dev
- ✅ Health check returns 200 OK
- ✅ Database migrations applied
- ✅ Environment variables loaded correctly
- ✅ Logs visible in Railway dashboard

**Deliverables:**
- Deployed staging environment
- Deployment documentation in `/docs/deployment.md`
- Monitoring dashboard URLs

---

### 🧪 **QA Tester** - E2E Smoke Tests
**Priority:** P0
**Time Estimate:** 4 hours

**Tasks:**
1. **7-Minute E2E Flow** (from CLAUDE.md)
   ```bash
   # Test against staging: https://api-staging.frameos.dev

   # 1. Create Purchase Intent
   curl -X POST https://api-staging.frameos.dev/purchase-intents \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <test_token>" \
     -H "Idempotency-Key: e2e-test-001" \
     -d '{
       "vendor": "acme_api",
       "amount": 199,
       "currency": "INR",
       "description": "Test API call"
     }'
   # Expected: 201 Created, intent_id returned

   # 2. Issue Mandate
   curl -X POST https://api-staging.frameos.dev/mandates \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <test_token>" \
     -H "Idempotency-Key: e2e-test-002" \
     -d '{
       "intent_id": "<intent_id>",
       "policy_id": "<policy_id>"
     }'
   # Expected: 201 Created, mandate_id + signature returned

   # 3. Execute Payment
   curl -X POST https://api-staging.frameos.dev/execute \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <test_token>" \
     -H "Idempotency-Key: e2e-test-003" \
     -d '{
       "mandate_id": "<mandate_id>"
     }'
   # Expected: 200 OK, payment_id + receipt_id returned

   # 4. Retrieve Receipt
   curl https://api-staging.frameos.dev/receipts/<receipt_id> \
     -H "Authorization: Bearer <test_token>"
   # Expected: 200 OK, receipt with hash chain
   ```

2. **Load Testing** (using k6)
   - 100 concurrent users
   - 5 minute duration
   - Target: p95 latency < 120ms
   - 0% error rate

3. **Negative Tests**
   - Invalid auth token → 401
   - Missing idempotency key → 400
   - Duplicate idempotency key → returns cached response
   - Expired mandate → 403

**Acceptance Criteria:**
- ✅ E2E flow completes successfully
- ✅ All 4 endpoints return expected responses
- ✅ Load test passes (p95 < 120ms)
- ✅ Negative tests fail gracefully

**Deliverables:**
- E2E test script (bash + curl)
- k6 load test script
- Test results report

---

### 📊 **Project Manager** - Phase 0 Documentation
**Priority:** P1
**Time Estimate:** 4 hours

**Tasks:**
1. Create `/docs/devlog.md` - Week 1-2 progress log
2. Update README.md with deployment instructions
3. Create `/docs/phase-0-completion-report.md`:
   - All tasks completed ✅
   - Test coverage: X%
   - Performance metrics: p95 latency, uptime
   - Known issues / tech debt
4. Prepare Phase 1 kickoff document
5. Update project board (GitHub Projects):
   - Close Phase 0 tickets
   - Create Phase 1 tickets

**Acceptance Criteria:**
- ✅ All documentation up-to-date
- ✅ Phase 0 completion report approved by CEO
- ✅ Phase 1 tickets ready

**Deliverables:**
- 3 documentation files
- Updated README
- Phase 1 kickoff doc

---

## Phase 0 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| TypeScript Errors | 0 | TBD |
| Test Coverage | 90%+ | TBD |
| Deployment Success | ✅ | TBD |
| E2E Tests Passing | 100% | TBD |
| Load Test p95 Latency | < 120ms | TBD |
| Security Vulnerabilities | 0 critical/high | TBD |

**Go/No-Go Decision:** All metrics must pass before Phase 1 starts.

---

# PHASE 1: MVP Launch (Weeks 3-12)
**Objective:** Launch marketplace with 8 agents + A2A payments
**Duration:** 10 weeks

---

## Week 3-4: Agent Runtime & Manifest System

### 🏗️ **System Architect** - Agent Runtime Architecture
**Priority:** P0
**Time Estimate:** 12 hours

**Tasks:**
1. **Design Agent Runtime Architecture**
   - Execution model: Docker containers vs. isolated Node.js processes
   - Sandboxing strategy: VM2, isolated-vm, or Docker?
   - Resource limits: CPU, memory, timeout per execution
   - Agent lifecycle: register → validate → deploy → execute → monitor
   - Error handling: retry logic, circuit breakers, fallbacks

2. **Design Agent Manifest Schema (Zod)**
   ```typescript
   // packages/domain/src/agent-manifest.ts
   export const AgentManifestSchema = z.object({
     id: z.string().regex(/^agt_[a-z0-9_]+$/),
     name: z.string().min(3).max(100),
     version: z.string().regex(/^\d+\.\d+\.\d+$/), // semver
     description: z.string().max(500),
     author: z.object({
       developer_id: z.string(),
       name: z.string(),
       email: z.string().email(),
     }),
     pricing: z.object({
       model: z.enum(["per_execution", "subscription", "pay_per_use"]),
       amount: z.number().int().positive(), // in minor units (paise)
       currency: z.enum(["INR", "USD"]),
     }),
     inputs: z.array(z.object({
       name: z.string(),
       type: z.enum(["string", "number", "boolean", "object", "array"]),
       required: z.boolean(),
       description: z.string().optional(),
     })),
     outputs: z.array(z.object({
       name: z.string(),
       type: z.enum(["string", "number", "boolean", "object", "array"]),
       description: z.string().optional(),
     })),
     capabilities: z.array(z.enum([
       "http_request",
       "database_read",
       "database_write",
       "file_storage",
       "webhook",
       "email",
       "browser_automation",
     ])),
     runtime: z.object({
       language: z.enum(["nodejs", "python", "deno"]),
       version: z.string(),
       entrypoint: z.string(), // e.g., "index.js", "main.py"
       timeout_ms: z.number().int().positive().max(300000), // max 5 min
       memory_mb: z.number().int().positive().max(2048), // max 2GB
     }),
     metadata: z.object({
       category: z.enum(["sales", "marketing", "devops", "research", "productivity"]),
       tags: z.array(z.string()),
       homepage: z.string().url().optional(),
       documentation: z.string().url().optional(),
     }),
   });
   ```

3. **Design Database Schema Extensions**
   ```prisma
   // Add to schema.prisma

   model Developer {
     id           String   @id @default(cuid())
     email        String   @unique
     name         String
     verified     Boolean  @default(false)
     stripe_account_id String? // for payouts
     created_at   DateTime @default(now())

     agents       AgentDefinition[]
   }

   model AgentDefinition {
     id           String   @id // matches manifest.id
     developer_id String
     manifest     Json     // full manifest
     code_url     String   // S3/GCS URL to agent code zip
     status       String   @default("pending_review") // pending_review, approved, rejected, suspended
     downloads    Int      @default(0)
     rating       Float?
     created_at   DateTime @default(now())
     updated_at   DateTime @updatedAt

     developer    Developer @relation(fields: [developer_id], references: [id])
     deployments  AgentDeployment[]
     executions   AgentExecution[]

     @@index([status, created_at])
     @@index([developer_id])
   }

   model AgentDeployment {
     id           String   @id @default(cuid())
     agent_id     String
     user_id      String   // who deployed it
     config       Json     // user-specific config (API keys, etc.)
     status       String   @default("active") // active, paused, deleted
     created_at   DateTime @default(now())

     agent        AgentDefinition @relation(fields: [agent_id], references: [id])
     executions   AgentExecution[]

     @@index([user_id, status])
   }

   model AgentExecution {
     id              String    @id @default(cuid())
     agent_id        String
     deployment_id   String
     inputs          Json
     outputs         Json?
     status          String    @default("pending") // pending, running, succeeded, failed
     started_at      DateTime  @default(now())
     completed_at    DateTime?
     duration_ms     Int?
     error           String?
     payment_id      String?   // links to Payment table
     created_at      DateTime  @default(now())

     agent           AgentDefinition @relation(fields: [agent_id], references: [id])
     deployment      AgentDeployment @relation(fields: [deployment_id], references: [id])

     @@index([agent_id, status, created_at])
     @@index([deployment_id, created_at])
   }
   ```

4. **API Endpoint Specifications**
   - `POST /agents/register` - Developer publishes agent
   - `GET /agents` - List all approved agents (with filters)
   - `GET /agents/:id` - Get agent details
   - `POST /agents/:id/deploy` - User deploys agent
   - `POST /agents/:id/execute` - Trigger agent execution
   - `GET /executions/:id` - Get execution status/results

5. **Security Architecture**
   - Code scanning (detect malicious patterns)
   - Rate limiting per agent (prevent abuse)
   - Agent isolation (cannot access other agents' data)
   - Credential management (encrypted env vars)

**Acceptance Criteria:**
- ✅ Architecture document approved by CEO
- ✅ Manifest schema validates correctly
- ✅ Database schema ready for migration
- ✅ API specs documented (OpenAPI)

**Deliverables:**
- `/docs/agent-runtime-architecture.md`
- `/packages/domain/src/agent-manifest.ts`
- Updated `prisma/schema.prisma`
- `/docs/api/agent-endpoints.yaml` (OpenAPI)

---

### 🔧 **Backend Developer** - Agent Registry API
**Priority:** P0
**Time Estimate:** 16 hours

**Tasks:**
1. **Database Migration**
   - Add Developer, AgentDefinition, AgentDeployment, AgentExecution tables
   - Run migration: `npm run db:migrate`

2. **Implement POST /agents/register**
   ```typescript
   // apps/api/src/routes/agents/register.ts
   - Authenticate developer (JWT)
   - Validate manifest against AgentManifestSchema
   - Upload agent code to S3/GCS (zip file)
   - Create AgentDefinition record (status: pending_review)
   - Send notification to admin for review
   - Return agent_id
   ```

3. **Implement GET /agents**
   ```typescript
   // apps/api/src/routes/agents/list.ts
   - Support filters: category, tags, pricing_model
   - Support pagination (page, limit)
   - Support sorting: latest, popular, rating
   - Only return approved agents
   - Return agent list with metadata
   ```

4. **Implement GET /agents/:id**
   ```typescript
   // apps/api/src/routes/agents/details.ts
   - Return full agent manifest
   - Include statistics: downloads, avg_rating, execution_count
   - Include developer info (name, rating)
   ```

5. **Implement POST /agents/:id/deploy**
   ```typescript
   // apps/api/src/routes/agents/deploy.ts
   - Authenticate user
   - Verify agent exists and is approved
   - Create AgentDeployment record
   - Create mandate for agent payments (if subscription model)
   - Return deployment_id
   ```

**Acceptance Criteria:**
- ✅ All 4 endpoints functional
- ✅ Zod validation on all inputs
- ✅ Idempotency on POST endpoints
- ✅ Unit tests (3 positive + 3 negative per endpoint)

**Deliverables:**
- 4 route files
- Unit tests
- Postman collection for testing

---

### 🤖 **AI Agent Developer** - Agent Execution Engine
**Priority:** P0
**Time Estimate:** 20 hours

**Tasks:**
1. **Docker-Based Execution Engine**
   ```typescript
   // packages/agent-runtime/src/executor.ts

   class AgentExecutor {
     async execute(execution: {
       agent_id: string;
       deployment_id: string;
       inputs: Record<string, any>;
     }): Promise<AgentExecutionResult> {
       // 1. Fetch agent code from S3/GCS
       // 2. Create isolated Docker container
       // 3. Inject inputs as environment variables
       // 4. Run agent code (timeout enforced)
       // 5. Capture outputs (stdout/stderr)
       // 6. Cleanup container
       // 7. Return results
     }
   }
   ```

2. **Sandbox Configuration**
   - Base Docker image: `node:20-alpine` (minimal)
   - No network access by default (unless capability granted)
   - Read-only filesystem (except /tmp)
   - CPU limit: 1 core
   - Memory limit: 512MB
   - Timeout: configurable per agent (max 5 min)

3. **Implement POST /agents/:id/execute**
   ```typescript
   // apps/api/src/routes/agents/execute.ts
   - Authenticate user
   - Verify deployment exists
   - Create AgentExecution record (status: pending)
   - Enqueue execution job (BullMQ)
   - Create payment mandate (charge user)
   - Return execution_id immediately (async execution)
   ```

4. **Background Job Worker**
   ```typescript
   // apps/api/src/workers/agent-executor.ts
   - Poll execution queue
   - Call AgentExecutor.execute()
   - Update AgentExecution status (running → succeeded/failed)
   - Store outputs in database
   - Process payment (charge user, pay developer)
   - Send webhook to user (execution completed)
   ```

5. **Implement GET /executions/:id**
   ```typescript
   // apps/api/src/routes/executions/status.ts
   - Return execution status (pending/running/succeeded/failed)
   - Return outputs (if succeeded)
   - Return error message (if failed)
   - Return duration_ms
   ```

**Acceptance Criteria:**
- ✅ Agents execute in isolated Docker containers
- ✅ Timeouts enforced
- ✅ Outputs captured correctly
- ✅ Failed executions handled gracefully
- ✅ Payment processed after successful execution

**Deliverables:**
- `packages/agent-runtime` package
- 2 API endpoints
- Background worker
- Execution logs visible in dashboard

---

### 🧪 **QA Tester** - Agent Runtime Tests
**Priority:** P0
**Time Estimate:** 12 hours

**Tasks:**
1. **Create Test Agents**
   - **Hello World Agent** - Returns "Hello, {input.name}"
   - **Math Agent** - Performs basic arithmetic
   - **Timeout Agent** - Intentionally sleeps longer than timeout
   - **Malicious Agent** - Tries to access filesystem/network (should fail)

2. **Integration Tests**
   ```typescript
   // tests/integration/agent-execution.test.ts
   - Register test agent → Deploy → Execute → Verify output
   - Test timeout enforcement
   - Test sandbox security (malicious code blocked)
   - Test payment processing (mandate → payment → receipt)
   - Test concurrent executions (10 agents running simultaneously)
   ```

3. **Load Testing**
   - 100 agent executions/minute
   - Verify no memory leaks
   - Verify containers cleaned up

**Acceptance Criteria:**
- ✅ All test agents execute correctly
- ✅ Security sandbox blocks malicious code
- ✅ Load test passes (100 exec/min)

**Deliverables:**
- 4 test agents
- Integration test suite
- Load test report

---

## Week 5-7: Marketplace Frontend (A-Layer)

### 🏗️ **System Architect** - Frontend Architecture
**Priority:** P0
**Time Estimate:** 8 hours

**Tasks:**
1. **Design Component Architecture**
   ```
   app/
   ├── (auth)/
   │   ├── login/
   │   └── register/
   ├── (marketplace)/
   │   ├── page.tsx              # Homepage
   │   ├── agents/
   │   │   ├── [id]/page.tsx     # Agent detail
   │   │   └── search/page.tsx   # Search results
   │   └── categories/
   │       └── [slug]/page.tsx   # Category view
   ├── (dashboard)/
   │   ├── deployments/
   │   ├── executions/
   │   └── billing/
   └── (developer)/
       ├── agents/
       │   ├── new/page.tsx      # Create agent
       │   └── [id]/page.tsx     # Edit agent
       └── earnings/
   ```

2. **Design State Management**
   - Zustand for global state (user, cart, filters)
   - React Query for API data (agents, executions)
   - Local storage for preferences

3. **Design API Client**
   ```typescript
   // lib/api-client.ts
   import axios from 'axios';

   const api = axios.create({
     baseURL: process.env.NEXT_PUBLIC_API_URL,
     headers: {
       'Content-Type': 'application/json',
     },
   });

   // Add auth interceptor
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });

   export const agentsApi = {
     list: (params) => api.get('/agents', { params }),
     get: (id) => api.get(`/agents/${id}`),
     deploy: (id) => api.post(`/agents/${id}/deploy`),
     execute: (id, inputs) => api.post(`/agents/${id}/execute`, inputs),
   };
   ```

4. **Design Component Library**
   - Use shadcn/ui components
   - Custom components:
     - `<AgentCard>` - Agent preview card
     - `<ExecutionLog>` - Real-time execution display
     - `<PaymentModal>` - Mandate approval flow
     - `<CodeEditor>` - Agent code viewer

**Acceptance Criteria:**
- ✅ Architecture document complete
- ✅ Component hierarchy defined
- ✅ API client designed

**Deliverables:**
- `/docs/frontend-architecture.md`
- Component wireframes (Figma/Excalidraw)

---

### 🎨 **Frontend Developer** - Marketplace UI Implementation
**Priority:** P0
**Time Estimate:** 40 hours (1 week full-time)

**Tasks:**

#### **Day 1-2: Project Setup & Core Layout**
1. Initialize Next.js 14 project
   ```bash
   npx create-next-app@latest frameos-app --typescript --tailwind --app
   cd frameos-app
   npm install @radix-ui/react-* class-variance-authority clsx tailwind-merge
   npx shadcn-ui@latest init
   ```

2. Install dependencies
   ```bash
   npm install axios zustand @tanstack/react-query
   npm install @clerk/nextjs  # or auth0
   npm install lucide-react   # icons
   ```

3. **Create Layout Components**
   - `components/layout/Header.tsx` - Navigation, search, user menu
   - `components/layout/Footer.tsx` - Links, social
   - `components/layout/Sidebar.tsx` - Category filters

#### **Day 3-4: Homepage & Agent Listing**
1. **Homepage** (`app/page.tsx`)
   - Hero section: "Hire an AI workforce instantly"
   - Featured agents (carousel)
   - Categories grid (Sales, Marketing, DevOps, Research)
   - Stats: "1,000+ agents, 50,000+ executions"
   - CTA: "Browse Marketplace" button

2. **Agent List Page** (`app/agents/page.tsx`)
   - Search bar with filters (category, pricing, rating)
   - Agent grid (cards with name, description, pricing)
   - Pagination
   - Sort by: latest, popular, rating

3. **AgentCard Component**
   ```tsx
   <AgentCard
     id="agt_linkedin_outreach"
     name="LinkedIn Outreach Agent"
     description="Automate cold outreach on LinkedIn"
     author="DevStudio"
     rating={4.8}
     downloads={1234}
     pricing={{ model: "per_execution", amount: 50 }}
     onDeploy={() => handleDeploy(id)}
   />
   ```

#### **Day 5: Agent Detail Page**
1. **Agent Detail** (`app/agents/[id]/page.tsx`)
   - Agent info (name, description, author, stats)
   - Input/output schema display
   - Pricing breakdown
   - User reviews (5-star system)
   - "Deploy Agent" button → opens payment modal
   - "Try Demo" button → opens input form

2. **PaymentModal Component**
   ```tsx
   <PaymentModal
     agentId="agt_..."
     pricing={{ model: "per_execution", amount: 50 }}
     onApprove={(mandateId) => handleDeploy(mandateId)}
   />
   // Shows:
   // - Pricing details
   // - Mandate terms (spending limits)
   // - Payment method selection
   // - Approve button
   ```

#### **Day 6-7: User Dashboard**
1. **Deployments Page** (`app/dashboard/deployments/page.tsx`)
   - List of deployed agents
   - Status: active, paused, deleted
   - Actions: execute, pause, delete
   - Configuration settings

2. **Executions Page** (`app/dashboard/executions/page.tsx`)
   - Execution history table
   - Status: pending, running, succeeded, failed
   - Inputs/outputs viewer
   - Duration, cost
   - Real-time updates (polling or websockets)

3. **Billing Page** (`app/dashboard/billing/page.tsx`)
   - Total spend (daily, monthly)
   - Transaction history
   - Receipts (downloadable)
   - Payment methods

#### **Day 8: Developer Portal**
1. **Agent Creation** (`app/developer/agents/new/page.tsx`)
   - Form: name, description, category, pricing
   - Code upload (zip file)
   - Manifest editor (JSON)
   - Validation + submit

2. **Earnings Dashboard** (`app/developer/earnings/page.tsx`)
   - Total earnings
   - Revenue chart (daily breakdown)
   - Top performing agents
   - Payout history

**Acceptance Criteria:**
- ✅ All pages responsive (mobile, tablet, desktop)
- ✅ API integration functional
- ✅ Authentication working (Clerk/Auth0)
- ✅ Payment flow end-to-end
- ✅ Real-time execution updates

**Deliverables:**
- Next.js app deployed to Vercel
- Accessible at https://app-staging.frameos.dev
- Component library documented

---

### 🧪 **QA Tester** - Frontend Testing
**Priority:** P1
**Time Estimate:** 8 hours

**Tasks:**
1. **Manual UI Testing**
   - Test all user flows (signup → browse → deploy → execute)
   - Cross-browser testing (Chrome, Firefox, Safari)
   - Mobile responsiveness testing
   - Accessibility testing (WCAG AA compliance)

2. **Automated E2E Tests** (Playwright)
   ```typescript
   // tests/e2e/agent-deployment.spec.ts
   test('User can deploy and execute agent', async ({ page }) => {
     await page.goto('/agents/agt_hello_world');
     await page.click('text=Deploy Agent');
     await page.click('text=Approve & Deploy');
     await page.waitForSelector('text=Deployment successful');
     await page.goto('/dashboard/deployments');
     await page.click('text=Execute');
     await page.fill('input[name="name"]', 'John');
     await page.click('text=Run');
     await page.waitForSelector('text=Hello, John');
   });
   ```

3. **Performance Testing**
   - Lighthouse score > 90 (Performance, Accessibility, Best Practices)
   - Time to Interactive < 3s
   - First Contentful Paint < 1.5s

**Acceptance Criteria:**
- ✅ All manual tests pass
- ✅ E2E tests pass
- ✅ Lighthouse score > 90

**Deliverables:**
- E2E test suite (Playwright)
- Performance report

---

## Week 8-10: Native Orchestrator Agent (B-Layer MVP)

### 🏗️ **System Architect** - Orchestration Architecture
**Priority:** P0
**Time Estimate:** 12 hours

**Tasks:**
1. **Design Orchestration Flow**
   ```
   User Goal: "Generate 100 qualified B2B leads in fintech"

   ┌─────────────────────────────────────────────┐
   │ 1. GoalPlanner Agent (Native)               │
   │    - Parse user goal using Claude 3.5       │
   │    - Decompose into tasks                   │
   │    - Match tasks to marketplace agents      │
   │    - Generate execution DAG                 │
   └─────────────────────────────────────────────┘
                    ↓
   ┌─────────────────────────────────────────────┐
   │ 2. Workflow Executor (Native)               │
   │    - Execute nodes in topological order     │
   │    - Pass outputs between agents            │
   │    - Handle errors (retry, fallback)        │
   │    - Monitor progress                       │
   └─────────────────────────────────────────────┘
                    ↓
   ┌─────────────────────────────────────────────┐
   │ 3. Payment Orchestrator (Native)            │
   │    - Create mandate for workflow            │
   │    - Pay each agent in chain                │
   │    - Generate consolidated receipt          │
   └─────────────────────────────────────────────┘
   ```

2. **Design Workflow DAG Schema**
   ```typescript
   interface WorkflowDAG {
     id: string;
     user_goal: string;
     nodes: WorkflowNode[];
     edges: WorkflowEdge[];
     estimated_cost: number;
     estimated_duration_ms: number;
   }

   interface WorkflowNode {
     id: string; // "node_1", "node_2"
     agent_id: string; // "agt_linkedin_scraper"
     inputs: Record<string, any>;
     dependencies: string[]; // ["node_1"] (must complete before this)
   }

   interface WorkflowEdge {
     from: string; // node_id
     to: string;   // node_id
     output_mapping: Record<string, string>; // { "profiles": "input.profiles" }
   }
   ```

3. **Design Agent Capability Matching**
   - Vector embeddings for agent descriptions
   - Semantic search: user task → best agent match
   - Capability filtering: only agents with required capabilities

4. **Design Error Handling**
   - Retry strategy: exponential backoff (3 attempts)
   - Fallback agents: if primary fails, try alternative
   - Partial success: complete as much as possible
   - User notification: real-time progress updates

**Acceptance Criteria:**
- ✅ Orchestration flow documented
- ✅ DAG schema validated
- ✅ Agent matching algorithm designed

**Deliverables:**
- `/docs/orchestration-architecture.md`
- Workflow DAG schema (Zod)
- Capability matching spec

---

### 🤖 **AI Agent Developer** - GoalPlanner Agent
**Priority:** P0
**Time Estimate:** 30 hours

**Tasks:**

#### **Day 1-2: LLM Integration**
1. **Setup Claude API**
   ```typescript
   // packages/orchestrator/src/llm-client.ts
   import Anthropic from '@anthropic-ai/sdk';

   export class LLMClient {
     private client: Anthropic;

     constructor() {
       this.client = new Anthropic({
         apiKey: process.env.ANTHROPIC_API_KEY,
       });
     }

     async decomposeGoal(userGoal: string, availableAgents: Agent[]): Promise<WorkflowDAG> {
       const prompt = `
         User Goal: ${userGoal}

         Available Agents:
         ${availableAgents.map(a => `- ${a.id}: ${a.description}`).join('\n')}

         Task: Break down the user goal into a step-by-step workflow.
         For each step, select the most appropriate agent from the list.
         Return a JSON workflow DAG.
       `;

       const response = await this.client.messages.create({
         model: 'claude-3-5-sonnet-20241022',
         max_tokens: 4096,
         messages: [{ role: 'user', content: prompt }],
       });

       // Parse JSON from response
       const workflow = JSON.parse(response.content[0].text);
       return workflow;
     }
   }
   ```

#### **Day 3: Agent Capability Vector Search**
1. **Setup Pinecone**
   ```typescript
   // packages/orchestrator/src/vector-search.ts
   import { Pinecone } from '@pinecone-database/pinecone';

   export class AgentMatcher {
     private pinecone: Pinecone;

     async findBestAgent(task: string): Promise<Agent> {
       // 1. Generate embedding for task using Claude
       const embedding = await this.generateEmbedding(task);

       // 2. Search Pinecone for closest agent
       const results = await this.pinecone.index('agents').query({
         vector: embedding,
         topK: 5,
       });

       // 3. Return top match
       return results.matches[0].metadata as Agent;
     }
   }
   ```

#### **Day 4-5: Workflow Executor**
1. **Implement Execution Engine**
   ```typescript
   // packages/orchestrator/src/workflow-executor.ts

   export class WorkflowExecutor {
     async execute(workflow: WorkflowDAG): Promise<WorkflowResult> {
       const nodeResults = new Map<string, any>();

       // Topological sort (execute dependencies first)
       const sortedNodes = this.topologicalSort(workflow);

       for (const node of sortedNodes) {
         try {
           // Get inputs from dependencies
           const inputs = this.resolveInputs(node, nodeResults);

           // Execute agent
           const result = await this.executeAgent(node.agent_id, inputs);

           // Store result
           nodeResults.set(node.id, result);

         } catch (error) {
           // Retry or fallback logic
           await this.handleError(node, error);
         }
       }

       return {
         status: 'completed',
         outputs: nodeResults,
       };
     }
   }
   ```

#### **Day 6-7: API Endpoints**
1. **Implement POST /orchestrate**
   ```typescript
   // apps/api/src/routes/orchestrate.ts

   router.post('/orchestrate', authenticate, asyncHandler(async (req, res) => {
     const { goal } = req.body;

     // 1. Parse goal
     const planner = new GoalPlanner();
     const workflow = await planner.createWorkflow(goal);

     // 2. Estimate cost
     const estimatedCost = workflow.nodes.reduce((sum, node) => {
       return sum + node.agent.pricing.amount;
     }, 0);

     // 3. Create mandate for total workflow cost
     const mandate = await createMandate({
       agent_id: req.agentId,
       amount: estimatedCost,
       description: `Orchestrated workflow: ${goal}`,
     });

     // 4. Execute workflow asynchronously
     const workflowId = await enqueueWorkflow(workflow, mandate.id);

     res.json({
       workflow_id: workflowId,
       estimated_cost: estimatedCost,
       estimated_duration_ms: workflow.estimated_duration_ms,
       status: 'queued',
     });
   }));
   ```

2. **Implement GET /orchestrate/:id**
   ```typescript
   router.get('/orchestrate/:id', authenticate, asyncHandler(async (req, res) => {
     const workflow = await getWorkflow(req.params.id);

     res.json({
       workflow_id: workflow.id,
       status: workflow.status, // queued, running, completed, failed
       progress: workflow.completed_nodes / workflow.total_nodes,
       outputs: workflow.outputs,
       cost: workflow.total_cost,
     });
   }));
   ```

**Acceptance Criteria:**
- ✅ LLM decomposes goals correctly
- ✅ Agent matching > 80% accuracy
- ✅ Workflows execute successfully
- ✅ Errors handled gracefully

**Deliverables:**
- `packages/orchestrator` package
- 2 API endpoints
- Example workflows (5 use cases)

---

### 🧪 **QA Tester** - Orchestration Testing
**Priority:** P0
**Time Estimate:** 12 hours

**Tasks:**
1. **Create Test Workflows**
   - **Lead Generation Workflow** (3 agents chained)
   - **Content Creation Workflow** (4 agents chained)
   - **Data Pipeline Workflow** (5 agents chained)

2. **Test Goal Decomposition**
   - 20 different user goals
   - Verify correct agent selection
   - Verify correct dependency ordering

3. **Test Error Handling**
   - Agent timeout → retry → fallback
   - Agent failure → partial completion
   - Invalid inputs → graceful error

4. **Load Testing**
   - 10 concurrent workflows
   - Verify no resource exhaustion
   - Verify payments processed correctly

**Acceptance Criteria:**
- ✅ All test workflows complete successfully
- ✅ Goal decomposition 80%+ accuracy
- ✅ Error handling works

**Deliverables:**
- Test workflows (JSON files)
- Test report with accuracy metrics

---

## Week 11-12: Launch Preparation

### 🔧 **Backend Developer** - Build Native Execution Agents
**Priority:** P0
**Time Estimate:** 24 hours

**Tasks:**
Build 3 production-ready agents:

#### **1. LinkedIn Outreach Agent**
```typescript
// agents/linkedin-outreach/index.ts

interface Inputs {
  target_profile_url: string;
  message_template: string;
  personalization_data?: Record<string, string>;
}

interface Outputs {
  connection_sent: boolean;
  message_id: string;
  profile_data: {
    name: string;
    headline: string;
    company: string;
  };
}

export async function execute(inputs: Inputs): Promise<Outputs> {
  // 1. Scrape LinkedIn profile (using Bright Data or similar)
  const profile = await scrapeProfile(inputs.target_profile_url);

  // 2. Personalize message
  const message = personalizeTemplate(inputs.message_template, profile);

  // 3. Send connection request via LinkedIn API
  const result = await sendConnectionRequest(profile.id, message);

  return {
    connection_sent: result.success,
    message_id: result.message_id,
    profile_data: {
      name: profile.name,
      headline: profile.headline,
      company: profile.company,
    },
  };
}
```

**Manifest:**
```json
{
  "id": "agt_linkedin_outreach",
  "name": "LinkedIn Cold Outreach Agent",
  "version": "1.0.0",
  "description": "Automate personalized LinkedIn connection requests",
  "pricing": { "model": "per_execution", "amount": 50 },
  "capabilities": ["http_request", "browser_automation"],
  "category": "sales"
}
```

#### **2. Data Enrichment Agent**
```typescript
// agents/data-enrichment/index.ts

interface Inputs {
  company_domain: string;
  fields: string[]; // ["revenue", "employee_count", "industry"]
}

interface Outputs {
  company_data: Record<string, any>;
  confidence_score: number;
}

export async function execute(inputs: Inputs): Promise<Outputs> {
  // 1. Call Clearbit/Hunter.io API
  const data = await enrichCompany(inputs.company_domain);

  // 2. Filter requested fields
  const filtered = inputs.fields.reduce((acc, field) => {
    acc[field] = data[field];
    return acc;
  }, {});

  return {
    company_data: filtered,
    confidence_score: data.confidence,
  };
}
```

**Manifest:**
```json
{
  "id": "agt_data_enrichment",
  "name": "Company Data Enrichment Agent",
  "version": "1.0.0",
  "description": "Enrich company data using multiple sources",
  "pricing": { "model": "per_execution", "amount": 20 },
  "capabilities": ["http_request"],
  "category": "research"
}
```

#### **3. Email Sequence Agent**
```typescript
// agents/email-sequence/index.ts

interface Inputs {
  recipient_email: string;
  sequence_template: string[];
  delay_days: number[];
}

interface Outputs {
  sequence_id: string;
  emails_scheduled: number;
  first_email_sent: boolean;
}

export async function execute(inputs: Inputs): Promise<Outputs> {
  // 1. Create email sequence in SendGrid/Mailgun
  const sequence = await createSequence({
    recipient: inputs.recipient_email,
    templates: inputs.sequence_template,
    delays: inputs.delay_days,
  });

  // 2. Send first email immediately
  const firstEmail = await sendEmail(sequence.emails[0]);

  return {
    sequence_id: sequence.id,
    emails_scheduled: sequence.emails.length,
    first_email_sent: firstEmail.success,
  };
}
```

**Manifest:**
```json
{
  "id": "agt_email_sequence",
  "name": "Email Drip Campaign Agent",
  "version": "1.0.0",
  "description": "Set up automated email sequences",
  "pricing": { "model": "subscription", "amount": 500 },
  "capabilities": ["email", "webhook"],
  "category": "marketing"
}
```

**Acceptance Criteria:**
- ✅ All 3 agents execute successfully
- ✅ Manifests valid
- ✅ Tests passing
- ✅ Deployed to production

**Deliverables:**
- 3 agent implementations
- Test suites for each agent

---

### 🤖 **AI Agent Developer** - Onboard 5 Community Developers
**Priority:** P1
**Time Estimate:** 20 hours

**Tasks:**
1. **Create Developer Onboarding Guide**
   - `/docs/developer-guide.md`
   - Agent SDK documentation
   - Code examples
   - Best practices

2. **Recruit 5 Developers**
   - Post on Twitter, Reddit (r/MachineLearning, r/SideProject)
   - Offer $500 grant per approved agent
   - Target developers in India (lower CAC)

3. **Provide Support**
   - Create Discord channel for developer support
   - Review submitted agents
   - Help debug issues

4. **Target Agents to Build**
   - **SEO Content Generator** (marketing)
   - **Code Review Agent** (devops)
   - **Lead Scorer** (sales)
   - **Twitter Thread Generator** (marketing)
   - **Data Scraper** (research)

**Acceptance Criteria:**
- ✅ 5 community developers onboarded
- ✅ 5 agents submitted for review
- ✅ At least 3 agents approved

**Deliverables:**
- Developer guide
- 5 community agents

---

### 📊 **Project Manager** - Launch Coordination
**Priority:** P0
**Time Estimate:** 20 hours

**Tasks:**

#### **Week 11: Pre-Launch**
1. **Create Launch Checklist**
   - [ ] All 8 agents deployed (3 native + 5 community)
   - [ ] Frontend live at app.frameos.dev
   - [ ] API stable (99% uptime last 7 days)
   - [ ] Documentation complete
   - [ ] Security audit passed
   - [ ] Load testing passed
   - [ ] Beta users invited (100 people)

2. **Write Launch Documentation**
   - `/docs/user-guide.md` - How to use FrameOS
   - `/docs/developer-guide.md` - How to build agents
   - `/docs/faq.md` - Common questions
   - `/docs/pricing.md` - Transparent pricing

3. **Setup Support Channels**
   - Discord server (users + developers)
   - Email support (support@frameos.dev)
   - Status page (status.frameos.dev)

#### **Week 12: Launch**
1. **Create Beta Waitlist**
   - Landing page with email signup
   - Target: 500 signups before launch

2. **Invite Beta Users**
   - Segment 1: 50 "power users" (developers, founders)
   - Segment 2: 30 "early adopters" (tech-savvy individuals)
   - Segment 3: 20 "enterprises" (small businesses)

3. **Launch Day Activities**
   - Product Hunt launch
   - Twitter announcement thread
   - Email to waitlist (100 invites)
   - Reddit posts (r/SideProject, r/Entrepreneur)
   - LinkedIn post from CEO

4. **Monitor Metrics**
   - Signups per day
   - Agent deployments per day
   - Executions per day
   - Error rate
   - User feedback (NPS survey)

**Acceptance Criteria:**
- ✅ 100 beta users onboarded in first week
- ✅ 500+ Product Hunt upvotes
- ✅ 50+ agent deployments
- ✅ NPS > 50

**Deliverables:**
- Launch plan document
- All documentation
- Beta metrics dashboard

---

### 🚀 **DevOps Engineer** - Production Infrastructure
**Priority:** P0
**Time Estimate:** 16 hours

**Tasks:**
1. **Scale Infrastructure**
   - Upgrade Railway plan (Pro: $20/month)
   - Upgrade Neon database (Pro: $69/month)
   - Setup Redis for job queue (Upstash: $10/month)
   - Setup S3 for agent code storage (AWS: pay-as-you-go)

2. **Monitoring & Alerting**
   - Setup Datadog (or Grafana Cloud)
   - Alerts:
     - API error rate > 5%
     - p95 latency > 500ms
     - Database connections > 80%
     - Agent execution failure rate > 10%
   - PagerDuty integration (on-call rotation)

3. **Backup & Disaster Recovery**
   - Daily database backups (Neon auto-backup)
   - Agent code replicated to 3 regions (S3)
   - Runbook for common incidents

4. **Security Hardening**
   - Rate limiting: 100 req/15min per IP
   - DDoS protection (Cloudflare)
   - API key rotation (quarterly)
   - Security headers (Helmet.js)

5. **CI/CD Pipeline**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Production

   on:
     push:
       branches: [main]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: npm ci
         - run: npm test
         - run: npm run typecheck

     deploy:
       needs: test
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: railway up --service api
   ```

**Acceptance Criteria:**
- ✅ 99.9% uptime SLA
- ✅ Monitoring dashboard live
- ✅ Alerts configured
- ✅ CI/CD passing

**Deliverables:**
- Production infrastructure
- Monitoring dashboard
- Runbook document

---

### 👁️ **Code Reviewer** - Pre-Launch Security Audit
**Priority:** P0
**Time Estimate:** 12 hours

**Tasks:**
1. **Code Review: Agent Execution Engine**
   - Verify sandbox isolation
   - Check for code injection vulnerabilities
   - Verify timeout enforcement
   - Check for resource leaks

2. **Code Review: Payment Flow**
   - Verify mandate signature validation
   - Check for race conditions (concurrent payments)
   - Verify idempotency correctness
   - Check for double-spending vulnerabilities

3. **Code Review: API Endpoints**
   - Verify auth on all protected endpoints
   - Check for SQL injection (should be prevented by Prisma)
   - Verify input validation (Zod)
   - Check for SSRF vulnerabilities

4. **Dependency Audit**
   - Run `npm audit`
   - Check for critical/high vulnerabilities
   - Update dependencies with patches

5. **Penetration Testing**
   - Hire external security firm (optional, $2K-$5K)
   - Or use tools: OWASP ZAP, Burp Suite

**Acceptance Criteria:**
- ✅ Zero critical/high vulnerabilities
- ✅ All code reviews approved
- ✅ Security checklist 100% complete

**Deliverables:**
- Security audit report
- List of fixed vulnerabilities

---

## Phase 1 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Agents Live** | 8 (3 native + 5 community) | Count in database |
| **Beta Users** | 100 | User signups |
| **Agent Deployments** | 50+ | AgentDeployment table |
| **Agent Executions** | 200+ | AgentExecution table |
| **GMV** | $5,000 | Sum of all payments |
| **NPS Score** | > 50 | User survey |
| **Uptime** | 99%+ | Railway metrics |
| **p95 Latency** | < 120ms | Datadog metrics |

**CEO Go/No-Go Decision:** If 6/8 metrics achieved → proceed to Phase 2.

---

# PHASE 2: Growth & Monetization (Months 4-9)
**Objective:** Scale to 1,000 agents, $10K MRR

## Month 4-5: Developer Experience

### 🤖 **AI Agent Developer** - Agent SDK (npm package)
**Priority:** P0
**Time Estimate:** 40 hours

**Tasks:**
1. **Create npm package `@frameos/agent-sdk`**
   ```typescript
   // packages/agent-sdk/src/index.ts

   import { z } from 'zod';

   export class Agent<I, O> {
     constructor(config: AgentConfig<I, O>) {
       this.manifest = config.manifest;
       this.handler = config.handler;
     }

     async execute(inputs: I): Promise<O> {
       // Validate inputs
       this.manifest.inputs.parse(inputs);

       // Execute handler
       const outputs = await this.handler(inputs);

       // Validate outputs
       this.manifest.outputs.parse(outputs);

       return outputs;
     }

     async deploy() {
       // Upload agent code to FrameOS
       const zipFile = await this.package();
       await uploadAgent(this.manifest, zipFile);
     }
   }

   // Usage example:
   const myAgent = new Agent({
     manifest: {
       id: 'agt_custom',
       name: 'My Custom Agent',
       version: '1.0.0',
       pricing: { model: 'per_execution', amount: 100 },
       inputs: z.object({ query: z.string() }),
       outputs: z.object({ result: z.string() }),
     },
     handler: async (inputs) => {
       // Your logic here
       return { result: `Processed: ${inputs.query}` };
     },
   });

   await myAgent.deploy();
   ```

2. **Features**
   - Local testing (run agents without deploying)
   - Automatic manifest generation
   - Input/output validation
   - Deployment automation
   - Logging helpers

3. **Documentation**
   - SDK reference docs (TypeDoc)
   - Tutorial: "Build your first agent in 10 minutes"
   - Video walkthrough (Loom recording)

**Acceptance Criteria:**
- ✅ SDK published to npm
- ✅ 10+ developers using SDK
- ✅ Documentation complete

**Deliverables:**
- `@frameos/agent-sdk` package
- Documentation site (docs.frameos.dev)

---

### 🎨 **Frontend Developer** - Developer Portal V2
**Priority:** P1
**Time Estimate:** 24 hours

**Tasks:**
1. **Agent Analytics Dashboard**
   - Execution count over time (chart)
   - Revenue over time (chart)
   - Success/failure rate
   - Average execution duration
   - User reviews

2. **Testing Sandbox**
   - Test agent with custom inputs
   - See outputs in real-time
   - Debug logs
   - Free test credits (100 executions)

3. **Version Management**
   - Publish new versions
   - Deprecate old versions
   - Migration guide for users

**Acceptance Criteria:**
- ✅ Developers can see detailed analytics
- ✅ Testing sandbox works
- ✅ Version management functional

**Deliverables:**
- Enhanced developer portal

---

## Month 6-7: Enterprise Features

### 🔧 **Backend Developer** - Team Workspaces
**Priority:** P1
**Time Estimate:** 32 hours

**Tasks:**
1. **Database Schema**
   ```prisma
   model Organization {
     id         String   @id @default(cuid())
     name       String
     plan       String   @default("free") // free, team, enterprise
     created_at DateTime @default(now())

     members    OrganizationMember[]
     agents     AgentDeployment[]
   }

   model OrganizationMember {
     id              String   @id @default(cuid())
     org_id          String
     user_id         String
     role            String   @default("member") // admin, member, viewer
     created_at      DateTime @default(now())

     organization    Organization @relation(fields: [org_id], references: [id])

     @@unique([org_id, user_id])
   }
   ```

2. **API Endpoints**
   - `POST /organizations` - Create organization
   - `POST /organizations/:id/members` - Invite member
   - `GET /organizations/:id/agents` - List org agents
   - `PUT /organizations/:id/members/:userId` - Update role

3. **Permission System**
   - Admin: full access
   - Member: deploy/execute agents
   - Viewer: read-only

**Acceptance Criteria:**
- ✅ Organizations can be created
- ✅ Members can be invited
- ✅ Permissions enforced

**Deliverables:**
- Team workspace functionality

---

### 🔧 **Backend Developer** - SSO Integration
**Priority:** P2 (Enterprise only)
**Time Estimate:** 16 hours

**Tasks:**
1. **SAML 2.0 Support**
   - Integrate with Okta, Azure AD, OneLogin
   - Use `passport-saml` library

2. **API Endpoints**
   - `GET /sso/login/:org_id` - Initiate SSO
   - `POST /sso/callback` - Handle SAML response

**Acceptance Criteria:**
- ✅ SSO works with Okta
- ✅ User automatically added to org

**Deliverables:**
- SSO integration (enterprise plan only)

---

### 🔧 **Backend Developer** - Advanced Policy Controls
**Priority:** P1
**Time Estimate:** 20 hours

**Tasks:**
1. **Extend Policy Schema**
   ```prisma
   model Policy {
     // Existing fields...
     ip_whitelist      String[]  // Only allow from these IPs
     time_restrictions Json      // { "start": "09:00", "end": "18:00", "timezone": "Asia/Kolkata" }
     approval_required Boolean   @default(false) // Require human approval for high-value txns
   }
   ```

2. **Policy Enforcement**
   - IP check in auth middleware
   - Time window check before execution
   - Approval workflow (manual approval via dashboard)

**Acceptance Criteria:**
- ✅ IP whitelist enforced
- ✅ Time restrictions enforced
- ✅ Approval workflow works

**Deliverables:**
- Advanced policy controls (enterprise feature)

---

## Month 8-9: Marketplace Growth

### 📊 **Project Manager** - Growth Strategy
**Priority:** P0
**Time Estimate:** Ongoing

**Tasks:**
1. **Content Marketing**
   - Blog posts: "Top 10 AI Agents for Sales"
   - Case studies: "How Company X saved 20 hours/week"
   - YouTube tutorials

2. **Community Building**
   - Weekly developer Q&A (Discord)
   - Monthly webinar: "Building Profitable AI Agents"
   - Developer grants: $5K for top 20 agents

3. **Partnerships**
   - Integrate with no-code tools (Zapier, Make)
   - Partner with AI influencers (Twitter, YouTube)
   - Sponsor AI conferences (NeurIPS, AAAI)

**Target Metrics (Month 9):**
- 1,000+ agents published
- 50+ developers earning $100+/month
- 500+ paying users
- $10K MRR

**Deliverables:**
- Growth playbook
- Partnership deals
- Content calendar

---

### 🎨 **Frontend Developer** - Marketplace V2
**Priority:** P1
**Time Estimate:** 32 hours

**Tasks:**
1. **Agent Categories & Search**
   - 10 categories (Sales, Marketing, DevOps, etc.)
   - Advanced filters (pricing, rating, popularity)
   - Semantic search (vector-based)

2. **User Reviews & Ratings**
   - 5-star rating system
   - Written reviews
   - Developer responses
   - Moderation tools

3. **Agent Bundles**
   - "Growth Stack" = 5 agents for $2K/month (10% discount)
   - "Dev Tools Bundle" = 3 agents for $1K/month
   - Custom bundles (user creates their own)

4. **Featured Agents**
   - Editorial picks (curated by FrameOS team)
   - Trending agents (most popular this week)
   - New agents (recently published)

**Acceptance Criteria:**
- ✅ Search returns relevant results
- ✅ Reviews visible on agent pages
- ✅ Bundles purchasable

**Deliverables:**
- Enhanced marketplace UI

---

## Phase 2 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Agents Published | 1,000+ | TBD |
| Developers Earning $100+/month | 50+ | TBD |
| Paying Users | 500+ | TBD |
| MRR | $10,000 | TBD |
| NPS Score | > 60 | TBD |

---

# PHASE 3: Agent Economy (Months 10-18)
**Objective:** Enable agent-to-agent collaboration, financing, reputation

*(Detailed task breakdown available upon request - this phase involves complex multi-agent protocols)*

**Key Milestones:**
- Month 10-12: Multi-agent collaboration protocol
- Month 13-15: Agent credit scores & reputation system
- Month 16-18: Agent financing & revenue-based lending

**Target Metrics (Month 18):**
- 5,000 agents
- 200+ developers earning $500+/month
- 2,000 paying users
- $100K MRR

---

# PHASE 4: Sovereign AI Economy (Months 19-24)
**Objective:** IPO-ready infrastructure for global AI economy

*(Detailed task breakdown available upon request - this is the unicorn phase)*

**Key Milestones:**
- Month 19-20: DAO-like agent enterprises
- Month 21-22: Global expansion (multi-currency, localization)
- Month 23-24: API ecosystem & white-label platform

**Target Metrics (Month 24):**
- 50,000 agents
- 1,000+ developers earning $10K+/year
- 50,000 users
- $1M MRR
- $100M GMV

---

# Resource Requirements

## Phase 0-1 (Weeks 1-12) - 4 People Full-Time
- 1 Backend Developer (40h/week)
- 1 Frontend Developer (40h/week)
- 1 AI/ML Engineer (40h/week)
- 1 DevOps Engineer (20h/week)

**Using Claude Code Agents:**
- System Architect (as needed)
- QA Tester (as needed)
- Code Reviewer (as needed)
- Project Manager (as needed)

## Phase 2 (Months 4-9) - 7 People
- +1 Frontend Developer
- +1 Developer Advocate
- +1 Product Manager

## Phase 3-4 (Months 10-24) - 15+ People
- +2 Backend Engineers
- +1 Data Engineer
- +2 AI Researchers
- +1 Security Engineer
- +1 Sales Lead
- +1 Marketing Lead

---

# Budget Estimates

| Phase | Duration | Headcount | Monthly Burn | Total |
|-------|----------|-----------|--------------|-------|
| Phase 0 | 2 weeks | 4 | $30K | $15K |
| Phase 1 | 10 weeks | 4 | $30K | $75K |
| Phase 2 | 6 months | 7 | $60K | $360K |
| Phase 3 | 9 months | 10 | $100K | $900K |
| Phase 4 | 6 months | 15 | $150K | $900K |
| **Total** | **24 months** | **4→15** | **$30K→$150K** | **$2.25M** |

**Additional Costs:**
- Infrastructure: $5K/month (scales with usage)
- Marketing: $10K/month (Months 4+)
- Legal & Compliance: $50K (one-time)
- Security Audits: $20K (annual)

**Total 24-Month Investment: ~$2.5M**

---

# Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Slow developer adoption | $500 grants + SDK | AI Agent Developer |
| Security vulnerabilities | Quarterly audits | Code Reviewer |
| Regulatory changes | Legal counsel on retainer | CEO |
| LLM costs too high | Cache + use smaller models | AI Agent Developer |
| Payment rail failures | Multi-rail redundancy | Backend Developer |
| Agent malicious code | Sandbox + code review | Code Reviewer |

---

# Immediate Next Steps (Next 48 Hours)

## Monday Morning (Today)

### 🔧 **Backend Developer**
- [ ] Start fixing TypeScript errors (4 hours)
  - x402.ts interface mismatch
  - stripe.ts API version
  - Error handling type guards
  - Receipt chain null checks

### 🧪 **QA Tester**
- [ ] Setup test infrastructure (2 hours)
  - Install Vitest
  - Create test file structure
  - Write first test (policy-gate)

### 🚀 **DevOps Engineer**
- [ ] Setup Railway staging environment (2 hours)
  - Create project
  - Configure environment variables
  - Link GitHub repo

### 📊 **Project Manager**
- [ ] Create GitHub project board (1 hour)
  - Phase 0 tickets
  - Assign to agents
  - Set deadlines

## Tuesday-Wednesday

### 🔧 **Backend Developer**
- [ ] Complete TypeScript fixes
- [ ] Start webhook handlers

### 🧪 **QA Tester**
- [ ] Write all unit tests (12 hours)
- [ ] Achieve 90%+ coverage

### 🚀 **DevOps Engineer**
- [ ] Complete Railway deployment
- [ ] Run database migrations
- [ ] Setup monitoring

## Thursday-Friday

### 🧪 **QA Tester**
- [ ] Run E2E smoke tests
- [ ] Load testing

### 👁️ **Code Reviewer**
- [ ] Security audit
- [ ] Code review approvals

### 📊 **Project Manager**
- [ ] Phase 0 completion report
- [ ] Phase 1 kickoff meeting

---

# Communication Cadence

## Daily (Phase 0-1)
- **9:00 AM:** Standup (15 min)
  - What I did yesterday
  - What I'm doing today
  - Blockers

## Weekly
- **Monday 2:00 PM:** Sprint planning (1 hour)
- **Friday 4:00 PM:** Sprint review + retro (1 hour)

## Monthly
- **First Monday:** Metrics review (CEO + PM)
- **Last Friday:** Demo day (show progress to stakeholders)

---

# Success Criteria Summary

## Phase 0 (Week 2)
✅ TypeScript compiles
✅ 90%+ test coverage
✅ Deployed to staging
✅ E2E tests passing

## Phase 1 (Week 12)
✅ 8 agents live
✅ 100 beta users
✅ $5K GMV
✅ NPS > 50

## Phase 2 (Month 9)
✅ 1,000 agents
✅ $10K MRR
✅ 50 developers earning

## Phase 3 (Month 18)
✅ 5,000 agents
✅ $100K MRR
✅ 10 enterprise customers

## Phase 4 (Month 24)
✅ 50,000 agents
✅ $1M MRR
✅ $100M GMV
✅ Unicorn valuation ($1B+)

---

# Final Recommendation

**CEO Action Required:**
1. ✅ Approve this plan (DONE)
2. 🔜 Kick off Phase 0 (Monday morning)
3. 🔜 Hire 3 full-time engineers (Weeks 1-4)
4. 🔜 Secure seed funding ($500K) (Month 3)

**First Milestone:** Phase 0 complete by **November 3, 2025** (2 weeks from now)

**Let's build the Visa for AI agents.** 🚀

---

**Document Version:** 1.0
**Last Updated:** 2025-10-20
**Next Review:** 2025-11-03 (Phase 0 completion)
