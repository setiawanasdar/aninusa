import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Layers } from "lucide-react";
import { MangaHeader } from "@/components/manga/manga-header";
import { MANGA_GENRES } from "@/lib/manga";

export const metadata: Metadata = {
  title: "Genre Manga & Komik",
  description: "Jelajahi manga, manhwa, dan manhua berdasarkan genre favorit Anda di AniNusa.",
  alternates: { canonical: "/manga/genre" },
};

const GENRE_COLORS = [
  "from-red-500/20 to-rose-600/10 border-red-500/30",
  "from-blue-500/20 to-indigo-600/10 border-blue-500/30",
  "from-emerald-500/20 to-green-600/10 border-emerald-500/30",
  "from-amber-500/20 to-yellow-600/10 border-amber-500/30",
  "from-purple-500/20 to-violet-600/10 border-purple-500/30",
  "from-pink-500/20 to-fuchsia-600/10 border-pink-500/30",
  "from-cyan-500/20 to-teal-600/10 border-cyan-500/30",
  "from-orange-500/20 to-red-600/10 border-orange-500/30",
];

export default function MangaGenrePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <MangaHeader />

      <main className="container-page py-6 sm:py-8 space-y-6">
        <header className="space-y-2">
          <nav className="flex items-center gap-2 text-xs text-white/50" aria-label="Breadcrumb">
            <Link href="/manga" className="hover:text-accent">
              Manga & Komik
            </Link>
            <span>/</span>
            <span className="text-white/80 font-medium">Genre</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-accent" />
            Genre Manga & Komik
          </h1>
          <p className="text-sm text-white/50">
            Pilih genre favorit Anda untuk menemukan komik yang sesuai.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {MANGA_GENRES.map((genre, idx) => (
            <Link
              key={genre.slug}
              href={`/manga/genre/${genre.slug}`}
              className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/5 ${GENRE_COLORS[idx % GENRE_COLORS.length]}`}
            >
              <BookOpen className="absolute -right-2 -top-2 h-16 w-16 text-white/[0.04] transition-transform duration-500 group-hover:scale-110 group-hover:text-white/[0.08]" />
              <span className="relative text-sm font-bold text-white/90 group-hover:text-white">
                {genre.name}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
