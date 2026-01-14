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
EXPOSE 3001

# Start development server (ensure package.json dev script runs on 3001 or modify command)
CMD ["pnpm", "dev", "-p", "3001"]
