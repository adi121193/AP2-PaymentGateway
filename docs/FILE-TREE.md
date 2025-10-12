# AP2 Payment Gateway - Complete File Structure

```
AP2-PaymentGateway/
├── apps/
│   └── api/                              # Express HTTP server
│       ├── src/
│       │   ├── routes/                   # API endpoint handlers
│       │   │   ├── purchase-intents.ts   # POST /purchase-intents
│       │   │   ├── mandates.ts           # POST /mandates
│       │   │   ├── execute.ts            # POST /execute
│       │   │   ├── receipts.ts           # GET /receipts/:id
│       │   │   └── webhooks/
│       │   │       └── stripe.ts         # POST /webhooks/stripe
│       │   ├── middleware/               # Request processing
│       │   │   ├── auth.ts               # JWT/API key authentication
│       │   │   ├── idempotency.ts        # Idempotency-Key enforcement
│       │   │   └── error-handler.ts      # Global error handling
│       │   ├── services/                 # Business logic
│       │   │   ├── policy-gate.ts        # Policy validation service
│       │   │   ├── mandate-signer.ts     # Ed25519 signing service
│       │   │   └── receipt-chain.ts      # Hash chain service
│       │   ├── app.ts                    # Express app setup
│       │   └── index.ts                  # Entry point
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── domain/                           # Shared types and schemas
│   │   ├── src/
│   │   │   ├── types.ts                  # ✅ Zod schemas (Intent, Mandate, Policy, Receipt, etc.)
│   │   │   ├── env.ts                    # ✅ Environment variable validation
│   │   │   ├── api-contracts.ts          # ✅ Response wrappers, error codes
│   │   │   └── index.ts                  # ✅ Package exports
│   │   ├── package.json                  # ✅
│   │   └── tsconfig.json
│   │
│   ├── database/                         # Prisma client
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # ✅ Complete database schema
│   │   │   └── seed.ts                   # Test data seeding script
│   │   ├── src/
│   │   │   ├── client.ts                 # ✅ Prisma client singleton
│   │   │   └── index.ts                  # ✅ Package exports
│   │   ├── package.json                  # ✅
│   │   └── tsconfig.json
│   │
│   ├── rails/                            # Payment provider adapters
│   │   ├── src/
│   │   │   ├── interface.ts              # ✅ RailAdapter interface
│   │   │   ├── stripe.ts                 # ✅ Stripe Payment Intents adapter
│   │   │   ├── x402.ts                   # ✅ x402 protocol adapter
│   │   │   ├── router.ts                 # ✅ Rail selection heuristic
│   │   │   └── index.ts                  # ✅ Package exports
│   │   ├── package.json                  # ✅
│   │   └── tsconfig.json
│   │
│   └── receipts/                         # Hash chain helpers
│       ├── src/
│       │   ├── chain.ts                  # ✅ Hash generation and verification
│       │   └── index.ts                  # ✅ Package exports
│       ├── package.json                  # ✅
│       └── tsconfig.json
│
├── infra/                                # Infrastructure configuration
│   ├── docker/
│   │   └── Dockerfile                    # ✅ Multi-stage production build
│   ├── railway/
│   │   └── railway.json                  # ✅ Railway deployment config
│   └── docker-compose.yml                # ✅ Local development stack
│
├── tests/                                # Test suites
│   ├── unit/                             # Unit tests for services
│   │   ├── policy-gate.test.ts
│   │   ├── mandate-signer.test.ts
│   │   ├── receipt-chain.test.ts
│   │   └── rails-router.test.ts
│   ├── integration/                      # Integration tests for endpoints
│   │   ├── purchase-intents.test.ts
│   │   ├── mandates.test.ts
│   │   ├── execute.test.ts
│   │   ├── receipts.test.ts
│   │   └── idempotency.test.ts
│   ├── e2e/                              # End-to-end scenarios
│   │   └── policy-limits.test.ts
│   └── setup.ts                          # Test environment setup
│
├── docs/                                 # Documentation
│   ├── 01-architecture.md                # ✅ Complete system architecture with Mermaid diagrams
│   ├── x402-protocol.md                  # ✅ x402 protocol specification
│   ├── IMPLEMENTATION-NOTES.md           # ✅ Design decisions and trade-offs
│   ├── openapi.yaml                      # OpenAPI 3.0 specification (to be generated)
│   ├── devlog.md                         # Development log and changelog
│   └── demo/
│       └── commands.md                   # Demo script with cURL commands
│
├── .env.template                         # ✅ Environment variables template
├── .gitignore                            # ✅ Git ignore rules
├── package.json                          # ✅ Root workspace configuration
├── tsconfig.json                         # ✅ Base TypeScript configuration
├── README.md                             # ✅ Project overview and quick start
└── CLAUDE.md                             # ✅ Development guidelines (existing)
```

