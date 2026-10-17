import Link from "next/link";
import { ChevronLeft, CloudDownload, PenTool } from "lucide-react";
import { AnimeForm } from "@/components/admin/anime-form";
import { AniKotoImporter } from "@/components/admin/anikoto-importer";
import { requireAdminPage } from "@/lib/page-auth";

export default async function NewAnimePage() {
  await requireAdminPage("/admin/anime/new");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/anime" className="flex items-center gap-1 text-xs text-white/45 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Kembali ke daftar
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Tambah Anime</h1>
        <p className="text-sm text-white/45">
          Gunakan API AniKoto untuk mengimport anime otomatis beserta seluruh episodenya, atau isi form manual.
        </p>
      </header>

      {/* Import dari AniKoto */}
      <section className="surface p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <CloudDownload className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-bold text-white">Import Otomatis dari AniKoto API</h2>
            <p className="text-xs text-white/45">
              Cari judul anime (misal: One Piece, Naruto, Bleach) untuk mengimport metadata dan episode sekaligus.
            </p>
          </div>
        </div>

        <AniKotoImporter />
      </section>

      {/* Form Manual */}
      <details className="surface p-5 group">
        <summary className="flex cursor-pointer items-center justify-between font-semibold text-white/70 hover:text-white">
          <span className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-white/40" />
            Input Manual (Tanpa API)
          </span>
          <span className="text-xs text-white/40 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="pt-5 border-t border-white/10 mt-4">
          <AnimeForm />
        </div>
      </details>
    </div>
  );
}
