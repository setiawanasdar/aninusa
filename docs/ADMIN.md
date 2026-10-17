# Admin guide

URL: `/admin` (ADMIN and MODERATOR). Anonymous visitors are redirected to `/login` by middleware before any admin shell is streamed. Every page repeats the authorization check against the database.

## Roles

| Role | Capabilities |
| --- | --- |
| `USER` | Favorites, history, progress |
| `MODERATOR` | Admin dashboard, catalog CRUD, sync, health checks, user list |
| `ADMIN` | Everything, plus changing roles and deleting users |

Role changes are audited. You cannot demote or delete your own account.

## Dashboard

Cards: total anime, episodes, video sources, active providers, failed jobs, broken sources, broken subtitles, users. Lists: recently added anime and recent ingestion jobs.

## Catalog management

### Create/edit anime

`/admin/anime/new` and `/admin/anime/:id`.

Fields: title (required), English/Japanese titles, alternative titles (comma-separated), synopsis, poster/banner URLs, type, status, year, season, score, popularity, duration, total episodes, latest episode, air dates, MAL/AniList IDs, genres, studios.

- Slug is generated from the English title (or title) and made unique.
- Poster/banner accept site-relative paths (`/art/...`) or https URLs.
- Genres/studios are created on demand from their names.

### Refresh metadata and episodes

On the anime edit page, **Segarkan metadata & episode** re-fetches the record from each attached provider reference. Providers that are disabled or restrict automated access are skipped and reported; no bypass is attempted.

### Episodes

On the anime edit page, expand ???Episode???:

- Add episode: number (supports decimals), title, duration (seconds), air date, intro start/end, outro start, thumbnail.
- Expand an episode to manage sources and subtitles.
- **Sources:** provider key, URL, quality (`Auto`, 360/480/720/1080), format, codec, language, status. Only add endpoints you are authorized to embed.
- **Subtitles:** language (`id`, `en`, `ja`), label, URL, format (VTT/SRT/ASS), default flag.
- Validate buttons run a single health check and persist the result.
- Delete cascades dependent rows.

## Providers and synchronization

`/admin/providers` lists registered adapters and their capabilities.

- **Tes** ??? read-only capability probe. Restricted providers report that automated access is unsupported.
- **Sinkron inkremental** ??? small batch (10) for routine updates.
- **Sinkron penuh** ??? larger batch (24).

The job table shows status, counts, error (truncated) and age. A provider is only syncable when `enabled` **and** `capabilities.automatedAccessPermitted`. The engine refuses everything else by design.

For large catalogs, use the worker's scheduled sync rather than the request-scoped button (route limit: 120s).

## Source health

`/admin/health`:

- Broken/degraded video sources with HTTP status, failure count and last check.
- Broken/degraded subtitles.
- Recent health checks with latency.
- **Jalankan pemeriksaan kesehatan** sweeps up to 50 sources and 50 subtitles.

Health probes use plain HTTP GETs. A 401/403 marks the source broken and records that no bypass was attempted. `DISABLED` rows are never probed.

## Users

`/admin/users` lists up to 100 users with favorite/history counts. ADMIN can change roles and delete accounts. MODERATOR sees the list read-only.

## Audit log

Every admin mutation writes an `AuditLog` row: actor, action (`anime.create`, `source.update`, `provider.sync`, ???), target, metadata, IP. Query it directly in SQL/Prisma Studio; it is not exposed in the UI.

## Operational checklist

1. Change the seeded admin password.
2. Confirm `AUTH_SECRET` is unique and ???32 characters.
3. Verify `/api/health` is green.
4. Run a provider test before enabling scheduled sync.
5. Check `/admin/health` after adding sources.
6. Review `FAILED` jobs; fix provider credentials/authorization rather than retrying blindly.
7. Trim `SourceHealthCheck`/`AuditLog` periodically in high-volume deployments.