## Legend

- ✅ = File created with complete, production-ready content
- Empty = Placeholder directory for implementation
- (to be generated) = Will be created during implementation phase

## File Count Summary

**Created Files:** 30
- Schemas: 1 (Prisma)
- Types: 3 (Zod, Env, API Contracts)
- Implementations: 7 (Database client, Rails adapters, Hash chain)
- Configuration: 9 (package.json files, tsconfig, Docker, Railway)
- Documentation: 5 (Architecture, x402 spec, Implementation notes, README, env template)
- Infrastructure: 5 (Dockerfile, docker-compose, Railway config, gitignore)

**Placeholder Directories:** 7
- Route handlers (5 files to implement)
- Middleware (3 files to implement)
- Services (3 files to implement)
- Tests (10+ test files to implement)
- API entry points (app.ts, index.ts)
- Demo scripts

**Total LOC (Lines of Code):**
- Prisma Schema: ~150 lines
- Zod Types: ~200 lines
- Environment Validation: ~70 lines
- API Contracts: ~200 lines
- Database Client: ~30 lines
- Rails Adapters: ~250 lines
- Hash Chain: ~100 lines
- Documentation: ~2,000 lines

**Estimated Implementation LOC:**
- Route Handlers: ~500 lines
- Middleware: ~300 lines
- Services: ~400 lines
- Tests: ~1,000 lines
- Total Project: ~3,200 lines (excluding tests)

## Key Architectural Files

### 1. Database Schema
**File:** `/Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway/prisma/schema.prisma`

Defines 8 models:
- Agent (agents with risk tiers)
- Policy (spending policies)
- PurchaseIntent (payment requests)
- Mandate (signed approvals)
- Payment (executed transactions)
- Receipt (hash chain records)
- Idempotency (duplicate prevention)
- VendorX402Endpoint (x402 configurations)

### 2. Type Definitions
**File:** `/Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway/packages/domain/src/types.ts`

Defines 15+ Zod schemas with TypeScript type inference:
- PurchaseIntentSchema
- PolicySchema
- MandateSchema
- ReceiptSchema
- X402PaymentRequestSchema
- And more...

### 3. Payment Rails
**Directory:** `/Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway/packages/rails/src/`

Three adapters:
- **stripe.ts** - Stripe Payment Intents integration
- **x402.ts** - Custom x402 protocol implementation
- **router.ts** - Intelligent rail selection heuristic

### 4. Architecture Documentation
**File:** `/Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway/docs/01-architecture.md`

Includes:
- 5 Mermaid diagrams (primary flow, policy gate, routing, hash chain, idempotency)
- Technology stack justification
- Security architecture
- Scalability plan
- Deployment guide

### 5. x402 Protocol Specification
**File:** `/Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway/docs/x402-protocol.md`

Complete specification:
- Request/response formats
- Ed25519 signature generation
- Error codes
- Security considerations
- Example implementations

## Next Steps for Implementation

1. **Install Dependencies**
   ```bash
   cd /Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.template .env
   # Edit .env and replace all TODO(human) placeholders
   ```

3. **Generate Prisma Client**
   ```bash
   npm run db:generate
   ```

4. **Create Database Migration**
   ```bash
   npm run db:migrate
   ```

5. **Implement Route Handlers**
   - Start with `apps/api/src/routes/purchase-intents.ts`
   - Follow patterns from architecture documentation

6. **Implement Services**
   - Policy gate logic
   - Mandate signing
   - Receipt chain generation

7. **Write Tests**
   - Unit tests for services (90% coverage target)
   - Integration tests for endpoints
   - E2E tests for complete flows

8. **Deploy**
   ```bash
   docker-compose up -d  # Local testing
   railway up            # Production deployment
   ```

## Important Notes

- All secrets use `TODO(human)` placeholders - NEVER commit real keys
- Stripe test mode ONLY (sk_test_ prefix enforced)
- x402 maximum amount: 200 (enforced in environment schema)
- Database indexes optimized for query patterns
- Receipt hash chain uses SHA256 with canonical JSON
- Mandate signatures use Ed25519 from @noble/curves
