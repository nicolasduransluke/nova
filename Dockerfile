# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat openssl

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy all workspace package.json files so npm can resolve the dependency graph
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ui/package.json ./packages/ui/

RUN npm ci

COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the NestJS API
RUN cd apps/api && npx nest build

# Prune devDependencies to reduce image size
RUN npm prune --omit=dev

# ============================================
# Stage 2: Production runner
# ============================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules (already pruned to production)
COPY --from=builder /app/node_modules ./node_modules

# Copy root package.json for workspace resolution
COPY --from=builder /app/package.json ./

# Copy workspace package.json files for module resolution
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/utils/package.json ./packages/utils/
COPY --from=builder /app/packages/config/package.json ./packages/config/

# Copy compiled shared packages (pre-compiled .js files live alongside .ts in src/)
COPY --from=builder /app/packages/types/src ./packages/types/src
COPY --from=builder /app/packages/utils/src ./packages/utils/src

# Copy Prisma schema and generated client
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy API package.json and compiled dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy startup script
COPY apps/api/start.sh ./apps/api/start.sh
RUN chmod +x ./apps/api/start.sh

EXPOSE ${PORT:-3001}

CMD ["./apps/api/start.sh"]
