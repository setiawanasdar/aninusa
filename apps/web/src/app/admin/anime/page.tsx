import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { AniKotoImporter } from "@/components/admin/anikoto-importer";
import { listAnime } from "@/lib/catalog";

interface AdminAnimePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminAnimePage({ searchParams }: AdminAnimePageProps) {
  await requireAdminPage("/admin/anime");
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const page = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);
  const perPage = 20;

  const result = await listAnime(q ? { q, page, perPage } : { page, perPage });
  const rows = result.items;
  const total = result.total;
  const totalPages = result.totalPages;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Kelola anime</h1>
          <p className="mt-0.5 text-sm text-white/45">{total.toLocaleString("id-ID")} judul terhubung via AniKoto &amp; Animasu Streaming API.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/providers" className="btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Sinkronisasi Provider
          </Link>
          <Link href="/admin/anime/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah / Import Anime
          </Link>
        </div>
      </header>

      <section className="surface p-4">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white/80 hover:text-white">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Cari &amp; Import Cepat dari AniKoto API
            </span>
            <span className="text-xs text-white/40 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="pt-4 border-t border-white/10 mt-3">
            <AniKotoImporter />
          </div>
        </details>
      </section>

      <form className="relative max-w-md" action="/admin/anime" method="get">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari judul anime..."
          aria-label="Cari anime"
          className="input pl-9"
        />
      </form>

      <div className="surface overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Daftar anime</caption>
          <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Judul</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Tipe</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Episode</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((anime) => (
              <tr key={anime.id} className="hover:bg-white/[0.02]">
                <td className="max-w-[280px] px-3 py-2.5">
                  <Link href={`/admin/anime/${anime.slug}`} className="block truncate font-medium text-white/90 hover:text-accent">
                    {anime.title}
                  </Link>
                  <span className="text-[11px] text-white/30">/{anime.slug}</span>
                </td>
                <td className="hidden px-3 py-2.5 text-xs text-white/55 sm:table-cell">{anime.type}</td>
                <td className="hidden px-3 py-2.5 text-xs text-white/55 sm:table-cell">{anime.status}</td>
                <td className="px-3 py-2.5 text-xs tabular-nums text-white/55">
                  {anime.latestEpisode ?? anime.totalEpisodes ?? "-"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/anime/${anime.slug}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-white/45 hover:bg-white/10 hover:text-white"
                    >
                      Lihat
                    </Link>
                    <Link
                      href={`/admin/anime/${anime.slug}`}
                      className="rounded-md px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                    >
                      Detail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-xs text-white/40">
                  Tidak ada anime yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/anime" searchParams={{ q }} />
    </div>
  );
}


