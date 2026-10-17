"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import type { NormalizedAnime } from "@aninusa/types";

export function AniKotoImporter() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NormalizedAnime[]>([]);
  const [importingSlug, setImportingSlug] = useState<string | null>(null);
  const [imported, setImported] = useState<Record<string, { slug: string; episodes: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const search = async (searchTerm?: string) => {
    const q = (searchTerm ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/anikoto/search?q=${encodeURIComponent(q)}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Gagal mencari anime di AniKoto");
      }
      setResults(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi ke AniKoto");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (slug: string) => {
    setImportingSlug(slug);
    setError(null);

    try {
      const res = await fetch("/api/admin/anikoto/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Gagal mengimport anime");
      }
      setImported((prev) => ({
        ...prev,
        [slug]: {
          slug: payload.data.slug,
          episodes: payload.data.episodesCount,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimport anime");
    } finally {
      setImportingSlug(null);
    }
  };

  const quickSearch = (title: string) => {
    setQuery(title);
    search(title);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ketik judul anime dari AniKoto (misal: One Piece, Solo Leveling, Naruto)..."
            className="input w-full pl-9 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => search()}
          disabled={loading || !query.trim()}
          className="btn-primary shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cari di AniKoto
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/50">
        <span className="flex items-center gap-1 text-white/70">
          <Sparkles className="h-3 w-3 text-accent" /> Contoh pencarian cepat:
        </span>
        {["One Piece", "Solo Leveling", "Demon Slayer", "Jujutsu Kaisen", "Bleach", "Naruto"].map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => quickSearch(title)}
            className="rounded bg-white/[0.06] px-2 py-0.5 text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            {title}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((anime) => {
            const isImporting = importingSlug === anime.externalId;
            const importedData = imported[anime.externalId];

            return (
              <div
                key={anime.externalId}
                className="surface flex gap-3 p-3 transition-colors hover:border-white/20"
              >
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-ink-900">
                  {anime.poster ? (
                    <Image
                      src={anime.poster}
                      alt={anime.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
                      No Art
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <h3 className="line-clamp-2 text-xs font-bold text-white" title={anime.title}>
                      {anime.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/45">
                      <span className="badge text-[9px]">{anime.type ?? "TV"}</span>
                      {anime.score && <span>★ {anime.score.toFixed(1)}</span>}
                      {anime.totalEpisodes && <span>{anime.totalEpisodes} Ep</span>}
                    </div>
                    {anime.genres && anime.genres.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-[10px] text-white/35">
                        {anime.genres.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-1">
                    {importedData ? (
                      <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Terimport ({importedData.episodes} Ep)
                        </span>
                        <Link
                          href={`/anime/${importedData.slug}`}
                          target="_blank"
                          className="flex items-center gap-0.5 text-accent hover:underline"
                        >
                          Lihat <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImport(anime.externalId)}
                        disabled={Boolean(importingSlug)}
                        className="btn-primary w-full py-1.5 text-[11px]"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Mengimport...
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" /> Import ke AniNusa
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
