import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Film, Layers, Play, Star, Tv } from "lucide-react";
import { formatDate, formatEpisodeNumber } from "@aninusa/utils";
import { AnimeRail } from "@/components/anime-rail";
import { EpisodeList } from "@/components/episode-list";
import { FavoriteButton } from "@/components/favorite-button";
import { getSessionUser } from "@/lib/auth";
import {
  getAnimeAvailability,
  getAnimeBySlug,
  getAnimeEpisodes,
  getFavoriteIds,
  getRelatedAnime,
} from "@/lib/catalog";
import { siteName, siteUrl } from "@/lib/env";
import { serializeJsonLd } from "@/lib/seo";

interface AnimePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AnimePageProps): Promise<Metadata> {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);

  if (!anime) {
    return { title: "Anime tidak ditemukan", robots: { index: false, follow: false } };
  }

  const description =
    anime.synopsis?.replace(/\s+/g, " ").slice(0, 160) ??
    `Tonton ${anime.title} dengan subtitle Indonesia di ${siteName()}.`;

  return {
    title: anime.title,
    description,
    alternates: { canonical: `/anime/${anime.slug}` },
    openGraph: {
      type: "video.tv_show",
      title: anime.title,
      description,
      url: `/anime/${anime.slug}`,
      images: anime.banner || anime.poster ? [{ url: (anime.banner || anime.poster)! }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: anime.title,
      description,
      images: anime.banner || anime.poster ? [(anime.banner || anime.poster)!] : undefined,
    },
  };
}

const statusLabel: Record<string, string> = {
  ONGOING: "Ongoing",
  COMPLETED: "Selesai",
  UPCOMING: "Segera",
};

