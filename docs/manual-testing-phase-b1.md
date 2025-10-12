# Phase B1 Manual Testing Guide

## Prerequisites

1. **Environment Setup**: Fill in the `.env` file with valid values:
   - `DATABASE_URL`: PostgreSQL connection string (TODO: human)
   - `STRIPE_SECRET_KEY`: Stripe test mode key starting with `sk_test_` (TODO: human)
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret starting with `whsec_` (TODO: human)
   - `MANDATE_SIGN_KEY`: 64+ character hex string for Ed25519 signing (TODO: human)
   - `JWT_SECRET`: 32+ character secret (TODO: human)

2. **Database Setup** (optional for Phase B1):
   ```bash
   # If you have PostgreSQL running:
   npm run db:migrate
   npm run db:seed
   ```

3. **Start the Server**:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   🚀 AP2 Payment Gateway API listening on port 3000
   📍 Health check: http://localhost:3000/healthz
   ```

---

## Test 1: Health Check

### Request
```bash
curl http://localhost:3000/healthz
```

### Expected Response (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2025-01-13T00:46:41.123Z",
  "uptime": 5.234,
  "environment": "development"
}
```

---

## Test 2: POST /purchase-intents (Success)

### Generate HMAC Signature
```bash
# For testing, we'll use a simple agent_id
AGENT_ID="agent_test_12345"
REQUEST_BODY='{"vendor":"acme-corp","amount":100,"currency":"USD","description":"Test purchase"}'

# The HMAC signature is currently validated by format only (not verified against a secret)
# In production, you would compute: HMAC-SHA256(request_body, agent_secret_key)
# For Phase B1 testing, any valid hex string works
SIGNATURE="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
```

### Request
```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_12345:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-intent-001" \
  -d '{
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Test purchase for widget"
  }'
```

### Expected Response (201 Created)
```json
{
  "success": true,
  "data": {
    "intent_id": "clxxx...",
    "agent_id": "agent_test_12345",
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Test purchase for widget",
    "metadata": {},
    "status": "PENDING",
    "created_at": "2025-01-13T00:47:00.000Z"
  }
}
```

**Note**: If database is not connected, you'll get a mock response with `intent_id` like `intent_mock_1705105620000`.

---

## Test 3: Idempotency Check

### Request (Same Idempotency-Key as Test 2)
```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_12345:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-intent-001" \
  -d '{
    "vendor": "different-vendor",
    "amount": 999,
    "currency": "EUR",
    "description": "This should be ignored"
  }'
```

### Expected Response (200 OK - Cached Response)
Same response as Test 2, ignoring the new request body. The idempotency middleware returns the cached response.

---

## Test 4: Missing Idempotency-Key

### Request
```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_12345:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -d '{
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Missing idempotency key"
  }'
```

### Expected Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Idempotency-Key header is required for mutation requests"
  }
}
```

---

## Test 5: Missing Authentication

### Request
```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-no-auth-001" \
  -d '{
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "No auth header"
  }'
```

### Expected Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authorization header is required"
  }
}
```

---

## Test 6: Invalid Request Body (Validation Error)

### Request
```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC-SHA256 agent_test_12345:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  -H "Idempotency-Key: test-validation-001" \
  -d '{
    "vendor": "invalid vendor with spaces!",
    "amount": -50,
    "currency": "INVALID",
    "description": ""
  }'
```

### Expected Response (400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "vendor",
        "message": "Vendor must be alphanumeric with hyphens/underscores"
      },
      {
        "field": "amount",
        "message": "Amount must be positive"
      },
      {
        "field": "currency",
        "message": "Invalid enum value..."
      },
      {
        "field": "description",
        "message": "String must contain at least 1 character(s)"
      }
    ]
  }
}
```

---

## Test 7: Unknown Route (404)

### Request
```bash
curl http://localhost:3000/unknown-route
```

### Expected Response (404 Not Found)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /unknown-route not found"
  }
}
```

---

## Test 8: GET /purchase-intents/:id (If Database Connected)

### Request
```bash
# Replace {intent_id} with an actual intent_id from Test 2
curl -X GET http://localhost:3000/purchase-intents/{intent_id} \
  -H "Authorization: HMAC-SHA256 agent_test_12345:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "data": {
    "intent_id": "clxxx...",
    "agent_id": "agent_test_12345",
    "vendor": "acme-corp",
    "amount": 100,
    "currency": "USD",
    "description": "Test purchase for widget",
    "metadata": {},
    "status": "PENDING",
    "created_at": "2025-01-13T00:47:00.000Z"
  }
}
```

---

## Test 9: Cross-Origin Request (CORS)

### Request from Browser Console (if testing from frontend)
```javascript
fetch('http://localhost:3000/healthz', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(console.log);
```

### Expected Behavior
- If origin is `http://localhost:3000` or `http://localhost:3001`: Request succeeds
- If origin is different: CORS error (expected, update `ALLOWED_ORIGINS` in `.env`)

---

## Database Testing (Optional)

If you have PostgreSQL running and have run migrations:

### 1. Create Test Agent
```sql
INSERT INTO agents (id, name, public_key, status, risk_tier)
VALUES ('agent_test_12345', 'Test Agent', 'pub_key_12345', 'active', 'LOW');
```

### 2. Run Test 2 Again
Now the request will:
- Verify the agent exists in the database
- Create an actual `purchase_intents` record
- Return a real database-generated `intent_id`

### 3. Check Database
```sql
SELECT * FROM purchase_intents WHERE agent_id = 'agent_test_12345';
SELECT * FROM idempotency WHERE key = 'test-intent-001';
```

---

## Logs

Check server logs for detailed request/response information:

```bash
# If running in terminal, logs appear in real-time
# If running in background, check:
tail -f /tmp/ap2-server.log
```

Expected log entries:
- Request start with method, path, agent_id
- Request completion with status code and duration
- Any errors with stack traces (in development mode)

---

## Success Criteria for Phase B1

✅ **Health check endpoint** returns 200 OK
✅ **POST /purchase-intents** accepts valid requests and returns 201
✅ **Authentication middleware** validates HMAC format
✅ **Idempotency middleware** caches and returns duplicate responses
✅ **Validation** rejects invalid requests with detailed error messages
✅ **Error handling** returns standardized error responses
✅ **CORS** allows configured origins
✅ **Logging** provides structured, redacted logs
✅ **Database fallback** returns mock responses when DB unavailable

---

## Next Steps (Phase B2)

After Phase B1 checkpoint approval:
- Implement POST /mandates endpoint
- Implement POST /execute endpoint
- Implement GET /receipts/:id endpoint
- Add policy gate service
- Add mandate signing service
- Add receipt hash-chain service

---

## Troubleshooting

### Server won't start
- Check `.env` file exists in project root
- Verify all required env vars are set (see Prerequisites)
- Check port 3000 is not already in use: `lsof -i :3000`

### Database connection errors
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` is correct
- Run migrations: `npm run db:migrate`
- For Phase B1, database is optional (mock responses will be used)

### Idempotency not working
- Database must be connected for idempotency to work
- Without database, warning will be logged and requests proceed without protection

### Authentication always fails
- Ensure `Authorization` header format: `HMAC-SHA256 agent_id:signature`
- In Phase B1, signature is not cryptographically verified (format validation only)
- If database connected, ensure agent exists and is active
