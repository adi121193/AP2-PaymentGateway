# Cashfree Quick Start Guide

**Status**: ✅ READY - API Connectivity Validated
**Phase**: C1 - Cashfree Integration
**Last Updated**: 2025-10-15

---

## TL;DR - We're Ready to Go!

✅ Credentials work
✅ S2S flag is enabled
✅ API returns successful responses
✅ Payment sessions can be created

**You can start implementing Cashfree integration immediately.**

---

## Test Credentials (Already in .env)

```bash
CASHFREE_APP_ID=TEST430329ae80e0f32e41a393d78b923034
CASHFREE_SECRET_KEY=TESTaf195616268bd6202eeb3bf8dc458956e7192a85
CASHFREE_API_URL=https://sandbox.cashfree.com/pg
CASHFREE_API_VERSION=2025-01-01
CASHFREE_ENV=sandbox
```

These are TEST credentials from Cashfree sandbox. Safe to use for development.

---

## Quick Test Commands

### Test 1: Create an Order
```bash
curl -X POST "https://sandbox.cashfree.com/pg/orders" \
  -H "x-client-id: TEST430329ae80e0f32e41a393d78b923034" \
  -H "x-client-secret: TESTaf195616268bd6202eeb3bf8dc458956e7192a85" \
  -H "x-api-version: 2025-01-01" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test_'$(date +%s)'",
    "order_amount": 10.00,
    "order_currency": "INR",
    "customer_details": {
      "customer_id": "test_customer_001",
      "customer_phone": "9999999999"
    }
  }'
```

**Expected**: HTTP 200, order created with `payment_session_id`

### Test 2: Run Automated Test Script
```bash
./scripts/test-cashfree-connectivity.sh
```

**Expected**: Green checkmarks, "READY" status

---

## API Basics

### Authentication
All requests require these headers:
```http
x-client-id: YOUR_APP_ID
x-client-secret: YOUR_SECRET_KEY
x-api-version: 2025-01-01
Content-Type: application/json
```

### Base URL
```
Sandbox:    https://sandbox.cashfree.com/pg
Production: https://api.cashfree.com/pg  (not yet configured)
```

### Rate Limits
- 8000 requests per period per App ID
- Check headers: `x-ratelimit-remaining`, `x-ratelimit-retry`

---

## Core API Endpoints

### 1. Create Order
```typescript
POST /pg/orders

Request:
{
  order_id: string;           // Your unique order ID
  order_amount: number;       // Amount in rupees (10.00)
  order_currency: "INR";
  customer_details: {
    customer_id: string;
    customer_phone: string;   // 10 digits
    customer_email?: string;  // Optional but recommended
    customer_name?: string;
  };
  order_meta?: {
    return_url?: string;      // For redirect flow
    notify_url?: string;      // Webhook URL
  };
}

Response (200):
{
  cf_order_id: string;              // Cashfree's order ID
  order_id: string;                 // Your order ID
  order_status: "ACTIVE";
  payment_session_id: string;       // Use for payment processing
  order_amount: number;
  created_at: string;
  order_expiry_time: string;        // +30 days default
}
```

### 2. Get Order Details
```typescript
GET /pg/orders/{order_id}

Response (200):
{
  cf_order_id: string;
  order_id: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED";
  order_amount: number;
  // ... other fields
}
```

### 3. Create Payment (S2S)
```typescript
POST /pg/orders/pay

Request:
{
  payment_session_id: string;       // From order creation
  payment_method: {
    card?: {
      channel: "link";
      card_number: string;
      card_holder_name: string;
      card_expiry_mm: string;
      card_expiry_yy: string;
      card_cvv: string;
    };
    upi?: {
      channel: "collect" | "qrcode";
      upi_id?: string;                // For collect
    };
    netbanking?: {
      channel: "link";
      netbanking_bank_code: string;
    };
  };
}

Response (200):
{
  cf_payment_id: number;
  payment_status: "SUCCESS" | "PENDING" | "FAILED";
  payment_amount: number;
  // ... other fields
}
```

