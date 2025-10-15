# Cashfree Adapter Quick Reference

> **Status:** ✅ Implementation Complete | ⏳ Testing Pending

---

## Quick Start

### 1. Installation

```bash
# Already included in package.json dependencies
npm install
```

### 2. Environment Setup

```bash
# Add to .env
CASHFREE_APP_ID=TEST430329ae80e0f32e41a393d78b923034
CASHFREE_SECRET_KEY=TESTaf195616268bd6202eeb3bf8dc458956e7192a85
```

### 3. Import & Use

```typescript
import { CashfreeAdapter } from '@ap2/rails';

const adapter = new CashfreeAdapter();

const result = await adapter.executePayment({
  mandate_id: 'mdt_123',
  amount: 25000,  // ₹250 in paise
  currency: 'INR',
  vendor: 'acme_api',
  agent_id: 'agt_demo',
  metadata: {
    customer_phone: '9876543210',  // Required
    customer_email: 'user@example.com',  // Optional
    customer_name: 'John Doe',  // Optional
  },
});

console.log(result);
// { success: true, provider_ref: 'cf_mdt_123_...', status: 'settled' }
```

---

## Amount Conversion

```typescript
import { convertMinorToMajor, convertMajorToMinor } from '@ap2/rails/cashfree';

// Paise → Rupees
convertMinorToMajor(25000);  // 250.00
convertMinorToMajor(199);    // 1.99
convertMinorToMajor(1);      // 0.01

// Rupees → Paise
convertMajorToMinor(250.00); // 25000
convertMajorToMinor(1.99);   // 199
convertMajorToMinor(0.01);   // 1
```

---

## Payment Methods

### UPI Link Flow (Default)

User enters their UPI ID on Cashfree payment page.

```typescript
await adapter.executePayment({
  // ... other fields
  metadata: {
    customer_phone: '9876543210',
    // No upi_id needed - user will enter on payment page
  },
});
```

### UPI Collect Flow

Payment request sent directly to user's UPI app.

```typescript
await adapter.executePayment({
  // ... other fields
  metadata: {
    customer_phone: '9876543210',
    upi_id: 'user@paytm',  // Triggers collect flow
  },
});
```

---

## Webhook Verification

```typescript
import { CashfreeAdapter } from '@ap2/rails';

const adapter = new CashfreeAdapter();

app.post('/webhooks/cashfree', (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;

  if (!adapter.verifyWebhook(req.body, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Process webhook
  const webhook = req.body as CashfreeWebhookPayload;
  console.log('Payment status:', webhook.data.payment.payment_status);

  res.json({ received: true });
});
```

---

## Error Handling

### All errors return PaymentResult

```typescript
const result = await adapter.executePayment(request);

if (!result.success) {
  console.error('Payment failed:', result.error);
  // Example errors:
  // - "Missing required field: customer_phone in metadata"
  // - "Invalid customer_phone format (must be 10-digit Indian mobile number)"
  // - "Order creation failed: INVALID_ORDER_AMOUNT"
  // - "Request timeout"
}
```

### Retry logic automatic

- 3 attempts max
- Exponential backoff (500ms → 5s)
- Only retries on 5xx, 429, network errors

---

## Payment Result Schema

```typescript
interface PaymentResult {
  success: boolean;
  provider_ref?: string;        // Order ID (e.g., "cf_mdt_123_1234567890")
  error?: string;               // Error message if failed
  status: "settled" | "pending" | "failed";
  metadata?: {
    cf_payment_id?: number;     // Cashfree payment ID
    payment_time?: string;      // ISO timestamp
    bank_reference?: string;    // Bank reference number
  };
}
```

---

## Testing

### Manual Test

```bash
npx tsx test-cashfree-adapter.ts
```

**Expected output:**
```
✅ Environment Loading
✅ Amount Conversion
✅ Adapter Initialization
✅ Webhook Verification
✅ Payment Request Validation
✅ Error Handling

✨ All Tests Passed!
```

### Unit Tests (Coming in Handoff #4)

```bash
npm test -- cashfree
```

---

