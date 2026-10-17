# API reference

Base URL: `http://localhost:3000/api`

## Conventions

Success:

```json
{ "data": { "...": "..." } }
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid",
    "details": [{ "path": "perPage", "message": "Number must be less than or equal to 60" }]
  }
}
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `UNAUTHORIZED` | 401 | No/invalid session |
| `FORBIDDEN` | 403 | Wrong role, cross-origin, or disallowed target |
| `NOT_FOUND` | 404 | Unknown resource |
| `CONFLICT` | 409 | Duplicate slug/username/email/episode |
| `RATE_LIMITED` | 429 | Per-IP limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error (details only in logs) |
| `UPSTREAM_UNAVAILABLE` | 502 | Subtitle/provider upstream failed |

Authentication uses the `aninusa_session` HttpOnly cookie. Mutating requests must be same-origin (the browser sends `Origin`); requests without `Origin` are rejected if they carry a session cookie.

Public responses set `Cache-Control: public, s-maxage=???`; authenticated responses use `no-store`.

---

## Catalog

### `GET /api/anime`

Query (all optional):

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Full-text + fuzzy title/genre/studio search |
| `page` | int | Default 1, max 10 000 |
| `perPage` | int | Default 24, max 60 |
| `type` | `TV \| MOVIE \| OVA \| ONA \| SPECIAL \| MUSIC` | |
| `status` | `ONGOING \| COMPLETED \| UPCOMING` | |
| `year` | int | 1900???2100 |
| `season` | `WINTER \| SPRING \| SUMMER \| FALL` | |
| `genre` | string | Genre slug |
| `studio` | string | Studio slug |
| `sort` | `popularity \| rating \| newest \| updated \| alphabetical` | Default `popularity` |

Response: `Paginated<AnimeSummary>` (`items`, `page`, `perPage`, `total`, `totalPages`, `hasNext`).

```bash
curl "http://localhost:3000/api/anime?q=bunny&type=MOVIE&sort=rating"
```

### `GET /api/anime/:slug`

Returns `AnimeDetail` plus `episodes: EpisodeDto[]`.

### `GET /api/anime/:slug/episodes`

```json
{ "data": { "animeId": "...", "slug": "sintel", "episodes": [] } }
```

### `GET /api/episode/:id`

Episode metadata plus `anime: { slug, title, poster }`.

### `GET /api/episode/:id/sources`

Normalized playback payload. The `provider` field is intentionally removed.

```json
{
  "data": {
    "episode": { "id": "ep_1", "number": 1, "title": "Sintel", "duration": 888 },
    "anime": { "id": "an_1", "slug": "sintel", "title": "Sintel", "poster": "/art/sintel-poster.svg" },
    "sources": [
      { "id": "src_1", "quality": 0, "format": "HLS", "codec": "h264", "language": "en",
        "url": "https://???/playlist.m3u8", "label": "Auto", "status": "ACTIVE" }
    ],
    "subtitles": [
      { "id": "sub_1", "language": "id", "label": "Bahasa Indonesia", "format": "VTT",
        "url": "/subtitles/sintel-id.vtt", "isDefault": true, "status": "ACTIVE" }
    ],
    "previousEpisode": null,
    "nextEpisode": { "id": "ep_2", "number": 2 }
  }
}
```

Only `ACTIVE`/`DEGRADED` sources are returned. External subtitle URLs are rewritten to `/api/subtitles?url=???`.

### `GET /api/search`

Same params as `/api/anime`, but `q` shorter than 2 characters returns an empty page without querying the database.

### `GET /api/genres`, `GET /api/studios`, `GET /api/seasons`

Taxonomy lists. `seasons` returns `{ seasons, years, current }`.

### `GET /api/subtitles?url=???`

Proxy for authorized external subtitle hosts. Requires the host to be present in `SUBTITLE_HOST_ALLOWLIST`; private/loopback hosts are refused. Returns `text/vtt`.

### `GET /api/health`

```json
{ "status": "ok", "checks": { "database": "ok", "cache": "ok" }, "latencyMs": 4 }
```

Returns 503 when a dependency is down.

---

## Authentication

### `POST /api/auth/register`

```json
{ "username": "budi", "email": "budi@example.com", "password": "rahasia12345" }
```

Policy: username 3???32 (`[a-zA-Z0-9_.-]`), valid email, password 10???128 with at least one letter and one digit. Sets the session cookie.

### `POST /api/auth/login`

```json
{ "email": "budi@example.com", "password": "rahasia12345" }
```

Same error for unknown account and wrong password.

### `POST /api/auth/logout`

Revokes the session row and clears the cookie.

### `GET /api/auth/me`

Returns the current user or `{ "data": null }`.

---

## User data (requires session)

### `POST /api/watch-progress`

```json
{ "episodeId": "ep_1", "progress": 120, "duration": 596, "completed": false }
```

Upserts one row per `(userId, episodeId)`. `completed` defaults to true at ???95% or within 20s of the end. Progress is clamped to the duration.

`GET /api/watch-progress?episodeId=???` returns the saved row for resume.

### `GET /api/watch-history?limit=12&includeCompleted=false`

Returns `WatchHistoryEntry[]` with anime and episode summaries, newest first.

### `DELETE /api/watch-history?id=???` or `DELETE /api/watch-history`

Deletes one entry or the whole history for the current user.

### `POST /api/favorites`

```json
{ "animeId": "an_1" }
```

Idempotent upsert.

### `GET /api/favorites`

Returns `AnimeSummary[]`.

### `DELETE /api/favorites/:animeId`

Removes the favorite (idempotent).

---

## Admin (ADMIN or MODERATOR)

All admin mutations are same-origin and audited in `AuditLog`.

### `GET /api/admin/stats`

Counts plus recent anime and recent ingestion jobs.

### `POST /api/admin/anime`

Body (`adminAnimeSchema`): `title` required; `slug`, `englishTitle`, `japaneseTitle`, `alternativeTitles[]`, `synopsis`, `poster`, `banner`, `type`, `status`, `year`, `season`, `score`, `popularity`, `source`, `duration`, `totalEpisodes`, `latestEpisode`, `airedFrom`, `airedTo`, `malId`, `anilistId`, `genres[]`, `studios[]`.

Slug is generated from the English/title and made unique.

### `POST /api/admin/anime/:id/refresh`

Re-fetches metadata and episodes from every `ProviderRef` attached to the anime. Providers that are disabled or do not permit automated access are reported as skipped; nothing is bypassed. Returns `{ animeId, results: [{ providerKey, ok, message, episodes, sources, subtitles }] }`.

### `PUT /api/admin/anime/:id`, `DELETE /api/admin/anime/:id`

Same body for update. Delete cascades episodes, sources, subtitles, favorites, history, and provider refs.

### `POST /api/admin/episodes`

`animeId`, `episodeNumber`, optional `title`, `description`, `duration`, `thumbnail`, `airDate`, `introStart`, `introEnd`, `outroStart`. Duplicate `(animeId, episodeNumber)` returns 409.

### `PUT /api/admin/episodes/:id`, `DELETE /api/admin/episodes/:id`

### `POST /api/admin/sources`

`episodeId`, `provider`, `url` (http/https), `quality` (0 = adaptive), `format`, `codec`, `language`, `subtitleSupport`, `isActive`, `status`.

### `PUT /api/admin/sources/:id`, `DELETE /api/admin/sources/:id`

### `POST /api/admin/subtitles`

`episodeId`, `language`, `label`, `url` (http/https or site-relative), `format`, `isDefault`, `isActive`, `status`. Setting `isDefault` clears the flag on sibling tracks.

### `PUT /api/admin/subtitles/:id`, `DELETE /api/admin/subtitles/:id`

### `POST /api/admin/sync`

```json
{ "providerKey": "open-media", "mode": "INCREMENTAL", "limit": 10 }
```

Runs synchronously (bounded by `maxDuration = 120`). Production should rely on the worker for large batches. Returns `{ jobId, status, stats }`.

### `GET /api/admin/sync`

Last 25 ingestion jobs.

### `GET /api/admin/providers`

Provider rows with adapter capabilities and `registered` flag.

### `POST /api/admin/providers/:id/test`

Runs a read-only capability probe. Returns `{ providerKey, ok, latencyMs, message }`. Restricted providers report that automated access is unsupported.

### `POST /api/admin/validate`

```json
{ "type": "sources", "limit": 50 }
{ "type": "subtitles", "id": "sub_1" }
```

Without `id`, runs a health sweep. With `id`, checks one row and persists the outcome.

### `GET /api/admin/users?q=???`

Last 100 users with favorite/history counts.

### `PATCH /api/admin/users/:id`

`{ "role": "MODERATOR" }`, `{ "username": "???" }`, or `{ "email": "???" }`. ADMIN only. Cannot demote yourself.

### `DELETE /api/admin/users/:id`

ADMIN only. Cannot delete yourself. Cascades sessions, favorites and history.

---

## Rate limits

| Scope | Default |
| --- | --- |
| Public reads | 120 / minute / IP |
| Auth (login/register) | 10 / minute / IP |
| Progress writes | 120 / minute / IP |

Configure with `RATE_LIMIT_*` env vars. Counters live in Redis when configured, otherwise in process memory.

## Pagination

All list endpoints accept `page` and `perPage`; responses include `total` and `totalPages`. The client never receives the full catalog.