---

## Test Cards (Sandbox)

### Successful Payment
```
Card Number:  4111 1111 1111 1111
Expiry:       Any future date (e.g., 12/30)
CVV:          Any 3 digits (e.g., 123)
Holder Name:  Any name
```

### Failed Payment
```
Card Number:  4000 0000 0000 0002
Expiry:       Any future date
CVV:          Any 3 digits
```

### More Test Cards
See: https://docs.cashfree.com/docs/test-data

---

## Test UPI IDs (Sandbox)

### Successful Payment
```
UPI ID: success@upi
```

### Failed Payment
```
UPI ID: failure@upi
```

### Pending Payment
```
UPI ID: pending@upi
```

---

## Webhook Setup

### Configure in Cashfree Dashboard
1. Go to https://merchant.cashfree.com/merchants/sandbox
2. Navigate to Developers > Webhooks
3. Add webhook URL: `https://your-domain.com/webhooks/cashfree`
4. Select events: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`
5. Copy webhook secret (starts with `whsec_`)

### Webhook Payload Example
```json
{
  "type": "PAYMENT_SUCCESS_WEBHOOK",
  "data": {
    "order": {
      "order_id": "your_order_id",
      "order_amount": 10.00,
      "order_currency": "INR"
    },
    "payment": {
      "cf_payment_id": 123456789,
      "payment_status": "SUCCESS",
      "payment_amount": 10.00,
      "payment_time": "2025-10-15T20:57:41+05:30",
      "payment_method": "CARD"
    }
  }
}
```

### Webhook Signature Verification
```typescript
import crypto from "crypto";

