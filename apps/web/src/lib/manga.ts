import { cache as reactCache } from "react";
import type { ChapterDetail, MangaDetail, MangaSummary } from "@aninusa/types";
import { CACHE_KEYS, CACHE_TTL, cache } from "./cache";
import { prisma } from "./db";

const rawEndpoint = process.env.KOMIKU_API_URL ?? "https://komiku-api-eta.vercel.app";
export const KOMIKU_API_URL = rawEndpoint.replace(/\/+$/, "");

/**
 * Fetch helper for Komiku API with timeout, caching, and error handling.
 */
async function fetchKomiku<T>(
  path: string,
  options?: { revalidate?: number; timeoutMs?: number },
): Promise<T | null> {
  const url = `${KOMIKU_API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: options?.revalidate ?? 600 },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 4500),
      headers: {
        Accept: "application/json",
        "User-Agent": "AniNusa/1.0 (MangaReader)",
      },
    });
    if (!res.ok) {
      console.warn(`Komiku API error: HTTP ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`Komiku API request failed for ${path}:`, error);
    return null;
  }
}

/**
 * Normalizes a comic slug string (removes leading/trailing slashes).
 */
export function cleanComicSlug(slug: string): string {
  return slug
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^manga\//i, "")
    .replace(/^chapter\//i, "");
}

/**
 * HTML parser for Komiku list endpoints (supports real pagination).
 */
function parseKomikuHtml(html: string): MangaSummary[] {
  const list: MangaSummary[] = [];
  const bgeRegex = /<div class="bge">([\s\S]*?)<\/div>\s*<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = bgeRegex.exec(html)) !== null) {
    const block = match[1];
    const linkMatch =
      block.match(/href="https:\/\/komiku\.org\/manga\/([^/"]+)\/?"/i) ||
      block.match(/href="\/manga\/([^/"]+)\/?"/i);
    const titleMatch =
      block.match(/<h3>\s*([^<]+)\s*<\/h3>/i) ||
      block.match(/alt="([^"]+)"/i);
    const imgMatch = block.match(/src="([^"]+)"/i);
    const typeMatch = block.match(/<b>(Manga|Manhwa|Manhua)<\/b>/i);
    const descMatch = block.match(/<p>\s*([^<]+)\s*<\/p>/i);
    const chapterMatch = block.match(
      /href="(?:\/|https:\/\/komiku\.org\/)([^/"]+)\/?"[^>]*>[\s\S]*?<span>(Chapter[^<]+)<\/span>/i
    );

    if (linkMatch && linkMatch[1]) {
      const slug = cleanComicSlug(linkMatch[1]);
      list.push({
        slug,
        title: titleMatch ? titleMatch[1].trim() : slug,
        thumbnail: imgMatch ? imgMatch[1].replace(/&#038;/g, "&") : "",
        type: typeMatch ? typeMatch[1] : "Manga",
        description: descMatch ? descMatch[1].trim() : undefined,
        latestChapter: chapterMatch
          ? {
              chapterSlug: cleanComicSlug(chapterMatch[1]),
              title: chapterMatch[2].trim(),
            }
          : undefined,
      });
    }
  }

  return list;
}

/**
 * Fetch latest manga/komik updates with real pagination.
 */
