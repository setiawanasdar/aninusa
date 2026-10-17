import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun AniNusa untuk menyinkronkan favorit dan riwayat tontonan.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/profile");

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Selamat datang kembali</h1>
          <p className="mt-1 text-sm text-white/50">Masuk untuk melanjutkan tontonan Anda.</p>
        </div>
        <div className="surface p-6">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
