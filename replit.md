# AP2 Payment Gateway - Replit Configuration

## Project Overview
This is the AP2-Native Agent Payment Gateway - a policy-driven payment routing system for AI agents. The project is a monorepo containing:
- **Frontend**: Next.js 16 application (port 5000)
- **API**: Express.js backend (port 3001)
- **Packages**: Shared libraries for database, domain logic, payment rails, etc.

## Environment Setup

### Required Environment Variables
Add these to Replit Secrets:

1. **Database** (Auto-configured by Replit):
   - `DATABASE_URL` - PostgreSQL connection string

2. **Payment Providers**:
   - `CASHFREE_APP_ID` - Cashfree App ID (starts with TEST for sandbox)
   - `CASHFREE_SECRET_KEY` - Cashfree Secret Key (starts with TEST for sandbox)
   - `STRIPE_SECRET_KEY` - (Optional) Stripe test key (starts with sk_test_)
   - `STRIPE_WEBHOOK_SECRET` - (Optional) Stripe webhook secret (starts with whsec_)

3. **Cryptographic Keys** (Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`):
   - `MANDATE_SIGN_KEY` - Ed25519 private key (64+ chars hex)
   - `JWT_SECRET` - JWT authentication secret (32+ chars)

4. **Optional Configuration**:
   - `NODE_ENV` - Set to "production" for deployment (default: development)
   - `PORT` - API port (default: 3001)
   - `LOG_LEVEL` - Logging level: fatal|error|warn|info|debug|trace (default: info)
   - `ALLOWED_ORIGINS` - CORS origins (default: http://localhost:5000,http://localhost:3001)

### Additional .env Variables (non-secrets)
Create a `.env` file in the root with:
```
CASHFREE_ENV=sandbox
CASHFREE_API_VERSION=2025-01-01
CASHFREE_API_URL=https://sandbox.cashfree.com/pg
X402_TIMEOUT_MS=5000
X402_MAX_AMOUNT=200
ENABLE_REQUEST_LOGGING=true
ENABLE_DB_SEED=false
```

## Development

### Starting the Application
The Replit workflow automatically runs:
```bash
npm run dev:api & npm run dev
```
This starts both the API (port 3001) and frontend (port 5000).

### Database Setup
1. Prisma client is auto-generated during npm install
2. Schema is synced with: `npm run db:generate` and `npm run db:push`
3. For migrations: `npm run db:migrate`

### Testing
- Unit tests: `npm test`
- Type checking: `npm run typecheck:all`

## Deployment
Deployment is configured as a VM with:
- Build: `npm run build` (builds both API and frontend)
- Run: `npm run start & npm run start:frontend`

## Architecture Notes
- Monorepo structure using npm workspaces
- API runs on port 3001 (internal)
- Frontend runs on port 5000 (public-facing)
- PostgreSQL database via Replit's built-in database
- Payment processing via Cashfree (and optionally Stripe)

## Recent Changes
- **2025-10-27**: Marketplace fully operational with 10 demo agents
  - Fixed agent status migration: Changed 'approved' to 'active' throughout seed data
  - Updated API client default filter to match 'active' status (was 'approved')
  - Enhanced execution endpoint to return payment information (amount, currency, payment URL)
  - Verified complete execution flow: marketplace → agent selection → execution → payment
  - All 10 agents now visible in marketplace with correct pricing ($10-$25), categories, and ratings

- **2025-10-26**: Migrated from Vercel to Replit
  - Updated port configurations (frontend: 5000, API: 3001)
  - Configured Replit workflows for concurrent API + frontend execution
  - Set up Replit Secrets for API keys
  - Synced database schema with Prisma

## Demo Agents Available
The marketplace features 10 production-ready demo agents across multiple categories:
- **Automation**: Smart Image Optimizer, Workflow Automator
- **Data Enrichment**: Data Enrichment Agent, Company Intel Finder
- **Analytics**: Sentiment Analyzer, Report Generator
- **Outreach**: Email Outreach Engine, Social Media Manager
- **Content Generation**: Content Creator Pro
- **Research**: Research Assistant
