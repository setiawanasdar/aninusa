"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Search } from "lucide-react";
import type { EpisodeDto } from "@aninusa/types";
import { formatEpisodeNumber } from "@aninusa/utils";

interface EpisodeListProps {
  animeSlug: string;
  episodes: EpisodeDto[];
  currentEpisodeNumber?: number;
  latestEpisodeNumber?: number | null;
}

const PAGE_SIZE = 100;

export function EpisodeList({ animeSlug, episodes, currentEpisodeNumber, latestEpisodeNumber }: EpisodeListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return episodes;
    return episodes.filter((episode) => {
      const haystack = `${formatEpisodeNumber(episode.number)} ${episode.title ?? ""}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [episodes, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!episodes.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-ink-850 px-4 py-8 text-center text-sm text-white/45">
        Episode belum tersedia. Sumber yang sah akan muncul setelah provider resmi terhubung.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {episodes.length > 12 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Cari nomor atau judul episode..."
            aria-label="Cari episode"
            className="input pl-9"
          />
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {visible.map((episode) => {
          const active = currentEpisodeNumber === episode.number;
          const isNew = latestEpisodeNumber !== null && latestEpisodeNumber !== undefined && episode.number === latestEpisodeNumber;
          return (
            <Link
              key={episode.id}
              href={`/anime/${animeSlug}/episode-${formatEpisodeNumber(episode.number)}`}
              aria-current={active ? "page" : undefined}
              title={episode.title ?? `Episode ${formatEpisodeNumber(episode.number)}`}
              className={`group relative flex items-center justify-center rounded-md border px-1 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:border-accent/40 hover:bg-white/[0.09] hover:text-white"
              }`}
            >
              {formatEpisodeNumber(episode.number)}
              {isNew && !active && (
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent"
                  aria-label="Episode terbaru"
                />
              )}
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={safePage === 0}
            className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Sebelumnya
          </button>
          <span className="text-xs text-white/40">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            disabled={safePage >= totalPages - 1}
            className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-30"
          >
            Berikutnya <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-white/45">Tidak ada episode yang cocok.</p>
      )}

      {visible.length > 0 && (
        <p className="flex items-center gap-1.5 pt-1 text-[11px] text-white/35">
          <Play className="h-3 w-3" aria-hidden="true" />
          Pilih episode untuk mulai menonton dengan subtitle Indonesia.
        </p>
      )}
    </div>
  );
}
