# Car Wash Booking System - Production Dockerfile for Render
# Multi-stage build for optimal production deployment

# ==============================================
# Stage 1: Dependencies Installation
# ==============================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --only=production; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ==============================================
# Stage 2: Build Application
# ==============================================
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client (required before build)
RUN npx prisma generate

# Build application with optimizations
RUN npm run build

# Compile TypeScript files for custom server
RUN npx tsc src/lib/websocket-server.ts --outDir src/lib/ --target es2020 --module commonjs --esModuleInterop --skipLibCheck || echo "TypeScript compilation failed, WebSocket features may be disabled"

# ==============================================
# Stage 3: Production Runtime
# ==============================================
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install runtime dependencies only
RUN apk add --no-cache \
    ca-certificates \
    curl \
    dumb-init \
    openssl

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy custom server and source files needed for WebSocket
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src/lib ./src/lib

# Copy Prisma schema and migrations for production deployments
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set ownership and permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check for Render
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Expose port
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application with custom server for WebSocket support
CMD ["node", "server.js"]