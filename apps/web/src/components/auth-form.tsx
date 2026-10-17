"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isRegister = mode === "register";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isRegister ? { email, username, password } : { email, password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: { message?: string; details?: Array<{ message: string }> } }
        | null;

      if (!response.ok) {
        const detail = payload?.error?.details?.[0]?.message;
        setError(detail ?? payload?.error?.message ?? "Terjadi kesalahan. Coba lagi.");
        return;
      }

      router.refresh();
      const destination =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.push(destination);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {isRegister && (
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            aria-describedby="username-hint"
          />
          <p id="username-hint" className="mt-1 text-[11px] text-white/35">
            3–32 karakter. Huruf, angka, titik, garis bawah, atau strip.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input"
          placeholder="nama@email.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 10 : 1}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input"
          placeholder={isRegister ? "Minimal 10 karakter, huruf dan angka" : "••••••••••"}
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isRegister ? "Buat akun" : "Masuk"}
      </button>

      <p className="text-center text-xs text-white/45">
        {isRegister ? (
          <>
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Masuk
            </Link>
          </>
        ) : (
          <>
            Belum punya akun?{" "}
            <Link href="/register" className="font-semibold text-accent hover:underline">
              Daftar gratis
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
