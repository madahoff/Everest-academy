FROM node:20-slim AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune web --docker

FROM node:20-slim AS installer
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app
COPY --from=pruner /app/out/json .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/turbo.json ./turbo.json
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile --ignore-scripts

ENV NEXT_TELEMETRY_DISABLED=1

FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full .
RUN npm install -g pnpm

# Generate Prisma Client
RUN npx prisma@5.22.0 generate --schema=apps/web/prisma/schema.prisma

# Build the Next.js application
ENV NODE_ENV=production
RUN pnpm turbo run build --filter=web

FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security BEFORE copying files
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application (standalone already includes necessary node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema for migrations
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

# Install prisma CLI for migrations (minimal install)
RUN npm install -g prisma@5.22.0

# Switch to nextjs user
USER nextjs

EXPOSE 3000

# Use prisma db push for production (works with existing databases)
CMD ["sh", "-c", "prisma db push --schema=apps/web/prisma/schema.prisma --accept-data-loss --skip-generate && node apps/web/server.js"]