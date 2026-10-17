# Architecture

## Goals

1. Keep anime metadata, playback sources, subtitles, user state, and recommendations independent.
2. Never hard-code a streaming provider into the UI.
3. Make unauthorized content structurally impossible to ingest: providers declare whether automated access is permitted, and the engine fails closed.
4. Stay fast at thousands of titles on a single PostgreSQL instance, while leaving a clear path to Redis, a dedicated search engine, and object storage/CDN.

## Runtime topology

```
Browser
  │  HTML/RSC + JSON
  ▼
Next.js (apps/web)
  ├── Server Components  → catalog reads (Prisma + cache)
  ├── Route Handlers     → REST API, auth, admin
  ├── Middleware (edge)  → early /admin and /profile gate (JWT signature + role)
  └── /api/subtitles     → allowlisted subtitle proxy
        │
        ├── PostgreSQL 16 (source of truth)
        └── Redis (cache + rate limits, optional)

Worker (apps/worker)
  ├── scheduled provider sync   → packages/services/ingestion
  ├── source health sweep       → packages/services/health
  └── HTTP health server (:4001)
```

## Package boundaries

| Package | Responsibility | Depends on |
| --- | --- | --- |
| `@aninusa/types` | Domain enums, DTOs, Zod schemas, provider-normalized contracts | zod |
| `@aninusa/utils` | Slugs, title normalization/matching, subtitle parsing, cache, rate limit, logger | types |
| `@aninusa/database` | Prisma schema/client, migrations, seed, idempotent ingest | types, utils |
| `@aninusa/source-adapters` | `MetadataProvider` / `VideoProvider` / `SubtitleProvider` interfaces and adapters | types, utils |
| `@aninusa/services` | Ingestion jobs, retry/backoff, health probes | database, adapters |
| `@aninusa/player` | Framework-agnostic React player | hls.js, utils |
| `apps/web` | UI, API routes, auth, admin | all packages |
| `apps/worker` | Long-running jobs | services |

The UI imports **DTOs only**. It never imports a provider adapter. `GET /api/episode/:id/sources` strips the `provider` field from the response so the browser cannot learn where a stream originates.

## Key decisions

### 1. REST Route Handlers, not tRPC

REST keeps the API usable by native clients, the worker, and third-party integrations, and it maps directly to the URL structure required by the product. Zod schemas in `@aninusa/types` are shared by the API and any future client. tRPC would add coupling without benefit here.

### 2. Provider normalization at the boundary

Adapters convert their payloads into `NormalizedAnime`, `NormalizedEpisode`, `NormalizedVideoSource`, and `NormalizedSubtitle` before anything touches the database. Ingestion, matching, and the UI are provider-agnostic. Adding a provider means adding one adapter and registering it; no schema or UI change is required.

### 3. Fail-closed provider compliance

`ProviderCapabilities.automatedAccessPermitted` defaults to false for unknown/restricted providers. `runProviderSync` refuses to call a provider without it. `RestrictedProviderExample` demonstrates the pattern: every method throws `UnsupportedProviderError`. There is no scraper, CAPTCHA solver, cookie injection, or DRM handling anywhere in the codebase.

### 4. External IDs first, titles second

Matching order:

1. Existing `ProviderRef` for `(providerKey, externalId)` → confidence 1.0.
2. MAL/AniList ID equality → 0.99, auto.
3. Title similarity across title/English/Japanese/alternative titles, adjusted by year, episode count, season.

Decision bands: `>= 0.95` auto-merge, `0.80–0.94` probable (kept separate for review), `< 0.80` no match. Probable matches intentionally do **not** merge automatically to avoid collapsing sequels and films into a parent series.

### 5. Idempotent ingestion

Every provider record upserts `Anime`, `Episode` (`animeId + episodeNumber`), `VideoSource` (`episodeId + provider + url`), `Subtitle` (`episodeId + language + url`), and `ProviderRef`. Re-running a sync is safe. Each anime is ingested in its own transaction so one bad record cannot roll back the batch; the job records partial success.

### 6. Cache strategy

`cached()` implements cache-aside with single-flight: concurrent misses share one database load. Redis is used when `REDIS_URL` is set; otherwise a bounded in-process `MemoryCache` keeps development simple. Catalog mutations invalidate `catalog:*` and `search:*` prefixes.

