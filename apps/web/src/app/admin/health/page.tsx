import { requireAdminPage } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { HealthActions } from "@/components/admin/health-actions";
import { formatRelativeTime } from "@aninusa/utils";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  DEGRADED: "bg-amber-500/15 text-amber-300",
  BROKEN: "bg-red-500/15 text-red-300",
  DISABLED: "bg-white/[0.06] text-white/40",
};

export default async function AdminHealthPage() {
  await requireAdminPage("/admin/health");
  const [sources, subtitles, recentChecks] = await Promise.all([
    prisma.videoSource.findMany({
      where: { status: { in: ["BROKEN", "DEGRADED"] } },
      orderBy: [{ status: "asc" }, { lastCheckedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        provider: true,
        url: true,
        quality: true,
        format: true,
        status: true,
        failureCount: true,
        lastCheckedAt: true,
        lastHttpStatus: true,
        episode: { select: { episodeNumber: true, anime: { select: { title: true, slug: true } } } },
      },
    }),
    prisma.subtitle.findMany({
      where: { status: { in: ["BROKEN", "DEGRADED"] } },
      orderBy: [{ status: "asc" }, { lastCheckedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        language: true,
        label: true,
        url: true,
        status: true,
        failureCount: true,
        lastCheckedAt: true,
        episode: { select: { episodeNumber: true, anime: { select: { title: true, slug: true } } } },
      },
    }),
    prisma.sourceHealthCheck.findMany({
      orderBy: { checkedAt: "desc" },
      take: 15,
      select: {
        id: true,
        status: true,
        httpStatus: true,
        latencyMs: true,
        error: true,
        checkedAt: true,
        videoSource: { select: { provider: true, url: true } },
        subtitle: { select: { language: true, url: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Kesehatan sumber</h1>
          <p className="mt-0.5 text-sm text-white/45">
            Sumber rusak otomatis disembunyikan dari pengguna. Subtitle rusak juga tidak ditampilkan.
          </p>
        </div>
        <HealthActions />
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">Sumber video bermasalah ({sources.length})</h2>
        <div className="surface overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">Anime / Episode</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Kualitas</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">HTTP</th>
                <th className="px-3 py-2 font-medium">Diperiksa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="max-w-[240px] px-3 py-2">
                    <p className="truncate text-white/75">{source.episode.anime.title}</p>
                    <p className="text-[10px] text-white/35">Episode {source.episode.episodeNumber}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-white/50">{source.provider}</td>
                  <td className="px-3 py-2 text-white/50">
                    {source.quality > 0 ? `${source.quality}p` : "Auto"} · {source.format}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusColor[source.status] ?? ""}`}>
                      {source.status}
                    </span>
                    <span className="ml-1 text-[10px] text-white/30">×{source.failureCount}</span>
                  </td>
                  <td className="px-3 py-2 text-white/45">{source.lastHttpStatus ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-white/35">
                    {source.lastCheckedAt ? formatRelativeTime(source.lastCheckedAt) : "belum"}
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/35">
                    Semua sumber video sehat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">Subtitle bermasalah ({subtitles.length})</h2>
        <div className="surface overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">Anime / Episode</th>
                <th className="px-3 py-2 font-medium">Bahasa</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">Diperiksa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {subtitles.map((track) => (
                <tr key={track.id}>
                  <td className="max-w-[240px] px-3 py-2">
                    <p className="truncate text-white/75">{track.episode.anime.title}</p>
                    <p className="text-[10px] text-white/35">Episode {track.episode.episodeNumber}</p>
                  </td>
                  <td className="px-3 py-2 uppercase text-white/55">{track.language}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusColor[track.status] ?? ""}`}>
                      {track.status}
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-white/30">{track.url}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-white/35">
                    {track.lastCheckedAt ? formatRelativeTime(track.lastCheckedAt) : "belum"}
                  </td>
                </tr>
              ))}
              {subtitles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-white/35">
                    Semua subtitle sehat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">Pemeriksaan terakhir</h2>
        <ul className="surface divide-y divide-white/[0.06]">
          {recentChecks.map((check) => (
            <li key={check.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusColor[check.status] ?? ""}`}>
                {check.status}
              </span>
              <span className="truncate text-white/45">
                {check.videoSource ? `video · ${check.videoSource.provider}` : `subtitle · ${check.subtitle?.language ?? "?"}`}
                {check.error ? ` · ${check.error}` : ""}
              </span>
              <span className="ml-auto shrink-0 text-white/25">
                {check.latencyMs ?? 0}ms · {formatRelativeTime(check.checkedAt)}
              </span>
            </li>
          ))}
          {recentChecks.length === 0 && (
            <li className="px-3 py-8 text-center text-xs text-white/35">Belum ada pemeriksaan.</li>
          )}
        </ul>
      </section>
    </div>
  );
}


