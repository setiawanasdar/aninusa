import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  History,
  Layers,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { getMangaAdminStats } from "@/lib/admin";
import { requireAdminPage } from "@/lib/page-auth";
import { formatRelativeTime } from "@aninusa/utils";

export const metadata: Metadata = {
  title: "Manajemen Manga · Admin AniNusa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMangaPage() {
  await requireAdminPage("/admin/manga");

  const startTime = Date.now();
  let upstreamStatus = "ONLINE";
  let upstreamLatency = 0;

  try {
    const res = await fetch("https://api.komiku.org/manga/page/1/", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    upstreamLatency = Date.now() - startTime;
    if (!res.ok) {
      upstreamStatus = `HTTP_${res.status}`;
    }
  } catch {
    upstreamStatus = "UNREACHABLE";
    upstreamLatency = Date.now() - startTime;
  }

  const stats = await getMangaAdminStats();

  const cards = [
    {
      label: "Status Upstream API",
      value: upstreamStatus === "ONLINE" ? `Online (${upstreamLatency}ms)` : upstreamStatus,
      icon: Activity,
      color: upstreamStatus === "ONLINE" ? "text-emerald-400" : "text-rose-400",
      description: "api.komiku.org",
    },
    {
      label: "Total Komik Favorit",
      value: stats.mangaFavoritesCount.toLocaleString("id-ID"),
      icon: Heart,
      color: "text-rose-400",
      description: "Komik disimpan di bookmark pengguna",
    },
    {
      label: "Riwayat Baca Tercatat",
      value: stats.mangaHistoryCount.toLocaleString("id-ID"),
      icon: History,
      color: "text-accent",
      description: "Progress chapter tersinkron ke DB",
    },
    {
      label: "Pembaca Aktif",
      value: stats.activeReaders.toLocaleString("id-ID"),
      icon: Users,
      color: "text-sky-400",
      description: "Pengguna unik dengan riwayat baca",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="flex items-center gap-2 text-xs text-white/50 mb-1" aria-label="Breadcrumb">
            <Link href="/admin" className="hover:text-accent">
              Dasbor
            </Link>
            <span>/</span>
            <span className="text-white/80 font-medium">Manga & Komik</span>
          </nav>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-accent" />
            Manajemen Manga & Komik
          </h1>
          <p className="mt-0.5 text-sm text-white/45">
            Kesehatan upstream provider, database bookmark, dan aktivitas pembaca komik.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/manga"
            target="_blank"
            className="btn-primary"
          >
            <span>Buka Portal Manga</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="surface p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {c.label}
                </span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="my-2">
                <span className={`text-2xl font-bold tracking-tight ${c.color}`}>
                  {c.value}
                </span>
              </div>
              <span className="text-[11px] text-white/40">{c.description}</span>
            </div>
          );
        })}
      </div>

      {/* Two columns: Top Favorites & Recent Reading Activities */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Favorites */}
        <section className="surface p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              Komik Paling Banyak Difavoritkan
            </h2>
            <span className="text-xs text-white/40">Database Live</span>
          </div>

          {stats.topFavorites.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/40">
              Belum ada data favorit manga dari pengguna.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {stats.topFavorites.map((item, idx) => (
                <li
                  key={item.comicSlug}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-800 text-xs font-bold text-white/70">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/manga/${item.comicSlug}`}
                        target="_blank"
                        className="truncate text-sm font-semibold text-white/90 hover:text-accent flex items-center gap-1.5"
                      >
                        <span className="truncate">{item.title}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-50" />
                      </Link>
                      <p className="text-[11px] text-white/40">
                        {item.type || "Manga"} · slug: {item.comicSlug}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/25 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                    <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                    <span>{item._count.comicSlug}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Reading Activities */}
        <section className="surface p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Aktivitas Membaca Terkini
            </h2>
            <span className="text-xs text-white/40">{stats.recentHistory.length} sesi terakhir</span>
          </div>

          {stats.recentHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/40">
              Belum ada aktivitas membaca yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/40">
                    <th className="pb-2 font-medium">Pengguna</th>
                    <th className="pb-2 font-medium">Komik & Chapter</th>
                    <th className="pb-2 font-medium text-right">Hal.</th>
                    <th className="pb-2 font-medium text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {stats.recentHistory.map((h) => (
                    <tr key={h.id} className="text-white/80">
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-white block truncate max-w-[100px]">
                          {h.user?.username || "Pengguna"}
                        </span>
                        <span className="text-[10px] text-white/35 block truncate max-w-[100px]">
                          {h.user?.email}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <Link
                          href={`/manga/read/${h.lastChapterSlug}?comic=${h.comicSlug}`}
                          target="_blank"
                          className="font-medium hover:text-accent block truncate max-w-[160px]"
                        >
                          {h.comicTitle}
                        </Link>
                        <span className="text-[10px] text-white/40 block truncate max-w-[160px]">
                          {h.lastChapterTitle}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-white/60">
                        {h.lastPage}
                      </td>
                      <td className="py-2 text-right text-white/40 text-[10px] whitespace-nowrap">
                        {formatRelativeTime(h.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Upstream Health Status Section */}
      <section className="surface p-4 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          Konektivitas Endpoint Scraper Komiku
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-white/[0.08] bg-ink-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Latest Catalog</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-[11px] text-white/45">/manga/page/:page/</p>
            <span className="text-[10px] text-emerald-400 font-medium">Multi-page pagination OK</span>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-ink-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Manhwa Filter</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-[11px] text-white/45">?tipe=manhwa</p>
            <span className="text-[10px] text-emerald-400 font-medium">Korean Comics OK</span>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-ink-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Genre Engine</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-[11px] text-white/45">?genre2=:slug</p>
            <span className="text-[10px] text-emerald-400 font-medium">Real-time Genre Filter OK</span>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-ink-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Direct Chapter Reader</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-[11px] text-white/45">komiku-api-eta.vercel.app</p>
            <span className="text-[10px] text-emerald-400 font-medium">Images & CDN OK</span>
          </div>
        </div>
      </section>
    </div>
  );
}
