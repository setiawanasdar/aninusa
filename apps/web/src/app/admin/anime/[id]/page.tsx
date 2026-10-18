import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { AnimeForm } from "@/components/admin/anime-form";
import { EpisodesManager, type AdminEpisodeRow } from "@/components/admin/episodes-manager";
import { RefreshMetadataButton } from "@/components/admin/refresh-metadata-button";
import { getAnimeBySlug, getAnimeEpisodes } from "@/lib/catalog";
import { requireAdminPage } from "@/lib/page-auth";

interface AdminAnimeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAnimeDetailPage({ params }: AdminAnimeDetailPageProps) {
  await requireAdminPage("/admin/anime");
  const { id } = await params;

  let anime = await getAnimeBySlug(id);
  if (!anime) {
    const animeRow = await prisma.anime
      .findUnique({
        where: { id },
        select: { slug: true, title: true },
      })
      .catch(() => null);
    if (animeRow) {
      anime = await getAnimeBySlug(animeRow.slug);
    }
  }
  if (!anime) notFound();

  const episodeDtos = await getAnimeEpisodes(anime.slug).catch(() => []);

  const rows: AdminEpisodeRow[] = episodeDtos.map((episode) => ({
    ...episode,
    sources: [
      {
        id: `src-${episode.id}`,
        provider: "anikoto",
        url: `https://anikototvapi.vercel.app/stream?id=${episode.id}`,
        quality: 1080,
        format: "EMBED",
        codec: null,
        language: "ja",
        status: "ACTIVE",
        lastCheckedAt: new Date().toISOString(),
      },
    ],
    subtitles: [
      {
        id: `sub-${episode.id}`,
        language: "id",
        label: "Indonesia",
        url: "#",
        format: "VTT",
        isDefault: true,
        status: "ACTIVE",
      },
    ],
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
            <RefreshMetadataButton animeId={anime.slug} />
            <Link href={`/anime/${anime.slug}`} className="btn-secondary px-3 py-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Lihat halaman
            </Link>
          </div>
        </div>
      </header>

      <section className="surface p-5">
        <h2 className="mb-4 text-sm font-bold text-white">Metadata (AniKoto API)</h2>
        <AnimeForm anime={anime} />
      </section>

      <section className="surface p-5">
        <EpisodesManager animeId={anime.slug} episodes={rows} />
      </section>
    </div>
  );
}
