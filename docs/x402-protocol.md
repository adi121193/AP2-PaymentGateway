# x402 Protocol Specification

## Overview

The **x402 protocol** is a lightweight, HTTP-based micropayment protocol designed for fast, low-value transactions between autonomous agents and API vendors. It uses Ed25519 signatures for authentication and supports idempotent payments up to 200 units (in minor currency units, e.g., cents).

**Version:** 1.0
**Status:** Draft
**Maximum Payment Amount:** 200 (minor units)
**Timeout:** 5 seconds

---

## Design Principles

1. **Simplicity First** - HTTP POST with JSON, no complex handshakes
2. **Cryptographic Authentication** - Ed25519 signatures, no API keys
3. **Idempotency by Design** - Every request requires an idempotency key
4. **Fast Settlement** - Synchronous response for sub-$2 payments
5. **Tamper-Proof** - Canonical JSON signing prevents replay attacks

---

## Protocol Flow

```
┌─────────┐                                 ┌────────────┐
│  Agent  │                                 │   Vendor   │
│ Gateway │                                 │ API Server │
└────┬────┘                                 └─────┬──────┘
     │                                            │
     │  1. POST /payment (signed request)         │
     ├───────────────────────────────────────────>│
     │                                            │
     │  2. Verify signature & idempotency         │
     │                                            │
     │  3. Process payment                        │
     │                                            │
     │  4. 200 OK (settlement_ref)                │
     │<───────────────────────────────────────────┤
     │                                            │
```

---

## Request Specification

### HTTP Method and Endpoint

```
POST {vendor_endpoint}/payment
```

The vendor endpoint is pre-configured in the `VendorX402Endpoint` table.

### Required Headers

| Header               | Format                        | Description                                    |
|----------------------|-------------------------------|------------------------------------------------|
| `Content-Type`       | `application/json`            | JSON request body                              |
| `X-Payment-Amount`   | Integer (e.g., `199`)         | Payment amount in minor units (e.g., cents)    |
| `X-Payment-Currency` | ISO 4217 code (e.g., `USD`)   | Three-letter currency code                     |
| `Idempotency-Key`    | String (max 255 chars)        | Unique key for idempotent processing           |
| `X-Signature`        | Base64-encoded Ed25519 sig    | Signature of canonical request body            |
| `X-Public-Key`       | Base64-encoded Ed25519 pubkey | Agent's public key for signature verification  |

### Request Body

```json
{
  "agent_id": "agt_01HXQ9F7Y2R8N5W6P3K1J4M0E9",
  "mandate_id": "mdt_01HXQ9G8Z3S9O6X7Q4L2K5N1F0",
  "vendor": "acme_api",
  "amount": 199,
  "currency": "USD",
  "timestamp": "2025-10-12T14:30:00.000Z"
}
```

**Field Descriptions:**

- `agent_id` - Unique identifier for the paying agent
- `mandate_id` - Reference to the pre-approved payment mandate
- `vendor` - Vendor identifier (must match endpoint registration)
- `amount` - Payment amount (must be ≤ 200 and match `X-Payment-Amount` header)
- `currency` - Currency code (must match `X-Payment-Currency` header)
- `timestamp` - ISO 8601 timestamp (used to prevent replay attacks; must be within 5 minutes of current time)

---

## Signature Generation

### Canonical JSON Format

To ensure consistent signatures, the request body must be serialized in **canonical JSON** format:

1. Sort all object keys alphabetically
2. No whitespace between elements
3. Use double quotes for strings
4. ISO 8601 format for timestamps

**Example Canonical JSON:**

```json
{"agent_id":"agt_01HXQ9F7Y2R8N5W6P3K1J4M0E9","amount":199,"currency":"USD","mandate_id":"mdt_01HXQ9G8Z3S9O6X7Q4L2K5N1F0","timestamp":"2025-10-12T14:30:00.000Z","vendor":"acme_api"}
```

### Signature Algorithm

**Algorithm:** Ed25519 (Edwards-curve Digital Signature Algorithm)

**Steps:**

1. Serialize request body to canonical JSON
2. Convert canonical JSON string to UTF-8 bytes
3. Sign bytes using Ed25519 private key
4. Base64-encode the signature
5. Include in `X-Signature` header

**Reference Implementation (Node.js):**

```javascript
import { ed25519 } from '@noble/curves/ed25519';

function signRequest(requestBody, privateKeyHex) {
  // 1. Canonical JSON
  const canonical = JSON.stringify(requestBody, Object.keys(requestBody).sort());

  // 2. Convert to bytes
  const messageBytes = new TextEncoder().encode(canonical);

  // 3. Sign with Ed25519
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const signature = ed25519.sign(messageBytes, privateKey);

  // 4. Base64 encode
  return Buffer.from(signature).toString('base64');
}
```

**Verification (Vendor Side):**

```javascript
function verifySignature(requestBody, signatureBase64, publicKeyBase64) {
  const canonical = JSON.stringify(requestBody, Object.keys(requestBody).sort());
  const messageBytes = new TextEncoder().encode(canonical);
  const signature = Buffer.from(signatureBase64, 'base64');
  const publicKey = Buffer.from(publicKeyBase64, 'base64');

  return ed25519.verify(signature, messageBytes, publicKey);
}
```

---

## Response Specification

### Success Response (200 OK)

```json
{
  "settlement_ref": "x402_01HXQ9JZAB4T7C8D9F0G1H2I3",
  "status": "settled",
  "timestamp": "2025-10-12T14:30:01.234Z"
}
```

