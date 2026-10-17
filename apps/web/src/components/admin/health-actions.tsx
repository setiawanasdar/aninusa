"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";

export function HealthActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sweep = async () => {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "sources", limit: 50 }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { sourcesChecked: number; subtitlesChecked: number; active: number; degraded: number; broken: number };
            error?: { message?: string };
          }
        | null;
      setResult(
        payload?.data
          ? `${payload.data.sourcesChecked} sumber & ${payload.data.subtitlesChecked} subtitle diperiksa · ${payload.data.active} aktif · ${payload.data.degraded} degradasi · ${payload.data.broken} rusak`
          : payload?.error?.message ?? "Pemeriksaan gagal.",
      );
      router.refresh();
    } catch {
      setResult("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={sweep} disabled={pending} className="btn-primary text-xs">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
        Jalankan pemeriksaan kesehatan
      </button>
      {result && <p className="text-[11px] text-white/45">{result}</p>}
      <p className="text-[11px] leading-relaxed text-white/30">
        Pemeriksaan hanya mengirim permintaan HTTP biasa. Jika provider menolak akses otomatis, sumber ditandai
        rusak dan tidak ada upaya melewati pembatasan.
      </p>
    </div>
  );
}
