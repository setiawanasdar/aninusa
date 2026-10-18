"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import type { AnimeSummary, Paginated } from "@aninusa/types";

interface SearchBoxProps {
  autoFocus?: boolean;
  initialQuery?: string;
  className?: string;
  compact?: boolean;
}

export function SearchBox({ autoFocus = false, initialQuery = "", className = "", compact = false }: SearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&perPage=6`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { data: Paginated<AnimeSummary> };
        setResults((payload.data?.items ?? []).slice(0, 6));
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const goTo = (slug: string) => {
    setOpen(false);
    router.push(`/anime/${slug}`);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          aria-hidden="true"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Cari anime"
          autoFocus={autoFocus}
          value={query}
          placeholder={compact ? "Cari anime..." : "Cari anime, genre, studio..."}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (activeIndex >= 0 && results[activeIndex]) goTo(results[activeIndex]!.slug);
              else submit();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, -1));
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className={`input pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${compact ? "py-2 text-[13px]" : ""}`}
        />
        {loading ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40"
            aria-hidden="true"
          />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(26rem,calc(100vh-10rem))] overflow-y-auto rounded-xl border border-white/20 bg-[#121217] shadow-[0_20px_50px_rgba(0,0,0,0.95)] ring-1 ring-white/10"
        >
          {results.length === 0 && !loading && (
            <p className="px-4 py-4 text-sm text-white/50">Tidak ada hasil untuk “{query.trim()}”.</p>
          )}
          {results.map((anime, index) => (
            <button
              key={anime.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => goTo(anime.slug)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex w-full items-center gap-3 border-b border-white/[0.06] last:border-b-0 px-3 py-2.5 text-left transition-colors ${
                index === activeIndex ? "bg-white/[0.10]" : "hover:bg-white/[0.05]"
              }`}
            >
              <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-700">
                {anime.poster && (
                  <Image src={anime.poster} alt="" fill sizes="40px" className="object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{anime.title}</span>
                <span className="block truncate text-xs text-white/45">
                  {[anime.type, anime.year, anime.status].filter(Boolean).join(" · ")}
                </span>
              </span>
              {anime.score !== null && (
                <span className="shrink-0 text-xs font-semibold text-amber-300">{anime.score.toFixed(1)}</span>
              )}
            </button>
          ))}
          {results.length > 0 && (
            <button
              type="button"
              onClick={submit}
              className="block w-full border-t border-white/15 bg-[#17171d] px-3 py-2.5 text-left text-xs font-semibold text-accent hover:bg-white/[0.06]"
            >
              Lihat semua hasil untuk “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
