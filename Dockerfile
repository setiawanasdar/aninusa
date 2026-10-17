# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# AniNusa web image (Next.js standalone)
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/source-adapters/package.json packages/source-adapters/package.json
COPY packages/services/package.json packages/services/package.json
COPY packages/player/package.json packages/player/package.json
RUN npm ci --ignore-scripts

FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-time-placeholder-build-time-placeholder"
RUN npx prisma generate --schema packages/database/prisma/schema.prisma \
  && npm run build -w @aninusa/web

# Migration runner: full toolchain, used by `docker compose run migrate`.
FROM deps AS migrator
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
CMD ["npx", "prisma", "migrate", "deploy", "--schema", "packages/database/prisma/schema.prisma"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
