# Deployment

## Requirements

- Node.js 22 (Docker images use `node:22-alpine`)
- PostgreSQL 16+
- Redis 7 (recommended for multi-instance)
- HTTPS termination (reverse proxy, load balancer, or platform)
- Object storage/CDN only for media you are authorized to store

## Environment

Copy `.env.example` to `.env` and set at minimum:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | ???32 random chars (`openssl rand -base64 48`) |
| SITE_URL | yes | Server-side canonical HTTPS origin, no trailing slash |
| NEXT_PUBLIC_SITE_URL | build | Same origin, inlined at build for client-visible metadata |
| `REDIS_URL` | production | Enables shared cache/rate limits |
| `SESSION_COOKIE_NAME` | no | Default `aninusa_session` |
| `SESSION_TTL_DAYS` | no | Default 7 |
| `COOKIE_SECURE` | no | Leave unset in production (Secure cookies). Set `false` only for local HTTP smoke tests |
| `SUBTITLE_HOST_ALLOWLIST` | when proxying | Comma-separated official subtitle hosts |
| `SEED_ADMIN_*` | seed only | Change before running the seed |
| `SOURCE_HEALTH_INTERVAL_MINUTES` | worker | Default 15 |
| `SYNC_INTERVAL_MINUTES` | worker | Default 360 |

Never expose `DATABASE_URL`, `AUTH_SECRET`, provider credentials, or storage keys to the browser. Only `NEXT_PUBLIC_*` values are public.

## Docker Compose (single host)

```bash
cp .env.example .env
# edit AUTH_SECRET, SEED_ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL

docker compose up -d --build
docker compose run --rm seed     # first deploy only
```

What happens:

1. `postgres` and `redis` start with health checks.
2. `migrate` applies committed Prisma migrations; `web` waits for it to complete.
3. `web` runs the Next standalone server on port 3000.
4. `worker` runs ingestion/health jobs and exposes `:4001/healthz`.

The web image copies `apps/web/public` and `.next/static` into the standalone layout, so local art and subtitles are served correctly.

### Compose behind a reverse proxy

Terminate TLS at Nginx/Caddy/Traefik and forward to `web:3000`. Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS URL so canonical URLs, OpenGraph, cookies and same-origin checks are correct. Do not forward untrusted `Origin` headers from other hosts.

## Manual / platform deployment

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm start            # or: node apps/web/.next/standalone/apps/web/server.js
```

Worker:

```bash
npm run start -w @aninusa/worker    # tsx apps/worker/src/index.ts
```

If you deploy the standalone output directly, also copy:

```
apps/web/.next/static  ??? <standalone>/apps/web/.next/static
apps/web/public        ??? <standalone>/apps/web/public
```

## Migrations

- Development: `npm run db:migrate` (creates a migration).
- Production: `npm run db:deploy` (applies only).
- Never run `migrate dev` against production.
- Back up before applying destructive migrations.

## Health checks

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Web + DB + cache; 503 when degraded |
| `GET :4001/healthz` | Worker uptime and last task status |
| `POST :4001/run/health` | Trigger a health sweep (protect at the network layer) |
| `POST :4001/run/sync` | Trigger scheduled sync |

## Scaling

- **Web:** stateless; run N replicas behind a load balancer. Requires Redis so cache invalidation and rate limits are shared.
- **Worker:** run exactly one instance per environment unless you add a distributed lock (the sync job guard is per-database but health sweeps are independent).
- **Postgres:** start with 2 vCPU/4 GB for tens of thousands of episodes; add read replicas only if catalog reads dominate. Keep the FTS/trigram indexes warm.
- **Media:** serve authorized assets from object storage + CDN. Store URLs in `VideoSource`; never store binaries in the database.

## Backups and retention

- Daily `pg_dump` or managed snapshots; test restores quarterly.
- Redis is a cache, not a source of truth. Loss is safe.
- Trim `SourceHealthCheck` (>90 days) and `AuditLog` (>1 year) on a schedule if volume grows.

## Security checklist

- [ ] Unique `AUTH_SECRET`, rotated on incident.
- [ ] HTTPS only; HSTS enabled by `next.config.mjs`.
- [ ] Admin password changed from the seed default.
- [ ] Redis not publicly exposed.
- [ ] Postgres not publicly exposed.
- [ ] `SUBTITLE_HOST_ALLOWLIST` contains only official hosts.
- [ ] Reverse proxy limits request body size and rate.
- [ ] `/admin` and `/api/admin/*` reachable only through the app (no static bypass).
- [ ] Logs shipped somewhere durable; secrets are redacted by the logger.
- [ ] Source sync enabled only for providers that permit automated access.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Invalid environment configuration` | Missing `DATABASE_URL`/`AUTH_SECRET` | Set env vars; restart |
| 500 on every page | Migrations not applied | `npm run db:deploy` |
| Login succeeds but session doesn't stick | Secure cookie over HTTP | Use HTTPS, or set `COOKIE_SECURE=false` for local smoke tests |
| Images return 400 | SVG optimization disabled | Ensure `dangerouslyAllowSVG: true` is present |
| Subtitles blocked | Host not allowlisted | Add the official host to `SUBTITLE_HOST_ALLOWLIST` |
| Sync `FAILED` with 403 | Provider denies automated access | Do not bypass; integrate via official API or disable the provider |
| Broken sources still visible | Cached playback payload | Wait 30s or clear `catalog:*` cache |

