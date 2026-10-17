import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "./generated/prisma";
import { ingestNormalizedAnime } from "./ingest";
import type { NormalizedAnime } from "@aninusa/types";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

const TEST_SLUG_PREFIX = "vitest-open-movie";
const TEST_PROVIDER = "vitest-provider";

const sample: NormalizedAnime = {
  externalId: "vitest-sintel",
  title: "Vitest Open Movie",
  englishTitle: "Vitest Open Movie",
  japaneseTitle: null,
  alternativeTitles: ["Vitest Movie"],
  synopsis: "A test-only entry for the ingestion pipeline.",
  poster: null,
  banner: null,
  type: "MOVIE",
  status: "COMPLETED",
  year: 2026,
  season: "WINTER",
  score: 7.5,
  popularity: 1,
  duration: 10,
  totalEpisodes: 1,
  malId: 999_000_001,
  anilistId: 999_000_002,
  genres: ["Test Genre"],
  studios: ["Test Studio"],
  source: "vitest",
  episodes: [
    {
      number: 1,
      title: "Test Episode",
      duration: 600,
      introStart: 0,
      introEnd: 10,
      outroStart: 580,
      sources: [
        {
          provider: TEST_PROVIDER,
          url: "https://example.com/test/master.m3u8",
          quality: 0,
          format: "HLS",
          codec: "h264",
          language: "ja",
        },
      ],
      subtitles: [
        {
          language: "id",
          label: "Bahasa Indonesia",
          url: "https://example.com/test/id.vtt",
          format: "VTT",
          isDefault: true,
        },
      ],
    },
  ],
};

describeDb("database ingestion", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.anime.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } });
  });

  afterAll(async () => {
    await prisma.anime.deleteMany({ where: { slug: { startsWith: TEST_SLUG_PREFIX } } });
    await prisma.providerRef.deleteMany({ where: { providerKey: TEST_PROVIDER } });
    await prisma.$disconnect();
  });

  it("creates an anime with normalized episodes, sources and subtitles", async () => {
    const result = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, TEST_PROVIDER, sample));

    expect(result.created).toBe(true);
    expect(result.slug).toBe("vitest-open-movie");
    expect(result.episodesUpserted).toBe(1);
    expect(result.sourcesUpserted).toBe(1);
    expect(result.subtitlesUpserted).toBe(1);

    const anime = await prisma.anime.findUnique({
      where: { id: result.animeId },
      include: {
        genres: true,
        studios: true,
        episodes: { include: { sources: true, subtitles: true } },
      },
    });

    expect(anime?.title).toBe("Vitest Open Movie");
    expect(anime?.genres.map((genre) => genre.slug)).toContain("test-genre");
    expect(anime?.studios.map((studio) => studio.slug)).toContain("test-studio");
    expect(anime?.episodes).toHaveLength(1);
    expect(anime?.episodes[0]?.sources[0]?.quality).toBe(0);
    expect(anime?.episodes[0]?.subtitles[0]?.isDefault).toBe(true);
    expect(anime?.latestEpisode).toBe(1);
  });

  it("is idempotent on repeated ingestion", async () => {
    const first = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, TEST_PROVIDER, sample));
    const second = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, TEST_PROVIDER, sample));

    expect(second.animeId).toBe(first.animeId);
    expect(second.created).toBe(false);

    const [episodes, sources, subtitles] = await Promise.all([
      prisma.episode.count({ where: { animeId: first.animeId } }),
      prisma.videoSource.count({ where: { episode: { animeId: first.animeId } } }),
      prisma.subtitle.count({ where: { episode: { animeId: first.animeId } } }),
    ]);

    expect(episodes).toBe(1);
    expect(sources).toBe(1);
    expect(subtitles).toBe(1);
  });

  it("merges a different provider record via external ID", async () => {
    const first = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, TEST_PROVIDER, sample));

    const other: NormalizedAnime = {
      ...sample,
      externalId: "vitest-second-provider",
      title: "Completely Different Provider Title",
      episodes: [],
    };

    const second = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, "vitest-provider-2", other));

    expect(second.animeId).toBe(first.animeId);
    expect(second.created).toBe(false);
    expect(second.match?.decision).toBe("AUTO");
    expect(second.match?.reasons.join(" ")).toMatch(/External ID|MAL|AniList/);
  });

  it("creates unique slugs when two unrelated works share a title", async () => {
    const first = await prisma.$transaction((tx) =>
      ingestNormalizedAnime(tx, TEST_PROVIDER, {
        ...sample,
        externalId: "vitest-slug-a",
        malId: null,
        anilistId: null,
        title: "Vitest Open Movie",
        episodes: [],
      }),
    );

    const second = await prisma.$transaction((tx) =>
      ingestNormalizedAnime(tx, TEST_PROVIDER, {
        ...sample,
        externalId: "vitest-slug-b",
        malId: null,
        anilistId: null,
        title: "Vitest Open Movie",
        year: 1990,
        totalEpisodes: 99,
        episodes: [],
      }),
    );

    expect(second.animeId).not.toBe(first.animeId);
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith(TEST_SLUG_PREFIX)).toBe(true);
  });
});