TTLs: home 60s, lists 60s, detail 120s, playback 30s, taxonomy 10m, sitemap 1h.

### 7. Search

PostgreSQL full-text search (`to_tsvector('simple', ...)`) combined with `ILIKE` fallbacks over titles, alternative titles, genres, and studios, plus `pg_trgm` indexes for fuzzy matching. The query builder is isolated in `apps/web/src/lib/catalog.ts`; replacing it with Meilisearch/Elasticsearch means implementing `listAnime()` against the new engine and keeping the same `Paginated<AnimeSummary>` contract.

The `simple` configuration is deliberate: it avoids English stemming for Japanese/romaji titles and Indonesian queries.

### 8. Rendering and caching layers

- Public catalog pages are server-rendered on demand and backed by the data cache, which keeps HTML fresh and avoids loading the catalog into the browser.
- Routes are dynamic because the root layout reads the session cookie for the header. Data-level caching (Redis/memory) provides the performance that static generation would otherwise give, without a second auth mechanism.
- Pagination is always server-side; the client never receives the full catalog.

### 9. Authorization

Three layers:

1. **Middleware** verifies the signed session JWT and role claim for `/admin` and `/profile`, preventing protected shells from being streamed.
2. **Page guards** (`requireAdminPage`, `requireUserPage`) repeat the check against the database before any query. This matters because Next renders layouts and pages in parallel; a layout-only check can leak page data into the RSC payload.
3. **API guards** (`requireApiAdmin`, `requireApiUser`) protect every mutating endpoint.

Sessions are revocable rows; JWT expiry matches the session expiry. Logout revokes the row and clears the cookie.

### 10. Source health

The worker probes a rotating batch of sources and subtitles with a normal HTTP GET (`Range: bytes=0-4095` for video). It validates HLS manifests for `#EXTM3U`, checks content types, and records every attempt in `SourceHealthCheck`.

- `401/403` → `BROKEN` with a note that no bypass was attempted.
- `429` → `DEGRADED`.
- Network failure/invalid payload → `BROKEN`.

Playback queries only return `ACTIVE` or `DEGRADED` rows, so broken sources disappear from the watch page automatically.

### 11. Media player

`@aninusa/player` is a controlled React component built on the native `<video>` element, hls.js for HLS, and a lazily imported dash.js for DASH. It owns:

- Source attachment and fatal-error recovery.
- Quality levels (from HLS manifest or fixed renditions).
- Custom subtitle rendering (parsed VTT/SRT) so font size/position/opacity can be adjusted.
- Progress reporting, intro/outro skip, auto-next, PiP, fullscreen, theater mode, shortcuts.

It never upscales. Quality options are derived from what the provider actually exposes.

### 12. Scaling path

- **More traffic:** add Redis, run multiple web replicas behind a load balancer, keep the worker as a singleton.
- **More content:** add indexes as query patterns grow; move search to Meilisearch when `pg_trgm`/FTS latency becomes the bottleneck.
- **More providers:** register adapters; use `ProviderRef` for identity.
- **Large media:** store only authorized assets in object storage (S3-compatible) behind a CDN; store URLs in `VideoSource`, never binaries in Postgres.
- **Recommendations:** `getRelatedAnime` is a genre/popularity baseline; replace with a vector or collaborative service behind the same function contract.

## Data flow: watch page

```
/anime/[slug]/episode-N
  → getAnimeBySlug + getEpisodeByNumber
  → getEpisodePlayback(episodeId)
       sources: isActive AND status IN (ACTIVE, DEGRADED), quality desc
       subtitles: active, proxied through /api/subtitles when external
  → WatchView (server data) → VideoPlayer (client)
       onProgress → POST /api/watch-progress (5s throttle, keepalive)
       onEnded + autoNext → router.push(next episode)
```

## Failure behavior

| Failure | User sees | Server |
| --- | --- | --- |
| Source unavailable | “Sumber video tidak tersedia.” + try another source | Technical detail in logs/health checks |
| Indonesian subtitle missing | “Subtitle Indonesia tidak tersedia.” | Fetch error logged in dev console |
| Provider blocked | Sync job `FAILED` with compliance message | No bypass attempted |
| Database down | Generic error page | `/api/health` returns 503 with `database: error` |
| Rate limited | 429 with Indonesian message | Counter in Redis/memory |
