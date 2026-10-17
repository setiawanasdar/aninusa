import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { WatchHistoryEntry } from "@aninusa/types";
import { formatDuration, formatEpisodeNumber } from "@aninusa/utils";

export function ContinueWatching({ entries }: { entries: WatchHistoryEntry[] }) {
  if (!entries.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="continue-watching-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="continue-watching-heading" className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Lanjut menonton
          </h2>
          <p className="mt-0.5 text-xs text-white/45">Lanjutkan dari tempat Anda berhenti</p>
        </div>
        <Link href="/profile#history" className="text-xs font-semibold text-white/55 hover:text-accent">
          Riwayat lengkap
        </Link>
      </div>

      <div className="scroll-row -mx-1 px-1">
        {entries.map((entry) => {
          const percent =
            entry.duration > 0 ? Math.min(100, (entry.progress / entry.duration) * 100) : 0;
          return (
            <Link
              key={entry.id}
              href={`/anime/${entry.anime.slug}/episode-${formatEpisodeNumber(entry.episode.number)}`}
              className="group w-[260px] shrink-0 snap-start overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-[300px]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-ink-750">
                {entry.episode.thumbnail || entry.anime.poster ? (
                  <Image
                    src={(entry.episode.thumbnail || entry.anime.poster)!}
                    alt=""
                    fill
                    sizes="300px"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/90 shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ml-0.5 h-4 w-4 fill-white text-white" aria-hidden="true" />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white/85">
                  {formatDuration(entry.progress)} / {formatDuration(entry.duration)}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                  <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
                </span>
              </div>
              <div className="p-2.5">
                <h3 className="truncate text-[13px] font-semibold text-white/95">{entry.anime.title}</h3>
                <p className="mt-0.5 truncate text-[11px] text-white/45">
                  Episode {formatEpisodeNumber(entry.episode.number)}
                  {entry.episode.title ? ` · ${entry.episode.title}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
