-- Full-text search and fuzzy title matching.
-- The search service uses the exact same expression as this index so PostgreSQL
-- can use the GIN index without a generated column (keeps Prisma schema clean).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Anime_title_trgm_idx"
  ON "Anime" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Anime_english_title_trgm_idx"
  ON "Anime" USING GIN ("englishTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Anime_search_fts_idx"
  ON "Anime" USING GIN (
    to_tsvector(
      'simple',
      coalesce("title", '') || ' ' ||
      coalesce("englishTitle", '') || ' ' ||
      coalesce("japaneseTitle", '') || ' ' ||
      coalesce("synopsis", '')
    )
  );

-- Speeds up the catalog's default sorts and season pages.
CREATE INDEX IF NOT EXISTS "Anime_year_season_idx" ON "Anime" ("year", "season");
CREATE INDEX IF NOT EXISTS "Anime_status_updated_idx" ON "Anime" ("status", "updatedAt" DESC);
