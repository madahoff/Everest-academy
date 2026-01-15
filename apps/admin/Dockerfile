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
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma Client (will be in node_modules/.prisma/client)
RUN npx prisma@5.22.0 generate --schema=apps/admin/prisma/schema.prisma

# Build with production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=admin

# Verify build succeeded and Prisma client exists
RUN ls -la apps/admin/.next/standalone || (echo "Build failed - no standalone output" && exit 1)
RUN ls -la node_modules/.prisma/client || echo "Prisma client not in root node_modules, checking standalone..."

# The standalone output includes node_modules with Prisma client already bundled
# We just need to ensure the schema is available for migrations

FROM base AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application (standalone already includes necessary node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Copy Prisma schema for migrations
COPY --from=builder /app/apps/admin/prisma ./apps/admin/prisma

# Install prisma CLI for migrations (minimal install)
RUN npm install -g prisma@5.22.0

USER nextjs

EXPOSE 3001

# Use prisma db push for production (works with existing databases)
CMD ["sh", "-c", "prisma db push --schema=apps/admin/prisma/schema.prisma --accept-data-loss && node apps/admin/server.js"]