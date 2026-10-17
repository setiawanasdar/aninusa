import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun AniNusa gratis untuk menyimpan favorit dan melanjutkan tontonan.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/register" },
};

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/profile");

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Buat akun AniNusa</h1>
          <p className="mt-1 text-sm text-white/50">
            Gratis. Favorit dan progres tontonan tersinkron di semua perangkat.
          </p>
        </div>
        <div className="surface p-6">
          <Suspense fallback={<div className="skeleton h-80 w-full" />}>
            <AuthForm mode="register" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
