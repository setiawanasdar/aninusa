import type { Metadata } from "next";
import Link from "next/link";
import { AnimeCard } from "@/components/anime-card";
import { listAnime, listSeasonYears } from "@/lib/catalog";
import { formatSeasonSlug } from "@aninusa/utils";
import type { Season } from "@aninusa/types";

export const metadata: Metadata = {
  title: "Anime musiman",
  description: "Jelajahi anime berdasarkan musim dan tahun rilis: Winter, Spring, Summer, dan Fall.",
  alternates: { canonical: "/season" },
};

export const revalidate = 300;

const SEASONS: Season[] = ["WINTER", "SPRING", "SUMMER", "FALL"];

function currentSeason(): { year: number; season: Season } {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const season: Season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  return { year: now.getUTCFullYear(), season };
}

export default async function SeasonIndexPage() {
  const { year, season } = currentSeason();
  const [years, current] = await Promise.all([
    listSeasonYears(),
    listAnime({ year, season, perPage: 18, sort: "popularity" }),
  ]);

  const availableYears = years.length ? years : [year];

  return (
    <div className="container-page space-y-8 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Anime musiman</h1>
        <p className="text-sm text-white/50">
          Rilisan musim berjalan dan arsip musim sebelumnya.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-white">
            {season.charAt(0) + season.slice(1).toLowerCase()} {year}
          </h2>
          <Link
            href={`/season/${formatSeasonSlug(year, season)}`}
            className="text-xs font-semibold text-white/55 hover:text-accent"
          >
            Lihat semua
          </Link>
        </div>
        {current.items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {current.items.map((anime, index) => (
              <AnimeCard key={anime.id} anime={anime} priority={index < 6} />
            ))}
          </div>
        ) : (
          <div className="surface px-6 py-10 text-center text-sm text-white/50">
            Belum ada anime untuk musim ini.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Arsip musim</h2>
        <div className="space-y-3">
          {availableYears.slice(0, 8).map((entryYear) => (
            <div key={entryYear} className="surface p-4">
              <p className="mb-2 text-sm font-semibold text-white/80">{entryYear}</p>
              <div className="flex flex-wrap gap-2">
                {SEASONS.map((entrySeason) => (
                  <Link
                    key={entrySeason}
                    href={`/season/${formatSeasonSlug(entryYear, entrySeason)}`}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/65 transition-colors hover:border-accent/40 hover:text-white"
                  >
                    {entrySeason.charAt(0) + entrySeason.slice(1).toLowerCase()}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
