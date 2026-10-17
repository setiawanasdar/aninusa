import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
        <Compass className="h-8 w-8 text-accent" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-white/50">
        Anime atau episode yang Anda cari mungkin sudah dipindahkan, atau tautannya salah.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-primary">
          Kembali ke beranda
        </Link>
        <Link href="/browse" className="btn-secondary">
          Jelajahi katalog
        </Link>
      </div>
    </div>
  );
}
