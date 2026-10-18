import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  getAnimeBySlug,
  getAnimeEpisodes,
  getEpisodePlayback,
  getFavoriteIds,
  getRelatedAnime,
} from "@/lib/catalog";
import { parseEpisodeSlug, formatEpisodeNumber } from "@aninusa/utils";
import { WatchView } from "@/components/watch-view";
import { siteName, siteUrl } from "@/lib/env";
import { serializeJsonLd } from "@/lib/seo";

interface WatchPageProps {
  params: Promise<{ slug: string; episode: string }>;
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { slug, episode: episodeSlug } = await params;
  const number = parseEpisodeSlug(episodeSlug);
  if (number === null) {
    return { title: "Episode tidak ditemukan", robots: { index: false, follow: false } };
  }

  const [anime, episodes] = await Promise.all([
    getAnimeBySlug(slug),
    getAnimeEpisodes(slug),
  ]);

  if (!anime) {
    return { title: "Episode tidak ditemukan", robots: { index: false, follow: false } };
  }

  const episode = episodes.find((ep) => ep.number === number) ?? null;
  if (!episode) {
    return { title: "Episode tidak ditemukan", robots: { index: false, follow: false } };
  }

  const title = `${anime.title} Episode ${formatEpisodeNumber(number)}`;
  const description =
    episode.description?.replace(/\s+/g, " ").slice(0, 160) ??
    `Tonton ${anime.title} episode ${formatEpisodeNumber(number)} dengan subtitle Indonesia di ${siteName()}.`;

  return {
    title,
    description,
    alternates: { canonical: `/anime/${anime.slug}/episode-${formatEpisodeNumber(number)}` },
    openGraph: {
      type: "video.episode",
      title,
      description,
      url: `/anime/${anime.slug}/episode-${formatEpisodeNumber(number)}`,
      images: episode.thumbnail || anime.poster ? [{ url: (episode.thumbnail || anime.poster)! }] : undefined,
    },
  };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug, episode: episodeSlug } = await params;
  const number = parseEpisodeSlug(episodeSlug);
  if (number === null) notFound();

  const [anime, episodes, user] = await Promise.all([
    getAnimeBySlug(slug),
    getAnimeEpisodes(slug),
    getSessionUser(),
  ]);

  if (!anime) notFound();

  const episode = episodes.find((ep) => ep.number === number) ?? null;
  if (!episode) notFound();

  const [playback, related] = await Promise.all([
    getEpisodePlayback(episode.id, { animeSlug: anime.slug, episodeNumber: number }),
    getRelatedAnime(anime, 6),
  ]);

  if (!playback) notFound();

  const [favoriteIds, history] = user
    ? await Promise.all([
        getFavoriteIds(user.id),
        prisma.watchHistory
          .findUnique({
            where: { userId_episodeId: { userId: user.id, episodeId: episode.id } },
            select: { progress: true, completed: true },
          })
          .catch(() => null),
      ])
    : [[], null];

  const initialProgress =
    history && !history.completed && history.progress > 5 ? history.progress : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: episode.title ?? `Episode ${formatEpisodeNumber(number)}`,
    episodeNumber: number,
    partOfSeries: {
      "@type": "TVSeries",
      name: anime.title,
      url: `${siteUrl()}/anime/${anime.slug}`,
    },
    url: `${siteUrl()}/anime/${anime.slug}/episode-${formatEpisodeNumber(number)}`,
    description: episode.description ?? undefined,
    image: episode.thumbnail ?? undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <WatchView
        playback={playback}
        episodes={episodes}
        related={related}
        animeStatus={anime.status}
        animeScore={anime.score}
        animeYear={anime.year}
        authenticated={Boolean(user)}
        favorited={favoriteIds.includes(anime.id) || favoriteIds.includes(anime.slug)}
        initialProgress={initialProgress}
      />
    </>
  );
}
