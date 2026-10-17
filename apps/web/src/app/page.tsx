import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimeRail } from "@/components/anime-rail";
import { ContinueWatching } from "@/components/continue-watching";
import { GenreGrid } from "@/components/genre-grid";
import { Hero } from "@/components/hero";
import { LatestEpisodes } from "@/components/latest-episodes";
import { getSessionUser } from "@/lib/auth";
import {
  getHomeSections,
  getRecommendationsForUser,
  getWatchHistoryForUser,
} from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

import { serializeJsonLd } from "@/lib/seo";
export const revalidate = 60;

export default async function HomePage() {
  const [sections, user] = await Promise.all([getHomeSections(), getSessionUser()]);
  const [history, recommendations] = user
    ? await Promise.all([
        getWatchHistoryForUser(user.id, 10),
        getRecommendationsForUser(user.id, 14),
      ])
    : [[], []];

  const seasonLabel = sections.seasonLabel
    ? `${sections.seasonLabel.season.charAt(0)}${sections.seasonLabel.season.slice(1).toLowerCase()} ${sections.seasonLabel.year}`
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AniNusa",
    url: siteUrl(),
    inLanguage: "id-ID",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl()}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Hero anime={sections.hero} />

      <div className="container-page space-y-10 pb-12 pt-8 sm:space-y-12">
        {history.length > 0 && <ContinueWatching entries={history} />}

        {recommendations.length > 0 && (
          <AnimeRail
            title="Rekomendasi untuk Anda"
            subtitle={
              history.length > 0
                ? "Berdasarkan genre yang Anda tonton"
                : "Rating tertinggi untuk memulai"
            }
            anime={recommendations}
          />
        )}

        <LatestEpisodes items={sections.latestEpisodes} />

        <AnimeRail title="Trending sekarang" anime={sections.trending} href="/browse?sort=updated" />

        <AnimeRail
          title="Populer sepanjang masa"
          subtitle="Paling banyak ditonton di AniNusa"
          anime={sections.popular}
          href="/browse?sort=popularity"
        />

        <AnimeRail
          title={seasonLabel ? `Musim ${seasonLabel}` : "Anime musiman"}
          subtitle="Rilisan musim berjalan"
          anime={sections.seasonal}
          href="/season"
        />

        <AnimeRail
          title="Rating tertinggi"
          anime={sections.topRated}
          href="/browse?sort=rating"
        />

        <AnimeRail
          title="Baru ditambahkan"
          anime={sections.recentlyAdded}
          href="/browse?sort=newest"
        />

        <AnimeRail
          title="Seri tamat"
          subtitle="Marathon tanpa menunggu"
          anime={sections.completed}
          href="/browse?status=COMPLETED"
        />

        <GenreGrid genres={sections.genres} />

        <section className="surface flex flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-white">Baru di AniNusa?</h2>
            <p className="mt-1 text-sm text-white/50">
              Buat akun gratis untuk menyimpan favorit dan melanjutkan tontonan di semua perangkat.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/register" className="btn-primary">
              Daftar gratis
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/browse" className="btn-secondary">
              Jelajahi katalog
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

