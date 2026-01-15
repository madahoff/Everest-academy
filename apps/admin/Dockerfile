FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune admin --docker

FROM base AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Install dependencies
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Copy source
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma Client
RUN pnpm prisma generate --schema=apps/admin/prisma/schema.prisma

# Build with production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=admin

# Verify build succeeded
RUN ls -la apps/admin/.next/standalone || (echo "Build failed - no standalone output" && exit 1)

FROM base AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Copy Prisma files
COPY --from=builder /app/apps/admin/prisma ./apps/admin/prisma
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client

USER nextjs

EXPOSE 3001

# Migration et démarrage
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/admin/prisma/schema.prisma && node apps/admin/server.js"]