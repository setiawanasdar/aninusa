"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { ANIME_STATUSES, ANIME_TYPES, SEASONS, SORT_OPTIONS } from "@aninusa/types";

interface CatalogFiltersProps {
  genres: Array<{ name: string; slug: string }>;
  studios: Array<{ name: string; slug: string }>;
  years: number[];
  basePath?: string;
}

const TYPE_LABELS: Record<string, string> = {
  TV: "TV",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  MUSIC: "Music",
};

const STATUS_LABELS: Record<string, string> = {
  ONGOING: "Ongoing",
  COMPLETED: "Selesai",
  UPCOMING: "Segera",
};

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
};

const SORT_LABELS: Record<string, string> = {
  popularity: "Popularitas",
  rating: "Rating",
  newest: "Terbaru",
  updated: "Baru diperbarui",
  alphabetical: "A-Z",
};

export function CatalogFilters({ genres, studios, years, basePath = "/browse" }: CatalogFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = (key: string) => params.get(key) ?? "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  };

  const reset = () => {
    startTransition(() => router.push(basePath));
  };

  const hasFilters = ["type", "status", "year", "season", "genre", "studio", "sort"].some((key) =>
    params.get(key),
  );

  return (
    <section className="surface p-4" aria-label="Filter katalog">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" />
          Filter
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" aria-hidden="true" />}
        </h2>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <label className="block">
          <span className="label">Tipe</span>
          <select className="input" value={current("type")} onChange={(event) => update("type", event.target.value)}>
            <option value="">Semua tipe</option>
            {ANIME_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Status</span>
          <select
            className="input"
            value={current("status")}
            onChange={(event) => update("status", event.target.value)}
          >
            <option value="">Semua status</option>
            {ANIME_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] ?? status}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Tahun</span>
          <select className="input" value={current("year")} onChange={(event) => update("year", event.target.value)}>
            <option value="">Semua tahun</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Musim</span>
          <select
            className="input"
            value={current("season")}
            onChange={(event) => update("season", event.target.value)}
          >
            <option value="">Semua musim</option>
            {SEASONS.map((season) => (
              <option key={season} value={season}>
                {SEASON_LABELS[season] ?? season}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Genre</span>
          <select
            className="input"
            value={current("genre")}
            onChange={(event) => update("genre", event.target.value)}
          >
            <option value="">Semua genre</option>
            {genres.map((genre) => (
              <option key={genre.slug} value={genre.slug}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Studio</span>
          <select
            className="input"
            value={current("studio")}
            onChange={(event) => update("studio", event.target.value)}
          >
            <option value="">Semua studio</option>
            {studios.map((studio) => (
              <option key={studio.slug} value={studio.slug}>
                {studio.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Urutkan</span>
          <select
            className="input"
            value={current("sort") || "popularity"}
            onChange={(event) => update("sort", event.target.value)}
          >
            {SORT_OPTIONS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort] ?? sort}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
