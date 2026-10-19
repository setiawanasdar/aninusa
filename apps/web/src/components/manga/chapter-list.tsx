"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, BookOpen, Calendar, Search } from "lucide-react";
import type { MangaChapterItem } from "@aninusa/types";

interface ChapterListProps {
  chapters: MangaChapterItem[];
  comicSlug: string;
}

export function ChapterList({ chapters, comicSlug }: ChapterListProps) {
  const [search, setSearch] = useState("");
  const [ascending, setAscending] = useState(false); // Default descending (latest first)

  const filtered = useMemo(() => {
    let list = chapters;
    const clean = search.trim().toLowerCase();
    if (clean) {
      list = list.filter((ch) => ch.title.toLowerCase().includes(clean));
    }
    if (ascending) {
      return [...list].reverse();
    }
    return list;
  }, [chapters, search, ascending]);

  return (
    <div className="space-y-4">
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-ink-900/60 p-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari chapter (cth: 100, 25)..."
            className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 pl-9 text-xs text-white placeholder-white/40 focus:border-accent focus:outline-none"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40 pointer-events-none" />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          <span className="text-white/50 text-[11px]">
            {filtered.length} dari {chapters.length} chapter
          </span>
          <button
            type="button"
            onClick={() => setAscending(!ascending)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-850 px-3 py-2 font-medium text-white/80 hover:bg-ink-800 hover:text-white"
          >
            <ArrowDownUp className="h-3.5 w-3.5 text-accent" />
            <span>{ascending ? "Terlama Dulu" : "Terbaru Dulu"}</span>
          </button>
        </div>
      </div>

      {/* Chapters Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-ink-900/40 p-8 text-center text-sm text-white/40">
          Tidak ada chapter yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((ch) => (
            <Link
              key={ch.chapterSlug}
              href={`/manga/read/${ch.chapterSlug}?comic=${comicSlug}`}
              className="group flex flex-col justify-between rounded-lg border border-white/[0.06] bg-ink-850/80 p-3 transition-all duration-200 hover:border-accent/40 hover:bg-ink-800 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-accent group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-xs text-white/90 group-hover:text-accent truncate">
                  {ch.title}
                </span>
              </div>
              {ch.releaseDate && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-white/40">
                  <Calendar className="h-3 w-3" />
                  <span>{ch.releaseDate}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
