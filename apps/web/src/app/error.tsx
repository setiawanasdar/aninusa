"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Technical details stay on the client console; the UI never exposes them.
    console.error("[aninusa] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="container-page flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-300" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white">Terjadi kesalahan</h1>
      <p className="mt-2 max-w-md text-sm text-white/50">
        Kami tidak dapat memuat halaman ini. Coba muat ulang dalam beberapa saat.
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        <RotateCcw className="h-4 w-4" aria-hidden="true" /> Coba lagi
      </button>
    </div>
  );
}
