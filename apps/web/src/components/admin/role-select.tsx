"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ROLES } from "@aninusa/types";

interface RoleSelectProps {
  userId: string;
  role: string;
  disabled?: boolean;
}

export function RoleSelect({ userId, role, disabled }: RoleSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (nextRole: string) => {
    const previous = value;
    setValue(nextRole);
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setValue(previous);
        setError(payload?.error?.message ?? "Gagal mengubah peran.");
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        className="rounded-md border border-white/12 bg-ink-850 px-2 py-1 text-[11px] text-white/80 disabled:opacity-40"
        value={value}
        disabled={disabled || pending}
        onChange={(event) => change(event.target.value)}
        aria-label="Peran pengguna"
      >
        {ROLES.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="h-3 w-3 animate-spin text-white/40" aria-hidden="true" />}
      {error && <span className="text-[10px] text-red-300">{error}</span>}
    </div>
  );
}