**Fields:**

- `settlement_ref` - Unique reference for the settled payment (vendor-generated)
- `status` - Payment status: `settled` (immediate) or `pending` (async)
- `timestamp` - ISO 8601 timestamp of settlement

### Pending Response (202 Accepted)

For vendors that process payments asynchronously:

```json
{
  "settlement_ref": "x402_01HXQ9JZAB4T7C8D9F0G1H2I3",
  "status": "pending",
  "timestamp": "2025-10-12T14:30:01.234Z"
}
```

The agent gateway will poll the vendor or wait for a webhook to confirm settlement.

---

## Error Responses

### 400 Bad Request - Invalid Request

```json
{
  "error": "INVALID_REQUEST",
  "message": "Amount exceeds x402 maximum of 200",
  "details": {
    "amount": 250,
    "max_allowed": 200
  }
}
```

**Common Causes:**
- Amount > 200
- Missing required headers
- Invalid JSON body
- Malformed signature

### 401 Unauthorized - Signature Verification Failed

```json
{
  "error": "INVALID_SIGNATURE",
  "message": "Ed25519 signature verification failed",
  "details": {
    "public_key": "base64_encoded_key"
  }
}
```

### 402 Payment Required - Insufficient Funds or Mandate Expired

```json
{
  "error": "PAYMENT_REQUIRED",
  "message": "Mandate has expired",
  "details": {
    "mandate_id": "mdt_01HXQ9G8Z3S9O6X7Q4L2K5N1F0",
    "expired_at": "2025-10-12T10:00:00.000Z"
  }
}
```

### 409 Conflict - Duplicate Idempotency Key

```json
{
  "error": "DUPLICATE_REQUEST",
  "message": "Idempotency key already processed",
  "details": {
    "idempotency_key": "demo-003",
    "original_settlement_ref": "x402_01HXQ9JZAB4T7C8D9F0G1H2I3"
  }
}
```

**Behavior:** Vendors MUST return the original response for duplicate idempotency keys.

### 500 Internal Server Error - Vendor Processing Error

```json
{
  "error": "INTERNAL_ERROR",
  "message": "Failed to process payment"
}
```

### 504 Gateway Timeout - Request Timeout

Requests that take longer than 5 seconds should be aborted by the agent gateway.

---

## Security Considerations

### Replay Attack Prevention

1. **Timestamp Validation**: Reject requests with timestamps older than 5 minutes
2. **Idempotency Keys**: Store processed keys for 24 hours to prevent replays
3. **Signature Verification**: Always verify Ed25519 signature before processing

### Amount Validation

1. Verify `X-Payment-Amount` header matches request body `amount` field
2. Enforce maximum amount of 200 (reject anything higher)
3. Ensure amount is positive integer

### Rate Limiting

Vendors SHOULD implement rate limiting:
- **Per Agent:** 100 requests per 15 minutes
- **Per IP:** 1000 requests per hour

### Public Key Management

- Agents MUST register their public keys with vendors before first payment
- Vendors MUST validate public keys against a whitelist
- Public keys should be rotated quarterly

---

## Implementation Checklist

### Agent Gateway (Client)

- [ ] Generate Ed25519 keypair for agent
- [ ] Implement canonical JSON serialization
- [ ] Sign requests with Ed25519 private key
- [ ] Include all required headers
- [ ] Handle 5-second timeout
- [ ] Retry logic for 5xx errors (max 2 retries)
- [ ] Store settlement references

### Vendor API (Server)

- [ ] Verify Ed25519 signatures
- [ ] Validate timestamp (must be within 5 minutes)
- [ ] Enforce idempotency (store keys for 24 hours)
- [ ] Validate amount ≤ 200
- [ ] Return settlement reference
- [ ] Implement rate limiting
- [ ] Log all payment attempts (redact sensitive data)

---

## Example cURL Request

```bash
# Generate signature (pseudo-code)
SIGNATURE=$(sign_request '{"agent_id":"agt_test","amount":199,"currency":"USD","mandate_id":"mdt_test","timestamp":"2025-10-12T14:30:00.000Z","vendor":"acme_api"}' $PRIVATE_KEY)

# Send payment request
curl -X POST https://vendor.example.com/payment \
  -H "Content-Type: application/json" \
  -H "X-Payment-Amount: 199" \
  -H "X-Payment-Currency: USD" \
  -H "Idempotency-Key: unique-request-id-123" \
  -H "X-Signature: $SIGNATURE" \
  -H "X-Public-Key: $(base64 <<< $PUBLIC_KEY)" \
  -d '{
    "agent_id": "agt_test",
    "mandate_id": "mdt_test",
    "vendor": "acme_api",
    "amount": 199,
    "currency": "USD",
    "timestamp": "2025-10-12T14:30:00.000Z"
  }'
```

---

## Future Enhancements (Out of Scope for v1)

- **Webhooks** for async settlement notifications
- **Batch Payments** for multiple micro-transactions
- **Multi-Currency Support** with exchange rate oracle
- **Dispute Resolution** protocol
- **Subscription Models** for recurring payments

---

## References

- [Ed25519 Specification (RFC 8032)](https://tools.ietf.org/html/rfc8032)
- [ISO 4217 Currency Codes](https://www.iso.org/iso-4217-currency-codes.html)
- [HTTP Idempotency Key Header (Draft)](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Maintainer:** AP2 Development Team
