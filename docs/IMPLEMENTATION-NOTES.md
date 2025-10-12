# Implementation Notes - AP2 Payment Gateway Architecture

## Design Decisions

### 1. Why Express over Fastify/Hono?

**Decision:** Express 4.x

**Rationale:**
- Most mature and battle-tested Node.js framework
- Extensive middleware ecosystem (Helmet, CORS, rate-limit)
- Larger community means better Stack Overflow support
- Simpler learning curve for new developers
- Performance is sufficient for our throughput targets (100 req/s)

**Trade-offs:**
- Slower than Fastify (but not a bottleneck for financial transactions)
- Less modern API than Hono (but stability over novelty)

### 2. Monolith vs Microservices

**Decision:** Modular Monolith with clear package boundaries

**Rationale:**
- Simpler deployment (single container)
- No network overhead between services
- ACID transactions across modules (critical for payments)
- Easier local development (no service mesh complexity)
- Can extract to microservices later if needed

**Future Migration Path:**
If we hit scaling limits, extract in this order:
1. Receipts service (read-heavy, can be cached)
2. Webhook handlers (async, can be queued)
3. Payment rail adapters (isolated, easy to extract)

### 3. Database: Prisma vs Kysely vs Raw SQL

**Decision:** Prisma 5.x

**Rationale:**
- Type-safe queries generated from schema
- Built-in migration tool
- Connection pooling out of the box
- Query builder reduces boilerplate by 70%
- Good performance for most queries (can optimize with raw SQL if needed)

**Trade-offs:**
- Slightly less control over query optimization
- Larger bundle size than Kysely
- Can fall back to `prisma.$queryRaw` for complex queries

### 4. Validation: Zod vs Yup vs Joi

**Decision:** Zod

**Rationale:**
- TypeScript-first design (types inferred from schemas)
- Composable schemas (reuse across layers)
- Zero dependencies
- Better error messages than Joi
- Smaller bundle than Yup

**Usage Pattern:**
```typescript
// Define once
const IntentSchema = z.object({ amount: z.number().positive() });

// Use in multiple places
type Intent = z.infer<typeof IntentSchema>; // TypeScript type
const validated = IntentSchema.parse(input); // Runtime validation
```

### 5. Cryptography: Ed25519 vs RSA

**Decision:** Ed25519 via @noble/curves

**Rationale:**
- 10x faster signature verification than RSA-2048
- 32-byte keys (vs 256 bytes for RSA)
- Modern, quantum-resistant (theoretically)
- Well-audited implementation (@noble/curves)
- Industry adoption (SSH, Signal, age encryption)

**Why not RSA?**
- Slower for high-volume signing
- Larger keys make storage/transmission expensive
- More complex implementation (padding schemes)

### 6. Idempotency: Database vs Redis

**Decision:** Database-backed (Postgres)

**Rationale:**
- Durability: survives cache evictions
- Simplicity: no separate cache infrastructure
- ACID guarantees: no race conditions
- Audit trail: all requests logged

**Performance Optimization:**
- Unique index on (route, key) makes lookups fast
- Add TTL-based cleanup job (delete older than 24h)
- Can add Redis layer later if needed

### 7. Hash Chain vs Merkle Tree

**Decision:** Simple Hash Chain (prev_hash → curr_hash)

**Rationale:**
- Sufficient for single-agent audit trails
- O(1) append, O(n) verification (acceptable for nightly job)
- Easy to understand and debug
- No need for Merkle proofs (no multi-agent verification needed)

**When to upgrade to Merkle Tree:**
- If we need cross-agent verification
- If we need efficient partial chain proofs
- If we exceed 10,000 receipts per agent

### 8. Payment Routing: Rule-Based vs ML

**Decision:** Simple rule-based heuristic

**Rationale:**
- Deterministic and explainable (regulatory compliance)
- No training data needed
- Easy to test (unit tests cover all branches)
- Can add ML layer later for optimization

**Heuristic Logic:**
```
IF amount > 200 → Stripe
ELSE IF policy.x402_enabled = false → Stripe
ELSE IF vendor.x402_endpoint = null → Stripe
ELSE IF agent.risk_tier = HIGH → Stripe
ELSE → x402
```

**Future Enhancement:**
- ML model to predict optimal rail based on success rate
- A/B testing framework for new routing strategies

---

