import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { MangaCard } from "@/components/manga/manga-card";
import { getMangaByGenre, MANGA_GENRES } from "@/lib/manga";

export const dynamic = "force-dynamic";

interface MangaGenreDetailProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: MangaGenreDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const genre = MANGA_GENRES.find((g) => g.slug === slug);

  if (!genre) {
    return { title: "Genre Tidak Ditemukan" };
  }

  return {
    title: `Manga Genre ${genre.name}`,
    description: `Baca manga, manhwa, dan manhua genre ${genre.name} bahasa Indonesia di AniNusa.`,
  };
}

export default async function MangaGenreDetailPage({ params, searchParams }: MangaGenreDetailProps) {
  const { slug } = await params;
  const rawParams = await searchParams;
  const page = parseInt(typeof rawParams.page === "string" ? rawParams.page : "1", 10) || 1;

  const genre = MANGA_GENRES.find((g) => g.slug === slug);
  if (!genre) notFound();

  const result = await getMangaByGenre(genre.slug, page);

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <header className="space-y-2">
        <nav className="flex items-center gap-2 text-xs text-white/50" aria-label="Breadcrumb">
          <Link href="/manga" className="hover:text-accent">
            Manga & Komik
          </Link>
          <span>/</span>
          <Link href="/manga/genre" className="hover:text-accent">
            Genre
          </Link>
          <span>/</span>
          <span className="text-white/80 font-medium">{genre.name}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-accent" />
          Genre: {genre.name}
        </h1>
        <p className="text-xs text-white/50">
          Halaman {page} · {result.items.length} judul ditemukan
        </p>
      </header>

      {result.items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-12 text-center text-sm text-white/50">
          Belum ada komik yang tersedia pada genre ini.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
          {result.items.map((mangaItem, idx) => (
            <MangaCard key={mangaItem.slug} manga={mangaItem} priority={idx < 6} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3 pt-6">
        {page > 1 && (
          <Link
            href={page === 2 ? `/manga/genre/${slug}` : `/manga/genre/${slug}?page=${page - 1}`}
            className="rounded-lg border border-white/15 bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800"
          >
            Halaman Sebelumnya
          </Link>
        )}
        <span className="text-xs text-white/60">
          Halaman {page}
        </span>
        {result.hasNextPage && (
          <Link
            href={`/manga/genre/${slug}?page=${page + 1}`}
            className="rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30"
          >
            Halaman Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}
