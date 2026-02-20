FROM node:lts-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune admin --docker

FROM node:lts-alpine AS installer
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev libc6-compat
COPY --from=pruner /app/out/json .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/turbo.json ./turbo.json
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile --ignore-scripts

ENV NEXT_TELEMETRY_DISABLED=1

FROM node:lts-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev libc6-compat
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full .
RUN npm install -g pnpm

# Generate Prisma Client
RUN npx prisma@5.22.0 generate --schema=apps/admin/prisma/schema.prisma

# Build the Next.js application
ENV NODE_ENV=production
RUN pnpm turbo run build --filter=admin

FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Install system dependencies (OpenSSL for Prisma, curl for health checks)
RUN apk add --no-cache curl openssl openssl-dev libc6-compat

# Create non-root user for security BEFORE copying files
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application (standalone already includes necessary node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Copy Prisma schema for migrations
COPY --from=builder /app/apps/admin/prisma ./apps/admin/prisma

# Symlink public directory to root for Next.js to serve static files
RUN ln -s /app/apps/admin/public /app/public

# Create uploads directory with proper permissions for the nextjs user
RUN mkdir -p /app/apps/admin/public/uploads/videos \
    && mkdir -p /app/apps/admin/public/uploads/images \
    && mkdir -p /app/apps/admin/public/uploads/misc \
    && chown -R nextjs:nodejs /app/apps/admin/public/uploads

# Install prisma CLI for migrations (minimal install)
RUN npm install -g prisma@5.22.0

EXPOSE 3001

# Use prisma db push for production (works with existing databases)
# Run as root to fix permissions, then switch to nextjs user
CMD ["sh", "-c", "mkdir -p /app/apps/admin/public/uploads && chown -R nextjs:nodejs /app/apps/admin/public/uploads && runuser -u nextjs -- sh -c 'prisma db push --schema=apps/admin/prisma/schema.prisma --accept-data-loss --skip-generate && node apps/admin/server.js'"]