function verifyWebhook(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const signedPayload = `${timestamp}${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Implementation Checklist

### Phase C1: Cashfree Adapter (Day 1-2)

- [ ] Create `packages/rails/cashfree.ts` adapter
  - [ ] Implement `createOrder()` method
  - [ ] Implement `executePayment()` method
  - [ ] Implement `verifyPayment()` method
  - [ ] Implement `verifyWebhook()` method
  - [ ] Add error handling and retries

- [ ] Update `packages/domain/src/env.ts`
  - [ ] Add Cashfree environment variables to Zod schema
  - [ ] Validate on startup

- [ ] Create `apps/api/src/routes/cashfree-webhook.ts`
  - [ ] POST /webhooks/cashfree endpoint
  - [ ] Signature verification
  - [ ] Idempotency check
  - [ ] Update payment status in DB
  - [ ] Generate receipt

- [ ] Update Rail Router (`packages/rails/router.ts`)
  - [ ] Add Cashfree to available rails
  - [ ] Define routing logic (amount thresholds, geo-restrictions)
  - [ ] Implement fallback logic

- [ ] Add to POST /execute endpoint
  - [ ] Route payments to Cashfree based on rules
  - [ ] Handle Cashfree responses
  - [ ] Store payment session ID

### Phase C2: Testing (Day 3)

- [ ] Unit tests for Cashfree adapter
  - [ ] Test successful payment flow
  - [ ] Test failed payment scenarios
  - [ ] Test webhook signature verification
  - [ ] Test error handling

- [ ] Integration tests with sandbox
  - [ ] E2E flow: Intent → Mandate → Execute → Receipt
  - [ ] Test all payment methods (card, UPI, netbanking)
  - [ ] Test webhook delivery

- [ ] Manual testing
  - [ ] Create test orders
  - [ ] Process test payments
  - [ ] Verify webhooks received
  - [ ] Check receipt generation

---

## Code Snippets

### Cashfree Adapter Structure
```typescript
// packages/rails/cashfree.ts
import axios from "axios";
import crypto from "crypto";

export class CashfreeAdapter implements RailAdapter {
  name = "cashfree_card" as const;
  private apiUrl: string;
  private appId: string;
  private secretKey: string;
  private apiVersion: string;

  constructor(config: CashfreeConfig) {
    this.apiUrl = config.apiUrl;
    this.appId = config.appId;
    this.secretKey = config.secretKey;
    this.apiVersion = config.apiVersion;
  }

  async createOrder(args: CreateOrderArgs): Promise<CreateOrderResponse> {
    const response = await axios.post(
      `${this.apiUrl}/orders`,
      {
        order_id: args.orderId,
        order_amount: args.amountMinor / 100,
        order_currency: args.currency,
        customer_details: args.customerDetails,
      },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async executePayment(args: ExecutePaymentArgs): Promise<PaymentResponse> {
    const response = await axios.post(
      `${this.apiUrl}/orders/pay`,
      {
        payment_session_id: args.paymentSessionId,
        payment_method: args.paymentMethod,
      },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  verifyWebhook(payload: string, signature: string, timestamp: string): boolean {
    const signedPayload = `${timestamp}${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(signedPayload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private getHeaders() {
    return {
      "x-client-id": this.appId,
      "x-client-secret": this.secretKey,
      "x-api-version": this.apiVersion,
      "Content-Type": "application/json",
    };
  }
}
```

### Rail Router Update
```typescript
// packages/rails/router.ts
import { CashfreeAdapter } from "./cashfree";
import { StripeAdapter } from "./stripe";
import { X402Adapter } from "./x402";

export class RailRouter {
  async route(args: RouteArgs): Promise<RailAdapter> {
    const { amountMinor, currency, mandate, agent } = args;

    // Rule 1: x402 for micro-payments (if available)
    if (amountMinor <= 200 && currency === "INR") {
      return new X402Adapter(this.config.x402);
    }

    // Rule 2: Cashfree for India-based payments
    if (currency === "INR" && agent.policies.geo.allow.includes("IN")) {
      return new CashfreeAdapter(this.config.cashfree);
    }

    // Rule 3: Stripe for international payments
    if (currency !== "INR") {
      return new StripeAdapter(this.config.stripe);
    }

    // Fallback: Stripe
    return new StripeAdapter(this.config.stripe);
  }
}
```

---

## Common Errors & Solutions

| Error Code | Description | Solution |
|------------|-------------|----------|
| 401 | Invalid credentials | Check APP_ID and SECRET_KEY |
| 403 | S2S not enabled | Contact care@cashfree.com |
| 422 | Invalid request | Validate payload against API docs |
| 429 | Rate limit exceeded | Implement retry with backoff |
| 500 | Server error | Retry with exponential backoff |

---

## Resources

- **API Docs**: https://docs.cashfree.com/reference/pg-overview
- **Test Data**: https://docs.cashfree.com/docs/test-data
- **Webhooks**: https://docs.cashfree.com/reference/webhooks-overview
- **Error Codes**: https://docs.cashfree.com/docs/error-codes
- **SDKs**: https://github.com/cashfree/cashfree-pg-sdk-nodejs
- **Dashboard**: https://merchant.cashfree.com/merchants/sandbox

---

## Next Steps

1. **Read Full Connectivity Report**: `/docs/CASHFREE_CONNECTIVITY_REPORT.md`
2. **Start Implementation**: Create Cashfree adapter in `packages/rails/`
3. **Run Tests**: Use test script to validate during development
4. **Integrate with Execute Endpoint**: Update POST /execute to route to Cashfree

---

## Questions?

- Check API docs: https://docs.cashfree.com
- Contact Cashfree support: care@cashfree.com
- Review connectivity report: `/docs/CASHFREE_CONNECTIVITY_REPORT.md`
- Run test script: `./scripts/test-cashfree-connectivity.sh`

---

**Status**: ✅ READY TO IMPLEMENT
**Blockers**: NONE
**Next Phase**: C1 Implementation (2-3 days)
