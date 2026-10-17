"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AnimeSummary } from "@aninusa/types";
import { AnimeCard } from "./anime-card";

interface AnimeRailProps {
  title: string;
  anime: AnimeSummary[];
  href?: string;
  subtitle?: string;
  priorityFirst?: boolean;
}

export function AnimeRail({ title, anime, href, subtitle, priorityFirst = false }: AnimeRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  if (!anime.length) return null;

  const scroll = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    const amount = Math.max(280, element.clientWidth * 0.8);
    element.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-3" aria-labelledby={`rail-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id={`rail-${title.replace(/\s+/g, "-").toLowerCase()}`}
            className="text-lg font-bold tracking-tight text-white sm:text-xl"
          >
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {href && (
            <Link
              href={href}
              className="mr-1 hidden text-xs font-semibold text-white/55 hover:text-accent sm:block"
            >
              Lihat semua
            </Link>
          )}
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Gulir ${title} ke kiri`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        {anime.map((item, index) => (
          <div
            key={item.id}
            role="listitem"
            className="w-[144px] shrink-0 snap-start sm:w-[160px] lg:w-[176px]"
          >
            <AnimeCard anime={item} priority={priorityFirst && index < 4} />
          </div>
        ))}
      </div>
    </section>
  );
}
