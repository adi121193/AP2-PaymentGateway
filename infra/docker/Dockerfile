# AP2 Payment Gateway - Multi-stage Docker Build

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/domain/package.json ./packages/domain/
COPY packages/database/package.json ./packages/database/
COPY packages/rails/package.json ./packages/rails/
COPY packages/receipts/package.json ./packages/receipts/
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npm run db:generate

# Build TypeScript
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/rails/dist ./packages/rails/dist
COPY --from=builder /app/packages/receipts/dist ./packages/receipts/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

USER expressjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "apps/api/dist/index.js"]
