import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { EpisodeDto } from "@aninusa/types";
import { formatEpisodeNumber, formatRelativeTime } from "@aninusa/utils";

interface LatestEpisodeItem {
  episode: EpisodeDto;
  anime: {
    id: string;
    slug: string;
    title: string;
    poster: string | null;
    score: number | null;
    year: number | null;
    status: string;
  };
}

export function LatestEpisodes({ items }: { items: LatestEpisodeItem[] }) {
  if (!items.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="latest-episodes-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="latest-episodes-heading" className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Episode terbaru
          </h2>
          <p className="mt-0.5 text-xs text-white/45">Rilis terakhir dari katalog AniNusa</p>
        </div>
        <Link href="/browse?sort=updated" className="text-xs font-semibold text-white/55 hover:text-accent">
          Lihat semua
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.slice(0, 12).map((item) => (
          <Link
            key={item.episode.id}
            href={`/anime/${item.anime.slug}/episode-${formatEpisodeNumber(item.episode.number)}`}
            className="group overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-ink-750">
              {item.episode.thumbnail || item.anime.poster ? (
                <Image
                  src={(item.episode.thumbnail || item.anime.poster)!}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                EP {formatEpisodeNumber(item.episode.number)}
              </span>
              <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                  <Play className="ml-0.5 h-4 w-4 fill-white text-white" aria-hidden="true" />
                </span>
              </span>
            </div>
            <div className="p-2.5">
              <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/95">
                {item.anime.title}
              </h3>
              <p className="mt-1 truncate text-[11px] text-white/40">
                {item.episode.airDate
                  ? formatRelativeTime(item.episode.airDate)
                  : item.episode.title ?? `Episode ${formatEpisodeNumber(item.episode.number)}`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
