"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Eye, Flame, Sparkles } from "lucide-react";
import type { MangaSummary } from "@aninusa/types";

interface MangaCardProps {
  manga: MangaSummary;
  priority?: boolean;
}

export function MangaCard({ manga, priority = false }: MangaCardProps) {
  const [imgError, setImgError] = useState(false);

  const typeLower = (manga.type || "manga").toLowerCase();
  const isManhwa = typeLower.includes("manhwa");
  const isManhua = typeLower.includes("manhua");

  const badgeStyle = isManhwa
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : isManhua
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-blue-500/20 text-blue-300 border-blue-500/40";

  return (
    <article className="group/manga relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10">
      <Link
        href={`/manga/${manga.slug}`}
        className="relative block aspect-[2/3] w-full overflow-hidden bg-ink-950 focus:outline-none"
        aria-label={`Baca ${manga.title}`}
      >
        {manga.thumbnail && !imgError ? (
          <Image
            src={manga.thumbnail}
            alt={`Cover ${manga.title}`}
            fill
            sizes="(max-width: 640px) 48vw, (max-width: 1024px) 25vw, 16vw"
            priority={priority}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="object-cover transition-transform duration-500 group-hover/manga:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 p-4 text-center">
            <BookOpen className="h-10 w-10 text-white/20 mb-2" />
            <span className="line-clamp-2 text-xs font-semibold text-white/50">{manga.title}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30" />

        {/* Top Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
          {manga.rank !== undefined && (
            <span className="flex h-5 items-center gap-0.5 rounded-md bg-accent px-1.5 text-[10px] font-black text-white shadow-md">
              <Flame className="h-3 w-3 fill-current" />
              #{manga.rank}
            </span>
          )}
          <span
            className={`flex h-5 items-center rounded-md border px-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${badgeStyle}`}
          >
            {manga.type || "Manga"}
          </span>
        </div>

        {/* Center Hover Action Icon */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/manga:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/95 text-white shadow-xl shadow-accent/40 backdrop-blur-sm transition-transform duration-300 group-hover/manga:scale-110">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
        </span>

        {/* Bottom Metadata on Image */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-medium text-white/90">
          {manga.genre ? (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-md">
              {manga.genre}
            </span>
          ) : manga.views ? (
            <span className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-md">
              <Eye className="h-3 w-3 text-white/70" />
              {manga.views}
            </span>
          ) : (
            <span />
          )}

          {manga.latestChapter && (
            <span className="rounded-md bg-accent/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-sm">
              {manga.latestChapter.title.replace(/Chapter\s*/i, "Ch. ")}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <h3 className="line-clamp-2 text-xs sm:text-[13px] font-bold leading-snug text-white/90 transition-colors group-hover/manga:text-accent">
          <Link href={`/manga/${manga.slug}`}>
            {manga.title}
          </Link>
        </h3>

        {manga.description && (
          <p className="mt-1 line-clamp-1 text-[11px] text-white/45">
            {manga.description}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between gap-1.5 border-t border-white/[0.06] text-[11px]">
          {manga.latestChapter ? (
            <Link
              href={`/manga/read/${manga.latestChapter.chapterSlug}?comic=${manga.slug}`}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline truncate max-w-full"
              title={`Baca ${manga.latestChapter.title}`}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{manga.latestChapter.title}</span>
            </Link>
          ) : (
            <span className="text-white/40">Lihat Detail</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900">
      <div className="skeleton aspect-[2/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3.5 w-full rounded" />
        <div className="skeleton h-2.5 w-2/3 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
      </div>
    </div>
  );
}