export default async function AnimeDetailPage({ params }: AnimePageProps) {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) notFound();

  const [episodes, related, user, availability] = await Promise.all([
    getAnimeEpisodes(anime.id),
    getRelatedAnime(anime, 10),
    getSessionUser(),
    getAnimeAvailability(anime.id),
  ]);

  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  const firstEpisode = episodes[0];
  const lastEpisode = episodes[episodes.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": anime.type === "MOVIE" ? "Movie" : "TVSeries",
    name: anime.title,
    alternateName: [anime.englishTitle, anime.japaneseTitle, ...anime.alternativeTitles].filter(Boolean),
    description: anime.synopsis ?? undefined,
    image: anime.poster ? new URL(anime.poster, siteUrl()).toString() : undefined,
    url: `${siteUrl()}/anime/${anime.slug}`,
    inLanguage: "ja",
    numberOfEpisodes: anime.episodeCount || undefined,
    genre: anime.genres,
    datePublished: anime.airedFrom ?? undefined,
    aggregateRating:
      anime.score !== null
        ? {
            "@type": "AggregateRating",
            ratingValue: anime.score,
            bestRating: 10,
            worstRating: 1,
            ratingCount: Math.max(10, anime.popularity),
          }
        : undefined,
    productionCompany: anime.studios.map((name) => ({ "@type": "Organization", name })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <div className="relative">
        <div className="relative h-[280px] w-full overflow-hidden sm:h-[340px] lg:h-[400px]">
          {anime.banner || anime.poster ? (
            <Image
              src={(anime.banner || anime.poster)!}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_30%]"
            />
          ) : (
            <div className="h-full w-full bg-ink-850" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/20" />
        </div>

        <div className="container-page relative -mt-36 pb-8 sm:-mt-44 lg:-mt-52">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
            <div className="relative mx-auto w-[168px] shrink-0 sm:mx-0 sm:w-[200px] lg:w-[220px]">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/15 bg-ink-800 shadow-2xl">
                {anime.poster ? (
                  <Image
                    src={anime.poster}
                    alt={`Poster ${anime.title}`}
                    fill
                    priority
                    sizes="220px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/30">Tanpa poster</div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-1 sm:pt-8">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="badge">{anime.type}</span>
                <span className="badge">{statusLabel[anime.status] ?? anime.status}</span>
                {anime.year && <span className="badge">{anime.year}</span>}
                {anime.season && <span className="badge">{anime.season}</span>}
                {anime.score !== null && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-0.5 text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {anime.score.toFixed(1)}
                  </span>
                )}
              </div>

              <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                {anime.title}
              </h1>

              <div className="mt-1 space-y-0.5 text-sm text-white/45">
                {anime.englishTitle && anime.englishTitle !== anime.title && <p>{anime.englishTitle}</p>}
                {anime.japaneseTitle && <p lang="ja">{anime.japaneseTitle}</p>}
                {anime.alternativeTitles.length > 0 && (
                  <p className="line-clamp-1 text-xs text-white/35">
                    Juga dikenal: {anime.alternativeTitles.slice(0, 4).join(", ")}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={
                    firstEpisode
                      ? `/anime/${anime.slug}/episode-${formatEpisodeNumber(firstEpisode.number)}`
                      : "#episodes"
                  }
                  className="btn-primary px-5"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Tonton sekarang
                </Link>
                <FavoriteButton
                  animeId={anime.id || anime.slug}
                  title={anime.title}
                  poster={anime.poster}
                  banner={anime.banner}
                  score={anime.score}
                  year={anime.year}
                  initialFavorited={favoriteIds.includes(anime.id) || favoriteIds.includes(anime.slug)}
                  authenticated={Boolean(user)}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <dt className="text-white/35">Studio</dt>
                  <dd className="mt-0.5 font-medium text-white/80">
                    {anime.studios.length ? anime.studios.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/35">Tayang</dt>
                  <dd className="mt-0.5 font-medium text-white/80">
                    {anime.airedFrom ? formatDate(anime.airedFrom) : anime.year ? String(anime.year) : "—"}
                    {anime.airedTo ? ` – ${formatDate(anime.airedTo)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/35">Episode</dt>
                  <dd className="mt-0.5 font-medium text-white/80">
                    {anime.episodeCount > 0
                      ? `${anime.episodeCount} tersedia${anime.totalEpisodes ? ` / ${anime.totalEpisodes}` : ""}`
                      : anime.totalEpisodes
                        ? `${anime.totalEpisodes}`
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/35">Durasi</dt>
                  <dd className="mt-0.5 font-medium text-white/80">
                    {anime.duration ? `${anime.duration} menit` : "—"}
                  </dd>
                </div>
              </dl>

              {anime.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {anime.genres.map((genre) => (
                    <Link
                      key={genre}
                      href={`/genre/${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                      className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-white/65 transition-colors hover:border-accent/40 hover:text-white"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-8">
              <section className="space-y-2" aria-labelledby="synopsis-heading">
                <h2 id="synopsis-heading" className="text-base font-bold text-white">
                  Sinopsis
                </h2>
                <p className="prose-synopsis">
                  {anime.synopsis ?? "Sinopsis belum tersedia untuk judul ini."}
                </p>
              </section>

              <section id="episodes" className="space-y-3 scroll-mt-24" aria-labelledby="episodes-heading">
                <div className="flex items-end justify-between gap-3">
                  <h2 id="episodes-heading" className="text-base font-bold text-white">
                    Episode
                  </h2>
                  {episodes.length > 0 && (
                    <span className="text-xs text-white/40">
                      {episodes.length} episode tersedia
                    </span>
                  )}
                </div>
                <EpisodeList
                  animeSlug={anime.slug}
                  episodes={episodes}
                  latestEpisodeNumber={anime.latestEpisode}
                />
              </section>
            </div>

            <aside className="space-y-4">
              <div className="surface space-y-3 p-4">
                <h2 className="text-sm font-bold text-white">Informasi</h2>
                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-white/40">
                      <Tv className="h-3.5 w-3.5" aria-hidden="true" /> Tipe
                    </dt>
                    <dd className="text-right font-medium text-white/80">{anime.type}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-white/40">
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" /> Status
                    </dt>
                    <dd className="text-right font-medium text-white/80">
                      {statusLabel[anime.status] ?? anime.status}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-white/40">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Tahun
                    </dt>
                    <dd className="text-right font-medium text-white/80">{anime.year ?? "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-white/40">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Durasi
                    </dt>
                    <dd className="text-right font-medium text-white/80">
                      {anime.duration ? `${anime.duration} menit` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-white/40">
                      <Film className="h-3.5 w-3.5" aria-hidden="true" /> Sumber metadata
                    </dt>
                    <dd className="text-right font-medium text-white/80">{anime.source ?? "AniNusa"}</dd>
                  </div>
                  {lastEpisode && (
                    <div className="flex items-start justify-between gap-3 border-t border-white/10 pt-2.5">
                      <dt className="text-white/40">Episode terakhir</dt>
                      <dd className="text-right font-medium text-white/80">
                        <Link
                          href={`/anime/${anime.slug}/episode-${formatEpisodeNumber(lastEpisode.number)}`}
                          className="hover:text-accent"
                        >
                          Episode {formatEpisodeNumber(lastEpisode.number)}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <div>
                    <p className="text-[11px] text-white/35">Kualitas tersedia</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {availability.adaptive && (
                        <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
                          Auto
                        </span>
                      )}
                      {availability.qualities.map((quality) => (
                        <span
                          key={quality}
                          className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold text-white/70"
                        >
                          {quality}p
                        </span>
                      ))}
                      {!availability.adaptive && availability.qualities.length === 0 && (
                        <span className="text-[11px] text-white/30">Belum tersedia</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/35">Subtitle</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {availability.subtitleLanguages.map((track) => (
                        <span
                          key={track.language}
                          className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/70"
                        >
                          {track.language}
                        </span>
                      ))}
                      {availability.subtitleLanguages.length === 0 && (
                        <span className="text-[11px] text-white/30">Belum tersedia</span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="border-t border-white/10 pt-2.5 text-[11px] leading-relaxed text-white/35">
                  Subtitle Indonesia tersedia jika provider menyediakannya. Kualitas mengikuti sumber resmi dan
                  tidak pernah di-upscale.
                </p>
              </div>

              <div className="surface p-4">
                <h2 className="mb-2 text-sm font-bold text-white">Legalitas</h2>
                <p className="text-[11px] leading-relaxed text-white/40">
                  AniNusa hanya menampilkan video yang sah, berlisensi, domain publik, atau diizinkan untuk
                  di-embed. Metadata dapat berasal dari API resmi AniList. Tidak ada DRM atau pembatasan akses
                  yang dilewati.
                </p>
              </div>
            </aside>
          </div>

          {related.length > 0 && (
            <div className="mt-10">
              <AnimeRail title="Anime terkait" anime={related} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
