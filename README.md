# AniNusa

A production-grade anime streaming platform for Indonesian audiences: Indonesian subtitles, multiple qualities up to 1080p, a from-scratch HLS player, catalog search, watch history, and a provider-agnostic ingestion pipeline.

> **Legal scope.** AniNusa only streams media that is legally accessible, licensed, public-domain, user-owned, or otherwise authorized for embedding. The bundled demo catalog uses Blender Foundation open movies (CC BY). The provider layer fails closed for services that prohibit automated access. Nothing in this repository bypasses DRM, authentication, paywalls, CAPTCHAs, robots restrictions, or anti-bot controls.

---

## What is included

| Area | Implementation |
| --- | --- |
| Web app | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS |
| API | Route Handlers under `/api` (REST, JSON envelope, Zod validation) |
| Database | PostgreSQL 16 + Prisma 6 (migrations, indexes, FTS + trigram search) |
| Cache | Redis (optional) with in-process fallback and single-flight dedupe |
| Player | Custom `@aninusa/player` package: HLS (hls.js), lazy DASH (dash.js), subtitles, quality, speed, PiP, theater, shortcuts |
| Ingestion | Adapter registry, scheduled/manual sync, retries, rate limiting, idempotent upserts |
| Matching | Normalized title + external ID + year/episode confidence scoring |
| Health | Background worker checks authorized sources/subtitles; broken rows are hidden |
| Auth | Email/password, bcrypt (cost 12), signed HttpOnly session cookies + DB-backed sessions |
| Admin | Dashboard, catalog CRUD, episode/source/subtitle management, provider sync, users, health |
| SEO | SSR, metadata, OpenGraph/Twitter, JSON-LD, sitemap, robots, canonical URLs |
| Deployment | Multi-stage Dockerfiles, Docker Compose, standalone Next output, worker service |
| Tests | Vitest: unit, API, player, auth, optional database integration suite |

## Repository layout

```
apps/
  web/                     Next.js application (UI + REST API)
  worker/                  Background ingestion + source-health worker
packages/
  types/                   Shared domain types, Zod schemas, API contracts
  utils/                   Slugs, matching, subtitles, cache, rate limit, logging
  database/                Prisma schema, generated client, migrations, seed, ingest
  source-adapters/         Provider interfaces + AniList/Open Media adapters
  services/                Ingestion orchestration + source health checks
  player/                  Custom media player (React + hls.js)
docs/                      Architecture, API, providers, player, admin, deployment, testing
```

## Quick start (local)

Requirements: Node.js 20.11+, PostgreSQL 16+, npm 10+. Redis is optional.

```bash
cp .env.example .env
# edit DATABASE_URL, AUTH_SECRET (>= 32 chars), SEED_ADMIN_PASSWORD

npm install
npm run db:generate
npm run db:migrate        # creates the schema
npm run db:seed           # open-media catalog + admin user
npm run dev               # http://localhost:3000
```

Optional worker (source health + scheduled sync):

```bash
npm run dev:worker        # health server on http://localhost:4001/healthz
```

The seed creates an admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Change the password before any deployment. The bundled open-media catalog is always seeded; AniList metadata is seeded when `SEED_ANILIST=true` and the public API is reachable.

### Local without Redis

Leave `REDIS_URL` empty. The app uses a bounded in-process cache. This is fine for a single instance; use Redis for multi-instance deployments so cache invalidation and rate limits are shared.

## Docker Compose

```bash
cp .env.example .env
# set AUTH_SECRET and SEED_ADMIN_PASSWORD
docker compose up -d --build
docker compose run --rm migrate     # if not using the automatic migrate service
docker compose run --rm seed        # optional: catalog + admin
```

Services: `postgres`, `redis`, `migrate`, `web` (port 3000), `worker` (port 4001). `seed` runs under the `seed` profile. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run dev:worker` | Ingestion/health worker in watch mode |
| `npm run build` | Generate Prisma client and build the web app |
| `npm start` | Start the production build |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit/API/player/auth suites |
| `npm run test:db` | Database integration suite (requires `TEST_DATABASE_URL`) |
| `npm run db:migrate` | Create/apply dev migrations |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed catalog, providers and admin |
| `npm run db:studio` | Prisma Studio |

## Demo catalog and subtitles

The seeded catalog contains three Blender Foundation open movies:

- *Big Buck Bunny* (CC BY 3.0)
- *Sintel* (CC BY 3.0)
- *Elephants Dream* (CC BY 2.5)

Streams point at the studios'/maintainers' public test endpoints. Subtitle files in `apps/web/public/subtitles` are original audio-description captions written for this project (CC0), not transcriptions of copyrighted dialogue.

AniList is used only through its official public GraphQL API for metadata. No video is sourced from AniList.

## Documentation

- [Architecture and decisions](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API reference](docs/API.md)
- [Provider adapters and compliance](docs/PROVIDERS.md)
- [Media player](docs/PLAYER.md)
- [Admin guide](docs/ADMIN.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)

## Security summary

- Passwords hashed with bcrypt (cost 12); never stored or logged in plaintext.
- Sessions are signed JWTs in `HttpOnly`, `SameSite=Lax`, `Secure` cookies, backed by a revocable `Session` table.
- State-changing APIs enforce same-origin requests; middleware gates `/admin` and `/profile` before rendering.
- Every admin page repeats the authorization check because Next renders layouts and pages in parallel.
- Zod validates every request body and query.
- Prisma parameterizes SQL; the only raw SQL is parameterized full-text search.
- Per-IP rate limits on public, auth and progress endpoints.
- Secrets stay server-side; only `NEXT_PUBLIC_*` values reach the browser.
- Health checks and the subtitle proxy refuse private/loopback targets and unlisted hosts.
