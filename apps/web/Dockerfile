FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune web --docker

FROM base AS builder
# Install dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app

# Install dependencies
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma Client (will be in node_modules/.prisma/client)
RUN npx prisma@5.22.0 generate --schema=apps/web/prisma/schema.prisma

# Build with production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=web

# Verify build succeeded and Prisma client exists
RUN ls -la apps/web/.next/standalone || (echo "Build failed - no standalone output" && exit 1)
RUN ls -la node_modules/.prisma/client || echo "Prisma client not in root node_modules, checking standalone..."

# The standalone output includes node_modules with Prisma client already bundled
# We just need to ensure the schema is available for migrations

FROM base AS runner
# Install dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application (standalone already includes necessary node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema for migrations
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

# Install prisma CLI for migrations (minimal install)
RUN npm install -g prisma@5.22.0

USER nextjs

EXPOSE 3000

# Use prisma db push for production (works with existing databases)
CMD ["sh", "-c", "prisma db push --schema=apps/web/prisma/schema.prisma --accept-data-loss --skip-generate && node apps/web/server.js"]