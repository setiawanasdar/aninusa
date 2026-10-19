import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Compass,
  Layers,
  Sparkles,
  User,
} from "lucide-react";
import { ChapterList } from "@/components/manga/chapter-list";
import { MangaHeader } from "@/components/manga/manga-header";
import { getMangaDetail } from "@/lib/manga";

export const dynamic = "force-dynamic";

interface MangaDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MangaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const comic = await getMangaDetail(slug);

  if (!comic) {
    return { title: "Komik Tidak Ditemukan" };
  }

  return {
    title: `Komik ${comic.title} Bahasa Indonesia`,
    description: comic.synopsis
      ? comic.synopsis.slice(0, 160)
      : `Baca komik ${comic.title} subtitle Indonesia online gratis di AniNusa.`,
    openGraph: {
      title: `${comic.title} — Baca Komik Online`,
      description: comic.synopsis ? comic.synopsis.slice(0, 160) : undefined,
      images: comic.thumbnail ? [{ url: comic.thumbnail }] : [],
    },
  };
}

export default async function MangaDetailPage({ params }: MangaDetailPageProps) {
  const { slug } = await params;
  const comic = await getMangaDetail(slug);

  if (!comic) {
    notFound();
  }

  const firstChapter = comic.chapters.length > 0 ? comic.chapters[comic.chapters.length - 1] : null;
  const latestChapter = comic.chapters.length > 0 ? comic.chapters[0] : null;

  const type = comic.metadata?.type || "Manga";
  const status = comic.metadata?.status || "Ongoing";
  const author = comic.metadata?.author || "Tidak Diketahui";
  const readingDirection = comic.metadata?.readingDirection || "Kiri ke kanan";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <MangaHeader />

      <main className="container-page py-6 sm:py-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/50" aria-label="Breadcrumb">
          <Link href="/manga" className="hover:text-accent">
            Manga & Komik
          </Link>
          <span>/</span>
          <span className="text-white/80 font-medium truncate max-w-xs sm:max-w-md">
            {comic.title}
          </span>
        </nav>

        {/* Comic Header Info Card */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70 p-5 sm:p-8 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            {/* Cover image */}
            <div className="relative aspect-[3/4] w-44 sm:w-56 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl mx-auto md:mx-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comic.thumbnail}
                alt={comic.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Info and Metadata */}
            <div className="flex-1 space-y-4 text-left">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-md border border-accent/40 bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent">
                    {type}
                  </span>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                    {status}
                  </span>
                  {comic.metadata?.rating && (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      {comic.metadata.rating}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {comic.title}
                </h1>
                {comic.altTitle && (
                  <p className="text-xs sm:text-sm text-white/50 mt-1">
                    {comic.altTitle}
                  </p>
                )}
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-white/[0.06] bg-ink-950/60 p-3.5 text-xs">
                <div>
                  <span className="text-white/40 block text-[11px] mb-0.5">Penulis / Author</span>
                  <span className="font-semibold text-white/90 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-accent" />
                    {author}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[11px] mb-0.5">Arah Membaca</span>
                  <span className="font-semibold text-white/90 flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5 text-accent" />
                    {readingDirection}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[11px] mb-0.5">Total Chapter</span>
                  <span className="font-semibold text-white/90 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-accent" />
                    {comic.totalChapters} Chapter
                  </span>
                </div>
              </div>

              {/* Genres */}
              {comic.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comic.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-lg border border-white/10 bg-ink-850 px-2.5 py-1 text-xs font-medium text-white/75"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {firstChapter && (
                  <Link
                    href={`/manga/read/${firstChapter.chapterSlug}?comic=${comic.slug}`}
                    className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:bg-accent/80 hover:shadow-lg hover:shadow-accent/25"
                  >
                    <BookOpen className="h-4 w-4" />
                    Mulai Baca ({firstChapter.title})
                  </Link>
                )}

                {latestChapter && latestChapter !== firstChapter && (
                  <Link
                    href={`/manga/read/${latestChapter.chapterSlug}?comic=${comic.slug}`}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-ink-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-ink-750"
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                    Chapter Terbaru ({latestChapter.title})
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Synopsis */}
          {comic.synopsis && (
            <div className="mt-6 border-t border-white/[0.08] pt-4">
              <h2 className="text-sm font-bold text-white/80 mb-2">Sinopsis</h2>
              <p className="text-xs sm:text-sm text-white/65 leading-relaxed whitespace-pre-line">
                {comic.synopsis}
              </p>
            </div>
          )}
        </section>

        {/* Chapter List Section */}
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              Daftar Chapter
            </h2>
            <span className="text-xs text-white/40">
              {comic.chapters.length} chapter tersedia
            </span>
          </header>

          <ChapterList chapters={comic.chapters} comicSlug={comic.slug} />
        </section>
      </main>
    </div>
  );
}
