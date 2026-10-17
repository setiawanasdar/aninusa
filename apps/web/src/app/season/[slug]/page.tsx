import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogQuerySchema } from "@aninusa/types";
import { AnimeCard } from "@/components/anime-card";
import { Pagination } from "@/components/pagination";
import { listAnime } from "@/lib/catalog";
import { formatSeasonSlug, parseSeasonSlug } from "@aninusa/utils";

interface SeasonPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: SeasonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSeasonSlug(slug);
  if (!parsed) return { title: "Musim tidak ditemukan" };

  const label = `${parsed.season.charAt(0)}${parsed.season.slice(1).toLowerCase()} ${parsed.year}`;
  return {
    title: `Anime ${label}`,
    description: `Daftar anime rilis ${label} dengan subtitle Indonesia di AniNusa.`,
    alternates: { canonical: `/season/${formatSeasonSlug(parsed.year, parsed.season)}` },
    openGraph: {
      title: `Anime ${label}`,
      description: `Daftar anime rilis ${label} dengan subtitle Indonesia.`,
      url: `/season/${formatSeasonSlug(parsed.year, parsed.season)}`,
    },
  };
}

export default async function SeasonPage({ params, searchParams }: SeasonPageProps) {
  const { slug } = await params;
  const parsed = parseSeasonSlug(slug);
  if (!parsed) notFound();

  const raw = await searchParams;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") normalized[key] = value;
  }

  const query = catalogQuerySchema.parse({ ...normalized, year: parsed.year, season: parsed.season });
  const result = await listAnime(query);
  const label = `${parsed.season.charAt(0)}${parsed.season.slice(1).toLowerCase()} ${parsed.year}`;

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Musim</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{label}</h1>
        <p className="text-sm text-white/50">{result.total.toLocaleString("id-ID")} judul dirilis musim ini.</p>
      </header>

      {result.items.length === 0 ? (
        <div className="surface px-6 py-14 text-center text-sm text-white/50">
          Belum ada anime pada musim ini.
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
        basePath={`/season/${slug}`}
        searchParams={normalized}
      />
    </div>
  );
}
