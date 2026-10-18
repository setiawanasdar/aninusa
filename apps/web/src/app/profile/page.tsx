import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Clock, LayoutDashboard, Shield } from "lucide-react";
import { AnimeCard } from "@/components/anime-card";
import { HistoryList } from "@/components/history-list";
import { getFavorites, getWatchHistoryForUser } from "@/lib/catalog";
import { requireUserPage } from "@/lib/page-auth";

export const metadata: Metadata = {
  title: "Profil saya",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUserPage("/profile");

  const [favorites, history] = await Promise.all([
    getFavorites(user.id),
    getWatchHistoryForUser(user.id, 50, true),
  ]);

  return (
    <div className="container-page space-y-8 py-8">
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
          <Link href="/browse" className="btn-primary">
            Cari anime
          </Link>
        </div>
      </header>

      <section id="history" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" /> Riwayat tontonan
        </h2>
        <HistoryList entries={history} />
      </section>

      <section id="favorites" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Bookmark className="h-4 w-4 text-accent" aria-hidden="true" /> Favorit
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


