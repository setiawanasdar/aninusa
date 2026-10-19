import Link from "next/link";
import { BookOpen } from "lucide-react";

export function MangaFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-ink-900">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/manga" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-accent to-red-500 text-white shadow-md">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-accent font-extrabold leading-none">
                AniNusa
              </span>
              <span className="text-[15px] font-extrabold leading-tight text-white">
                Manga & Komik
              </span>
            </div>
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-white/45">
            Baca ribuan manga, manhwa, dan manhua dengan terjemahan Bahasa Indonesia.
            Update chapter tercepat dan gambar kualitas tinggi.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Jelajahi</h2>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/manga" className="hover:text-white">Semua komik</Link></li>
            <li><Link href="/manga?tab=popular" className="hover:text-white">Populer</Link></li>
            <li><Link href="/manga?tab=latest" className="hover:text-white">Update terbaru</Link></li>
            <li><Link href="/manga/genre" className="hover:text-white">Genre</Link></li>
            <li><Link href="/manga/search" className="hover:text-white">Pencarian</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Tipe Komik</h2>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/manga?tab=manga" className="hover:text-white">Manga (Jepang)</Link></li>
            <li><Link href="/manga?tab=manhwa" className="hover:text-white">Manhwa (Korea)</Link></li>
            <li><Link href="/" className="hover:text-white">↗ Tonton Anime</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Legalitas</h2>
          <p className="text-xs leading-relaxed text-white/45">
            AniNusa hanya menampilkan konten yang sah dan berlisensi. Metadata komik dapat berasal dari
            sumber API pihak ketiga. Tidak ada pembatasan akses yang dilewati.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container-page flex flex-col items-start justify-between gap-2 text-[11px] text-white/35 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} AniNusa Manga. Platform baca komik untuk Indonesia.</p>
          <p>Konten terjemahan Bahasa Indonesia.</p>
        </div>
      </div>
    </footer>
  );
}
