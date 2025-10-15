# Phase B2 Integration Testing Playbook

## Overview

This playbook tests the complete authorization and payment flow:
**Purchase Intent → Mandate → Execute → Receipt**

All endpoints are tested with both positive (happy path) and negative (error) scenarios.

---

## Prerequisites

1. **Server Running**:
   ```bash
   npm run dev
   ```

2. **Database Setup** (optional, works with mocks if DB unavailable):
   ```bash
   npm run db:migrate
   ```

3. **Environment Variables** (from `.env`):
   - `DATABASE_URL`: PostgreSQL connection
   - `MANDATE_SIGN_KEY`: Ed25519 private key (you have this)
   - `JWT_SECRET`: JWT secret (you have this)

4. **Test Agent Setup** (if database connected):
   ```sql
   -- Create test agent
   INSERT INTO agents (id, name, public_key, status, risk_tier)
   VALUES ('agent_test_b2', 'Test Agent B2', 'pub_key_b2_12345', 'active', 'LOW');

   -- Create test policy
   INSERT INTO policies (id, agent_id, version, vendor_allowlist, amount_cap, daily_cap, risk_tier, x402_enabled, expires_at)
   VALUES (
     'policy_test_b2',
     'agent_test_b2',
     1,
     '["acme-corp", "widget-co", "test-vendor"]'::jsonb,
     500,
     2000,
     'LOW',
     true,
     NOW() + INTERVAL '30 days'
   );
   ```

---

## Test Constants

```bash
# Authentication
AGENT_ID="agent_test_b2"
SIGNATURE="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
AUTH_HEADER="Authorization: HMAC-SHA256 ${AGENT_ID}:${SIGNATURE}"

# Base URL
BASE_URL="http://localhost:3000"
```

---

## Happy Path: Complete Flow

### Step 1: Create Purchase Intent

```bash
curl -X POST ${BASE_URL}/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-intent-001" \
  -d '{
    "vendor": "acme-corp",
    "amount": 150,
    "currency": "USD",
    "description": "Test purchase for Phase B2"
  }'
```

**Expected Response (201)**:
```json
{
  "success": true,
  "data": {
    "intent_id": "clxxx...",
    "agent_id": "agent_test_b2",
    "vendor": "acme-corp",
    "amount": 150,
    "currency": "USD",
    "status": "PENDING"
  }
}
```

**Save the `intent_id` for next step!**

---

### Step 2: Create Mandate

```bash
# Replace {intent_id} with actual intent_id from Step 1
INTENT_ID="clxxx..."

curl -X POST ${BASE_URL}/mandates \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-mandate-001" \
  -d "{
    \"intent_id\": \"${INTENT_ID}\",
    \"expires_in_hours\": 24
  }"
```

**Expected Response (201)**:
```json
{
  "success": true,
  "data": {
    "mandate_id": "clxxx...",
    "intent_id": "clxxx...",
    "policy_id": "policy_test_b2",
    "signature": "a1b2c3d4...",
    "hash": "sha256:...",
    "public_key": "e5f6g7h8...",
    "issued_at": "2025-01-13T01:00:00Z",
    "expires_at": "2025-01-14T01:00:00Z",
    "status": "ACTIVE",
    "vendor": "acme-corp",
    "amount": 150,
    "currency": "USD"
  }
}
```

**Save the `mandate_id` for next step!**

---

### Step 3: Execute Payment

```bash
# Replace {mandate_id} with actual mandate_id from Step 2
MANDATE_ID="clxxx..."

curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-execute-001" \
  -d "{
    \"mandate_id\": \"${MANDATE_ID}\"
  }"
```

**Expected Response (201)**:
```json
{
  "success": true,
  "data": {
    "payment_id": "clxxx...",
    "receipt_id": "clxxx...",
    "mandate_id": "clxxx...",
    "intent_id": "clxxx...",
    "provider": "mock",
    "provider_ref": null,
    "amount": 150,
    "currency": "USD",
    "status": "PENDING",
    "receipt_hash": "sha256:...",
    "receipt_chain_index": 0,
    "message": "Payment initiated. Settlement pending (test mode).",
    "created_at": "2025-01-13T01:00:00Z"
  }
}
```

**Save the `receipt_id` for next step!**

---

### Step 4: Fetch Receipt (JSON)

```bash
# Replace {receipt_id} with actual receipt_id from Step 3
RECEIPT_ID="clxxx..."

curl -X GET ${BASE_URL}/receipts/${RECEIPT_ID} \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
```

**Expected Response (200)**:
```json
{
  "success": true,
  "data": {
    "receipt_id": "clxxx...",
    "payment_id": "clxxx...",
    "agent_id": "agent_test_b2",
    "mandate_id": "clxxx...",
    "intent_id": "clxxx...",
    "hash": "sha256:...",
    "prev_hash": null,
    "chain_index": 0,
    "payment": {
      "provider": "mock",
      "provider_ref": null,
      "amount": 150,
      "currency": "USD",
      "status": "PENDING",
      "settled_at": null
    },
    "intent": {
      "vendor": "acme-corp",
      "description": "Test purchase for Phase B2"
    },
    "created_at": "2025-01-13T01:00:00Z"
  }
}
```

---

### Step 5: Fetch Receipt (CSV)

```bash
curl -X GET "${BASE_URL}/receipts/${RECEIPT_ID}?format=csv" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  --output receipt.csv

cat receipt.csv
```

**Expected Output**:
```csv
Receipt ID,Payment ID,Mandate ID,Intent ID,Agent ID,Vendor,Amount,Currency,Provider,Provider Reference,Status,Hash,Previous Hash,Chain Index,Settled At,Created At
clxxx...,clxxx...,clxxx...,clxxx...,agent_test_b2,acme-corp,150,USD,mock,N/A,PENDING,sha256:...,N/A (genesis),0,N/A,2025-01-13T01:00:00.000Z
```

