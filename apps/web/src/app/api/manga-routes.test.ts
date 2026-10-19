import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetMangaLatest = vi.fn();
const mockGetMangaPopular = vi.fn();
const mockSearchManga = vi.fn();
const mockGetMangaDetail = vi.fn();
const mockGetChapterDetail = vi.fn();

vi.mock("@/lib/manga", () => ({
  getMangaLatest: mockGetMangaLatest,
  getMangaPopular: mockGetMangaPopular,
  searchManga: mockSearchManga,
  getMangaDetail: mockGetMangaDetail,
  getChapterDetail: mockGetChapterDetail,
}));

function request(url: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${url}`, init);
}

describe("Manga API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/manga/latest", () => {
    it("returns latest manga list", async () => {
      mockGetMangaLatest.mockResolvedValueOnce({
        items: [{ title: "Solo Leveling", slug: "solo-leveling" }],
        page: 1,
        count: 1,
        hasNextPage: true,
      });

      const { GET } = await import("./manga/latest/route");
      const res = await GET(request("/api/manga/latest?page=1"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].title).toBe("Solo Leveling");
      expect(mockGetMangaLatest).toHaveBeenCalledWith(1);
    });
  });

  describe("GET /api/manga/popular", () => {
    it("returns popular manga ranking", async () => {
      mockGetMangaPopular.mockResolvedValueOnce([
        { rank: 1, title: "Ao Ashi", slug: "ao-ashi" },
      ]);

      const { GET } = await import("./manga/popular/route");
      const res = await GET(request("/api/manga/popular"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Ao Ashi");
    });
  });

  describe("GET /api/manga/search", () => {
    it("returns search results for given keyword", async () => {
      mockSearchManga.mockResolvedValueOnce({
        items: [{ title: "One Piece", slug: "one-piece" }],
        keyword: "one piece",
        page: 1,
        total: 1,
      });

      const { GET } = await import("./manga/search/route");
      const res = await GET(request("/api/manga/search?q=one%20piece"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].title).toBe("One Piece");
      expect(mockSearchManga).toHaveBeenCalledWith("one piece", 1);
    });

    it("returns empty result when keyword is empty", async () => {
      const { GET } = await import("./manga/search/route");
      const res = await GET(request("/api/manga/search?q="));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items).toEqual([]);
      expect(mockSearchManga).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/manga/[slug]", () => {
    it("returns comic detail when found", async () => {
      mockGetMangaDetail.mockResolvedValueOnce({
        title: "Ao Ashi",
        slug: "ao-ashi",
        chapters: [{ title: "Chapter 1", chapterSlug: "ao-ashi-chapter-1" }],
      });

      const { GET } = await import("./manga/[slug]/route");
      const res = await GET(request("/api/manga/ao-ashi"), {
        params: Promise.resolve({ slug: "ao-ashi" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.title).toBe("Ao Ashi");
    });

    it("returns 404 when comic is not found", async () => {
      mockGetMangaDetail.mockResolvedValueOnce(null);

      const { GET } = await import("./manga/[slug]/route");
      const res = await GET(request("/api/manga/non-existent"), {
        params: Promise.resolve({ slug: "non-existent" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/manga/chapter/[chapterSlug]", () => {
    it("returns chapter reader details", async () => {
      mockGetChapterDetail.mockResolvedValueOnce({
        title: "Chapter 1",
        chapterSlug: "ao-ashi-chapter-1",
        comic: { title: "Ao Ashi", slug: "ao-ashi" },
        images: [{ page: 1, url: "https://image.komiku.to/1.webp" }],
        navigation: { prevChapter: null, nextChapter: "ao-ashi-chapter-2" },
      });

      const { GET } = await import("./manga/chapter/[chapterSlug]/route");
      const res = await GET(request("/api/manga/chapter/ao-ashi-chapter-1?comic=ao-ashi"), {
        params: Promise.resolve({ chapterSlug: "ao-ashi-chapter-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.title).toBe("Chapter 1");
      expect(json.data.images).toHaveLength(1);
    });
  });
});
