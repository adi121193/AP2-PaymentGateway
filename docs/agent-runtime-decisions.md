# FrameOS Agent Runtime - Design Decisions

**Version:** 1.0
**Date:** 2025-10-20
**Architect:** System Architect Agent

---

## Table of Contents

1. [Execution Model: Docker vs. Isolated Processes](#execution-model-docker-vs-isolated-processes)
2. [Code Storage: S3 vs. GitHub vs. Database](#code-storage-s3-vs-github-vs-database)
3. [Execution Pattern: Synchronous vs. Asynchronous](#execution-pattern-synchronous-vs-asynchronous)
4. [Queue System: BullMQ vs. Database Queue](#queue-system-bullmq-vs-database-queue)
5. [Payment Timing: Pre-execution vs. Post-execution](#payment-timing-pre-execution-vs-post-execution)
6. [Agent Approval: Manual vs. Automated](#agent-approval-manual-vs-automated)
7. [Database: Separate vs. Shared with C-Layer](#database-separate-vs-shared-with-c-layer)
8. [Frontend Framework: Next.js vs. React SPA](#frontend-framework-nextjs-vs-react-spa)
9. [Versioning: Semantic vs. Timestamp](#versioning-semantic-vs-timestamp)
10. [Revenue Split: 70/20/10 vs. Alternatives](#revenue-split-702010-vs-alternatives)

---

## 1. Execution Model: Docker vs. Isolated Processes

### Decision: **Docker Containers**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Docker Containers** | ✅ Strong isolation (kernel-level)<br>✅ Resource limits (cgroups)<br>✅ Network control<br>✅ Language agnostic<br>✅ Industry standard | ❌ Higher overhead (~100ms startup)<br>❌ Requires Docker daemon<br>❌ More complex orchestration |
| **Isolated Node.js (VM2)** | ✅ Faster startup (~10ms)<br>✅ Simpler deployment<br>✅ No Docker dependency | ❌ Weaker isolation (same process space)<br>❌ Node.js only<br>❌ VM2 has known escape vectors<br>❌ Hard to enforce resource limits |
| **Firecracker VMs** | ✅ Best isolation (full VM)<br>✅ Fast startup (~125ms)<br>✅ Strong security | ❌ Complex setup<br>❌ Requires KVM/virtualization<br>❌ Overkill for Phase 1 |
| **WebAssembly (WASM)** | ✅ Sandboxed by design<br>✅ Fast startup<br>✅ Portable | ❌ Limited ecosystem<br>❌ No native Node.js support<br>❌ Experimental for backend |

### Rationale

**Why Docker wins:**

1. **Security First**: Docker provides kernel-level isolation (namespaces, cgroups). Malicious code cannot:
   - Access host filesystem (unless explicitly mounted)
   - Make network requests (with `--network=none`)
   - Spawn unlimited processes (with `--pids-limit`)
   - Consume unlimited CPU/memory (with `--cpus` and `--memory`)

2. **Language Agnostic**: Phase 1 starts with Node.js, but future support for Python, Go, Rust is critical. Docker supports all.

3. **Resource Enforcement**: Docker's cgroups integration makes CPU/memory limits trivial:
   ```bash
   docker run --cpus=1.0 --memory=512m agent-runtime:latest
   ```

4. **Battle-Tested**: Docker is production-proven. Companies like AWS Lambda, Vercel, and Railway use container-based execution.

5. **Network Isolation**: `--network=none` completely disables network access. Agent must explicitly declare `http_request` capability and allowlisted domains.

**Trade-offs Accepted:**

- **Startup Overhead**: ~100ms to spin up container (acceptable for 5-minute executions)
- **Infrastructure Complexity**: Requires Docker daemon on worker nodes (solved by Railway/AWS ECS)

**Phase 2 Consideration:**

Migrate to **Firecracker VMs** for even stronger isolation (full VM per execution). Firecracker is used by AWS Lambda and Fly.io.

### Implementation Details

```typescript
// Execute agent in Docker container
async function executeAgent(
  agentCode: string,
  inputs: Record<string, any>,
  config: RuntimeConfig
): Promise<ExecutionResult> {
  const containerName = `agent-exec-${executionId}`;

  // Build Docker command
  const dockerCmd = [
    'docker', 'run',
    '--rm',                              // Auto-remove after exit
    '--network=none',                    // No network access
    '--read-only',                       // Read-only filesystem
    '--tmpfs', '/tmp:size=100m',         // 100MB temp storage
    `--cpus=${config.cpu_cores}`,        // CPU limit
    `--memory=${config.memory_mb}m`,     // Memory limit
    '--memory-swap=0',                   // No swap
    `--pids-limit=50`,                   // Max 50 processes
    '--cap-drop=ALL',                    // Drop all capabilities
    '--security-opt=no-new-privileges',
    `--name=${containerName}`,
    'agent-runtime:latest',
    config.entrypoint,
  ].join(' ');

  // Execute with timeout
  const result = await execWithTimeout(dockerCmd, config.timeout_ms);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
    duration_ms: result.duration,
  };
}
```

---

## 2. Code Storage: S3 vs. GitHub vs. Database

### Decision: **S3-Compatible Storage (Cloudflare R2)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **S3 (Cloudflare R2)** | ✅ Cheap ($0.015/GB/month)<br>✅ Fast access<br>✅ Versioning built-in<br>✅ CDN integration<br>✅ No egress fees (R2) | ❌ External dependency<br>❌ Requires SDK integration |
| **GitHub Releases** | ✅ Free for public repos<br>✅ Git-native versioning<br>✅ Developer-friendly | ❌ Rate limits (60 req/hour)<br>❌ Public repos only<br>❌ Slower downloads<br>❌ Not designed for programmatic access |
| **PostgreSQL (BYTEA)** | ✅ No external dependency<br>✅ Transactional integrity<br>✅ Simple queries | ❌ Database bloat (code is large)<br>❌ Slow queries<br>❌ Expensive backups<br>❌ Not designed for blob storage |
| **Git LFS** | ✅ Git integration<br>✅ Large file support | ❌ Complex setup<br>❌ GitHub LFS pricing ($5/50GB)<br>❌ Not ideal for non-Git workflows |

### Rationale

**Why S3 (Cloudflare R2) wins:**

1. **Cost**: Cloudflare R2 has **zero egress fees**. AWS S3 charges $0.09/GB for egress (expensive at scale).

   - R2 pricing: $0.015/GB/month storage
   - Average agent code: 2MB (compressed)
   - 1000 agents × 10 versions = 20GB = **$0.30/month**

2. **Versioning**: S3 has built-in versioning. Each agent version gets unique key:
   ```
   agents/agt_abc123/v1.0.0.tar.gz
   agents/agt_abc123/v1.1.0.tar.gz
   agents/agt_abc123/v1.2.0.tar.gz
   ```

3. **Performance**: S3 is optimized for fast parallel downloads. Workers can fetch code in <200ms.

4. **Integrity**: S3 supports ETags (MD5 hashes) to verify downloads. We also store SHA256 hash in database.

5. **CDN**: R2 integrates with Cloudflare CDN for global distribution (future optimization).

**Trade-offs Accepted:**

- **External Dependency**: Platform requires S3 credentials (acceptable)
- **SDK Complexity**: AWS SDK is large but well-documented

**Alternative for MVP:**

If budget is tight, start with **PostgreSQL BYTEA** for Phase 1 (simpler), migrate to S3 in Phase 2.

### Implementation

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // Cloudflare R2 endpoint
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Upload agent code
async function uploadAgentCode(
  agentId: string,
  version: string,
  code: Buffer
): Promise<string> {
  const key = `agents/${agentId}/v${version}.tar.gz`;

  await s3.send(new PutObjectCommand({
    Bucket: 'frameos-agents',
    Key: key,
    Body: code,
    ContentType: 'application/gzip',
    Metadata: {
      agent_id: agentId,
      version,
      uploaded_at: new Date().toISOString(),
    },
  }));

  return key;
}

// Download agent code
async function downloadAgentCode(s3Key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: 'frameos-agents',
    Key: s3Key,
  }));

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

---

## 3. Execution Pattern: Synchronous vs. Asynchronous

### Decision: **Asynchronous (Queue-Based)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Async (Queue)** | ✅ Non-blocking API<br>✅ Scalable (workers process queue)<br>✅ Retry logic<br>✅ Priority support | ❌ Polling required<br>❌ More complex |
| **Sync (Blocking)** | ✅ Simpler API<br>✅ Immediate results | ❌ Blocks HTTP thread (5 min!)<br>❌ Timeout issues<br>❌ Not scalable |
| **Hybrid (SSE)** | ✅ Real-time updates<br>✅ No polling | ❌ Complex client logic<br>❌ Firewall issues<br>❌ Not RESTful |

### Rationale

**Why Async wins:**

1. **Scalability**: API server shouldn't block for 5 minutes. Queue-based execution allows:
   - API server handles 1000s of requests/sec
   - Worker nodes process executions in parallel

2. **Retry Logic**: BullMQ provides automatic retries with exponential backoff. Sync execution cannot retry.

3. **Priority**: Paid users get priority over free tier users.

4. **Graceful Degradation**: If workers are busy, executions queue up instead of failing.

**Flow:**

```
User: POST /agents/:id/execute
  ↓
API: Creates execution record (status: "queued")
API: Enqueues job in BullMQ
API: Returns 202 Accepted with execution_id
  ↓
User: Polls GET /executions/:id every 2 seconds
  ↓
Worker: Picks job from queue
Worker: Executes agent (5 min max)
Worker: Updates execution record (status: "success" | "failed")
  ↓
User: Sees result on next poll
```

**Trade-offs Accepted:**

- **Polling**: User must poll for results (acceptable with WebSockets in Phase 2)
- **Complexity**: Requires job queue infrastructure (Redis + BullMQ)

---

## 4. Queue System: BullMQ vs. Database Queue

### Decision: **BullMQ (Redis-backed)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **BullMQ (Redis)** | ✅ Purpose-built for job queues<br>✅ Retry, priority, concurrency<br>✅ Battle-tested<br>✅ Excellent DX | ❌ Redis dependency<br>❌ More infrastructure |
| **Database Queue (PostgreSQL)** | ✅ No extra dependency<br>✅ Transactional<br>✅ Simpler | ❌ Polling overhead<br>❌ Not optimized for queues<br>❌ Manual retry logic |
| **AWS SQS** | ✅ Managed service<br>✅ No infrastructure | ❌ Vendor lock-in<br>❌ Costs scale with usage<br>❌ Not as feature-rich as BullMQ |

### Rationale

**Why BullMQ wins:**

1. **Features**: BullMQ provides out-of-the-box:
   - Retry with exponential backoff
   - Priority queues
   - Concurrency limits
   - Job progress tracking
   - Scheduled jobs (future: cron agents)

2. **Performance**: Redis is in-memory, so queue operations are **<1ms**. PostgreSQL polling would be ~10-50ms.

3. **Ecosystem**: BullMQ has excellent tooling:
   - Bull Board (web UI for queue monitoring)
   - Prometheus metrics
   - Job failure hooks

4. **Cost**: Redis is cheap. Railway Redis: $5/month for 1GB.

**Database Queue Alternative (for MVP):**

If avoiding Redis, implement simple queue in PostgreSQL:

```sql
CREATE TABLE execution_queue (
  id TEXT PRIMARY KEY,
  execution_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  priority INT DEFAULT 0,
  attempts INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  worker_id TEXT
);

CREATE INDEX idx_queue_processing
  ON execution_queue(status, priority DESC, scheduled_at);
```

Worker polls:
```sql
UPDATE execution_queue
SET status = 'processing', worker_id = $1, started_at = NOW()
WHERE id = (
  SELECT id FROM execution_queue
  WHERE status = 'pending'
  ORDER BY priority DESC, scheduled_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

**Decision: Start with BullMQ** (better features, worth the Redis dependency).

---

## 5. Payment Timing: Pre-execution vs. Post-execution

### Decision: **Hybrid (Pre-authorization + Post-execution charge)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Pre-execution (upfront)** | ✅ Guaranteed payment<br>✅ No refunds needed | ❌ User pays even if agent fails<br>❌ Poor UX |
| **Post-execution (pay after)** | ✅ Fair (only pay for success)<br>✅ Good UX | ❌ Risk of non-payment<br>❌ Refund complexity |
| **Hybrid (pre-auth + charge)** | ✅ Fair (only charge on success)<br>✅ Guaranteed payment | ❌ More complex flow |

### Rationale

**Why Hybrid wins:**

1. **Fairness**: User only pays if agent succeeds. If execution fails, no payment is processed.

2. **Security**: C-Layer mandate acts as pre-authorization. Payment is "locked" but not charged.

3. **No Refunds**: Since payment happens post-execution, failed runs never charge the user (no refund logic needed).

**Flow:**

```
User triggers execution
  ↓
Platform creates PurchaseIntent (C-Layer)
  "I intend to pay ₹0.50 for this agent execution"
  ↓
Platform creates Mandate (C-Layer)
  "I authorize payment of ₹0.50 if execution succeeds"
  Mandate signed with Ed25519
  ↓
Execution queued (no payment yet)
  ↓
Agent executes (5 min max)
  ↓
If successful:
  Platform executes payment (C-Layer POST /execute)
  C-Layer routes to Stripe/Cashfree
  User charged ₹0.50
  Developer credited ₹0.35 (70%)
  ↓
If failed:
  Mandate expires (no payment)
  User charged ₹0.00
```

**Trade-offs Accepted:**

- **Complexity**: Requires coordination between B-Layer and C-Layer
- **Mandate Expiry**: Mandates expire after execution (short-lived)

**Alternative for Free Tier:**

If agent is free (`pricing_model: "free"`), skip C-Layer entirely (no intent, no mandate).

---

## 6. Agent Approval: Manual vs. Automated

### Decision: **Manual (Phase 1), Automated (Phase 2)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Manual Review** | ✅ High quality<br>✅ Prevent malicious agents<br>✅ Build trust | ❌ Slow (24-hour turnaround)<br>❌ Doesn't scale |
| **Automated Scan Only** | ✅ Instant publishing<br>✅ Scalable | ❌ False negatives (malicious code gets through)<br>❌ False positives (good code rejected) |
| **Hybrid (Scan + Spot Check)** | ✅ Fast + safe<br>✅ Scalable | ❌ Complex workflow |

### Rationale

**Phase 1 (Manual Review):**

- **Goal**: Launch with **8 high-quality agents** (3 native + 5 community)
- **Workflow**:
  1. Developer publishes agent
  2. Code scanner runs automatically (reject obvious malicious code)
  3. If scan passes, agent enters **pending_review** status
  4. Admin manually reviews code, manifest, and tests agent
  5. Admin approves → agent status changes to **published**
  6. Admin rejects → developer notified with reason

- **Timeline**: 24-hour approval SLA (for Phase 1, can be same-day)

**Phase 2 (Automated Approval):**

- **Goal**: Scale to 100s of agents
- **Workflow**:
  1. Developer publishes agent
  2. Code scanner runs (static analysis + pattern detection)
  3. If scan passes → **auto-approve** and publish immediately
  4. Random spot checks (10% of auto-approved agents)
  5. If spot check finds issue → agent banned, developer notified

**Trade-offs Accepted (Phase 1):**

- **Slow Publishing**: 24-hour wait (acceptable for MVP)
- **Manual Work**: Admins review code (acceptable for 8 agents)

**Code Scanner (Both Phases):**

```typescript
// Static analysis patterns
const MALICIOUS_PATTERNS = [
  /require\(['"]child_process['"]\)/,
  /import.*from ['"]child_process['"]/,
  /eval\(/,
  /Function\(/,
  /require\(['"]fs['"]\)/,
  /import.*from ['"]fs['"]/,
  /0x[0-9a-fA-F]{40}/, // Ethereum addresses
];

function scanCode(code: string): ScanResult {
  const violations = [];

  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(code)) {
      violations.push({
        pattern: pattern.source,
        severity: 'HIGH',
        line: findLineNumber(code, pattern),
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
```

---

## 7. Database: Separate vs. Shared with C-Layer

### Decision: **Shared Database (Same PostgreSQL Instance)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Shared Database** | ✅ Simpler infrastructure<br>✅ Single source of truth<br>✅ Easy joins across layers<br>✅ Cheaper | ❌ Tight coupling<br>❌ Migration complexity |
| **Separate Databases** | ✅ Decoupled layers<br>✅ Independent scaling | ❌ Cross-database joins<br>❌ Data consistency issues<br>❌ More expensive |

### Rationale

**Why Shared wins:**

1. **Simplicity**: One database to manage (backups, migrations, monitoring).

2. **Joins**: Can join A/B-Layer models with C-Layer models:
   ```sql
   SELECT ae.*, p.amount, p.status
   FROM agent_executions ae
   JOIN payments p ON ae.payment_id = p.id
   WHERE ae.user_id = $1;
   ```

3. **Cost**: Neon PostgreSQL pricing scales by storage, not databases. One database = cheaper.

4. **Transactions**: Can use database transactions across layers (e.g., create execution + payment in one transaction).

**Trade-offs Accepted:**

- **Coupling**: A/B-Layer depends on C-Layer schema (migrations must be coordinated)
- **Scaling**: Cannot scale A/B-Layer database independently (but not needed for Phase 1)

**Phase 3 Consideration:**

If A/B-Layer grows to millions of executions, consider sharding by `user_id` or migrating to separate database.

---

## 8. Frontend Framework: Next.js vs. React SPA

### Decision: **Next.js 14 (App Router)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Next.js 14** | ✅ SEO (marketplace pages indexed)<br>✅ Server-side rendering<br>✅ API routes<br>✅ Built-in optimization | ❌ More complex than SPA<br>❌ Vercel lock-in (optional) |
| **React SPA (Vite)** | ✅ Simpler<br>✅ Faster dev builds<br>✅ Lightweight | ❌ No SEO (marketplace not indexed)<br>❌ Slower initial load<br>❌ Need separate backend |
| **Remix** | ✅ Similar to Next.js<br>✅ Better data loading | ❌ Smaller ecosystem<br>❌ Less mature |

### Rationale

**Why Next.js wins:**

1. **SEO**: Marketplace pages (`/agents`, `/agents/:slug`) must be indexed by Google. Server-side rendering critical.

2. **Performance**: Static generation for agent listings (update every hour). Fast page loads.

3. **Developer Experience**: Next.js App Router provides:
   - File-based routing
   - Server Components (reduce client JS)
   - Built-in image optimization
   - API routes (for BFF pattern)

4. **Deployment**: Vercel is free for hobby projects, production-ready.

**Example Pages:**

```
/                   → Landing page (SSG)
/agents             → Agent marketplace (ISR, revalidate every 1 hour)
/agents/:slug       → Agent details (SSR, dynamic)
/dashboard          → User dashboard (CSR, requires auth)
/developer          → Developer portal (CSR, requires auth)
/executions/:id     → Execution details (SSR, dynamic)
```

**Trade-offs Accepted:**

- **Complexity**: Next.js is more complex than Vite SPA (acceptable for SEO benefits)
- **Bundle Size**: Server Components reduce client JS (net positive)

---

## 9. Versioning: Semantic vs. Timestamp

### Decision: **Semantic Versioning (SemVer)**

### Options Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Semantic Versioning** | ✅ Industry standard<br>✅ Clear intent (major/minor/patch)<br>✅ User-friendly | ❌ Requires developer discipline |
| **Timestamp Versioning** | ✅ Auto-generated<br>✅ No conflicts | ❌ No semantic meaning<br>❌ Hard to understand changes |
| **Auto-increment** | ✅ Simple (v1, v2, v3)<br>✅ No conflicts | ❌ No semantic meaning |

### Rationale

**Why SemVer wins:**

1. **Clarity**: Users understand:
   - **1.0.0 → 1.0.1**: Bug fix (safe to upgrade)
   - **1.0.0 → 1.1.0**: New feature (safe to upgrade)
   - **1.0.0 → 2.0.0**: Breaking change (manual upgrade needed)

2. **Industry Standard**: npm, Docker, and all major package registries use SemVer.

3. **Dependency Management (Phase 2)**: If agents can depend on other agents, SemVer enables version ranges:
   ```json
   {
     "dependencies": {
       "email-validator-agent": "^1.2.0"
     }
   }
   ```

**Validation:**

```typescript
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;

function validateVersion(version: string): boolean {
  return VERSION_REGEX.test(version);
}
```

**Trade-offs Accepted:**

- **Developer Burden**: Developers must follow SemVer conventions (enforced by docs and linter)

---

## 10. Revenue Split: 70/20/10 vs. Alternatives

### Decision: **70% Developer / 20% Platform / 10% Orchestrator**

### Options Considered

| Split | Developer | Platform | Orchestrator | Rationale |
|-------|-----------|----------|--------------|-----------|
| **70/20/10** | ₹0.70 | ₹0.20 | ₹0.10 | **Chosen** - Competitive with Stripe (70/30) |
| **80/15/5** | ₹0.80 | ₹0.15 | ₹0.05 | Developer-friendly but unsustainable |
| **60/30/10** | ₹0.60 | ₹0.30 | ₹0.10 | Higher margins but less competitive |
| **50/50/0** | ₹0.50 | ₹0.50 | ₹0.00 | No orchestrator incentive |

### Rationale

**Why 70/20/10 wins:**

1. **Developer Incentive**: 70% is competitive:
   - **App Store**: 70/30 split (30% to Apple)
   - **Stripe**: ~70/30 after fees
   - **Gumroad**: 90/10 (but higher base fees)

2. **Platform Sustainability**: 20% covers:
   - Infrastructure (Railway, Neon, S3)
   - Support and moderation
   - Payment processing fees (Stripe: 2.9% + ₹2)

3. **Orchestrator Incentive**: 10% rewards agents that trigger other agents (Phase 2 feature).

**Example Calculation (₹1.00 payment):**

```
User pays: ₹1.00 (100 paise)
  ├─ Payment rail fee (Stripe): ₹0.05 (5 paise, 2.9% + ₹2)
  ├─ Developer: ₹0.70 (70 paise)
  ├─ Platform: ₹0.20 (20 paise)
  └─ Orchestrator: ₹0.10 (10 paise) [if applicable]

Net margins:
  Platform: ₹0.20 - ₹0.05 = ₹0.15 (15%)
```

**Phase 2 Consideration:**

Introduce tiered splits based on agent popularity:

| Tier | Monthly Revenue | Developer Share |
|------|----------------|----------------|
| Starter | < ₹10,000 | 70% |
| Pro | ₹10,000 - ₹100,000 | 75% |
| Enterprise | > ₹100,000 | 80% |

**Trade-offs Accepted:**

- **Lower Margins**: 15% net margin (after payment fees) is thin, but competitive
- **Orchestrator Complexity**: Tracking orchestration chains is complex (Phase 2)

---

## Summary of Key Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Execution Model** | Docker Containers | Best security, language agnostic |
| **Code Storage** | S3 (Cloudflare R2) | Cost-effective, fast, versioning |
| **Execution Pattern** | Asynchronous (Queue) | Scalable, non-blocking |
| **Queue System** | BullMQ (Redis) | Purpose-built, feature-rich |
| **Payment Timing** | Pre-auth + Post-charge | Fair, no refunds needed |
| **Agent Approval** | Manual (Phase 1) | Quality over speed |
| **Database** | Shared with C-Layer | Simpler, cheaper |
| **Frontend** | Next.js 14 | SEO, performance |
| **Versioning** | Semantic Versioning | Industry standard |
| **Revenue Split** | 70/20/10 | Competitive, sustainable |

---

**Next Steps:**

1. Review and approve these decisions
2. Proceed to implementation (Backend Developer Agent)
3. Build Phase 1 MVP (8 agents in 10 weeks)

---

**End of Design Decisions Document**
