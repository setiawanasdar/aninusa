import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Bookmark,
  Clock,
  Heart,
  History,
  LayoutDashboard,
  Shield,
  Sparkles,
} from "lucide-react";
import { AnimeCard } from "@/components/anime-card";
import { HistoryList } from "@/components/history-list";
import { getFavorites, getWatchHistoryForUser } from "@/lib/catalog";
import { getUserMangaFavorites, getUserMangaReadingHistory } from "@/lib/manga";
import { requireUserPage } from "@/lib/page-auth";
import { formatRelativeTime } from "@aninusa/utils";

export const metadata: Metadata = {
  title: "Profil saya",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUserPage("/profile");

  const [favorites, history, mangaFavorites, mangaHistory] = await Promise.all([
    getFavorites(user.id),
    getWatchHistoryForUser(user.id, 50, true),
    getUserMangaFavorites(user.id),
    getUserMangaReadingHistory(user.id, 50),
  ]);

  return (
    <div className="container-page space-y-10 py-8">
      {/* Header Profile Box */}
      <header className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-xl font-bold uppercase text-accent">
            {user.username.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">{user.username}</h1>
            <p className="text-sm text-white/45">{user.email}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/35">
              <Shield className="h-3 w-3" aria-hidden="true" />
              {user.role} · Akun aktif
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Link href="/admin" className="btn-secondary">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dasbor admin
            </Link>
          )}
          <Link href="/browse" className="btn-secondary">
            Cari anime
          </Link>
          <Link href="/manga" className="btn-primary">
            <BookOpen className="h-4 w-4" /> Baca Komik
          </Link>
        </div>
      </header>

      {/* SECTION: Riwayat Baca Komik */}
      <section id="manga-history" className="scroll-mt-24 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <History className="h-4 w-4 text-accent" aria-hidden="true" /> Riwayat Baca Komik
            <span className="text-xs font-normal text-white/35">({mangaHistory.length})</span>
          </h2>
          <Link href="/manga" className="text-xs font-semibold text-accent hover:underline">
            Katalog Komik
          </Link>
        </div>

        {mangaHistory.length === 0 ? (
          <div className="surface px-6 py-8 text-center">
            <p className="text-sm font-medium text-white">Belum ada riwayat baca komik.</p>
            <p className="mt-1 text-xs text-white/45">
              Mulai membaca manga, manhwa, atau manhua di AniNusa untuk melihat progresmu di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {mangaHistory.map((item) => (
              <Link
                key={item.id}
                href={`/manga/read/${item.lastChapterSlug}?comic=${item.comicSlug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900/80 p-2.5 transition-all hover:border-accent/40 hover:bg-ink-850"
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
                  <p className="text-[10px] text-white/35">
                    {formatRelativeTime(item.updatedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* SECTION: Komik Favorit */}
      <section id="manga-favorites" className="scroll-mt-24 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" aria-hidden="true" /> Komik Favorit
            <span className="text-xs font-normal text-white/35">({mangaFavorites.length})</span>
          </h2>
        </div>

        {mangaFavorites.length === 0 ? (
          <div className="surface px-6 py-8 text-center">
            <p className="text-sm font-medium text-white">Belum ada komik favorit.</p>
            <p className="mt-1 text-xs text-white/45">
              Buka komik dan klik tombol “Tambah ke Favorit” untuk menyimpannya di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {mangaFavorites.map((item) => (
              <Link
                key={item.id}
                href={`/manga/${item.comicSlug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900/80 p-2.5 transition-all hover:border-accent/40 hover:bg-ink-850"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-950">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                  {item.type && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-accent/90 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shadow">
                      {item.type}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <h3 className="line-clamp-1 text-xs font-bold text-white group-hover:text-accent">
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-white/40">
                    Disimpan {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* SECTION: Riwayat Tontonan Anime */}
      <section id="history" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" /> Riwayat tontonan anime
        </h2>
        <HistoryList entries={history} />
      </section>

      {/* SECTION: Anime Favorit */}
      <section id="favorites" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Bookmark className="h-4 w-4 text-accent" aria-hidden="true" /> Anime Favorit
          <span className="text-xs font-normal text-white/35">({favorites.length})</span>
        </h2>

        {favorites.length === 0 ? (
          <div className="surface px-6 py-10 text-center">
            <p className="text-sm font-medium text-white">Belum ada anime favorit.</p>
            <p className="mt-1 text-xs text-white/45">
              Tekan “Tambah ke favorit” pada halaman anime untuk menyimpannya di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {favorites.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
