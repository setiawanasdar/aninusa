import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Compass,
  Flame,
  History,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaRail } from "@/components/manga/manga-rail";
import {
  getMangaHomeSections,
  getMangaLatest,
  getMangaByType,
  getMangaPopular,
  getUserMangaReadingHistory,
  MANGA_GENRES,
} from "@/lib/manga";
import { getSessionUser } from "@/lib/auth";
import type { MangaSummary } from "@aninusa/types";

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

  const user = await getSessionUser();

  // Load user reading history if authenticated and on home page
  const readingHistory =
    user && tab === "all" && page === 1
      ? await getUserMangaReadingHistory(user.id, 6)
      : [];

  let displayItems: MangaSummary[] = [];
  let hasNextPage = true;
  let homeSections = null;

  if (tab === "all") {
    if (page === 1) {
      homeSections = await getMangaHomeSections();
      displayItems =
        homeSections.manhua.length > 0
          ? homeSections.manhua
          : homeSections.latest.length > 0
            ? homeSections.latest
            : homeSections.popular;
      hasNextPage = true;
    } else {
      const result = await getMangaLatest(page);
      displayItems = result.items;
      hasNextPage = result.hasNextPage;
    }
  } else if (tab === "manhwa") {
    const result = await getMangaByType("manhwa", page);
    displayItems = result.items;
    hasNextPage = result.hasNextPage;
  } else if (tab === "manga") {
    const result = await getMangaByType("manga", page);
    displayItems = result.items;
    hasNextPage = result.hasNextPage;
  } else if (tab === "manhua") {
    const result = await getMangaByType("manhua", page);
    displayItems = result.items;
    hasNextPage = result.hasNextPage;
  } else if (tab === "latest") {
    const result = await getMangaLatest(page);
    displayItems = result.items;
    hasNextPage = result.hasNextPage;
  } else if (tab === "popular") {
    displayItems = await getMangaPopular();
    hasNextPage = false;
  } else {
    const result = await getMangaLatest(page);
    displayItems = result.items;
    hasNextPage = result.hasNextPage;
  }

  const tabLabels: Record<string, string> = {
    all: "Semua Komik",
    popular: "Populer (Top Views)",
    latest: "Update Terbaru",
    manhwa: "Manhwa (Korea)",
    manga: "Manga (Jepang)",
    manhua: "Manhua (China)",
  };

  const tabs = [
    { id: "all", label: "Semua Komik", icon: BookOpen },
    { id: "popular", label: "Populer", icon: Flame },
    { id: "latest", label: "Update Terbaru", icon: History },
    { id: "manhwa", label: "Manhwa (Korea)", icon: Sparkles },
    { id: "manga", label: "Manga (Jepang)", icon: Compass },
  ];

  const featured = homeSections?.featured;
  const popular = homeSections?.popular || [];
  const latest = homeSections?.latest || [];
  const manhwa = homeSections?.manhwa || [];
  const manga = homeSections?.manga || [];

  return (
    <div className="container-page py-6 sm:py-8 space-y-10 sm:space-y-12">
      {/* Featured Hero Banner (Page 1 of 'all' tab) */}
      {page === 1 && tab === "all" && featured && (
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-ink-950 via-ink-900 to-ink-950 p-6 sm:p-10 shadow-2xl">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            {/* Poster with glow */}
            <div className="relative aspect-[2/3] w-40 sm:w-48 shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featured.thumbnail}
                alt={featured.title}
                className="h-full w-full object-cover"
              />
              {featured.type && (
                <span className="absolute top-2 left-2 rounded-md bg-accent px-2 py-0.5 text-[10px] font-black uppercase text-white shadow">
                  {featured.type}
                </span>
              )}
            </div>

            {/* Content Details */}
            <div className="flex-1 text-center md:text-left space-y-3.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Rekomendasi Utama
                </span>
                {featured.genre && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs font-medium text-white/70">
                    {featured.genre}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {featured.title}
              </h1>

              {featured.description && (
                <p className="text-xs sm:text-sm text-white/70 line-clamp-3 max-w-2xl leading-relaxed">
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
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-ink-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-ink-750 transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                    {featured.latestChapter.title}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Reading History Rail (For logged-in users with history) */}
      {readingHistory.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-ink-950/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg flex items-center gap-2">
                <History className="h-4 w-4 text-accent" />
                Lanjutkan Membaca
              </h2>
              <p className="text-xs text-white/45 mt-0.5">
                Komik yang terakhir kali kamu baca
              </p>
            </div>
            <Link
              href="/profile#manga-history"
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              <span>Riwayat Lengkap</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
            {readingHistory.map((item) => (
              <Link
                key={item.id}
                href={`/manga/read/${item.lastChapterSlug}?comic=${item.comicSlug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900/80 p-2.5 transition-all hover:border-accent/40 hover:bg-ink-850 hover:shadow-lg"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-950">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={item.comicTitle}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-accent backdrop-blur-sm">
                    Hal. {item.lastPage}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <h3 className="line-clamp-1 text-xs font-bold text-white group-hover:text-accent">
                    {item.comicTitle}
                  </h3>
                  <p className="line-clamp-1 text-[11px] text-white/50">
                    {item.lastChapterTitle}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tab Filter Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {tabs.map((t) => {
            const active = tab === t.id && page === 1;
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={t.id === "all" ? "/manga" : `/manga?tab=${t.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-accent text-white shadow-md shadow-accent/25"
                    : "bg-ink-850 text-white/70 hover:bg-ink-800 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </Link>
            );
          })}

          <Link
            href="/manga/genre"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink-850 px-3.5 py-2 text-xs font-bold text-white/70 hover:bg-ink-800 hover:text-white transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span>Semua Genre</span>
          </Link>
        </div>

        <span className="text-xs text-white/50 text-right">
          {tabLabels[tab] ?? tab} · {displayItems.length} judul
        </span>
      </div>

      {/* PORTAL EXPERIENCE (When on default 'all' tab & page 1) */}
      {tab === "all" && page === 1 && homeSections ? (
        <div className="space-y-12">
          {/* Rail 1: Trending & Populer */}
          {popular.length > 0 && (
            <MangaRail
              title="Sedang Tren & Populer"
              subtitle="Paling banyak dibaca pembaca Indonesia saat ini"
              manga={popular}
              href="/manga?tab=popular"
              priorityFirst
            />
          )}

          {/* Rail 2: Update Chapter Terbaru */}
          {latest.length > 0 && (
            <MangaRail
              title="Update Chapter Terbaru"
              subtitle="Rilisan chapter komik paling fresh hari ini"
              manga={latest}
              href="/manga?tab=latest"
            />
          )}

          {/* Rail 3: Manhwa Korea Pilihan */}
          {manhwa.length > 0 && (
            <MangaRail
              title="Manhwa Pilihan (Korea)"
              subtitle="Komik berwarna aksi dan reinkarnasi terfavorit"
              manga={manhwa}
              href="/manga?tab=manhwa"
            />
          )}

          {/* Rail 4: Manga Jepang Populer */}
          {manga.length > 0 && (
            <MangaRail
              title="Manga Populer (Jepang)"
              subtitle="Serial komik klasik dan modern dari Jepang"
              manga={manga}
              href="/manga?tab=manga"
            />
          )}

          {/* Quick Genre Chips Grid */}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Jelajah Berdasarkan Genre
                </h2>
                <p className="mt-0.5 text-xs text-white/50">
                  Temukan cerita sesuai genre yang paling kamu sukai
                </p>
              </div>
              <Link
                href="/manga/genre"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <span>Lihat 22 Genre</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {MANGA_GENRES.slice(0, 8).map((genre) => (
                <Link
                  key={genre.slug}
                  href={`/manga/genre/${genre.slug}`}
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2.5 text-xs font-bold text-white/80 hover:border-accent/40 hover:bg-accent/15 hover:text-white transition-all text-center shadow-sm"
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          </section>

          {/* Catalog Grid Section (Koleksi Rilisan Lainnya) */}
          <section className="space-y-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent" />
                Koleksi Rilisan Lainnya
              </h2>
              <span className="text-xs text-white/40">{displayItems.length} judul</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
              {displayItems.map((mangaItem, idx) => (
                <MangaCard key={mangaItem.slug} manga={mangaItem} priority={idx < 6} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* TAB FILTERED VIEW (e.g. popular, latest, manhwa, or page > 1) */
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              {tabLabels[tab] ?? "Katalog Komik"}
            </h2>
            <span className="text-xs text-white/50">
              Halaman {page} · {displayItems.length} komik
            </span>
          </header>

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
        </div>
      )}

      {/* Pagination Navigation */}
      <div className="flex items-center justify-center gap-3 pt-6 border-t border-white/[0.08]">
        {page > 1 && (
          <Link
            href={
              page === 2
                ? tab === "all"
                  ? "/manga"
                  : `/manga?tab=${tab}`
                : `/manga?${tab !== "all" ? `tab=${tab}&` : ""}page=${page - 1}`
            }
            className="rounded-lg border border-white/15 bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
          >
            Halaman Sebelumnya
          </Link>
        )}
        <span className="text-xs text-white/60 font-medium">Halaman {page}</span>
        {hasNextPage && (
          <Link
            href={`/manga?${tab !== "all" ? `tab=${tab}&` : ""}page=${page + 1}`}
            className="rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30 transition-colors"
          >
            Halaman Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}