---

## Negative Test Scenarios

### Test 1: Create Mandate for Non-Existent Intent

```bash
curl -X POST ${BASE_URL}/mandates \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-001" \
  -d '{
    "intent_id": "nonexistent_intent_id",
    "expires_in_hours": 24
  }'
```

**Expected Response (422)**:
```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Purchase intent not found"
  }
}
```

---

### Test 2: Create Mandate for Disallowed Vendor

First, create intent with disallowed vendor:

```bash
curl -X POST ${BASE_URL}/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-002a" \
  -d '{
    "vendor": "evil-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Disallowed vendor test"
  }'
```

Then try to create mandate:

```bash
# Use intent_id from above response
curl -X POST ${BASE_URL}/mandates \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-002b" \
  -d "{
    \"intent_id\": \"${INTENT_ID_FROM_ABOVE}\",
    \"expires_in_hours\": 24
  }"
```

**Expected Response (422)**:
```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Vendor \"evil-corp\" not in policy allowlist"
  }
}
```

---

### Test 3: Create Mandate for Amount Exceeding Cap

```bash
curl -X POST ${BASE_URL}/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-003a" \
  -d '{
    "vendor": "acme-corp",
    "amount": 600,
    "currency": "USD",
    "description": "Over amount cap"
  }'

# Then try to create mandate (use intent_id from response)
curl -X POST ${BASE_URL}/mandates \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-003b" \
  -d "{
    \"intent_id\": \"${INTENT_ID}\",
    \"expires_in_hours\": 24
  }"
```

**Expected Response (422)**:
```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Amount 600 exceeds policy cap 500"
  }
}
```

---

### Test 4: Execute with Expired Mandate

First, create a mandate that expires quickly:

```bash
# Create intent
curl -X POST ${BASE_URL}/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-004a" \
  -d '{
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Expiry test"
  }'

# Create mandate with 0.001 hour expiry (manually set expires_at in DB, or wait)
# For testing, manually update DB:
# UPDATE mandates SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = 'mandate_id';

# Then try to execute
curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-004b" \
  -d "{
    \"mandate_id\": \"${EXPIRED_MANDATE_ID}\"
  }"
```

**Expected Response (422)**:
```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Mandate has expired"
  }
}
```

---

### Test 5: Execute Same Mandate Twice

```bash
# First execution (should succeed)
curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-005a" \
  -d "{
    \"mandate_id\": \"${MANDATE_ID}\"
  }"

# Second execution with DIFFERENT idempotency key (should fail)
curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-neg-005b" \
  -d "{
    \"mandate_id\": \"${MANDATE_ID}\"
  }"
```

**Expected Response (422)**:
```json
{
  "success": false,
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Mandate has already been executed"
  }
}
```

---

### Test 6: Idempotency Replay Test

```bash
# First request
curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-idempotency-replay" \
  -d "{
    \"mandate_id\": \"${MANDATE_ID}\"
  }"

# Second request with SAME idempotency key (should return cached response)
curl -X POST ${BASE_URL}/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-b2-idempotency-replay" \
  -d "{
    \"mandate_id\": \"different_mandate_id_ignored\"
  }"
```

**Expected**: Second response is identical to first (ignores new request body).

---

## Receipt Chain Verification

Create multiple payments to test hash chain:

```bash
# Payment 1
curl -X POST ${BASE_URL}/purchase-intents ... (create intent 1)
curl -X POST ${BASE_URL}/mandates ... (create mandate 1)
curl -X POST ${BASE_URL}/execute ... (execute 1)
# Note receipt_1.hash and receipt_1.chain_index (should be 0)

# Payment 2
curl -X POST ${BASE_URL}/purchase-intents ... (create intent 2)
curl -X POST ${BASE_URL}/mandates ... (create mandate 2)
curl -X POST ${BASE_URL}/execute ... (execute 2)
# Note receipt_2.prev_hash should equal receipt_1.hash
# Note receipt_2.chain_index should be 1

# Payment 3
curl -X POST ${BASE_URL}/purchase-intents ... (create intent 3)
curl -X POST ${BASE_URL}/mandates ... (create mandate 3)
curl -X POST ${BASE_URL}/execute ... (execute 3)
# Note receipt_3.prev_hash should equal receipt_2.hash
# Note receipt_3.chain_index should be 2
```

**Verification**:
```bash
# Fetch all receipts for agent
curl -X GET "${BASE_URL}/receipts" \
  -H "Authorization: HMAC-SHA256 agent_test_b2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

# Verify:
# - receipt[i].prev_hash == receipt[i-1].hash (for i > 0)
# - receipt[i].chain_index == i
# - All hashes start with "sha256:"
```

---

## Success Criteria

✅ **All 6 endpoints operational**:
- GET /healthz
- POST /purchase-intents
- GET /purchase-intents/:id
- POST /mandates
- GET /mandates/:id
- POST /execute
- GET /execute/:paymentId
- GET /receipts/:id
- GET /receipts

✅ **Complete flow works**: Intent → Mandate → Execute → Receipt

✅ **Policy enforcement**: Vendor allowlist, amount caps, daily caps

✅ **Mandate signing**: Ed25519 signatures generated

✅ **Receipt chain**: Hash chain maintained across payments

✅ **CSV export**: Receipts downloadable as CSV

✅ **Error handling**: All negative scenarios handled gracefully

✅ **Idempotency**: Duplicate requests return cached responses

---

## Next Phase

**Phase C**: Replace "mock" provider with real Stripe + x402 rails integration.
