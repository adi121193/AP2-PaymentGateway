# AP2 Gateway - Database Seed Script

## Overview

The seed script populates the AP2 Payment Gateway database with realistic test data for development and testing purposes. It creates interconnected records across all 8 database models with proper cryptographic signatures and hash chains.

## Quick Start

```bash
cd packages/database

# Setup database schema
npm run db:push

# Run seed script
npm run seed

# Verify seeded data
npm run verify
```

## What Gets Seeded

### 📊 Summary

| Table | Count | Description |
|-------|-------|-------------|
| **Agents** | 3 | Different risk tiers (LOW, MEDIUM, HIGH) |
| **Policies** | 3 | Varying caps and vendor allowlists |
| **Purchase Intents** | 5 | Different statuses (PENDING, APPROVED, EXECUTED, REJECTED) |
| **Mandates** | 2 | 1 active, 1 expired |
| **Payments** | 5 | Multiple providers (Stripe, Cashfree, x402) |
| **Receipts** | 5 | Proper hash chain with verification |
| **Idempotency** | 2 | Example idempotency records |
| **X402 Endpoints** | 2 | 1 enabled, 1 disabled |

---

## Detailed Data Specifications

### 1. Agents (3 records)

#### Agent 1: Demo AI Agent
- **ID:** `agt_demo_001`
- **Risk Tier:** LOW
- **Status:** active
- **Public Key:** Ed25519 (generated)
- **Use Case:** General testing with generous limits

#### Agent 2: Research Agent
- **ID:** `agt_research_002`
- **Risk Tier:** MEDIUM
- **Status:** active
- **Public Key:** Ed25519 (generated)
- **Use Case:** Testing stricter limits

#### Agent 3: Suspended Agent
- **ID:** `agt_suspended_003`
- **Risk Tier:** HIGH
- **Status:** suspended
- **Public Key:** Ed25519 (generated)
- **Use Case:** Testing suspended agent scenarios

---

### 2. Policies (3 records)

#### Policy 1 (Demo Agent)
- **Version:** 1
- **Vendor Allowlist:** `["acme_api", "openai", "anthropic"]`
- **Amount Cap:** $5.00 (500 cents)
- **Daily Cap:** $50.00 (5000 cents)
- **x402 Enabled:** true
- **Expires:** 2026-12-31

#### Policy 2 (Research Agent)
- **Version:** 1
- **Vendor Allowlist:** `["data_provider", "research_api"]`
- **Amount Cap:** $2.00 (200 cents)
- **Daily Cap:** $10.00 (1000 cents)
- **x402 Enabled:** false
- **Expires:** 2026-06-30

#### Policy 3 (Suspended Agent)
- **Version:** 1
- **Vendor Allowlist:** `[]`
- **Amount Cap:** $1.00 (100 cents)
- **Daily Cap:** $5.00 (500 cents)
- **x402 Enabled:** false
- **Expires:** 2024-01-01 (already expired)

---

### 3. Purchase Intents (5 records)

| # | Vendor | Amount | Status | Description |
|---|--------|--------|--------|-------------|
| 1 | acme_api | $1.99 | PENDING | API enrichment call |
| 2 | openai | $1.50 | APPROVED | GPT-4 completion |
| 3 | anthropic | $2.50 | EXECUTED | Claude API call |
| 4 | expensive_service | $10.00 | REJECTED | Over limit request |
| 5 | acme_api | $0.50 | PENDING | x402 eligible |

---

### 4. Mandates (2 records)

#### Mandate 1: ACTIVE
- **ID:** `mdt_active_001`
- **Intent:** Intent 2 (OpenAI GPT-4)
- **Policy:** Policy 1 (Demo Agent)
- **Signature:** Valid Ed25519 signature
- **Expires:** +24 hours from creation
- **Status:** ACTIVE

#### Mandate 2: EXPIRED
- **ID:** `mdt_expired_002`
- **Intent:** Intent 3 (Anthropic Claude)
- **Policy:** Policy 1 (Demo Agent)
- **Signature:** Valid Ed25519 signature
- **Expires:** -1 hour from creation (expired)
- **Status:** EXPIRED

---

### 5. Payments (5 records)

| # | Provider | Amount | Currency | Status | Provider Ref |
|---|----------|--------|----------|--------|--------------|
| 1 | stripe | $1.50 | USD | SETTLED | pi_demo_settled_12345 |
| 2 | cashfree | ₹2.50 | INR | PENDING | cf_demo_pending_67890 |
| 3 | stripe | $5.00 | USD | FAILED | pi_demo_failed_99999 |
| 4 | stripe | $0.99 | USD | SETTLED | pi_demo_settled_11111 |
| 5 | x402 | $0.45 | USD | SETTLED | x402_demo_settled_22222 |

---

### 6. Receipts (5 records with hash chain)

The receipts form a cryptographic hash chain where each receipt links to the previous one.

```
Receipt 0 (chain_index: 0)
  prev_hash: null
  hash: sha256:e85cd4b882195...
  payment: $1.50 SETTLED
         ↓
Receipt 1 (chain_index: 1)
  prev_hash: sha256:e85cd4b882195...
  hash: sha256:aed35cde45902...
  payment: $2.50 PENDING
         ↓
Receipt 2 (chain_index: 2)
  prev_hash: sha256:aed35cde45902...
  hash: sha256:8bf659785a5fb...
  payment: $5.00 FAILED
         ↓
Receipt 3 (chain_index: 3)
  prev_hash: sha256:8bf659785a5fb...
  hash: sha256:594568fdc6c57...
  payment: $0.99 SETTLED
         ↓
Receipt 4 (chain_index: 4)
  prev_hash: sha256:594568fdc6c57...
  hash: sha256:6db03e1289f14...
  payment: $0.45 SETTLED
```

