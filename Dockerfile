# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ gcc

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 3: Runner (Production)
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc6-compat \
    dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy additional runtime files
COPY --chown=nextjs:nodejs server.js ./
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs next.config.js ./
COPY --chown=nextjs:nodejs tsconfig.json ./

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/dmarc.db

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run entrypoint script
CMD ["./docker-entrypoint.sh"]
