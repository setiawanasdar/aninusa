import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaHeader } from "@/components/manga/manga-header";
import { getMangaPopular, searchManga } from "@/lib/manga";

export const dynamic = "force-dynamic";

interface MangaSearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: MangaSearchPageProps): Promise<Metadata> {
  const rawParams = await searchParams;
  const query = typeof rawParams.q === "string" ? rawParams.q : typeof rawParams.keyword === "string" ? rawParams.keyword : "";

  return {
    title: query ? `Hasil Pencarian Manga "${query}"` : "Cari Manga & Komik",
    description: `Cari dan baca manga, manhwa, dan manhua bahasa Indonesia di AniNusa.`,
  };
}

export default async function MangaSearchPage({ searchParams }: MangaSearchPageProps) {
  const rawParams = await searchParams;
  const query = (
    typeof rawParams.q === "string" ? rawParams.q : typeof rawParams.keyword === "string" ? rawParams.keyword : ""
  ).trim();
  const page = parseInt(typeof rawParams.page === "string" ? rawParams.page : "1", 10) || 1;

  const [searchResult, popular] = await Promise.all([
    query ? searchManga(query, page) : null,
    !query ? getMangaPopular() : null,
  ]);

  const items = searchResult?.items ?? [];

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <MangaHeader />

      <main className="container-page py-6 sm:py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Link href="/manga" className="hover:text-accent">
              Manga & Komik
            </Link>
            <span>/</span>
            <span className="text-white/80 font-medium">Pencarian</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-accent" />
            {query ? (
              <span>
                Hasil Pencarian: &quot;<span className="text-accent">{query}</span>&quot;
              </span>
            ) : (
              <span>Cari Komik, Manga & Manhwa</span>
            )}
          </h1>

          {query && (
            <p className="text-xs text-white/50">
              Ditemukan {items.length} komik untuk kata kunci ini.
            </p>
          )}
        </header>

        {query && items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-12 text-center space-y-3">
            <BookOpen className="h-10 w-10 text-white/20 mx-auto" />
            <p className="text-sm text-white/70">
              Tidak ditemukan komik dengan judul &quot;{query}&quot;.
            </p>
            <p className="text-xs text-white/40">
              Coba gunakan kata kunci yang lebih umum atau nama judul dalam bahasa Inggris/Indonesia.
            </p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
            {items.map((mangaItem, idx) => (
              <MangaCard key={mangaItem.slug} manga={mangaItem} priority={idx < 6} />
            ))}
          </div>
        ) : popular && popular.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
              Rekomendasi Populer
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
              {popular.slice(0, 12).map((mangaItem, idx) => (
                <MangaCard key={mangaItem.slug} manga={mangaItem} priority={idx < 6} />
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
