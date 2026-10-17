import { requireAdminPage } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { createProviderRegistry, providerConfigFromEnv } from "@aninusa/source-adapters";
import { ProviderActions } from "@/components/admin/provider-actions";
import { formatRelativeTime } from "@aninusa/utils";

export default async function AdminProvidersPage() {
  await requireAdminPage("/admin/providers");
  const [providers, jobs] = await Promise.all([
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.ingestionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        providerKey: true,
        mode: true,
        status: true,
        attempts: true,
        error: true,
        stats: true,
        createdAt: true,
        finishedAt: true,
      },
    }),
  ]);

  const registry = createProviderRegistry(providerConfigFromEnv());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Provider &amp; sinkronisasi</h1>
        <p className="mt-0.5 text-sm text-white/45">
          Hanya provider yang mengizinkan akses otomatis yang dapat disinkronkan. Provider terbatas ditandai
          tidak didukung dan tidak akan pernah dilewati pembatasannya.
        </p>
      </header>

      <section className="space-y-2">
        {providers.map((provider) => {
          const descriptor = registry.statuses.find((entry) => entry.key === provider.key);
          const supported = descriptor?.capabilities.automatedAccessPermitted ?? false;

          return (
            <article key={provider.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-white">{provider.name}</h2>
                    <span className="badge">{provider.kind}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        provider.enabled && supported
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/[0.06] text-white/40"
                      }`}
                    >
                      {provider.enabled && supported ? "AKTIF" : "TIDAK AKTIF"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/35">
                    key: <span className="font-mono">{provider.key}</span>
                    {provider.baseUrl ? ` ?? ${provider.baseUrl}` : ""}
                    {provider.lastSyncAt ? ` ?? sinkron ${formatRelativeTime(provider.lastSyncAt)}` : ""}
                  </p>
                  {descriptor?.capabilities.notes && (
                    <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-white/40">
                      {descriptor.capabilities.notes}
                    </p>
                  )}
                </div>
                <ProviderActions
                  providerId={provider.id}
                  providerKey={provider.key}
                  enabled={provider.enabled}
                  supported={supported}
                />
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">Job terakhir</h2>
        <div className="surface overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Hasil</th>
                <th className="px-3 py-2 font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {jobs.map((job) => {
                const stats = (job.stats ?? {}) as {
                  created?: number;
                  updated?: number;
                  failed?: number;
                  episodes?: number;
                };
                return (
                  <tr key={job.id}>
                    <td className="px-3 py-2 font-mono text-white/70">{job.providerKey}</td>
                    <td className="px-3 py-2 text-white/50">{job.mode}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          job.status === "SUCCEEDED"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : job.status === "FAILED"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white/45">
                      {job.error
                        ? job.error.slice(0, 80)
                        : `${stats.created ?? 0} baru ?? ${stats.updated ?? 0} update ?? ${stats.failed ?? 0} gagal`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-white/35">
                      {formatRelativeTime(job.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-white/35">
                    Belum ada job sinkronisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


