# AP2-Native Agent Payment Gateway

A policy-driven payment routing system that enables autonomous agents to make secure, auditable micropayments through multiple payment rails (Stripe test mode and x402 protocol).

## Overview

The AP2 Payment Gateway enforces spending policies, generates cryptographic mandates, and maintains a tamper-proof receipt chain using SHA256 hashing.

**Status:** Test Mode Only - No production payments

## Key Features

- **Multi-Rail Payment Routing** - Automatically routes to Stripe or x402 based on amount and policy
- **Policy-First Enforcement** - Vendor allowlists, amount caps, daily limits
- **Cryptographic Mandates** - Ed25519-signed payment approvals
- **Receipt Hash Chain** - Tamper-proof audit trail per agent
- **Idempotent Operations** - Database-backed idempotency protection
- **Type-Safe** - Full TypeScript with Zod runtime validation

## Technology Stack

- **Framework:** Express 4.x
- **Database:** PostgreSQL 14+ with Prisma 5.x
- **Language:** TypeScript 5.x (strict mode)
- **Validation:** Zod
- **Cryptography:** @noble/curves (Ed25519), Node.js crypto (SHA256)
- **Payment Providers:** Stripe (test mode), x402 protocol

## Quick Start

### Prerequisites

- Node.js 20+ LTS
- PostgreSQL 14+
- npm 10+

### Installation

```bash
# Clone repository
cd AP2-PaymentGateway

# Install dependencies
npm install

# Copy environment template
cp .env.template .env

# Edit .env and replace all TODO(human) placeholders
# See .env.template for instructions

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed test data
npm run db:seed
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Type checking
npm run typecheck

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Project Structure

```
AP2-PaymentGateway/
├── apps/
│   └── api/                    # Express HTTP server
│       ├── src/
│       │   ├── routes/         # API endpoints
│       │   ├── middleware/     # Auth, idempotency, error handling
│       │   ├── services/       # Business logic
│       │   ├── app.ts          # Express setup
│       │   └── index.ts        # Entry point
│       └── package.json
├── packages/
│   ├── domain/                 # Shared types, schemas, contracts
│   │   └── src/
│   │       ├── types.ts        # Zod schemas
│   │       ├── env.ts          # Environment validation
│   │       └── api-contracts.ts
│   ├── database/               # Prisma client
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   ├── rails/                  # Payment provider adapters
│   │   └── src/
│   │       ├── stripe.ts
│   │       ├── x402.ts
│   │       └── router.ts
│   └── receipts/               # Hash chain utilities
│       └── src/
├── tests/                      # Unit, integration, E2E tests
├── docs/                       # Documentation
│   ├── 01-architecture.md      # System architecture
│   └── x402-protocol.md        # x402 specification
├── infra/                      # Docker, Railway configs
├── .env.template               # Environment variables template
└── package.json                # Root workspace config
```

## API Endpoints

### POST /purchase-intents

Create a payment intent with policy validation.

**Request:**
```json
{
  "agent_id": "agt_abc123",
  "vendor": "acme_api",
  "amount": 199,
  "currency": "USD",
  "description": "API enrichment call"
}
```

### POST /mandates

Issue a cryptographically signed mandate.

**Request:**
```json
{
  "intent_id": "intent_xyz",
  "policy_id": "pol_123"
}
```

### POST /execute

Execute payment through selected rail.

**Request:**
```json
{
  "mandate_id": "mdt_abc123"
}
```

### GET /receipts/:id

Retrieve receipt with hash chain proof.

## Payment Routing Logic

The system automatically selects the payment rail based on:

1. **Amount ≤ 200** AND **policy.x402_enabled = true** → x402
2. **risk_tier = HIGH** → Stripe (requires fraud detection)
3. **Default** → Stripe

See [docs/01-architecture.md](docs/01-architecture.md) for detailed flow diagrams.

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm test:coverage

# Run specific test file
npm test -- tests/unit/policy-gate.test.ts
```

**Test Coverage Target:** 90%+ on domain logic

## Documentation

- [Architecture Overview](docs/01-architecture.md) - System design, data flow, diagrams
- [x402 Protocol Specification](docs/x402-protocol.md) - Custom micropayment protocol
- [OpenAPI Specification](docs/openapi.yaml) - API contract (to be generated)

## Security

- All secrets managed via environment variables (no hardcoded keys)
- Ed25519 signatures for mandate authentication
- SHA256 hash chains for receipt integrity
- Idempotency protection against duplicate requests
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- Stripe webhook signature verification

## Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Docker

```bash
# Build image
docker build -t ap2-gateway .

# Run container
docker run -p 3000:3000 --env-file .env ap2-gateway
```

## Contributing

This is a test project for autonomous agent payment systems. Contributions should maintain:

- Type safety (strict TypeScript)
- Test coverage (90%+ on domain)
- Security-first design
- Clear documentation

## License

MIT

## Support

For questions or issues, see [CLAUDE.md](CLAUDE.md) for development guidelines.

---

**Version:** 1.0.0
**Status:** Test Mode Only
**Last Updated:** 2025-10-12
