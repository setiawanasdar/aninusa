import type { MetadataRoute } from "next";
import type { Season } from "@aninusa/types";
import { formatSeasonSlug } from "@aninusa/utils";
import { getSitemapEntries, listGenres } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

// Generated per request so the canonical origin comes from runtime env rather
// than the build machine. Database reads are cached by the catalog layer.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/browse`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/season`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/genre`, changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    const [entries, genres] = await Promise.all([getSitemapEntries(), listGenres()]);

    const animeRoutes: MetadataRoute.Sitemap = entries.map((entry) => ({
      url: `${base}/anime/${entry.slug}`,
      lastModified: entry.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const genreRoutes: MetadataRoute.Sitemap = genres.map((genre) => ({
      url: `${base}/genre/${genre.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const currentYear = new Date().getUTCFullYear();
    const seasons: Season[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
    const seasonRoutes: MetadataRoute.Sitemap = [currentYear, currentYear - 1].flatMap((year) =>
      seasons.map((season) => ({
        url: `${base}/season/${formatSeasonSlug(year, season)}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    );

    return [...staticRoutes, ...animeRoutes, ...genreRoutes, ...seasonRoutes];
  } catch {
    return staticRoutes;
  }
}