export async function getMangaLatest(page = 1): Promise<{
  items: MangaSummary[];
  page: number;
  count: number;
  hasNextPage: boolean;
}> {
  const safePage = Math.max(1, page);
  const cacheKey = CACHE_KEYS.mangaLatest(safePage);
  const hit = await cache().get<{
    items: MangaSummary[];
    page: number;
    count: number;
    hasNextPage: boolean;
  }>(cacheKey);
  if (hit) return hit;

  let items: MangaSummary[] = [];

  // Try direct paginated scrape from Komiku API
  try {
    const res = await fetch(`https://api.komiku.org/manga/page/${safePage}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const html = await res.text();
      items = parseKomikuHtml(html);
    }
  } catch (err) {
    console.warn(`Failed direct Komiku latest page ${safePage}:`, err);
  }

  // Fallback to fetchKomiku scraper if page 1
  if (items.length === 0 && safePage === 1) {
    const res = await fetchKomiku<{
      success: boolean;
      count: number;
      results: any[];
    }>("/api/latest");

    const rawList = Array.isArray(res?.results) ? res.results : [];
    items = rawList.map((item: any) => ({
      title: item.title || "Komik",
      altTitle: item.altTitle || undefined,
      slug: cleanComicSlug(item.slug || ""),
      type: item.type || "Manga",
      thumbnail: item.thumbnail || "",
      description: item.description || undefined,
      latestChapter: item.latestChapter
        ? {
            title: (item.latestChapter.title || "").replace(/Terbaru:\s*/i, "").trim(),
            chapterSlug: cleanComicSlug(item.latestChapter.chapterSlug || ""),
            url: item.latestChapter.url,
          }
        : undefined,
      url: item.url,
    }));
  }

  const result = {
    items,
    page: safePage,
    count: items.length,
    hasNextPage: items.length >= 10,
  };

  await cache().set(cacheKey, result, CACHE_TTL.mangaList);
  return result;
}

/**
 * Fetch popular manga ranking.
 */
export async function getMangaPopular(): Promise<MangaSummary[]> {
  const cacheKey = CACHE_KEYS.mangaPopular;
  const hit = await cache().get<MangaSummary[]>(cacheKey);
  if (hit) return hit;

  const res = await fetchKomiku<{
    success: boolean;
    count: number;
    results: any[];
  }>("/api/popular");

  const rawList = Array.isArray(res?.results) ? res.results : [];
  const items: MangaSummary[] = rawList.map((item: any, idx: number) => ({
    rank: typeof item.rank === "number" ? item.rank : idx + 1,
    title: item.title || "Komik",
    slug: cleanComicSlug(item.slug || ""),
    type: "Manga",
    genre: item.genre || undefined,
    views: item.views || undefined,
    thumbnail: item.thumbnail || "",
    latestChapter: item.latestChapter
      ? {
          title: (item.latestChapter.title || "").replace(/Terbaru:\s*/i, "").trim(),
          chapterSlug: cleanComicSlug(item.latestChapter.chapterSlug || ""),
          url: item.latestChapter.url,
        }
      : undefined,
    url: item.url,
  }));

  await cache().set(cacheKey, items, CACHE_TTL.mangaList);
  return items;
}

/**
 * Search manga/komik by keyword.
 */
export async function searchManga(
  keyword: string,
  page = 1,
): Promise<{
  items: MangaSummary[];
  keyword: string;
  page: number;
  total: number;
}> {
  const clean = keyword.trim();
  if (!clean) {
    return { items: [], keyword: "", page: 1, total: 0 };
  }

  const safePage = Math.max(1, page);
  const cacheKey = CACHE_KEYS.mangaSearch(clean.toLowerCase(), safePage);
  const hit = await cache().get<{
    items: MangaSummary[];
    keyword: string;
    page: number;
    total: number;
  }>(cacheKey);
  if (hit) return hit;

  const res = await fetchKomiku<{
    success: boolean;
    count: number;
    results: any[];
  }>(`/api/search?keyword=${encodeURIComponent(clean)}&page=${safePage}`);

  const rawList = Array.isArray(res?.results) ? res.results : [];
  const items: MangaSummary[] = rawList.map((item: any) => ({
    title: item.title || clean,
    altTitle: item.altTitle || undefined,
    slug: cleanComicSlug(item.slug || ""),
    type: item.type || "Manga",
    thumbnail: item.thumbnail || "",
    description: item.description || undefined,
    firstChapter: item.firstChapter
      ? {
          title: item.firstChapter.title || "",
          chapterSlug: cleanComicSlug(item.firstChapter.chapterSlug || ""),
          url: item.firstChapter.url,
        }
      : undefined,
    latestChapter: item.latestChapter
      ? {
          title: (item.latestChapter.title || "").replace(/Terbaru:\s*/i, "").trim(),
          chapterSlug: cleanComicSlug(item.latestChapter.chapterSlug || ""),
          url: item.latestChapter.url,
        }
      : undefined,
    url: item.url,
  }));

  const result = {
    items,
    keyword: clean,
    page: safePage,
    total: items.length,
  };

  await cache().set(cacheKey, result, 180);
  return result;
}

/**
 * Fetch detailed comic information with full chapter list.
 */
export const getMangaDetail = reactCache(async (slug: string): Promise<MangaDetail | null> => {
  const cleanSlug = cleanComicSlug(slug);
  if (!cleanSlug) return null;

  const cacheKey = CACHE_KEYS.mangaDetail(cleanSlug);
  const hit = await cache().get<MangaDetail>(cacheKey);
  if (hit) return hit;

  const res = await fetchKomiku<{
    success: boolean;
    results?: any;
  }>(`/api/comic/${encodeURIComponent(cleanSlug)}`);

  const raw = res?.results;
  if (!raw || !raw.title) return null;

  const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  const chapters = rawChapters.map((ch: any) => ({
    title: (ch.title || "Chapter").trim(),
    chapterSlug: cleanComicSlug(ch.chapterSlug || ch.slug || ""),
    url: ch.url,
    releaseDate: ch.releaseDate || undefined,
  }));

  const detail: MangaDetail = {
    title: raw.title,
    altTitle: raw.altTitle || undefined,
    slug: cleanComicSlug(raw.slug || cleanSlug),
    thumbnail: raw.thumbnail || "",
    synopsis: raw.synopsis || undefined,
    metadata: raw.metadata
      ? {
          type: raw.metadata.type || undefined,
          theme: raw.metadata.theme || undefined,
          author: raw.metadata.author || undefined,
          status: raw.metadata.status || undefined,
          rating: raw.metadata.rating || undefined,
          readingDirection: raw.metadata.readingDirection || undefined,
        }
      : undefined,
    genres: Array.isArray(raw.genres) ? raw.genres.filter(Boolean) : [],
    totalChapters: typeof raw.totalChapters === "number" ? raw.totalChapters : chapters.length,
    chapters,
    url: raw.url,
  };

  await cache().set(cacheKey, detail, CACHE_TTL.mangaDetail);
  return detail;
});

/**
 * Fetch chapter images and navigation for the manga reader.
 */
export const getChapterDetail = reactCache(
  async (chapterSlug: string, optionalComicSlug?: string): Promise<ChapterDetail | null> => {
    const cleanChapter = cleanComicSlug(chapterSlug);
    if (!cleanChapter) return null;

    const cacheKey = CACHE_KEYS.mangaChapter(cleanChapter);
    const hit = await cache().get<ChapterDetail>(cacheKey);
    if (hit) return hit;

    const res = await fetchKomiku<{
      success: boolean;
      count: number;
      results?: any;
    }>(`/api/chapter/${encodeURIComponent(cleanChapter)}`);

    const raw = res?.results;
    if (!raw || !raw.images || !Array.isArray(raw.images)) return null;

    const comicSlug = cleanComicSlug(raw.comic?.slug || optionalComicSlug || "");
    let prevChapter = raw.navigation?.prevChapter ? cleanComicSlug(raw.navigation.prevChapter) : null;
    let nextChapter = raw.navigation?.nextChapter ? cleanComicSlug(raw.navigation.nextChapter) : null;

    // If navigation is null from upstream, resolve accurately from comic detail's chapter list
    if ((!prevChapter || !nextChapter) && comicSlug) {
      try {
        const comic = await getMangaDetail(comicSlug);
        if (comic && comic.chapters.length > 0) {
          const index = comic.chapters.findIndex((c) => c.chapterSlug === cleanChapter);
          if (index !== -1) {
            if (!nextChapter && index > 0) {
              nextChapter = comic.chapters[index - 1].chapterSlug;
            }
            if (!prevChapter && index < comic.chapters.length - 1) {
              prevChapter = comic.chapters[index + 1].chapterSlug;
            }
          }
        }
      } catch (e) {
        console.warn(`Could not resolve navigation chapters for ${cleanChapter}:`, e);
      }
    }

    const images = raw.images.map((img: any, i: number) => ({
      page: typeof img.page === "number" ? img.page : i + 1,
      url: img.url || "",
      alt: img.alt || `Halaman ${i + 1}`,
    }));

    const result: ChapterDetail = {
      title: raw.title || `Chapter ${cleanChapter}`,
      chapterSlug: cleanChapter,
      comic: {
        title: raw.comic?.title || "Komik",
        slug: comicSlug,
        url: raw.comic?.url,
      },
      navigation: {
        prevChapter,
        nextChapter,
      },
      totalImages: typeof raw.totalImages === "number" ? raw.totalImages : images.length,
      images,
    };

    await cache().set(cacheKey, result, CACHE_TTL.mangaChapter);
    return result;
  },
);

export interface MangaHomeData {
  featured: MangaSummary | null;
  popular: MangaSummary[];
  latest: MangaSummary[];
  manhwa: MangaSummary[];
  manga: MangaSummary[];
  manhua: MangaSummary[];
}

/**
 * Aggregates home sections for the dedicated Manga portal with zero duplicate items.
 */
export async function getMangaHomeSections(): Promise<MangaHomeData> {
  const cacheKey = CACHE_KEYS.mangaHome;
  const hit = await cache().get<MangaHomeData>(cacheKey);
  if (hit) return hit;

  const [popular, latestData] = await Promise.all([
    getMangaPopular().catch(() => [] as MangaSummary[]),
    getMangaLatest(1).catch(() => ({
      items: [] as MangaSummary[],
      page: 1,
      count: 0,
      hasNextPage: false,
    })),
  ]);

  const latest = latestData.items;

  // Create deduplicated pool from both popular and latest
  const itemMap = new Map<string, MangaSummary>();
  for (const item of popular) {
    if (item.slug && !itemMap.has(item.slug)) {
      itemMap.set(item.slug, item);
    }
  }
  for (const item of latest) {
    if (item.slug && !itemMap.has(item.slug)) {
      itemMap.set(item.slug, item);
    }
  }
  const allPool = Array.from(itemMap.values());

  const featured = popular[0] || latest[0] || null;

  const manhwa = allPool.filter((item) =>
    (item.type || "").toLowerCase().includes("manhwa")
  );
  const manga = allPool.filter((item) =>
    (item.type || "").toLowerCase().includes("manga")
  );
  const manhua = allPool.filter((item) =>
    (item.type || "").toLowerCase().includes("manhua")
  );

  const data: MangaHomeData = {
    featured,
    popular,
    latest,
    manhwa: manhwa.length > 0 ? manhwa : popular.slice(0, 10),
    manga: manga.length > 0 ? manga : popular.slice(0, 10),
    manhua: manhua.length > 0 ? manhua : latest.slice(0, 10),
  };

  await cache().set(cacheKey, data, CACHE_TTL.mangaHome);
  return data;
}

/**
 * Common manga/manhwa/manhua genres for the genre browser.
 */
export const MANGA_GENRES = [
  { name: "Action", slug: "action" },
  { name: "Adventure", slug: "adventure" },
  { name: "Comedy", slug: "comedy" },
  { name: "Drama", slug: "drama" },
  { name: "Fantasy", slug: "fantasy" },
  { name: "Horror", slug: "horror" },
  { name: "Isekai", slug: "isekai" },
  { name: "Martial Arts", slug: "martial-arts" },
  { name: "Mecha", slug: "mecha" },
  { name: "Mystery", slug: "mystery" },
  { name: "Psychological", slug: "psychological" },
  { name: "Romance", slug: "romance" },
  { name: "School Life", slug: "school-life" },
  { name: "Sci-Fi", slug: "sci-fi" },
  { name: "Seinen", slug: "seinen" },
  { name: "Shoujo", slug: "shoujo" },
  { name: "Shounen", slug: "shounen" },
  { name: "Slice of Life", slug: "slice-of-life" },
  { name: "Sports", slug: "sports" },
  { name: "Supernatural", slug: "supernatural" },
  { name: "Thriller", slug: "thriller" },
  { name: "Tragedy", slug: "tragedy" },
] as const;

export type MangaGenre = (typeof MANGA_GENRES)[number];

export function getMangaGenres(): readonly MangaGenre[] {
  return MANGA_GENRES;
}

/**
 * Fetch manga filtered by genre with REAL pagination.
 */
export async function getMangaByGenre(
  genre: string,
  page = 1,
): Promise<{
  items: MangaSummary[];
  genre: string;
  page: number;
  total: number;
  hasNextPage: boolean;
}> {
  const safePage = Math.max(1, page);
  const genreEntry = MANGA_GENRES.find(
    (g) => g.slug === genre || g.name.toLowerCase() === genre.toLowerCase()
  );
  const genreSlug = genreEntry ? genreEntry.slug : genre.toLowerCase();
  const keyword = genreEntry ? genreEntry.name : genre;

  const cacheKey = CACHE_KEYS.mangaGenreSearch(genreSlug, safePage);
  const hit = await cache().get<{
    items: MangaSummary[];
    genre: string;
    page: number;
    total: number;
    hasNextPage: boolean;
  }>(cacheKey);
  if (hit) return hit;

  let items: MangaSummary[] = [];

  // Try direct paginated genre from Komiku API
  try {
    const res = await fetch(
      `https://api.komiku.org/manga/page/${safePage}/?genre2=${encodeURIComponent(genreSlug)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(4500),
        next: { revalidate: 600 },
      }
    );
    if (res.ok) {
      const html = await res.text();
      items = parseKomikuHtml(html);
    }
  } catch (err) {
    console.warn(`Failed direct Komiku genre page ${safePage}:`, err);
  }

  // Fallback to search endpoint only if page 1
  if (items.length === 0 && safePage === 1) {
    const res = await fetchKomiku<{
      success: boolean;
      count: number;
      results: any[];
    }>(`/api/search?keyword=${encodeURIComponent(keyword)}`);

    const rawList = Array.isArray(res?.results) ? res.results : [];
    items = rawList.map((item: any) => ({
      title: item.title || keyword,
      altTitle: item.altTitle || undefined,
      slug: cleanComicSlug(item.slug || ""),
      type: item.type || "Manga",
      thumbnail: item.thumbnail || "",
      description: item.description || undefined,
      latestChapter: item.latestChapter
        ? {
            title: (item.latestChapter.title || "").replace(/Terbaru:\s*/i, "").trim(),
            chapterSlug: cleanComicSlug(item.latestChapter.chapterSlug || ""),
            url: item.latestChapter.url,
          }
        : undefined,
      url: item.url,
    }));
  }

  const result = {
    items,
    genre,
    page: safePage,
    total: items.length,
    hasNextPage: items.length >= 10,
  };

  await cache().set(cacheKey, result, CACHE_TTL.mangaList);
  return result;
}

