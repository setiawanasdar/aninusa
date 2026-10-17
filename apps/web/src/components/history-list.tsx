"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import type { WatchHistoryEntry } from "@aninusa/types";
import { formatDuration, formatEpisodeNumber, formatRelativeTime } from "@aninusa/utils";

interface HistoryListProps {
  entries: WatchHistoryEntry[];
}

export function HistoryList({ entries }: HistoryListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const remove = async (id: string) => {
    setPendingId(id);
    try {
      await fetch(`/api/watch-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await fetch("/api/watch-history", { method: "DELETE" });
      router.refresh();
    } finally {
      setClearing(false);
    }
  };

  if (!entries.length) {
    return (
      <div className="surface px-6 py-10 text-center">
        <p className="text-sm font-medium text-white">Belum ada riwayat tontonan.</p>
        <p className="mt-1 text-xs text-white/45">
          Mulai menonton dan progres Anda akan muncul di sini.
        </p>
        <Link href="/browse" className="btn-primary mt-4">
          Jelajahi anime
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">{entries.length} judul terakhir</p>
        <button
          type="button"
          onClick={clearAll}
          disabled={clearing}
          className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-red-300 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Hapus semua
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => {
          const percent = entry.duration > 0 ? Math.min(100, (entry.progress / entry.duration) * 100) : 0;
          return (
            <li
              key={entry.id}
              className="surface flex items-center gap-3 overflow-hidden p-2.5"
            >
              <Link
                href={`/anime/${entry.anime.slug}/episode-${formatEpisodeNumber(entry.episode.number)}`}
                className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-ink-750"
              >
                {entry.episode.thumbnail || entry.anime.poster ? (
                  <Image
                    src={(entry.episode.thumbnail || entry.anime.poster)!}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : null}
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-4 w-4 fill-white text-white" aria-hidden="true" />
                </span>
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/60">
                  <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
                </span>
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/anime/${entry.anime.slug}`}
                  className="line-clamp-1 text-sm font-semibold text-white hover:text-accent"
                >
                  {entry.anime.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-white/45">
                  Episode {formatEpisodeNumber(entry.episode.number)}
                  {entry.episode.title ? ` · ${entry.episode.title}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-white/30">
                  {formatDuration(entry.progress)} / {formatDuration(entry.duration)} ·{" "}
                  {formatRelativeTime(entry.updatedAt)}
                  {entry.completed ? " · Selesai" : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => remove(entry.id)}
                disabled={pendingId === entry.id}
                className="shrink-0 rounded-md p-2 text-white/35 hover:bg-white/10 hover:text-red-300 disabled:opacity-40"
                aria-label={`Hapus riwayat ${entry.anime.title}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
