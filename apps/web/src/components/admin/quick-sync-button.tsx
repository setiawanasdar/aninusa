"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export function QuickSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSyncAll = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Sync AniKoto and Animasu catalogs concurrently
      const [resAniKoto, resAnimasu] = await Promise.all([
        fetch("/api/admin/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerKey: "anikoto", mode: "FULL" }),
        }),
        fetch("/api/admin/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerKey: "animasu", mode: "INCREMENTAL" }),
        }),
      ]);

      if (resAniKoto.ok && resAnimasu.ok) {
        setMessage("Katalog AniKoto & Animasu berhasil disinkronkan!");
      } else {
        setMessage("Sinkronisasi selesai dengan beberapa catatan.");
      }

      router.refresh();
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setMessage("Gagal menghubungi server untuk sinkronisasi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="hidden text-xs font-medium text-emerald-400 sm:inline animate-fade-up">
          ✓ {message}
        </span>
      )}
      <button
        type="button"
        onClick={handleSyncAll}
        disabled={loading}
        className="btn-secondary flex items-center gap-1.5 text-xs font-semibold hover:border-accent/40 hover:text-accent disabled:opacity-50"
        title="Sinkronkan katalog dari AniKoto dan Animasu API"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        ) : (
          <RefreshCw className="h-4 w-4 text-accent" />
        )}
        <span>{loading ? "Menyinkronkan..." : "Sinkronkan Sekarang"}</span>
      </button>
    </div>
  );
}
