import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Flame, History, Sparkles } from "lucide-react";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaHeader } from "@/components/manga/manga-header";
import { getMangaHomeSections, getMangaLatest } from "@/lib/manga";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Baca Manga & Komik Online Bahasa Indonesia",
  description:
    "Baca ribuan manga, manhwa, dan manhua bahasa Indonesia gratis, update chapter tercepat dan gambar kualitas tinggi di AniNusa.",
  alternates: { canonical: "/manga" },
};

interface MangaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MangaHomePage({ searchParams }: MangaPageProps) {
  const rawParams = await searchParams;
  const tab = typeof rawParams.tab === "string" ? rawParams.tab : "all";
  const page = parseInt(typeof rawParams.page === "string" ? rawParams.page : "1", 10) || 1;

  const [homeData, latestPaginated] = await Promise.all([
    getMangaHomeSections(),
    page > 1 ? getMangaLatest(page) : null,
  ]);

  const { featured, popular, latest, manhwa, manga } = homeData;

  const displayItems =
    page > 1 && latestPaginated
      ? latestPaginated.items
      : tab === "popular"
        ? popular
        : tab === "latest"
          ? latest
          : tab === "manhwa"
            ? manhwa
            : tab === "manga"
              ? manga
              : latest;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <MangaHeader />

      <main className="container-page py-6 sm:py-8 space-y-8">
        {/* Featured Hero Banner (only on page 1 of 'all' tab) */}
        {page === 1 && tab === "all" && featured && (
          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-ink-950 via-ink-900 to-ink-950 p-6 sm:p-10 shadow-2xl">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="relative aspect-[3/4] w-40 sm:w-48 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.thumbnail}
                  alt={featured.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Rekomendasi Utama
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  {featured.title}
                </h1>
                {featured.genre && (
                  <p className="text-xs sm:text-sm font-semibold text-white/60">
                    Genre: {featured.genre}
                  </p>
                )}
                {featured.description && (
                  <p className="text-xs sm:text-sm text-white/70 line-clamp-3 max-w-2xl">
                    {featured.description}
                  </p>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <Link
                    href={`/manga/${featured.slug}`}
                    className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all hover:bg-accent/80 hover:shadow-lg hover:shadow-accent/25"
                  >
                    <BookOpen className="h-4 w-4" />
                    Mulai Baca
                  </Link>
                  {featured.latestChapter && (
                    <Link
                      href={`/manga/read/${featured.latestChapter.chapterSlug}?comic=${featured.slug}`}
                      className="flex items-center gap-2 rounded-xl border border-white/15 bg-ink-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-ink-750"
                    >
                      {featured.latestChapter.title}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab Selection Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "Semua Komik", icon: BookOpen },
              { id: "popular", label: "Populer (Top Views)", icon: Flame },
              { id: "latest", label: "Update Terbaru", icon: History },
              { id: "manhwa", label: "Manhwa (Korea)", icon: null },
              { id: "manga", label: "Manga (Jepang)", icon: null },
            ].map((t) => {
              const active = tab === t.id && page === 1;
              const Icon = t.icon;
              return (
                <Link
                  key={t.id}
                  href={t.id === "all" ? "/manga" : `/manga?tab=${t.id}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                    active
                      ? "bg-accent text-white shadow-md shadow-accent/20"
                      : "bg-ink-850 text-white/70 hover:bg-ink-800 hover:text-white"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>

          <span className="text-xs text-white/50 text-right">
            Halaman {page} · {displayItems.length} judul
          </span>
        </div>

        {/* Comic Grid */}
        {displayItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-12 text-center text-sm text-white/50">
            Belum ada komik yang tersedia pada kategori ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
            {displayItems.map((mangaItem, idx) => (
              <MangaCard key={mangaItem.slug} manga={mangaItem} priority={idx < 6} />
            ))}
          </div>
        )}

        {/* Pagination Navigation */}
        <div className="flex items-center justify-center gap-3 pt-6">
          {page > 1 && (
            <Link
              href={page === 2 ? (tab === "all" ? "/manga" : `/manga?tab=${tab}`) : `/manga?${tab !== "all" ? `tab=${tab}&` : ""}page=${page - 1}`}
              className="rounded-lg border border-white/15 bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800"
            >
              Halaman Sebelumnya
            </Link>
          )}
          <span className="text-xs text-white/60">
            Halaman {page}
          </span>
          <Link
            href={`/manga?${tab !== "all" ? `tab=${tab}&` : ""}page=${page + 1}`}
            className="rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30"
          >
            Halaman Berikutnya
          </Link>
        </div>
      </main>
    </div>
  );
}
