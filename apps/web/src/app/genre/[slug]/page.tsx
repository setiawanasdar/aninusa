import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogQuerySchema } from "@aninusa/types";
import { AnimeCard } from "@/components/anime-card";
import { Pagination } from "@/components/pagination";
import { listAnime, listGenres } from "@/lib/catalog";

interface GenrePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The root layout reads the session cookie, so catalog pages are rendered on
// demand. Data-level caching (Redis/memory) keeps them fast without making the
// whole route static.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: GenrePageProps): Promise<Metadata> {
  const { slug } = await params;
  const genres = await listGenres();
  const genre = genres.find((entry) => entry.slug === slug);

  if (!genre) return { title: "Genre tidak ditemukan" };

  return {
    title: `Anime genre ${genre.name}`,
    description: `Daftar anime genre ${genre.name} dengan subtitle Indonesia di AniNusa.`,
    alternates: { canonical: `/genre/${genre.slug}` },
    openGraph: {
      title: `Anime genre ${genre.name}`,
      description: `Daftar anime genre ${genre.name} dengan subtitle Indonesia.`,
      url: `/genre/${genre.slug}`,
    },
  };
}

export default async function GenrePage({ params, searchParams }: GenrePageProps) {
  const { slug } = await params;
  const raw = await searchParams;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") normalized[key] = value;
  }

  const genres = await listGenres();
  const genre = genres.find((entry) => entry.slug === slug);
  if (!genre) notFound();

  const parsed = catalogQuerySchema.safeParse({ ...normalized, genre: slug });
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({ genre: slug });
  const result = await listAnime(query);

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Genre</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{genre.name}</h1>
        <p className="text-sm text-white/50">{result.total.toLocaleString("id-ID")} judul dalam genre ini.</p>
      </header>

      {result.items.length === 0 ? (
        <div className="surface px-6 py-14 text-center text-sm text-white/50">
          Belum ada anime pada genre ini.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {result.items.map((anime, index) => (
            <AnimeCard key={anime.id} anime={anime} priority={index < 6} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath={`/genre/${slug}`}
        searchParams={normalized}
      />
    </div>
  );
}
