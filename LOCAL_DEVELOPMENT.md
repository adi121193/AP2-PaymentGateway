# Local Development Guide

## Quick Start

### Frontend (Next.js)
```bash
cd apps/frontend
npm install
npm run dev
```
Open http://localhost:3000

### Backend API (Express)
```bash
cd apps/api
npm install
npm run dev
```
API runs on http://localhost:3000

### Full Monorepo
```bash
# From project root
npm install

# Run frontend dev server
npm run dev:frontend

# Run API dev server (default)
npm run dev

# Run both (parallel)
npm run dev:all
```

## Build Commands

### Build Everything
```bash
npm run build
```
This runs both `build:api` and `build:frontend` sequentially.

### Build API Only
```bash
npm run build:api
```
Compiles TypeScript to `dist/apps/api/`

### Build Frontend Only
```bash
npm run build:frontend
```
Creates optimized Next.js build in `apps/frontend/.next/`

## Production Builds

### Start API
```bash
npm run start
```

### Start Frontend
```bash
npm run start:frontend
```

## TypeScript

### Type Check
```bash
# Backend only (root tsconfig)
npm run typecheck

# Frontend + Backend
npm run typecheck:all
```

**Important:** Root `tsconfig.json` excludes `apps/frontend/**/*` because Next.js manages its own TypeScript configuration.

## Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (development)
npm run db:migrate

# Run migrations (production)
npm run db:migrate:deploy

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Code Quality

```bash
# Lint
npm run lint

# Format code
npm run format
```

## Workspace Structure

```
AP2-PaymentGateway/
├── apps/
│   ├── api/          # Backend Express/Hono API
│   └── frontend/     # Next.js 16 frontend
├── packages/
│   ├── agent-runtime/
│   ├── database/     # Prisma schema
│   ├── domain/       # Shared types
│   ├── rails/        # Payment adapters
│   └── receipts/     # Receipt utilities
└── tests/            # Integration tests
```

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CASHFREE_APP_ID=TEST...
CASHFREE_SECRET_KEY=TEST...
MANDATE_SIGN_KEY=<64-char-hex>
JWT_SECRET=<32-char-secret>
```

See `.env.example` in each workspace for complete list.

## Common Issues

### "Cannot find module '@ap2/...'"
Run `npm install` from the **root directory** to install all workspace dependencies.

### TypeScript errors in frontend when building from root
This is normal - root tsconfig excludes frontend. Build frontend separately:
```bash
npm run build:frontend
```

### Port already in use
API and frontend both default to port 3000. Run them separately or change ports:
```bash
# Frontend on different port
cd apps/frontend
PORT=3001 npm run dev
```

### Database connection errors
1. Ensure PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Run migrations: `npm run db:migrate`

## Development Workflow

1. **Start with frontend:**
   ```bash
   npm run dev:frontend
   ```

2. **In another terminal, start API:**
   ```bash
   npm run dev
   ```

3. **Make changes** - both have hot reload enabled

4. **Before committing:**
   ```bash
   npm run typecheck:all
   npm run lint
   npm test
   ```

## Architecture Notes

- **Monorepo:** Uses npm workspaces
- **TypeScript:** Separate configs for frontend (Next.js) and backend (root)
- **Frontend:** Next.js 16 with standalone output for Docker
- **Backend:** Express with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Payment Rails:** Stripe + Cashfree adapters

## Getting Help

- Check `CLAUDE.md` for project mission and principles
- Review `docs/` for architecture documentation
- See workspace-specific READMEs in `apps/*/README.md`

---

**Last Updated:** 2025-10-26
