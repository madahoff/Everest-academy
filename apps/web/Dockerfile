FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl ca-certificates

# Copy manifest files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start development server with schema sync
CMD ["sh", "-c", "npx prisma db push --skip-generate && pnpm dev"]

