FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install deps
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/prisma/package*.json ./packages/prisma/
COPY packages/shared-types/package*.json ./packages/shared-types/
RUN npm ci --workspace=@empleado-ia/api

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate --workspace=@empleado-ia/prisma
RUN npm run build --workspace=@empleado-ia/api

# Production image
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/main"]
