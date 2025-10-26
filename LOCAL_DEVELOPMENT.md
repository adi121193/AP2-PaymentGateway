# Local Development Guide

## WHERE TO RUN COMMANDS

**IMPORTANT:** This project uses npm workspaces. Different commands run from different directories:

| Command | Run From | What It Does |
|---------|----------|--------------|
| `npm run dev` | `apps/frontend/` | Start ONLY frontend |
| `npm run dev:frontend` | **PROJECT ROOT** | Start ONLY frontend (from root) |
| `npm run dev` | **PROJECT ROOT** | Start ONLY backend API |
| `npm run dev:all` | **PROJECT ROOT** | Start BOTH frontend + backend |

**Rule of thumb:**
- In a workspace directory (`apps/frontend/`, `apps/api/`) → use simple `npm run dev`
- In project root → use specific commands like `dev:frontend`, `dev:all`

---

## Quick Start

### Option 1: Frontend Only (Recommended for UI work)
```bash
# From apps/frontend/ directory
cd apps/frontend
npm run dev
```
OR from project root:
```bash
# From project root
npm run dev:frontend
```
Open http://localhost:3000

### Option 2: Backend API Only
```bash
# From apps/api/ directory
cd apps/api
npm run dev
```
OR from project root:
```bash
# From project root
npm run dev
```
API runs on http://localhost:3000

### Option 3: Full Stack (Frontend + Backend)
```bash
# MUST run from project root
cd /Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway
npm run dev:all
```
This runs both servers in parallel (requires 2 different ports)

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

## Process Management

**New helper scripts** to manage running processes:

```bash
# Check what's running on ports 3000 and 3001
npm run ps

# Kill process on port 3001 (backend)
npm run dev:clean

# Kill processes on both ports 3000 and 3001
npm run dev:clean:all

# Kill and restart backend
npm run dev:restart

# Kill and restart both frontend + backend
npm run dev:restart:all
```

**When to use:**
- Use `npm run ps` when you're not sure if services are running
- Use `npm run dev:restart` to safely restart the backend
- Use `npm run dev:restart:all` to restart everything cleanly

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

### "Missing script: dev:all" error
**Cause:** You're running `npm run dev:all` from a workspace directory (like `apps/frontend/`)

**Fix:** Either:
1. Run simple command from current directory: `npm run dev`
2. OR navigate to project root first:
   ```bash
   cd /Users/blaknwhite/Downloads/AP2/AP2-code/AP2-PaymentGateway
   npm run dev:all
   ```

### "Cannot find module '@ap2/...'"
Run `npm install` from the **root directory** to install all workspace dependencies.

### TypeScript errors in frontend when building from root
This is normal - root tsconfig excludes frontend. Build frontend separately:
```bash
npm run build:frontend
```

### Port already in use

**Error**: `EADDRINUSE` or "Port already in use"

**Cause**: Another process is already running on the required port.
- Backend API runs on port **3001** (configured in `.env`)
- Frontend runs on port **3000** (Next.js default)

**Quick Fix:**

```bash
# Kill processes and restart backend
npm run dev:restart

# Kill processes and restart both services
npm run dev:restart:all

# Just check what's running
npm run ps
```

**Manual Fix:**

```bash
# 1. Find the process using the port
lsof -i :3001  # for backend
lsof -i :3000  # for frontend

# 2. Kill the process (replace <PID> with actual PID from above)
kill <PID>

# 3. If process won't die, force kill
kill -9 <PID>

# 4. Restart your service
npm run dev
```

**Prevention:**
- Always use `Ctrl+C` to stop development servers properly
- Use `npm run dev:restart` instead of `npm run dev` if you're unsure
- Check `npm run ps` before starting services

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
