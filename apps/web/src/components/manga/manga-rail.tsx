"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MangaSummary } from "@aninusa/types";
import { MangaCard } from "./manga-card";

interface MangaRailProps {
  title: string;
  manga: MangaSummary[];
  href?: string;
  subtitle?: string;
  priorityFirst?: boolean;
}

export function MangaRail({
  title,
  manga,
  href,
  subtitle,
  priorityFirst = false,
}: MangaRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  if (!manga.length) return null;

  const scroll = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    const amount = Math.max(280, element.clientWidth * 0.75);
    element.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  const id = `rail-${title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;

  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="text-lg font-bold tracking-tight text-white sm:text-xl">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1.5">
          {href && (
            <Link
              href={href}
              className="mr-1 text-xs font-semibold text-white/60 hover:text-accent transition-colors"
            >
              Lihat semua
            </Link>
          )}
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Gulir ${title} ke kiri`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Gulir ${title} ke kanan`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="scroll-row -mx-1 px-1"
        role="list"
        aria-label={`Daftar ${title}`}
      >
        {manga.map((item, index) => (
          <div
            key={item.slug}
            role="listitem"
            className="w-[148px] shrink-0 snap-start sm:w-[165px] lg:w-[180px]"
          >
            <MangaCard manga={item} priority={priorityFirst && index < 4} />
          </div>
        ))}
      </div>
    </section>
  );
}