## Security Architecture Decisions

### 1. Mandate Signatures

**Algorithm:** Ed25519

**Signed Data:**
```json
{
  "intent_id": "...",
  "policy_id": "...",
  "expires_at": "2025-10-12T10:00:00Z"
}
```

**Why canonical JSON?**
- Deterministic serialization (sorted keys)
- Prevents signature bypass via key reordering

**Key Management:**
- Private key in environment variable (hex or base64)
- Public key derived on startup
- Rotate quarterly (add key_version field in future)

### 2. Receipt Hash Chain

**Hash Function:** SHA256

**Chained Data:**
```json
{
  "prev_hash": "sha256:abc123...",
  "payment_id": "...",
  "mandate_id": "...",
  "amount": 199,
  "currency": "USD",
  "timestamp": "2025-10-12T14:30:00Z"
}
```

**Verification Strategy:**
- Nightly job re-computes all hashes per agent
- Alert on any mismatch
- Log broken chain index for investigation

**Why not blockchain?**
- No need for decentralized consensus
- Single authority (our system) is sufficient
- Simpler to audit and debug

### 3. x402 Protocol Security

**Timestamp Window:** 5 minutes

Prevents replay attacks:
- Reject requests with timestamp > 5 minutes old
- Store timestamp in signature payload

**Idempotency Keys:** 24-hour TTL

Prevents duplicate processing:
- Unique constraint on (route, key)
- Return cached response for duplicates

**Rate Limiting:** 100 requests per 15 minutes per IP

Prevents abuse:
- express-rate-limit middleware
- Can add Redis-backed rate limiter for distributed setups

---

## Performance Architecture

### Database Indexing Strategy

**Query Patterns:**

1. **Agent lookups** - `WHERE agent_id = ? AND status = 'active'`
   - Index: `agents(agent_id, status)`

2. **Policy validation** - `WHERE agent_id = ? AND expires_at > NOW()`
   - Index: `policies(agent_id, expires_at)`

3. **Daily spending** - `WHERE agent_id = ? AND created_at >= TODAY()`
   - Index: `payments(agent_id, created_at)`

4. **Receipt chain** - `WHERE agent_id = ? ORDER BY chain_index DESC LIMIT 1`
   - Index: `receipts(agent_id, chain_index)`

5. **Idempotency checks** - `WHERE route = ? AND key = ?`
   - Unique index: `idempotency(route, key)`

**Expected Performance:**
- All lookups < 10ms (with proper indexes)
- Chain traversal < 50ms (even for 10,000 receipts)

### Caching Strategy (Future)

**Redis Layer:**

1. **Hot Data** (TTL: 5 minutes)
   - Active policies per agent
   - Agent metadata (status, risk_tier)

2. **Computed Data** (TTL: 1 hour, invalidate on write)
   - Daily spending totals
   - Vendor x402 configurations

3. **Idempotency Responses** (TTL: 24 hours)
   - Cached API responses

**Implementation:**
```typescript
async function getActivePolicy(agentId: string): Promise<Policy> {
  const cached = await redis.get(`policy:${agentId}`);
  if (cached) return JSON.parse(cached);

  const policy = await db.policy.findFirst({ where: { agent_id: agentId } });
  await redis.setex(`policy:${agentId}`, 300, JSON.stringify(policy));
  return policy;
}
```

---

## Testing Strategy

### Unit Tests (90% coverage target)

**Core Services:**
- Policy Gate: 12 test cases (vendor allowlist, caps, expiry)
- Mandate Signer: 8 test cases (signature generation, verification)
- Receipt Chain: 10 test cases (hash generation, chain validation)
- Rail Router: 8 test cases (routing decisions)

**Example Test:**
```typescript
describe('PolicyGate', () => {
  it('should reject if amount exceeds cap', async () => {
    const policy = { amount_cap: 100 };
    const result = await policyGate.validate({ amount: 150 }, policy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('AMOUNT_EXCEEDS_CAP');
  });
});
```

### Integration Tests (E2E Flow)

**Scenarios:**
1. Happy path: Intent → Mandate → Execute → Receipt
2. Policy violation: Intent rejected
3. Mandate expiry: Execute fails
4. Idempotency: Duplicate request returns same response
5. Rail routing: x402 vs Stripe selection

