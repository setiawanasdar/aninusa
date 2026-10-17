# Provider adapters

The source layer exists so authorized providers can be added without touching the UI, database schema, or ingestion engine.

## Interfaces

From `packages/source-adapters/src/types.ts`:

```ts
interface MetadataProvider {
  key: string;
  name: string;
  capabilities: ProviderCapabilities;
  search(query: string, options?: { limit?: number }): Promise<NormalizedAnime[]>;
  getAnime(externalId: string): Promise<NormalizedAnime | null>;
  getSeasonalAnime(year: number, season: Season, options?): Promise<NormalizedAnime[]>;
  getPopular?(options?): Promise<NormalizedAnime[]>;
}

interface VideoProvider {
  key: string;
  name: string;
  capabilities: ProviderCapabilities;
  getVideoSources(animeExternalId: string, episodeNumber: number): Promise<NormalizedVideoSource[]>;
  getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]>;
  getAvailableQualities?(animeExternalId: string, episodeNumber: number): Promise<number[]>;
}

interface SubtitleProvider {
  getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]>;
}
```

`ProviderCapabilities`:

```ts
{
  metadata: boolean;
  video: boolean;
  subtitles: boolean;
  incremental: boolean;
  seasonal: boolean;
  automatedAccessPermitted: boolean; // must be true to sync
  notes?: string;
}
```

## Normalized output

Adapters return:

- `NormalizedAnime` — externalId, titles, synopsis, art, type/status/year/season, score, popularity, duration, episode count, air dates, MAL/AniList IDs, genres, studios, and optional episodes.
- `NormalizedEpisode` — number, title, description, duration, thumbnail, airDate, intro/outro offsets, sources, subtitles.
- `NormalizedVideoSource` — provider, externalId, URL, quality (0 = adaptive), format, codec, language, subtitle support.
- `NormalizedSubtitle` — language, label, URL, format, isDefault.

Nothing else crosses the boundary. The database layer owns persistence, matching and deduplication.

## Adding an authorized provider

1. **Verify authorization.** Read the provider's terms and API documentation. Automated access must be explicitly allowed. If not, mark `automatedAccessPermitted: false` and stop; do not write a scraper.
2. Create `packages/source-adapters/src/providers/<name>.ts` implementing one or more interfaces.
3. Use `providerJson` / `providerFetch` from `../http` so timeouts, 401/403/429 handling and user-agent behavior stay consistent.
4. Respect rate limits with `RateGate` (requests/minute).
5. Register the adapter in `registry.ts`, gated by an env flag (for example `MYPROVIDER_ENABLED`).
6. Add a `Provider` row (seed or admin) with `key`, `name`, `kind`, `baseUrl`, `enabled`.
7. Map IDs with `ProviderRef`: the ingestion engine upserts `(providerKey, externalId)` automatically.
8. If the provider supplies video, store only URLs you are authorized to embed. Do not proxy or mirror the media.
9. Add unit tests for mapping and a compliance test asserting the adapter fails closed when unauthorized.

## What adapters must never do

- Solve or bypass CAPTCHAs.
- Reuse cookies, tokens, or credentials not explicitly issued to you.
- Circumvent DRM (Widevine, PlayReady, FairPlay) or decrypt protected segments.
- Ignore `robots.txt` or rate limits.
- Spoof browser fingerprints to defeat anti-bot systems.
- Download and re-host copyrighted media.

If a provider blocks automated requests (401/403/429), `providerFetch` raises a non-retryable or retryable `ProviderError`. The sync job records the failure and the provider remains unsupported. This is the intended outcome, not a bug to work around.

## Bundled adapters

### `open-media`

- Blender Foundation open movies (CC BY 2.5/3.0).
- Metadata, video, and subtitle capabilities.
- Streams point at the studios'/maintainers' public test endpoints.
- Used to seed a fully functional catalog without unauthorized content.

### `anilist`

- Official public GraphQL API at `https://graphql.anilist.co`.
- Metadata only (`video: false`).
- Rate-gated (`ANILIST_RATE_LIMIT_PER_MINUTE`), cached by the catalog layer, attributed in the UI.
- Episode list uses `streamingEpisodes` titles/thumbnails when available; no streams are sourced from AniList.

### `restricted-example`

- Demonstrates a provider whose terms prohibit automated access.
- `automatedAccessPermitted: false`; every method throws `UnsupportedProviderError`.
- Registered as disabled so operators see the integration point without accidentally enabling it.

## Ingestion pipeline

`packages/services/src/ingestion.ts`:

1. Reject disabled/unregistered/non-automated providers.
2. Prevent concurrent jobs for the same provider (30-minute guard).
3. Create an `IngestionJob` (`RUNNING`).
4. Fetch a bounded batch (`limit`, max 50).
5. Ingest each anime in its own transaction with retry/backoff at the fetch layer.
6. Persist counts, errors, duration; mark `SUCCEEDED`, `PARTIAL`, or `FAILED`.
7. Invalidate catalog caches after successful mutations.

Scheduling:

- Web: manual sync from `/admin/providers`.
- Worker: `SYNC_INTERVAL_MINUTES` (default 6h) and optional `SYNC_ON_BOOT` / `SYNC_PROVIDER_ON_BOOT`.

## Matching and duplicate handling

`packages/utils/src/match.ts`:

- External ID equality → 0.99.
- Title similarity (Jaro-Winkler + token Jaccard) → base score.
- Year match +0.02, ±1 year −0.05, larger gap −0.20.
- Episode count match +0.02, large mismatch −0.06.
- Season match +0.01 / mismatch −0.02.

Auto-merge only at ≥0.95. Probable matches (0.80–0.94) remain separate and should be reviewed manually. Slugs are normalized and suffixed (`one-piece-2`) when taken.

## Subtitle hosting

- Site-relative paths (`/subtitles/...`) are served directly.
- External hosts must be listed in `SUBTITLE_HOST_ALLOWLIST`; the proxy refuses everything else, including private/loopback addresses.
- Supported in the player: VTT and SRT. ASS/SSA must be converted to VTT before ingestion.

## Source health

`packages/services/src/health.ts` probes with a normal HTTP GET and records:

- HTTP status, content type, latency.
- HLS validation (`#EXTM3U`).
- Subtitle payload recognition (`WEBVTT` or `-->`).
- `ACTIVE` / `DEGRADED` / `BROKEN` / `DISABLED`.

Playback excludes `BROKEN` and `DISABLED` rows. Operators can validate a single row from the admin episode manager or run a sweep from `/admin/health`.
