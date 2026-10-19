import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanComicSlug,
  getChapterDetail,
  getMangaDetail,
  getMangaHomeSections,
  getMangaLatest,
  getMangaPopular,
  searchManga,
} from "./manga";
import { cache } from "./cache";

// Mock the global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("Manga Service & Helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cache().deletePrefix("manga:");
  });

  describe("cleanComicSlug", () => {
    it("strips leading/trailing slashes and prefixes", () => {
      expect(cleanComicSlug("ao-ashi")).toBe("ao-ashi");
      expect(cleanComicSlug("/manga/ao-ashi/")).toBe("ao-ashi");
      expect(cleanComicSlug("chapter/ao-ashi-chapter-410/")).toBe("ao-ashi-chapter-410");
      expect(cleanComicSlug("  solo-leveling  ")).toBe("solo-leveling");
    });
  });

  describe("getMangaLatest", () => {
    it("fetches, normalizes, and caches latest manga updates", () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 1,
          results: [
            {
              title: "Solo Leveling: Ragnarok",
              altTitle: "Aksi | 10 menit lalu",
              slug: "solo-leveling-ragnarok",
              type: "Manhwa",
              thumbnail: "https://thumbnail.komiku.org/uploads/slr.jpg",
              description: "Petualangan Suho putra Sung Jinwoo.",
              latestChapter: {
                title: "Terbaru: Chapter 50",
                chapterSlug: "solo-leveling-ragnarok-chapter-50",
                url: "https://komiku.org/slr-50/",
              },
            },
          ],
        }),
      });

      return getMangaLatest(1).then((res) => {
        expect(res.page).toBe(1);
        expect(res.items).toHaveLength(1);
        const item = res.items[0];
        expect(item.title).toBe("Solo Leveling: Ragnarok");
        expect(item.slug).toBe("solo-leveling-ragnarok");
        expect(item.type).toBe("Manhwa");
        expect(item.latestChapter?.title).toBe("Chapter 50");
        expect(item.latestChapter?.chapterSlug).toBe("solo-leveling-ragnarok-chapter-50");
      });
    });
  });

  describe("getMangaPopular", () => {
    it("fetches popular ranking manga items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          results: [
            {
              rank: 1,
              title: "Ao Ashi",
              slug: "ao-ashi",
              genre: "Sports",
              views: "100K",
              thumbnail: "https://thumbnail.komiku.to/ao-ashi.jpg",
              latestChapter: {
                title: "Chapter 410",
                chapterSlug: "ao-ashi-chapter-410",
              },
            },
            {
              rank: 2,
              title: "One Piece",
              slug: "one-piece",
              genre: "Action",
              views: "90K",
              thumbnail: "https://thumbnail.komiku.to/op.jpg",
            },
          ],
        }),
      });

      const res = await getMangaPopular();
      expect(res).toHaveLength(2);
      expect(res[0].rank).toBe(1);
      expect(res[0].title).toBe("Ao Ashi");
      expect(res[1].title).toBe("One Piece");
    });
  });

  describe("searchManga", () => {
    it("returns empty results for empty or blank query", async () => {
      const res = await searchManga("   ");
      expect(res.items).toHaveLength(0);
      expect(res.total).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("searches and parses manga results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 1,
          results: [
            {
              title: "Solo Swordmaster",
              slug: "solo-swordmaster",
              type: "Manhwa",
              thumbnail: "https://thumbnail.komiku.org/ss.jpg",
              description: "Update 1 hari lalu",
              firstChapter: {
                title: "Chapter 1",
                chapterSlug: "solo-swordmaster-chapter-1",
              },
              latestChapter: {
                title: "Terbaru: Chapter 22",
                chapterSlug: "solo-swordmaster-chapter-22",
              },
            },
          ],
        }),
      });

      const res = await searchManga("swordmaster", 1);
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toBe("Solo Swordmaster");
      expect(res.items[0].latestChapter?.title).toBe("Chapter 22");
    });
  });

  describe("getMangaDetail", () => {
    it("parses comic detail, metadata, and chapter list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            title: "Ao Ashi",
            altTitle: "Ao Ashi: Brotherfoot",
            slug: "ao-ashi",
            thumbnail: "https://thumbnail.komiku.to/ao-ashi.jpg",
            synopsis: "Kisah Ashito Aoi mengejar mimpi pemain sepak bola.",
            metadata: {
              type: "Manga",
              author: "Yūgo Kobayashi",
              status: "Ongoing",
              readingDirection: "Kanan ke kiri",
            },
            genres: ["Drama", "Sports", "Seinen"],
            totalChapters: 2,
            chapters: [
              {
                title: "Chapter 2",
                chapterSlug: "ao-ashi-chapter-2",
                releaseDate: "2026-10-18",
              },
              {
                title: "Chapter 1",
                chapterSlug: "ao-ashi-chapter-1",
                releaseDate: "2026-10-10",
              },
            ],
          },
        }),
      });

      const comic = await getMangaDetail("ao-ashi");
      expect(comic).not.toBeNull();
      expect(comic?.title).toBe("Ao Ashi");
      expect(comic?.metadata?.author).toBe("Yūgo Kobayashi");
      expect(comic?.genres).toEqual(["Drama", "Sports", "Seinen"]);
      expect(comic?.chapters).toHaveLength(2);
      expect(comic?.chapters[0].chapterSlug).toBe("ao-ashi-chapter-2");
    });
  });

  describe("getChapterDetail", () => {
    it("resolves prevChapter and nextChapter from comic detail when upstream navigation is null", async () => {
      // 1. Chapter call returning navigation: { prevChapter: null, nextChapter: null }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          results: {
            title: "Ao Ashi Chapter 2",
            chapterSlug: "ao-ashi-chapter-2",
            comic: {
              title: "Ao Ashi",
              slug: "ao-ashi",
            },
            navigation: {
              prevChapter: null,
              nextChapter: null,
            },
            totalImages: 2,
            images: [
              { page: 1, url: "https://image.komiku.to/1.webp", alt: "Hal 1" },
              { page: 2, url: "https://image.komiku.to/2.webp", alt: "Hal 2" },
            ],
          },
        }),
      });

      // 2. Comic detail call triggered to resolve navigation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            title: "Ao Ashi",
            slug: "ao-ashi",
            chapters: [
              { title: "Chapter 3", chapterSlug: "ao-ashi-chapter-3" }, // index 0 (newer)
              { title: "Chapter 2", chapterSlug: "ao-ashi-chapter-2" }, // index 1 (current)
              { title: "Chapter 1", chapterSlug: "ao-ashi-chapter-1" }, // index 2 (older)
            ],
          },
        }),
      });

      const res = await getChapterDetail("ao-ashi-chapter-2", "ao-ashi");
      expect(res).not.toBeNull();
      expect(res?.title).toBe("Ao Ashi Chapter 2");
      expect(res?.images).toHaveLength(2);

      // Newer chapter should be index - 1 ("ao-ashi-chapter-3")
      expect(res?.navigation.nextChapter).toBe("ao-ashi-chapter-3");
      // Older chapter should be index + 1 ("ao-ashi-chapter-1")
      expect(res?.navigation.prevChapter).toBe("ao-ashi-chapter-1");
    });
  });

  describe("getMangaHomeSections", () => {
    it("categorizes items into manhwa, manga, popular, and latest", async () => {
      // Mock popular
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 1,
          results: [
            {
              rank: 1,
              title: "Popular 1",
              slug: "pop-1",
            },
          ],
        }),
      });

      // Mock latest
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          results: [
            {
              title: "Manhwa 1",
              slug: "manhwa-1",
              type: "Manhwa",
            },
            {
              title: "Manga 1",
              slug: "manga-1",
              type: "Manga",
            },
          ],
        }),
      });

      const sections = await getMangaHomeSections();
      expect(sections.popular).toHaveLength(1);
      expect(sections.latest).toHaveLength(2);
      expect(sections.manhwa[0].title).toBe("Manhwa 1");
      expect(sections.manga[0].title).toBe("Manga 1");
      expect(sections.featured?.title).toBe("Popular 1");
    });
  });
});
