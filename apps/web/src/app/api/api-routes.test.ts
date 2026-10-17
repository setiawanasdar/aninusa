import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodePlayback, Paginated, AnimeSummary } from "@aninusa/types";

const listAnime = vi.fn();
const getEpisodePlayback = vi.fn();

vi.mock("@/lib/catalog", () => ({
  listAnime,
  getEpisodePlayback,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => null),
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    episode: { findUnique: vi.fn() },
    anime: { findUnique: vi.fn() },
    watchHistory: { upsert: vi.fn(), findUnique: vi.fn() },
    favorite: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

const sampleAnime: AnimeSummary = {
  id: "anime_1",
  slug: "sintel",
  title: "Sintel",
  englishTitle: "Sintel",
  japaneseTitle: null,
  poster: "/art/sintel-poster.svg",
  banner: "/art/sintel-banner.svg",
  type: "MOVIE",
  status: "COMPLETED",
  year: 2010,
  season: "FALL",
  score: 8.3,
  popularity: 100,
  totalEpisodes: 1,
  latestEpisode: 1,
  duration: 15,
  genres: ["Fantasy"],
  studios: ["Blender Animation Studio"],
  updatedAt: new Date().toISOString(),
};

const page: Paginated<AnimeSummary> = {
  items: [sampleAnime],
  page: 1,
  perPage: 24,
  total: 1,
  totalPages: 1,
  hasNext: false,
};

function request(url: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, init);
}

describe("GET /api/anime", () => {
  beforeEach(() => {
    listAnime.mockReset();
    listAnime.mockResolvedValue(page);
  });

  it("returns a paginated catalog", async () => {
    const { GET } = await import("./anime/route");
    const response = await GET(request("/api/anime?page=1&perPage=24&sort=rating"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: Paginated<AnimeSummary> };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]?.slug).toBe("sintel");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("rejects invalid pagination", async () => {
    const { GET } = await import("./anime/route");
    const response = await GET(request("/api/anime?perPage=999"));
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(listAnime).not.toHaveBeenCalled();
  });

  it("rejects unknown enum values", async () => {
    const { GET } = await import("./anime/route");
    const response = await GET(request("/api/anime?status=DROPPED"));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/search", () => {
  it("returns an empty page for short queries without hitting the database", async () => {
    listAnime.mockReset();
    const { GET } = await import("./search/route");
    const response = await GET(request("/api/search?q=a"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: Paginated<AnimeSummary> };
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(listAnime).not.toHaveBeenCalled();
  });

  it("delegates longer queries to the catalog service", async () => {
    listAnime.mockReset();
    listAnime.mockResolvedValue(page);
    const { GET } = await import("./search/route");
    const response = await GET(request("/api/search?q=sintel"));
    expect(response.status).toBe(200);
    expect(listAnime).toHaveBeenCalledWith(expect.objectContaining({ q: "sintel" }));
  });
});

describe("GET /api/episode/:id/sources", () => {
  it("returns normalized sources without provider internals", async () => {
    const playback: EpisodePlayback = {
      episode: {
        id: "ep_1",
        animeId: "anime_1",
        number: 1,
        title: "Sintel",
        description: null,
        duration: 888,
        thumbnail: null,
        airDate: null,
        introStart: 0,
        introEnd: 15,
        outroStart: 850,
      },
      sources: [
        {
          id: "src_1",
          quality: 0,
          format: "HLS",
          codec: "h264",
          language: "en",
          url: "https://example.com/master.m3u8",
          label: "Auto",
          status: "ACTIVE",
        },
      ],
      subtitles: [
        {
          id: "sub_1",
          language: "id",
          label: "Bahasa Indonesia",
          format: "VTT",
          url: "/subtitles/sintel-id.vtt",
          isDefault: true,
          status: "ACTIVE",
        },
      ],
      anime: { id: "anime_1", slug: "sintel", title: "Sintel", poster: null },
      previousEpisode: null,
      nextEpisode: null,
    };
    getEpisodePlayback.mockResolvedValue(playback);

    const { GET } = await import("./episode/[id]/sources/route");
    const response = await GET(request("/api/episode/ep_1/sources"), {
      params: Promise.resolve({ id: "ep_1" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: EpisodePlayback };
    expect(body.data.sources[0]?.url).toBe("https://example.com/master.m3u8");
    expect(body.data.sources[0]).not.toHaveProperty("provider");
    expect(body.data.subtitles[0]?.language).toBe("id");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 404 for an unknown episode", async () => {
    getEpisodePlayback.mockResolvedValue(null);
    const { GET } = await import("./episode/[id]/sources/route");
    const response = await GET(request("/api/episode/missing/sources"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("authenticated mutations", () => {
  it("rejects watch progress without a session", async () => {
    const { POST } = await import("./watch-progress/route");
    const response = await POST(
      request("/api/watch-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ episodeId: "ep_1234567890", progress: 10, duration: 100 }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects favorites deletion without a session", async () => {
    const { DELETE } = await import("./favorites/[animeId]/route");
    const response = await DELETE(request("/api/favorites/anime_1", { method: "DELETE" }), {
      params: Promise.resolve({ animeId: "anime_1" }),
    });
    expect(response.status).toBe(401);
  });

  it("blocks cross-site origins on mutations", async () => {
    const { POST } = await import("./favorites/route");
    const response = await POST(
      request("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ animeId: "anime_1" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
