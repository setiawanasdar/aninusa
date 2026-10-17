"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

interface RefreshMetadataButtonProps {
  animeId: string;
}

interface RefreshResult {
  providerKey: string;
  ok: boolean;
  message: string;
  episodes?: number;
  sources?: number;
  subtitles?: number;
}

export function RefreshMetadataButton({ animeId }: RefreshMetadataButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<RefreshResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setPending(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`/api/admin/anime/${animeId}/refresh`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { results: RefreshResult[] }; error?: { message?: string } }
        | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Gagal menyegarkan metadata.");
        return;
      }

      setResults(payload?.data?.results ?? []);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={refresh} disabled={pending} className="btn-secondary px-3 py-1.5 text-xs">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Segarkan metadata &amp; episode
      </button>
      {error && <p className="max-w-sm text-[11px] text-amber-300">{error}</p>}
      {results && results.length > 0 && (
        <ul className="max-w-sm space-y-0.5 text-[11px] text-white/45">
          {results.map((result) => (
            <li key={result.providerKey}>
              <span className={result.ok ? "text-emerald-300" : "text-amber-300"}>
                {result.providerKey}:
              </span>{" "}
              {result.message}
              {result.ok
                ? ` · ${result.episodes ?? 0} episode, ${result.sources ?? 0} sumber, ${result.subtitles ?? 0} subtitle`
                : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