/**
 * Fetch manga filtered by comic type (Manhwa, Manga, Manhua) with REAL pagination.
 */
export async function getMangaByType(
  type: "manhwa" | "manga" | "manhua",
  page = 1,
): Promise<{
  items: MangaSummary[];
  type: string;
  page: number;
  total: number;
  hasNextPage: boolean;
}> {
  const safePage = Math.max(1, page);
  const cacheKey = `manga:type:${type}:${safePage}`;
  const hit = await cache().get<{
    items: MangaSummary[];
    type: string;
    page: number;
    total: number;
    hasNextPage: boolean;
  }>(cacheKey);
  if (hit) return hit;

  let items: MangaSummary[] = [];

  try {
    const res = await fetch(
      `https://api.komiku.org/manga/page/${safePage}/?tipe=${type}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(4500),
        next: { revalidate: 600 },
      }
    );
    if (res.ok) {
      const html = await res.text();
      items = parseKomikuHtml(html);
    }
  } catch (err) {
    console.warn(`Failed direct Komiku type ${type} page ${safePage}:`, err);
  }

  const result = {
    items,
    type,
    page: safePage,
    total: items.length,
    hasNextPage: items.length >= 10,
  };

  await cache().set(cacheKey, result, CACHE_TTL.mangaList);
  return result;
}

/**
 * Database helpers: User Manga Favorites & Reading History
 */
export async function getUserMangaFavorites(userId: string) {
  return prisma.mangaFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserMangaReadingHistory(userId: string, limit = 10) {
  return prisma.mangaReadingHistory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function isMangaFavorited(userId: string, comicSlug: string) {
  const hit = await prisma.mangaFavorite.findUnique({
    where: {
      userId_comicSlug: {
        userId,
        comicSlug,
      },
    },
    select: { id: true },
  });
  return Boolean(hit);
}
