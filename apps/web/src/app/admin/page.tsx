import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  Film,
  History,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import { getAdminStats } from "@/lib/admin";
import { formatRelativeTime } from "@aninusa/utils";

import { QuickSyncButton } from "@/components/admin/quick-sync-button";

export default async function AdminDashboardPage() {
  await requireAdminPage("/admin");
  const stats = await getAdminStats();

  const cards = [
    { label: "Total anime", value: stats.animeCount, icon: Database, href: "/admin/anime" },
    { label: "Total episode", value: stats.episodeCount, icon: Film, href: "/admin/anime" },
    { label: "Manga Favorit", value: stats.mangaFavoritesCount, icon: BookOpen, href: "/admin/manga" },
    { label: "Riwayat Baca Komik", value: stats.mangaHistoryCount, icon: History, href: "/admin/manga" },
    { label: "Sumber video", value: stats.sourceCount, icon: Video, href: "/admin/health" },
    { label: "Provider aktif", value: stats.activeProviders, icon: CheckCircle2, href: "/admin/providers" },
    { label: "Job gagal", value: stats.failedJobs, icon: AlertTriangle, href: "/admin/providers" },
    { label: "Pengguna", value: stats.userCount, icon: Users, href: "/admin/users" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Dasbor admin</h1>
          <p className="mt-0.5 text-sm text-white/45">Ringkasan katalog, provider, dan kesehatan sumber.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickSyncButton />
          <Link href="/admin/providers" className="btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Provider
          </Link>
          <Link href="/admin/anime/new" className="btn-primary">
            Tambah anime
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="surface p-4 transition-colors hover:border-white/20"
            >
              <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {card.label}
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {card.value.toLocaleString("id-ID")}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Anime terbaru</h2>
            <Link href="/admin/anime" className="text-xs text-white/45 hover:text-accent">
              Kelola
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {stats.recentAnime.map((anime) => (
              <li key={anime.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/anime/${anime.slug}`} className="block truncate text-sm text-white/85 hover:text-accent">
                    {anime.title}
                  </Link>
                  <p className="text-[11px] text-white/35">
                    {[anime.status, anime.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link
                  href={`/admin/anime/${anime.id}`}
                  className="shrink-0 text-xs font-medium text-accent hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
            {stats.recentAnime.length === 0 && (
              <li className="py-6 text-center text-xs text-white/35">Belum ada anime.</li>
            )}
          </ul>
        </section>

        <section className="surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Job sinkronisasi</h2>
            <Link href="/admin/providers" className="text-xs text-white/45 hover:text-accent">
              Semua job
            </Link>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {stats.recentJobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/85">
                    {job.providerKey} · {job.mode}
                  </p>
                  <p className="text-[11px] text-white/35">
                    {formatRelativeTime(job.createdAt)}
                    {job.error ? ` · ${job.error.slice(0, 60)}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    job.status === "SUCCEEDED"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : job.status === "FAILED"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {job.status}
                </span>
              </li>
            ))}
            {stats.recentJobs.length === 0 && (
              <li className="py-6 text-center text-xs text-white/35">Belum ada job.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}


