"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Search, Sparkles, X } from "lucide-react";
import type { MangaSummary } from "@aninusa/types";

interface MangaSearchBoxProps {
  autoFocus?: boolean;
  initialQuery?: string;
  className?: string;
  compact?: boolean;
  onSelect?: () => void;
}

export function MangaSearchBox({
  autoFocus = false,
  initialQuery = "",
  className = "",
  compact = false,
  onSelect,
}: MangaSearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        const response = await fetch(
          `/api/manga/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { items?: MangaSummary[] };
        setResults((payload.items ?? []).slice(0, 6));
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const submit = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setOpen(false);
    onSelect?.();
    router.push(`/manga/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && event.key === "ArrowDown") {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => (idx + 1 < results.length ? idx + 1 : idx));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => (idx > 0 ? idx - 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        const target = results[activeIndex];
        setOpen(false);
        onSelect?.();
        router.push(`/manga/${target.slug}`);
      } else {
        submit(query);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="relative"
      >
        <Search
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40 ${
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          }`}
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder="Cari komik, manga, manhwa..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          className={`w-full rounded-lg border border-white/10 bg-ink-850 text-xs text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${
            compact ? "py-2 pl-9 pr-8" : "py-2.5 pl-10 pr-9 sm:text-sm"
          }`}
        />

        {loading ? (
          <Loader2
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-white/40 ${
              compact ? "h-3.5 w-3.5" : "h-4 w-4"
            }`}
          />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 hover:text-white"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </form>

      {/* Live Dropdown Results */}
      {open && query.trim().length >= 2 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 py-1.5 shadow-2xl backdrop-blur-xl"
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-white/50">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Mencari komik...</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Hasil Pencarian
              </div>

              {results.map((item, index) => {
                const isActive = index === activeIndex;
                const typeLower = (item.type || "manga").toLowerCase();
                const isManhwa = typeLower.includes("manhwa");
                const isManhua = typeLower.includes("manhua");
                const badgeColor = isManhwa
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : isManhua
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/30";

                return (
                  <button
                    key={item.slug}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      setOpen(false);
                      onSelect?.();
                      router.push(`/manga/${item.slug}`);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md border border-white/10 bg-ink-800">
                      {item.thumbnail ? (
                        <Image
                          src={item.thumbnail}
                          alt=""
                          fill
                          sizes="36px"
                          unoptimized
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/30">
                          <BookOpen className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white/95">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
                        <span
                          className={`rounded border px-1 py-0.2 text-[9px] font-bold uppercase ${badgeColor}`}
                        >
                          {item.type || "Manga"}
                        </span>
                        {item.latestChapter && (
                          <span className="truncate text-accent">
                            {item.latestChapter.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => submit(query)}
                className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.08] px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
              >
                <span>Lihat semua hasil untuk &quot;{query}&quot;</span>
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="px-4 py-6 text-center text-xs text-white/50">
              <p>Tidak ada komik ditemukan untuk &quot;{query}&quot;</p>
              <button
                type="button"
                onClick={() => submit(query)}
                className="mt-2 inline-block font-semibold text-accent hover:underline"
              >
                Coba buka halaman pencarian lengkap
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
