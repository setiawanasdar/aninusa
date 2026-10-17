import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { AnimeForm } from "@/components/admin/anime-form";
import { EpisodesManager, type AdminEpisodeRow } from "@/components/admin/episodes-manager";
import { DeleteButton } from "@/components/admin/delete-button";
import { RefreshMetadataButton } from "@/components/admin/refresh-metadata-button";
import { getAnimeBySlug } from "@/lib/catalog";
import { requireAdminPage } from "@/lib/page-auth";

interface AdminAnimeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAnimeDetailPage({ params }: AdminAnimeDetailPageProps) {
  await requireAdminPage("/admin/anime");
  const { id } = await params;

  const animeRow = await prisma.anime.findUnique({
    where: { id },
    select: { slug: true, title: true },
  });
  if (!animeRow) notFound();

  const anime = await getAnimeBySlug(animeRow.slug);
  if (!anime) notFound();

  const episodes = await prisma.episode.findMany({
    where: { animeId: id },
    orderBy: { episodeNumber: "asc" },
    select: {
      id: true,
      animeId: true,
      episodeNumber: true,
      title: true,
      description: true,
      duration: true,
      thumbnail: true,
      airDate: true,
      introStart: true,
      introEnd: true,
      outroStart: true,
      sources: {
        orderBy: [{ quality: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          provider: true,
          url: true,
          quality: true,
          format: true,
          codec: true,
          language: true,
          status: true,
          lastCheckedAt: true,
        },
      },
      subtitles: {
        orderBy: [{ isDefault: "desc" }, { language: "asc" }],
        select: {
          id: true,
          language: true,
          label: true,
          url: true,
          format: true,
          isDefault: true,
          status: true,
        },
      },
    },
  });

  const rows: AdminEpisodeRow[] = episodes.map((episode) => ({
    id: episode.id,
    animeId: episode.animeId,
    number: episode.episodeNumber,
    title: episode.title,
    description: episode.description,
    duration: episode.duration,
    thumbnail: episode.thumbnail,
    airDate: episode.airDate?.toISOString() ?? null,
    introStart: episode.introStart,
    introEnd: episode.introEnd,
    outroStart: episode.outroStart,
    sources: episode.sources.map((source) => ({
      ...source,
      lastCheckedAt: source.lastCheckedAt?.toISOString() ?? null,
    })),
    subtitles: episode.subtitles,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/anime" className="flex items-center gap-1 text-xs text-white/45 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Kembali ke daftar
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{anime.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <RefreshMetadataButton animeId={anime.id} />
            <Link href={`/anime/${anime.slug}`} className="btn-secondary px-3 py-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Lihat halaman
            </Link>
            <DeleteButton
              endpoint={`/api/admin/anime/${anime.id}`}
              confirmMessage={`Hapus "${anime.title}" beserta seluruh episode?`}
              redirectTo="/admin/anime"
              label="Hapus anime"
            />
          </div>
        </div>
      </header>

      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-bold text-white">Metadata</h2>
        <AnimeForm anime={anime} />
      </section>

      <section className="surface p-5">
        <EpisodesManager animeId={anime.id} episodes={rows} />
      </section>
    </div>
  );
}
