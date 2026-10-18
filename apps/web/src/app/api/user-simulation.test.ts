import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodePlayback, Paginated, AnimeSummary } from "@aninusa/types";
import { parseEpisodeSlug, formatEpisodeNumber } from "@aninusa/utils";
import { mapAnimasuItemToSummary, mapAnimasuDetailToAnime } from "@/lib/animasu";

const listAnime = vi.fn();
const getEpisodePlayback = vi.fn();

vi.mock("@/lib/catalog", () => ({
  listAnime,
  getEpisodePlayback,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "usr_test_123", username: "Tester", role: "USER" })),
  requireUser: vi.fn(async () => ({ id: "usr_test_123", username: "Tester", role: "USER" })),
  requireAdmin: vi.fn(async () => ({ id: "usr_admin_123", username: "Admin", role: "ADMIN" })),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    episode: { findUnique: vi.fn() },
    anime: { findFirst: vi.fn(), findUnique: vi.fn() },
    watchHistory: { upsert: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    favorite: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

function mockRequest(url: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, {
    ...init,
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      ...(init?.headers || {}),
    },
  });
}

describe("User Simulation: Utilities & Episode Handling", () => {
  it("handles decimal special episodes seamlessly", () => {
    expect(parseEpisodeSlug("episode-1")).toBe(1);
    expect(parseEpisodeSlug("episode-12.5")).toBe(12.5);
    expect(parseEpisodeSlug("episode-0.5")).toBe(0.5);
    expect(formatEpisodeNumber(1)).toBe("1");
    expect(formatEpisodeNumber(12.5)).toBe("12.5");
    expect(formatEpisodeNumber(0.5)).toBe("0.5");
  });
});

describe("User Simulation: Animasu Mappers", () => {
  it("maps Animasu list items to AnimeSummary with Sub Indo tag and synopsis", () => {
    const item = {
      title: "Naruto Shippuden",
      slug: "naruto-shippuden",
      poster: "https://example.com/naruto.jpg",
      subStatus: "Ongoing",
      latestEpisode: "Episode 500",
      synopsis: "Kisah petualangan ninja Naruto Uzumaki.",
    };
    const summary = mapAnimasuItemToSummary(item);
    expect(summary.title).toBe("Naruto Shippuden");
    expect(summary.slug).toBe("naruto-shippuden");
    expect(summary.source).toBe("Animasu (Sub Indo)");
    expect(summary.status).toBe("ONGOING");
    expect(summary.synopsis).toBe("Kisah petualangan ninja Naruto Uzumaki.");
  });

  it("maps Animasu detail data without wrongly marking alternative titles as Japanese title", () => {
    const detailData = {
      title: "Solo Leveling Season 2",
      alterTitle: "Ore dake Level Up na Ken",
      slug: "solo-leveling-season-2",
      poster: "https://example.com/poster.jpg",
      rating: "8.7",
      status: "Ongoing",
      type: "TV",
      totalEpisodes: "12",
      genres: ["Action", "Fantasy"],
      synopsis: "Sung Jinwoo kembali beraksi.",
    };
    const anime = mapAnimasuDetailToAnime(detailData);
    expect(anime.japaneseTitle).toBeNull();
    expect(anime.alternativeTitles).toContain("Ore dake Level Up na Ken");
    expect(anime.score).toBe(8.7);
    expect(anime.synopsis).toBe("Sung Jinwoo kembali beraksi.");
  });
});

describe("User Simulation: Watch Progress & History", () => {
  it("saves watch progress and correctly calculates completed state", async () => {
    const { prisma } = await import("@/lib/db");
    const mockEpisode = { id: "ep_sample", animeId: "anime_sample", duration: 1440 };
    (prisma.episode.findUnique as any).mockResolvedValue(mockEpisode);
    (prisma.watchHistory.upsert as any).mockImplementation(({ create }: any) => ({
      id: "hist_1",
      progress: create.progress,
      duration: create.duration,
      completed: create.completed,
      updatedAt: new Date(),
    }));

    const { POST } = await import("./watch-progress/route");
    
    // Test within 20s of end (1425s / 1440s)
    const reqCompleted = mockRequest("/api/watch-progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ episodeId: "ep_sample", progress: 1425, duration: 1440 }),
    });
    const res = await POST(reqCompleted);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.completed).toBe(true);
  });

  it("clears watch history when user requests delete all", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.watchHistory.deleteMany as any).mockResolvedValue({ count: 5 });

    const { DELETE } = await import("./watch-history/route");
    const req = mockRequest("/api/watch-history", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(prisma.watchHistory.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_test_123" },
    });
  });
});

describe("User Simulation: Favorites Management", () => {
  it("adds and deletes favorites with colon-separated slugs", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.anime.findFirst as any).mockResolvedValue({ id: "db_anime_1" });
    (prisma.favorite.deleteMany as any).mockResolvedValue({ count: 1 });

    const { DELETE } = await import("./favorites/[animeId]/route");
    const req = mockRequest("/api/favorites/animasu%3Anaruto", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ animeId: "animasu:naruto" }) });
    expect(res.status).toBe(200);
    expect(prisma.favorite.deleteMany).toHaveBeenCalled();
  });
});
