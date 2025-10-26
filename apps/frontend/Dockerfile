# Multi-stage build for Next.js 16 on Railway
# This Dockerfile bypasses monorepo detection by building only the frontend

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --include=dev

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all frontend source files
COPY . .

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (Next.js creates apps/frontend structure)
COPY --from=builder /app/.next/standalone ./
# Copy static files to the correct location
COPY --from=builder /app/.next/static ./apps/frontend/.next/static
# Copy public files
COPY --from=builder /app/public ./apps/frontend/public

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port (Railway will set PORT env var)
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start from the frontend directory
WORKDIR /app/apps/frontend
CMD ["node", "server.js"]
