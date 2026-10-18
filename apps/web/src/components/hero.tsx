"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Info, Play, Star } from "lucide-react";
import type { AnimeSummary } from "@aninusa/types";

interface HeroProps {
  anime: AnimeSummary[];
}

export function Hero({ anime }: HeroProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (anime.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % anime.length);
    }, 8_000);
    return () => clearInterval(timer);
  }, [anime.length, paused]);

  if (!anime.length) return null;
  const current = anime[Math.min(active, anime.length - 1)]!;

  return (
    <section
      className="relative isolate min-h-[420px] overflow-hidden sm:min-h-[480px] lg:min-h-[540px]"
      aria-label="Anime unggulan"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {anime.map((item, index) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={index !== active}
        >
          {(() => {
            const raw = item.banner || item.poster;
            const valid = typeof raw === "string" && raw.startsWith("http") ? raw : null;
            return valid ? (
              <Image
                src={valid}
                alt=""
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover object-[center_25%]"
                unoptimized={
                  !valid.includes("anipixcdn.co") &&
                  !valid.includes("anilist.co") &&
                  !valid.includes("myanimelist.net")
                }
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-ink-800 via-ink-850 to-ink-900" />
            );
          })()}
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />

      <div className="container-page relative z-10 flex min-h-[420px] flex-col justify-end pb-10 pt-24 sm:min-h-[480px] lg:min-h-[540px] lg:pb-14">
        <div className="max-w-2xl animate-fade-up">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded bg-accent px-2 py-1 text-[11px] uppercase tracking-wider text-white">
              Unggulan
            </span>
            {current.score !== null && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                {current.score.toFixed(1)}
              </span>
            )}
            <span className="text-white/55">{current.type}</span>
            {current.year && <span className="text-white/55">{current.year}</span>}
            {current.latestEpisode !== null && (
              <span className="text-white/55">Episode terbaru {current.latestEpisode}</span>
            )}
          </div>

          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            {current.title}
          </h1>
          {current.englishTitle && current.englishTitle !== current.title && (
            <p className="mt-1 text-sm text-white/50">{current.englishTitle}</p>
          )}

          <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/70">
            {current.genres.length > 0 && (
              <span className="mr-2 font-medium text-white/85">{current.genres.slice(0, 3).join(" · ")}</span>
            )}
            {current.synopsis
              ? current.synopsis.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
              : "Sinopsis belum tersedia untuk judul ini."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/anime/${current.slug}`}
              className="btn-primary px-6"
              aria-label={`Tonton ${current.title}`}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Tonton sekarang
            </Link>
            <Link href={`/anime/${current.slug}`} className="btn-secondary px-5">
              <Info className="h-4 w-4" aria-hidden="true" />
              Detail
            </Link>
          </div>

          {anime.length > 1 && (
            <div className="mt-6 flex items-center gap-2" role="tablist" aria-label="Pilih anime unggulan">
              {anime.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={item.title}
                  onClick={() => setActive(index)}
                  className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    index === active ? "w-8 bg-accent" : "w-4 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