**Example Test:**
```typescript
it('should route to x402 for amount <= 200', async () => {
  const intent = await createIntent({ amount: 199 });
  const mandate = await createMandate(intent.id);
  const result = await executePayment(mandate.id);
  expect(result.rail).toBe('x402');
});
```

### Load Tests (Future)

**Target:** 100 req/s sustained

**Tool:** k6 or Artillery

**Metrics:**
- p50 response time < 100ms
- p95 response time < 200ms
- p99 response time < 500ms
- Error rate < 0.1%

---

## Deployment Architecture

### Railway (Recommended for MVP)

**Services:**
1. **API** - Node.js container (auto-scaling)
2. **Database** - Managed Postgres (Neon or Railway Postgres)
3. **Redis** (optional) - Managed Redis

**Environment Variables:**
- Set via Railway dashboard
- Auto-injected into containers
- Secrets encrypted at rest

**Deployment Flow:**
```bash
git push origin main
→ GitHub Actions runs tests
→ Railway auto-deploys on success
→ Health check verifies deployment
```

### Docker Compose (Local Development)

**Services:**
- postgres: Database (port 5432)
- redis: Cache (port 6379)
- api: Express server (port 3000)

**Usage:**
```bash
docker-compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

### Monitoring Setup

**Metrics to Track:**
- Request rate (per endpoint)
- Error rate (by error code)
- Payment success rate (by provider)
- Database query time (p95)
- Receipt chain integrity (nightly verification)

**Alerting:**
- Error rate > 5% for 5 minutes → PagerDuty
- Payment failure rate > 10% → Slack
- Database connection pool exhausted → Email
- Receipt chain broken → Immediate alert

---

## Migration Path from Architecture to Implementation

### Phase 1: Foundation (Week 1)
- ✅ Set up monorepo with workspaces
- ✅ Create Prisma schema
- ✅ Define Zod types and validation
- ✅ Environment variable schema
- [ ] Database migrations
- [ ] Seed script for test data

### Phase 2: Core Services (Week 2)
- [ ] Policy Gate service with tests
- [ ] Mandate Signer service with tests
- [ ] Receipt Chain service with tests
- [ ] Rail Router with tests

### Phase 3: API Layer (Week 3)
- [ ] Express app setup
- [ ] Middleware (auth, idempotency, error handler)
- [ ] Route handlers (intents, mandates, execute, receipts)
- [ ] OpenAPI documentation

### Phase 4: Payment Rails (Week 4)
- [ ] Stripe adapter implementation
- [ ] x402 adapter implementation
- [ ] Webhook handlers
- [ ] End-to-end payment tests

### Phase 5: Testing (Week 5)
- [ ] Integration tests (E2E flows)
- [ ] Coverage report (≥ 90%)
- [ ] Load tests (100 req/s)
- [ ] Security audit

### Phase 6: Deployment (Week 6)
- [ ] Docker build pipeline
- [ ] Railway deployment
- [ ] Monitoring setup (Sentry, Prometheus)
- [ ] Demo script and documentation

---

## Known Limitations and Future Work

### Current Limitations

1. **No Refunds** - Only forward payments (add refund flow later)
2. **No Multi-Currency** - USD only (add currency conversion later)
3. **No Webhooks for x402** - Synchronous only (add async settlement later)
4. **No Admin Dashboard** - CLI only (build React admin later)
5. **No Agent Registration** - Manual DB inserts (add self-service API later)

### Future Enhancements

1. **ML-Based Routing** - Optimize rail selection based on success rate
2. **Batching** - Combine multiple x402 payments into one request
3. **Subscription Support** - Recurring mandates with auto-renewal
4. **Multi-Agent Policies** - Share spending caps across agent groups
5. **GraphQL API** - For complex client queries
6. **WebSockets** - Real-time payment status updates

---

## Questions for Human Review

Before implementation, clarify:

1. **Agent Registration** - Self-service API or admin-only?
2. **Webhook Callbacks** - Should we notify agents on payment completion?
3. **Refund Policy** - Do we need refund support in v1?
4. **Currency Support** - USD only or multi-currency?
5. **Rate Limiting** - 100 req/15min sufficient or too strict?
6. **Key Rotation** - Quarterly rotation process acceptable?
7. **Audit Logs** - Do we need separate audit log table?
8. **Compliance** - Any PCI-DSS or SOC2 requirements?

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Author:** System Architect Agent
