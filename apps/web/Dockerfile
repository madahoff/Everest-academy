FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune web --docker

FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# First copy pruned json to install dependencies (layer caching)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --ignore-scripts

# Copy pruned source and build
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma Client (needed for build)
RUN pnpm prisma generate --schema=apps/web/prisma/schema.prisma

# Environment variables for build time
ENV NODE_ENV=production
RUN pnpm run build --filter=web

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Copy schema for runtime db sync if needed
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma

USER nextjs

EXPOSE 3000

# Script to sync DB and start server
CMD ["sh", "-c", "npx prisma db push --schema=apps/web/prisma/schema.prisma --skip-generate && node server.js"]
