import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import type { AnimeSummary } from "@aninusa/types";
import { formatEpisodeNumber } from "@aninusa/utils";

interface AnimeCardProps {
  anime: AnimeSummary;
  priority?: boolean;
  size?: "default" | "compact";
  showProgress?: number;
}

const statusLabel: Record<string, string> = {
  ONGOING: "Ongoing",
  COMPLETED: "Selesai",
  UPCOMING: "Segera",
};

export function AnimeCard({ anime, priority = false, size = "default", showProgress }: AnimeCardProps) {
  const episodeLabel =
    anime.latestEpisode !== null && anime.latestEpisode !== undefined
      ? `Ep ${formatEpisodeNumber(anime.latestEpisode)}`
      : anime.totalEpisodes
        ? `${anime.totalEpisodes} ep`
        : null;

  return (
    <article className="group/card relative">
      <Link
        href={`/anime/${anime.slug}`}
        className="block overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800 shadow-card transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`${anime.title}${anime.year ? ` (${anime.year})` : ""}`}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink-750">
          {anime.poster ? (
            <Image
              src={anime.poster}
              alt={`Poster ${anime.title}`}
              fill
              sizes="(max-width: 640px) 42vw, (max-width: 1024px) 24vw, 15vw"
              className="object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-ink-700 text-xs text-white/30">
              Tanpa poster
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-black/10 opacity-80" />

          {anime.score !== null && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" />
              {anime.score.toFixed(1)}
            </span>
          )}

          {episodeLabel && (
            <span className="absolute right-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">
              {episodeLabel}
            </span>
          )}

          {anime.source?.toLowerCase().includes("sub indo") && (
            <span className="absolute left-2 bottom-2 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-sm">
              Sub Indo
            </span>
          )}

          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/95 shadow-lg">
              <Play className="ml-0.5 h-5 w-5 fill-white text-white" aria-hidden="true" />
            </span>
          </span>

          {showProgress !== undefined && showProgress > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
              <span
                className="block h-full bg-accent"
                style={{ width: `${Math.min(100, Math.max(0, showProgress))}%` }}
              />
            </span>
          )}
        </div>

        <div className={size === "compact" ? "p-2" : "p-2.5"}>
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/95 group-hover/card:text-white">
            {anime.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
            <span>{anime.type}</span>
            <span aria-hidden="true">·</span>
            <span>{statusLabel[anime.status] ?? anime.status}</span>
            {anime.year && (
              <>
                <span aria-hidden="true">·</span>
                <span>{anime.year}</span>
              </>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800">
      <div className="skeleton aspect-[2/3] w-full rounded-none" />
      <div className="space-y-2 p-2.5">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-2.5 w-2/3" />
      </div>
    </div>
  );
}
