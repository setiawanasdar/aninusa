"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteButtonProps {
  endpoint: string;
  confirmMessage: string;
  label?: string;
  redirectTo?: string;
  className?: string;
}

export function DeleteButton({
  endpoint,
  confirmMessage,
  label = "Hapus",
  redirectTo,
  className = "",
}: DeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const remove = async () => {
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        window.alert(payload?.error?.message ?? "Gagal menghapus data.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      window.alert("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-300/80 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40 ${className}`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