**Hash Chain Verification:**
- Uses `generateReceiptHash()` from `@ap2/receipts`
- Each receipt's hash is computed from: `{prev_hash, payment_id, mandate_id, amount, currency, timestamp}`
- Chain integrity is verified during seeding

---

### 7. Idempotency Records (2 records)

#### Record 1: Purchase Intent Creation
- **Route:** `/purchase-intents`
- **Key:** `demo-idempotency-key-001`
- **Status Code:** 201
- **Response:** `{ success: true, intent_id: "..." }`

#### Record 2: Stripe Webhook
- **Route:** `/webhooks/stripe`
- **Key:** `evt_demo_webhook_123`
- **Status Code:** 200
- **Response:** `{ received: true, processed: true }`

---

### 8. Vendor X402 Endpoints (2 records)

#### Vendor 1: acme_api
- **Endpoint:** `https://api.acme.com/x402/payment`
- **Public Key:** Ed25519 (generated)
- **Enabled:** true

#### Vendor 2: old_vendor
- **Endpoint:** `https://old-vendor.com/x402`
- **Public Key:** Ed25519 (generated)
- **Enabled:** false

---

## Cryptographic Features

### Ed25519 Key Pairs

The seed script generates **5 Ed25519 key pairs**:

1. **Agent 1 Keys** (Demo Agent)
2. **Agent 2 Keys** (Research Agent)
3. **Agent 3 Keys** (Suspended Agent)
4. **Vendor 1 Keys** (acme_api)
5. **Vendor 2 Keys** (old_vendor)

### Mandate Signatures

Each mandate is signed using Ed25519:

```typescript
signature = ed25519.sign(mandateHash, agentPrivateKey)
```

Where `mandateHash` is generated from:
```typescript
generateMandateHash({
  intent_id,
  policy_id,
  expires_at
})
```

### Receipt Hash Chain

Each receipt hash is generated from:
```typescript
generateReceiptHash({
  prev_hash,      // Previous receipt's hash (or null)
  payment_id,
  mandate_id,
  amount,
  currency,
  timestamp
})
```

---

## Verification

### Quick Verification

```bash
npm run verify
```

### Manual Verification (SQL)

```sql
-- Check all record counts
SELECT
  (SELECT COUNT(*) FROM agents) as agents,
  (SELECT COUNT(*) FROM policies) as policies,
  (SELECT COUNT(*) FROM purchase_intents) as intents,
  (SELECT COUNT(*) FROM mandates) as mandates,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM receipts) as receipts,
  (SELECT COUNT(*) FROM idempotency) as idempotency,
  (SELECT COUNT(*) FROM vendor_x402_endpoints) as x402_endpoints;

-- Verify receipt hash chain
SELECT
  r.chain_index,
  r.hash,
  r.prev_hash,
  p.amount,
  p.currency,
  p.status,
  CASE
    WHEN r.chain_index = 0 THEN (r.prev_hash IS NULL)
    ELSE (r.prev_hash = LAG(r.hash) OVER (ORDER BY r.chain_index))
  END as chain_valid
FROM receipts r
JOIN payments p ON r.payment_id = p.id
WHERE r.agent_id = 'agt_demo_001'
ORDER BY r.chain_index;
```

---

## Usage in Tests

### Example: Testing with Demo Agent

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use seeded agent
const agent = await prisma.agent.findUnique({
  where: { id: 'agt_demo_001' }
});

// Get active policy
const policy = await prisma.policy.findFirst({
  where: {
    agent_id: 'agt_demo_001',
    expires_at: { gt: new Date() }
  }
});

// Create new purchase intent
const intent = await prisma.purchaseIntent.create({
  data: {
    agent_id: 'agt_demo_001',
    vendor: 'acme_api',
    amount: 199,
    currency: 'USD',
    description: 'Test purchase',
  }
});
```

---

## Idempotent Execution

The seed script is **idempotent** - you can run it multiple times safely:

```bash
npm run seed  # First run
npm run seed  # Second run (clears old data, creates fresh data)
```

### What Happens on Re-run:

1. **Clears all existing data** (in foreign-key safe order)
2. **Generates new cryptographic keys** (different each time)
3. **Creates fresh test data** with new timestamps
4. **Verifies hash chain integrity**

---

## Files

| File | Purpose |
|------|---------|
| `prisma/seed.ts` | Main seed script (677 lines) |
| `prisma/verify-seed.ts` | Verification script (80 lines) |
| `SEED_README.md` | This documentation |

---

## Troubleshooting

### Error: DATABASE_URL not found

**Solution:**
Ensure `.env` file exists in project root with:
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Error: Tables don't exist

**Solution:**
Run database migrations first:
```bash
npm run db:push
```

### Error: Permission denied to create database

**Solution:**
Use `db:push` instead of `migrate:dev`:
```bash
npm run db:push
npm run seed
```

---

## Next Steps

1. **View data in Prisma Studio:**
   ```bash
   npm run studio
   ```

2. **Test API endpoints** with seeded agent IDs:
   - `agt_demo_001` (active, LOW risk)
   - `agt_research_002` (active, MEDIUM risk)
   - `agt_suspended_003` (suspended, HIGH risk)

3. **Run integration tests** using seeded data

4. **Verify hash chain** with provided SQL query

---

## Related Documentation

- [Prisma Schema](/packages/database/prisma/schema.prisma)
- [Receipt Chain Implementation](/packages/receipts/src/chain.ts)
- [Environment Configuration](/.env.template)
- [API Documentation](/docs/openapi.yaml)

---

**Created:** 2025-10-20
**Last Updated:** 2025-10-20
**Version:** 1.0.0
