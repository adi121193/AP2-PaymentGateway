# Webhook Testing Guide

## Overview

This guide explains how to test the Stripe and Cashfree webhook handlers for the AP2 Payment Gateway.

## Webhook Endpoints

### Stripe Webhook
- **URL:** `POST /webhooks/stripe`
- **Events:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, `payment_intent.canceled`
- **Signature Header:** `stripe-signature`

### Cashfree Webhook
- **URL:** `POST /webhooks/cashfree`
- **Events:** `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_USER_DROPPED`, `SETTLEMENT`
- **Signature Headers:** `x-webhook-signature`, `x-webhook-timestamp`

## Prerequisites

### 1. Environment Variables

Ensure these are set in your `.env` file:

```bash
# Stripe (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cashfree (Required)
CASHFREE_APP_ID=TEST430329ae80e0f32e41a393d78b923034
CASHFREE_SECRET_KEY=TESTaf195616268bd6202eeb3bf8dc458956e7192a85
```

### 2. Database Setup

```bash
npm run db:migrate
```

### 3. Start the Server

```bash
npm run dev
```

Server should be running at `http://localhost:3000`

## Testing Methods

### Method 1: Stripe CLI (Recommended for Stripe)

#### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.0/stripe_1.19.0_linux_x86_64.tar.gz
tar -xvf stripe_1.19.0_linux_x86_64.tar.gz
```

#### Forward Webhooks to Local Server

```bash
stripe listen --forward-to http://localhost:3000/webhooks/stripe
```

This will output a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_abc123...
```

Update your `.env` with this secret:
```bash
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

#### Trigger Test Events

```bash
# Trigger payment success
stripe trigger payment_intent.succeeded

# Trigger payment failure
stripe trigger payment_intent.payment_failed

# Trigger payment processing
stripe trigger payment_intent.processing

# Trigger payment canceled
stripe trigger payment_intent.canceled
```

#### Create Real Test Payment

```bash
# Create a payment intent (requires existing payment with provider_ref)
stripe payment_intents create \
  --amount=2000 \
  --currency=usd \
  --payment-method=pm_card_visa \
  --confirm=true
```

### Method 2: Manual cURL Requests

#### Test Stripe Webhook (Without Signature Verification)

**Note:** This will fail signature verification but can test basic routing.

```bash
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test-signature" \
  -d '{
    "id": "evt_test_123",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_123",
        "amount": 2000,
        "currency": "usd",
        "status": "succeeded"
      }
    },
    "created": 1234567890
  }'
```

Expected response:
```json
{
  "error": "Invalid signature"
}
```

#### Test Cashfree Webhook (Simplified)

```bash
# First, get current timestamp
TIMESTAMP=$(date +%s)

# Create test payload
PAYLOAD='{
  "type": "PAYMENT_SUCCESS",
  "data": {
    "order": {
      "order_id": "order_test_123",
      "order_amount": 250.00,
      "order_currency": "INR",
      "order_status": "PAID"
    },
    "payment": {
      "cf_payment_id": "cf_test_123",
      "payment_status": "SUCCESS",
      "payment_amount": 250.00,
      "payment_time": "2025-01-20T10:30:00Z"
    }
  },
  "event_time": "2025-01-20T10:30:00Z"
}'

# Generate signature (requires openssl)
SIGNATURE=$(echo -n "${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -hmac "TESTaf195616268bd6202eeb3bf8dc458956e7192a85" | awk '{print $2}')

# Send webhook
curl -X POST http://localhost:3000/webhooks/cashfree \
  -H "Content-Type: application/json" \
  -H "x-webhook-timestamp: ${TIMESTAMP}" \
  -H "x-webhook-signature: t=${TIMESTAMP},v1=${SIGNATURE}" \
  -d "${PAYLOAD}"
```

### Method 3: Test with Real Payment Flow

#### 1. Create Purchase Intent

```bash
curl -X POST http://localhost:3000/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <agent_public_key>" \
  -H "Idempotency-Key: test-intent-001" \
  -d '{
    "agent_id": "agt_demo",
    "vendor": "test_api",
    "amount": 25000,
    "currency": "INR",
    "description": "Test payment"
  }'
```

Save the `intent_id` from response.

#### 2. Create Mandate

```bash
curl -X POST http://localhost:3000/mandates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <agent_public_key>" \
  -H "Idempotency-Key: test-mandate-001" \
  -d '{
    "intent_id": "<intent_id>",
    "policy_id": "<policy_id>"
  }'
```

Save the `mandate_id` from response.

#### 3. Execute Payment

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <agent_public_key>" \
  -H "Idempotency-Key: test-execute-001" \
  -d '{
    "mandate_id": "<mandate_id>"
  }'
```

This will create a payment with `provider_ref`. Note the `payment_id` and `provider_ref`.

#### 4. Simulate Webhook

Now use the Stripe CLI or cURL to send a webhook with the `provider_ref` as the `payment_intent.id` or `order_id`.

### Method 4: Webhook Testing Tools

