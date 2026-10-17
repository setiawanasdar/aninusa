"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, RefreshCw, Wifi } from "lucide-react";

interface ProviderActionsProps {
  providerId: string;
  providerKey: string;
  enabled: boolean;
  supported: boolean;
}

export function ProviderActions({ providerId, providerKey, enabled, supported }: ProviderActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const run = async (action: "test" | "incremental" | "full") => {
    setPending(action);
    setResult(null);

    try {
      if (action === "test") {
        const response = await fetch(`/api/admin/providers/${providerId}/test`, { method: "POST" });
        const payload = (await response.json().catch(() => null)) as
          | { data?: { ok: boolean; latencyMs: number; message: string }; error?: { message?: string } }
          | null;
        setResult(
          payload?.data
            ? `${payload.data.ok ? "OK" : "Gagal"} · ${payload.data.latencyMs}ms · ${payload.data.message}`
            : payload?.error?.message ?? "Tes provider gagal.",
        );
      } else {
        const response = await fetch("/api/admin/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            providerKey,
            mode: action === "full" ? "FULL" : "INCREMENTAL",
            limit: action === "full" ? 24 : 10,
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              data?: { status: string; stats: { created: number; updated: number; failed: number; episodes: number } };
              error?: { message?: string };
            }
          | null;
        setResult(
          payload?.data
            ? `${payload.data.status} · ${payload.data.stats.created} baru, ${payload.data.stats.updated} diperbarui, ${payload.data.stats.failed} gagal, ${payload.data.stats.episodes} episode`
            : payload?.error?.message ?? "Sinkronisasi gagal.",
        );
      }
      router.refresh();
    } catch {
      setResult("Tidak dapat menghubungi server.");
    } finally {
      setPending(null);
    }
  };

  if (!enabled || !supported) {
    return (
      <p className="text-[11px] text-white/35">
        {!enabled ? "Provider dinonaktifkan." : "Provider tidak mendukung akses otomatis."}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => run("test")}
          disabled={Boolean(pending)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-40"
        >
          {pending === "test" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
          Tes
        </button>
        <button
          type="button"
          onClick={() => run("incremental")}
          disabled={Boolean(pending)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending === "incremental" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sinkron inkremental
        </button>
        <button
          type="button"
          onClick={() => run("full")}
          disabled={Boolean(pending)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-40"
        >
          {pending === "full" ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
          Sinkron penuh
        </button>
      </div>
      {result && <p className="text-[11px] leading-snug text-white/45">{result}</p>}
    </div>
  );
}
