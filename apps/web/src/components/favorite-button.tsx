"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface FavoriteButtonProps {
  animeId: string;
  initialFavorited: boolean;
  authenticated: boolean;
  className?: string;
}

export function FavoriteButton({ animeId, initialFavorited, authenticated, className = "" }: FavoriteButtonProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = async () => {
    if (!authenticated) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setPending(true);
    setMessage(null);
    const next = !favorited;
    setFavorited(next);

    try {
      const response = next
        ? await fetch("/api/favorites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ animeId }),
          })
        : await fetch(`/api/favorites/${animeId}`, { method: "DELETE" });

      if (!response.ok) throw new Error("request failed");
      router.refresh();
    } catch {
      setFavorited(!next);
      setMessage("Gagal menyimpan favorit. Coba lagi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        className={favorited ? "btn-secondary border-accent/40 text-accent" : "btn-secondary"}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : favorited ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        )}
        {favorited ? "Tersimpan" : "Tambah ke favorit"}
      </button>
      {message && (
        <p className="mt-1.5 text-xs text-amber-300" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
