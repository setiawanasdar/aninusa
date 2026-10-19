"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Eye } from "lucide-react";
import type { MangaSummary } from "@aninusa/types";

interface MangaCardProps {
  manga: MangaSummary;
  priority?: boolean;
}

export function MangaCard({ manga, priority = false }: MangaCardProps) {
  const typeLower = (manga.type || "manga").toLowerCase();
  const isManhwa = typeLower.includes("manhwa");
  const isManhua = typeLower.includes("manhua");

  const badgeColor = isManhwa
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : isManhua
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-blue-500/20 text-blue-300 border-blue-500/40";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5">
      <Link
        href={`/manga/${manga.slug}`}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-ink-950 focus:outline-none"
        aria-label={`Baca ${manga.title}`}
      >
        {manga.thumbnail ? (
          <Image
            src={manga.thumbnail}
            alt={manga.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink-800 text-white/30">
            <BookOpen className="h-10 w-10" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-black/30" />

        {/* Top Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {manga.rank !== undefined && (
            <span className="flex h-6 items-center rounded-md bg-accent px-2 text-xs font-bold text-white shadow-md">
              #{manga.rank}
            </span>
          )}
          <span
            className={`flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold tracking-wide backdrop-blur-md ${badgeColor}`}
          >
            {manga.type || "Manga"}
          </span>
        </div>

        {/* Bottom Metadata on Image */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-white/80">
          {manga.genre ? (
            <span className="rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
              {manga.genre}
            </span>
          ) : manga.views ? (
            <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
              <Eye className="h-3 w-3" />
              {manga.views}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white/90 group-hover:text-accent transition-colors">
          <Link href={`/manga/${manga.slug}`}>
            {manga.title}
          </Link>
        </h3>

        {manga.description && (
          <p className="mt-1 line-clamp-1 text-xs text-white/45">
            {manga.description}
          </p>
        )}

        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06]">
          {manga.latestChapter ? (
            <Link
              href={`/manga/read/${manga.latestChapter.chapterSlug}?comic=${manga.slug}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent/90 hover:text-accent hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{manga.latestChapter.title}</span>
            </Link>
          ) : (
            <span className="text-[11px] text-white/40">Detail komik</span>
          )}
        </div>
      </div>
    </article>
  );
}
