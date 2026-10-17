import { Suspense } from "react";
import type { Metadata } from "next";
import { catalogQuerySchema } from "@aninusa/types";
import { AnimeCard } from "@/components/anime-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { Pagination } from "@/components/pagination";
import { listAnime, listGenres, listSeasonYears, listStudios } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Jelajahi katalog anime",
  description:
    "Jelajahi seluruh katalog anime AniNusa. Filter berdasarkan tipe, status, tahun, musim, genre, dan studio.",
  alternates: { canonical: "/browse" },
};

interface BrowsePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const raw = await searchParams;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") normalized[key] = value;
  }

  const parsed = catalogQuerySchema.safeParse(normalized);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});

  const [result, genres, studios, years] = await Promise.all([
    listAnime(query),
    listGenres(),
    listStudios(),
    listSeasonYears(),
  ]);

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Jelajahi anime</h1>
        <p className="text-sm text-white/50">
          {result.total.toLocaleString("id-ID")} judul tersedia dalam katalog.
        </p>
      </header>

      <Suspense fallback={<div className="skeleton h-40 w-full" />}>
        <CatalogFilters genres={genres} studios={studios} years={years} />
      </Suspense>

      {result.items.length === 0 ? (
        <div className="surface px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">Tidak ada anime yang cocok.</p>
          <p className="mt-1 text-sm text-white/50">Coba ubah atau reset filter Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {result.items.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} priority={index < 6} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/browse"
        searchParams={normalized}
      />
    </div>
  );
}
