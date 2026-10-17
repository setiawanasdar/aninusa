# Testing

```bash
npm test          # unit, API, player, auth
npm run typecheck # all workspaces
npm run lint
npm run test:db   # database integration (needs TEST_DATABASE_URL)
```

## Suites

| File | Covers |
| --- | --- |
| `packages/utils/src/slug.test.ts` | Slug normalization, uniqueness, validation |
| `packages/utils/src/match.test.ts` | Title similarity, confidence scoring, decision bands, best-match selection |
| `packages/utils/src/subtitles.test.ts` | VTT/SRT parsing, timestamps, entity/tag stripping, ASS rejection, round-trip |
| `packages/utils/src/cache.test.ts` | Memory cache TTL/prefix/increment, single-flight dedupe, rate limiter |
| `packages/utils/src/format.test.ts` | Durations, episode/season slugs |
| `packages/player/src/utils.test.ts` | Time formatting, auto-quality, quality labels, shortcuts, style clamping |
| `packages/player/src/settings-menu.test.tsx` | Quality/speed/subtitle controls, ARIA state, auto-next toggle (jsdom) |
| `packages/source-adapters/src/registry.test.ts` | Registry gating, open-media licensing invariants, restricted provider fails closed |
| `apps/web/src/app/api/api-routes.test.ts` | Catalog/search/source APIs, validation errors, 401/403, cross-origin rejection |
| `apps/web/src/lib/password.test.ts` | bcrypt hashing, salting, verification, policy |
| `packages/database/src/ingest.test.ts` | Idempotent ingestion, external-ID merge, unique slugs (opt-in) |

## Database integration tests

They are skipped unless `TEST_DATABASE_URL` is set.

```bash
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/aninusa_test?schema=public"
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm run test:db
```

On PowerShell:

```powershell
$env:TEST_DATABASE_URL="postgresql://aninusa:aninusa@127.0.0.1:5432/aninusa_test?schema=public"
npm run test:db
```

The suite creates records prefixed `vitest-open-movie` / `vitest-provider` and deletes them afterwards. Never point it at production.

## Manual verification checklist

1. `npm run db:seed` then open `/` ??? hero, rails, latest episodes, genres render.
2. `/browse` ??? filters change the URL and results; pagination works.
3. `/search?q=bunny` ??? debounced search box returns results; filters preserve `q`.
4. `/anime/big-buck-bunny` ??? metadata, JSON-LD, episode grid, favorite button.
5. `/anime/big-buck-bunny/episode-1` ??? player loads, quality menu, Indonesian subtitles, speed, theater, PiP, keyboard shortcuts.
6. Log in, play 30s, reload ??? resume prompt works and `/profile` shows history.
7. `/admin` ??? dashboard, create/edit/delete anime, add episode/source/subtitle, sync open-media, validate a subtitle, inspect health.
8. Register a normal user and confirm `/admin` redirects away and `/api/admin/stats` returns 403.
9. `GET /api/health` returns `{ status: "ok" }`.
10. Check `/sitemap.xml` and `/robots.txt`.

## Adding tests

- Pure logic belongs in the package that owns it.
- API tests import route handlers directly and mock `@/lib/catalog`, `@/lib/db`, and `@/lib/auth`; `server-only` is stubbed in `test/server-only.ts`.
- Component tests use `// @vitest-environment jsdom` and Testing Library.
- Avoid network calls in unit tests. Provider adapters should be tested through injected fakes or pure mapping functions.

