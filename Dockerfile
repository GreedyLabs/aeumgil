# syntax=docker/dockerfile:1

# ---------- base ----------
# Pinned Node 24 (current Active LTS; satisfies package.json engines ">=20") on Alpine.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- deps ----------
# Install dependencies separately so they cache unless a manifest/lockfile changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @eumgil/web build

# ---------- runner ----------
# Ship only the Next.js standalone output — no source, no dev dependencies.
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    EUMGIL_CACHE_DIR=/app/cache
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# standalone bundle keeps the monorepo layout (apps/web/server.js + traced node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

RUN mkdir -p /app/cache && chown nextjs:nodejs /app/cache

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