## Common Issues

### Issue: "CASHFREE_APP_ID must start with TEST or PROD"

**Solution:** Check your .env file:
```bash
# Wrong
CASHFREE_APP_ID=430329ae...

# Correct
CASHFREE_APP_ID=TEST430329ae...
```

### Issue: "Missing required field: customer_phone in metadata"

**Solution:** Always include customer phone:
```typescript
metadata: {
  customer_phone: '9876543210',  // Required for Cashfree
}
```

### Issue: "Invalid customer_phone format"

**Solution:** Use 10-digit Indian mobile number (starts with 6-9):
```typescript
// Wrong
customer_phone: '1234567890'  // Doesn't start with 6-9
customer_phone: '+919876543210'  // No country code

// Correct
customer_phone: '9876543210'
```

---

## Environment Variables Reference

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| CASHFREE_APP_ID | ✅ Yes | TEST/PROD prefix | TEST430329ae... |
| CASHFREE_SECRET_KEY | ✅ Yes | TEST/PROD prefix | TESTaf195616... |
| STRIPE_SECRET_KEY | ❌ No (optional) | sk_test_ | sk_test_... |
| DATABASE_URL | ✅ Yes | PostgreSQL URL | postgresql://... |

---

## API Limits (Sandbox)

| Limit | Value |
|-------|-------|
| Min amount | ₹1 (100 paise) |
| Max amount | ₹100,000 (test mode) |
| Request timeout | 5s (order), 10s (payment) |
| Webhook retries | 5 attempts over 24h |
| API rate limit | 100 req/min |

---

## Logging

All logs in structured JSON format:

```json
{
  "level": "info",
  "msg": "Payment executed",
  "mandate_id": "mdt_123",
  "order_id": "cf_mdt_123_1234567890",
  "cf_payment_id": 12345678,
  "status": "SUCCESS",
  "amount_minor": 25000,
  "amount_major": 250,
  "currency": "INR",
  "duration_ms": 523,
  "customer_phone": "9876XXXXXX"
}
```

**Sensitive data automatically redacted:**
- ✅ Phone: Last 6 digits masked
- ✅ Credentials: Only first 8 chars shown
- ✅ UPI IDs: Never logged fully

---

## TypeScript Types

### Import Types

```typescript
import type {
  CashfreeCustomer,
  CashfreeOrderResponse,
  CashfreePaymentResponse,
  CashfreeWebhookPayload,
} from '@ap2/rails/cashfree';
```

### Customer Details

```typescript
const customer: CashfreeCustomer = {
  customer_id: 'cust_123',          // Required
  customer_phone: '9876543210',     // Required
  customer_email: 'user@ex.com',    // Optional
  customer_name: 'John Doe',        // Optional
};
```

---

## File Locations

```
packages/rails/src/cashfree/
├── adapter.ts     # Main adapter class
├── types.ts       # TypeScript type definitions
├── utils.ts       # Utility functions
└── index.ts       # Module exports
```

---

## What's Next?

### Phase C2 (Current)
- [ ] Unit tests with Vitest
- [ ] Integration tests
- [ ] Update RailRouter to support Cashfree

### Phase C3 (Future)
- [ ] Webhook endpoint implementation
- [ ] Settlement tracking
- [ ] Refund support
- [ ] Card payment support

---

## Useful Links

- [Cashfree API Docs](https://docs.cashfree.com/reference/pg-new-apis-endpoint)
- [Cashfree Dashboard](https://sandbox.cashfree.com/merchant/dashboard)
- [Implementation Report](./CASHFREE_ADAPTER_IMPLEMENTATION.md)
- [Architecture Design](./PHASE_C_DEVELOPMENT_PLAN.md)

---

## Support

**Questions?** Check:
1. [Full Implementation Report](./CASHFREE_ADAPTER_IMPLEMENTATION.md)
2. [TypeScript Types](../packages/rails/src/cashfree/types.ts)
3. [Test Script](../test-cashfree-adapter.ts)

**Found a bug?** File an issue with:
- Error message
- Request/response logs
- Environment (TEST/PROD)
