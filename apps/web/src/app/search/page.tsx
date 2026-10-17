import { Suspense } from "react";
import type { Metadata } from "next";
import { catalogQuerySchema } from "@aninusa/types";
import { AnimeCard } from "@/components/anime-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";
import { listAnime, listGenres, listSeasonYears, listStudios } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Pencarian anime",
  description: "Cari anime berdasarkan judul, judul Jepang, genre, studio, tahun, musim, atau status.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") normalized[key] = value;
  }

  const parsed = catalogQuerySchema.safeParse(normalized);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  const hasQuery = Boolean(query.q && query.q.trim().length >= 2);

  const [result, genres, studios, years] = await Promise.all([
    hasQuery ? listAnime(query) : Promise.resolve(null),
    listGenres(),
    listStudios(),
    listSeasonYears(),
  ]);

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Pencarian</h1>
        <div className="max-w-2xl">
          <SearchBox autoFocus initialQuery={query.q ?? ""} />
        </div>
        {hasQuery && result && (
          <p className="text-sm text-white/50">
            {result.total.toLocaleString("id-ID")} hasil untuk{" "}
            <span className="font-semibold text-white">“{query.q}”</span>
          </p>
        )}
      </header>

      <Suspense fallback={<div className="skeleton h-40 w-full" />}>
        <CatalogFilters genres={genres} studios={studios} years={years} basePath="/search" />
      </Suspense>

      {!hasQuery ? (
        <div className="surface px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">Mulai mencari anime</p>
          <p className="mt-1 text-sm text-white/50">
            Ketik minimal 2 karakter. Anda juga dapat mencari genre, studio, atau judul Jepang.
          </p>
        </div>
      ) : result && result.items.length === 0 ? (
        <div className="surface px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">Tidak ada hasil ditemukan.</p>
          <p className="mt-1 text-sm text-white/50">
            Coba kata kunci lain, atau periksa ejaan judul. Pencarian juga mendukung judul alternatif.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {result?.items.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} priority={index < 6} />
          ))}
        </div>
      )}

      {result && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          basePath="/search"
          searchParams={normalized}
        />
      )}
    </div>
  );
}
