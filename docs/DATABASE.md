# Database

PostgreSQL 16+, Prisma 6. Schema: `packages/database/prisma/schema.prisma`.

## Entity overview

```
Anime ──< Episode ──< VideoSource ──< SourceHealthCheck
  │         └──────< Subtitle ──────< SourceHealthCheck
  ├──< ProviderRef
  ├──< Favorite >── User
  ├──< WatchHistory >── User
  └──> Genre[] / Studio[] (implicit m-n)
User ──< Session
Provider ──< IngestionJob
User ──< AuditLog
```

## Tables

### `Anime`

Core metadata. `slug` is unique and SEO-safe. `malId` / `anilistId` are nullable unique external identities. `latestEpisode` is a float to support 12.5-style specials. `popularity` is an integer used for ranking.

Indexes: `(status, year)`, `(season, year)`, `(type, status)`, `popularity DESC`, `score DESC`, `updatedAt DESC`, plus trigram and FTS indexes from the second migration.

### `Episode`

`@@unique([animeId, episodeNumber])` is the idempotency key for ingestion. `introStart/introEnd/outroStart` drive skip buttons; values are seconds.

### `VideoSource`

Authorized playback endpoints only. `quality = 0` means an adaptive master playlist; positive values are the rendition height. `status` transitions `ACTIVE → DEGRADED → BROKEN`; `DISABLED` is operator-controlled. `isActive` is a hard kill switch.

### `Subtitle`

One row per episode/language/URL. `isDefault` marks the preferred track (Indonesian by convention). `format` is VTT, SRT, or ASS; ASS is rejected by the player and should be converted before ingestion.

### `User`, `Session`

`User.passwordHash` is bcrypt. `Session` is the revocation list: a JWT without a live, non-revoked row is rejected.

### `WatchHistory`

`@@unique([userId, episodeId])`; `progress` and `duration` are seconds. `completed` drives “Continue watching” filtering.

### `Favorite`

`@@unique([userId, animeId])`, cascades on user/anime deletion.

### `Provider`, `ProviderRef`, `IngestionJob`

`Provider` stores operator-facing configuration and enablement. `ProviderRef` maps `(providerKey, externalId)` → internal anime, with the match confidence. `IngestionJob` records every sync attempt with JSON stats and a truncated error.

### `SourceHealthCheck`, `AuditLog`

Append-only operational history. Health checks reference a video source or subtitle; audit logs record admin actions with optional metadata and IP.

## Migrations

```bash
# development (creates a migration from schema changes)
npm run db:migrate

# production (applies committed migrations)
npm run db:deploy
```

Migrations included:

1. `20260101000000_init` — all tables, enums, constraints, base indexes.
2. `20260101000100_search_indexes` — `pg_trgm`, trigram indexes on titles, GIN FTS index, season/status indexes.

> `pg_trgm` is a standard PostgreSQL extension but creating extensions may require elevated privileges on managed providers. Enable it in the database before running the second migration, or remove the trigram statements and rely on the FTS index.

The FTS index expression matches `apps/web/src/lib/catalog.ts` exactly:

```sql
to_tsvector('simple',
  coalesce("title",'') || ' ' || coalesce("englishTitle",'') || ' ' ||
  coalesce("japaneseTitle",'') || ' ' || coalesce("synopsis",''))
```

Keep them in sync if the searchable columns change.

## Seeding

`packages/database/prisma/seed.ts`:

1. Upserts providers (`open-media`, `anilist`, `restricted-example` disabled).
2. Creates/ensures the admin account from `SEED_ADMIN_*`.
3. Ingests the bundled CC BY catalog.
4. Optionally fetches popular + current-season metadata from AniList (`SEED_ANILIST`).

Safe to run repeatedly.

## Retention

- `SourceHealthCheck` and `AuditLog` grow forever by default. Add a scheduled `DELETE` for rows older than 90/365 days in high-volume deployments.
- `IngestionJob` can be trimmed to the last N per provider.

## Backup

Use `pg_dump`/`pg_restore` or your managed provider's snapshot mechanism. Object storage (if introduced for authorized media) should be backed up separately; the database stores URLs, not binaries.