#### RequestBin / Webhook.site

1. Go to https://webhook.site
2. Copy your unique URL
3. Configure as webhook URL in Stripe/Cashfree dashboard (test mode)
4. Inspect the payload structure
5. Replay to your local server using cURL

## Verification Steps

### Check Payment Status Updated

```bash
curl http://localhost:3000/execute/<payment_id> \
  -H "Authorization: Bearer <agent_public_key>"
```

Expected response after webhook:
```json
{
  "success": true,
  "data": {
    "payment_id": "...",
    "status": "SETTLED",  // Changed from PENDING
    "settled_at": "2025-01-20T10:30:00Z",
    "receipt_id": "..."
  }
}
```

### Check Receipt Generated

```bash
curl http://localhost:3000/receipts/<receipt_id> \
  -H "Authorization: Bearer <agent_public_key>"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "payment_id": "...",
    "hash": "sha256:...",
    "prev_hash": "sha256:..." or null,
    "chain_index": 0
  }
}
```

### Check Logs

The server logs should show:

```
[INFO] Webhook request received path=/webhooks/stripe
[INFO] Stripe webhook event received eventId=evt_...
[INFO] Processing payment_intent.succeeded
[INFO] Payment successfully settled paymentId=...
[INFO] Receipt generated for settled payment receiptId=...
```

## Idempotency Testing

### Test Duplicate Webhooks

Send the same webhook event twice:

```bash
# First request
stripe trigger payment_intent.succeeded

# Second request (same event ID)
stripe trigger payment_intent.succeeded
```

Expected behavior:
- First request: Payment updated, receipt created
- Second request: Returns 200 OK with "Already processed" message
- No duplicate receipts created
- Payment status unchanged

## Error Scenarios

### Invalid Signature

```bash
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "stripe-signature: invalid-signature" \
  -d '{}'
```

Expected: `401 Unauthorized` with `{"error": "Invalid signature"}`

### Payment Not Found

Send webhook for non-existent payment:

```bash
stripe trigger payment_intent.succeeded
```

Expected: `200 OK` with warning in logs (prevents Stripe retries)

### Database Error

Stop database and send webhook:

```bash
# Stop database
docker-compose stop postgres

# Send webhook
stripe trigger payment_intent.succeeded
```

Expected: `200 OK` with error logged (prevents infinite retries)

## Rate Limiting

Test rate limiting (100 requests/min):

```bash
for i in {1..101}; do
  curl -X POST http://localhost:3000/webhooks/stripe \
    -H "stripe-signature: test" \
    -d '{}' &
done
```

Expected: First 100 succeed, 101st returns `429 Too Many Requests`

## Production Webhook Setup

### Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter: `https://your-domain.com/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.processing`
   - `payment_intent.canceled`
5. Copy webhook signing secret to `.env`

### Cashfree Dashboard

1. Go to https://merchant.cashfree.com/merchants/webhooks
2. Add webhook URL: `https://your-domain.com/webhooks/cashfree`
3. Select events:
   - `PAYMENT_SUCCESS`
   - `PAYMENT_FAILED`
   - `PAYMENT_USER_DROPPED`
4. Cashfree automatically signs webhooks with your secret key

## Troubleshooting

### Webhook Not Received

1. Check server is running: `curl http://localhost:3000/healthz`
2. Check webhook endpoint: `curl http://localhost:3000/webhooks/health`
3. Check firewall/ngrok if testing from external service
4. Verify webhook URL in payment provider dashboard

### Signature Verification Failed

1. Verify `STRIPE_WEBHOOK_SECRET` or `CASHFREE_SECRET_KEY` in `.env`
2. Check header names: `stripe-signature`, `x-webhook-signature`
3. Ensure raw body is passed to verification (not parsed JSON)
4. For Stripe CLI, use the secret from `stripe listen` output

### Payment Not Updated

1. Check `provider_ref` matches webhook `payment_intent.id` or `order_id`
2. Verify payment exists in database
3. Check payment status (may already be SETTLED)
4. Review server logs for errors

### Receipt Not Generated

1. Check if receipt already exists for payment
2. Verify agent_id in payment chain
3. Check database constraints (unique payment_id)
4. Review hash chain continuity

## Monitoring

### Key Metrics

- Webhook processing time (should be < 500ms)
- Signature verification success rate
- Idempotency hit rate
- Payment status distribution
- Receipt chain continuity

### Log Queries

```bash
# Count webhooks by type
grep "webhook event received" logs/combined.log | grep -o "eventType=[^ ]*" | sort | uniq -c

# Find signature failures
grep "signature verification failed" logs/error.log

# Check duplicate webhooks
grep "Already processed" logs/combined.log | wc -l
```

## Security Checklist

- [x] Webhook signatures verified
- [x] Sensitive data redacted in logs
- [x] Rate limiting enabled
- [x] HTTPS enforced (production)
- [x] Idempotency prevents duplicate processing
- [x] Returns 200 OK to prevent retries
- [x] No PII in error messages
