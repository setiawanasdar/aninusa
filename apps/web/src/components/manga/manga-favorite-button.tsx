"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, Loader2 } from "lucide-react";

interface MangaFavoriteButtonProps {
  comicSlug: string;
  comicTitle: string;
  comicThumbnail?: string | null;
  comicType?: string | null;
  initialFavorited?: boolean;
  isLoggedIn?: boolean;
  variant?: "primary" | "secondary" | "icon";
}

export function MangaFavoriteButton({
  comicSlug,
  comicTitle,
  comicThumbnail,
  comicType = "Manga",
  initialFavorited = false,
  isLoggedIn = false,
  variant = "secondary",
}: MangaFavoriteButtonProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!isLoggedIn) {
      router.push(`/login?next=/manga/${comicSlug}`);
      return;
    }

    const previousState = favorited;
    setFavorited(!previousState);
    setLoading(true);

    try {
      const res = await fetch("/api/manga/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicSlug,
          title: comicTitle,
          thumbnail: comicThumbnail,
          type: comicType,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal mengubah favorit");
      }

      const data = await res.json();
      setFavorited(Boolean(data.favorited));
      router.refresh();
    } catch (err) {
      console.error("Failed to toggle manga favorite:", err);
      setFavorited(previousState);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={favorited ? "Hapus dari favorit" : "Tambah ke favorit"}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
          favorited
            ? "border-rose-500/40 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
            : "border-white/10 bg-ink-900/80 text-white/70 hover:border-white/20 hover:bg-ink-800 hover:text-white"
        }`}
        aria-label={favorited ? "Favorit" : "Tambah favorit"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        ) : (
          <Heart
            className={`h-4 w-4 transition-transform ${
              favorited ? "fill-rose-500 text-rose-500 scale-110" : ""
            }`}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
        favorited
          ? "border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 shadow-lg shadow-rose-500/10"
          : "border border-white/15 bg-ink-800 text-white hover:bg-ink-750 hover:border-white/25"
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
      ) : (
        <Heart
          className={`h-4 w-4 transition-transform ${
            favorited ? "fill-rose-500 text-rose-500 scale-110" : "text-white/70"
          }`}
        />
      )}
      <span>{favorited ? "Tersimpan di Favorit" : "Tambah ke Favorit"}</span>
    </button>
  );
}
