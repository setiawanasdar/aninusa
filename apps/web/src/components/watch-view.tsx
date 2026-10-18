"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListVideo, Maximize, Server, Star } from "lucide-react";
import { VideoPlayer } from "@aninusa/player";
import type { AnimeSummary, EpisodeDto, EpisodePlayback } from "@aninusa/types";
import { formatEpisodeNumber } from "@aninusa/utils";
import { EpisodeList } from "./episode-list";
import { FavoriteButton } from "./favorite-button";

interface WatchViewProps {
  playback: EpisodePlayback;
  episodes: EpisodeDto[];
  related: AnimeSummary[];
  animeStatus: string;
  animeScore: number | null;
  animeYear: number | null;
  authenticated: boolean;
  favorited: boolean;
  initialProgress: number;
}

const LOCAL_PROGRESS_PREFIX = "aninusa:local-progress:";

export function WatchView({
  playback,
  episodes,
  related,
  animeStatus,
  animeScore,
  animeYear,
  authenticated,
  favorited,
  initialProgress,
}: WatchViewProps) {
  const router = useRouter();
  const [theater, setTheater] = useState(false);
  const [startAt, setStartAt] = useState(initialProgress);
  const [savedLocally, setSavedLocally] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);

  const { anime, episode, sources, subtitles, previousEpisode, nextEpisode } = playback;

  useEffect(() => {
    setActiveSourceIndex(0);
  }, [episode.id]);

  useEffect(() => {
    if (initialProgress > 0) {
      setStartAt(initialProgress);
      return;
    }
    if (authenticated) return;
    try {
      const raw = window.localStorage.getItem(LOCAL_PROGRESS_PREFIX + episode.id);
      if (raw) {
        const parsed = JSON.parse(raw) as { progress?: number };
        if (typeof parsed.progress === "number" && parsed.progress > 5) setStartAt(parsed.progress);
      }
    } catch {
      /* ignore corrupted local state */
    }
  }, [authenticated, episode.id, initialProgress]);

  const saveProgress = useCallback(
    async (progress: { currentTime: number; duration: number; completed: boolean }) => {
      if (authenticated) {
        try {
          await fetch("/api/watch-progress", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              episodeId: episode.id,
              progress: progress.currentTime,
              duration: progress.duration,
              completed: progress.completed,
            }),
            keepalive: true,
          });
        } catch {
          /* progress sync failures are non-fatal */
        }
        return;
      }

      try {
        window.localStorage.setItem(
          LOCAL_PROGRESS_PREFIX + episode.id,
          JSON.stringify({ progress: progress.currentTime, duration: progress.duration }),
        );
        setSavedLocally(true);
      } catch {
        /* storage can be unavailable */
      }
    },
    [authenticated, episode.id],
  );

  const goNext = useCallback(() => {
    if (nextEpisode) {
      router.push(`/anime/${anime.slug}/episode-${formatEpisodeNumber(nextEpisode.number)}`);
    }
  }, [nextEpisode, router, anime.slug]);

  const goPrevious = useCallback(() => {
    if (previousEpisode) {
      router.push(`/anime/${anime.slug}/episode-${formatEpisodeNumber(previousEpisode.number)}`);
    }
  }, [previousEpisode, router, anime.slug]);

  return (
    <div className="container-page py-4 sm:py-6">
      <div className={theater ? "space-y-4" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"}>
        <div className="min-w-0 space-y-4">
          <div className={theater ? "" : "overflow-hidden rounded-xl"}>
            <VideoPlayer
              sources={sources}
              selectedSourceIndex={activeSourceIndex}
              subtitles={subtitles}
              poster={episode.thumbnail ?? anime.poster}
              animeTitle={anime.title}
              animeHref={`/anime/${anime.slug}`}
              episodeNumber={episode.number}
              episodeTitle={episode.title}
              startAt={startAt}
              autoPlay={false}
              theater={theater}
              onTheaterChange={setTheater}
              previousEpisode={previousEpisode}
              nextEpisode={nextEpisode}
              onPreviousEpisode={goPrevious}
              onNextEpisode={goNext}
              onBack={() => router.push(`/anime/${anime.slug}`)}
              intro={
                episode.introStart !== null && episode.introEnd !== null
                  ? { start: episode.introStart, end: episode.introEnd }
                  : null
              }
              outroStart={episode.outroStart}
              onProgress={saveProgress}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#16161c] px-3.5 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <Server className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>Pilih Server:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((src, index) => {
                  const isCurrent = index === activeSourceIndex;
                  const isSubIndo = src.language === "id" || src.label.toLowerCase().includes("sub indo");
                  return (
                    <button
                      key={src.id || index}
                      type="button"
                      onClick={() => setActiveSourceIndex(index)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                        isCurrent
                          ? "bg-accent text-white shadow-sm ring-1 ring-white/20 font-bold"
                          : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-[11px]">{isSubIndo ? "🇮🇩" : "🌐"}</span>
                      <span>{src.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const container = document.querySelector(".anp-root");
                if (container) {
                  if (document.fullscreenElement) {
                    void document.exitFullscreen();
                    if (typeof screen !== "undefined" && screen.orientation) {
                      try {
                        void (screen.orientation as any).unlock?.();
                      } catch {}
                    }
                  } else {
                    void container.requestFullscreen();
                    if (typeof screen !== "undefined" && screen.orientation) {
                      try {
                        void (screen.orientation as any).lock?.("landscape")?.catch?.(() => undefined);
                      } catch {}
                    }
                  }
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Maximize className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Layar Penuh</span>
            </button>
          </div>

          {sources[activeSourceIndex]?.format === "EMBED" && (
            <div className="flex items-start gap-1.5 px-1 text-[11px] text-white/40">
              <span className="shrink-0 font-medium text-white/60">💡 Tips Server:</span>
              <span>Jika pemutar tidak langsung berputar atau membuka tab baru, cukup tutup tab tersebut dan klik putar kembali, atau pilih opsi server lain di atas.</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Link
              href={previousEpisode ? `/anime/${anime.slug}/episode-${formatEpisodeNumber(previousEpisode.number)}` : `/anime/${anime.slug}`}
              className="btn-secondary px-3 py-2 text-xs"
              aria-label={previousEpisode ? `Episode ${previousEpisode.number} sebelumnya` : "Kembali ke detail anime"}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {previousEpisode ? `Episode ${formatEpisodeNumber(previousEpisode.number)}` : "Detail"}
            </Link>

            <p className="text-xs text-white/40">
              Episode {formatEpisodeNumber(episode.number)}
              {episodes.length > 0 ? ` dari ${episodes.length}` : ""}
            </p>

            <Link
              href={nextEpisode ? `/anime/${anime.slug}/episode-${formatEpisodeNumber(nextEpisode.number)}` : `/anime/${anime.slug}`}
              className={`btn-secondary px-3 py-2 text-xs ${nextEpisode ? "" : "pointer-events-none opacity-40"}`}
              aria-label={nextEpisode ? `Episode ${nextEpisode.number} berikutnya` : "Tidak ada episode berikutnya"}
            >
              {nextEpisode ? `Episode ${formatEpisodeNumber(nextEpisode.number)}` : "Selesai"}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <section className="space-y-3 pt-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/anime/${anime.slug}`}
                  className="text-xl font-bold tracking-tight text-white hover:text-accent sm:text-2xl"
                >
                  {anime.title}
                </Link>
                {(() => {
                  const epLabel = `Episode ${formatEpisodeNumber(episode.number)}`;
                  const titleClean = episode.title?.trim();
                  const showCustomTitle =
                    titleClean &&
                    titleClean.toLowerCase() !== epLabel.toLowerCase() &&
                    titleClean.toLowerCase() !== `episode ${episode.number}`.toLowerCase();
                  return (
                    <h1 className="mt-0.5 text-sm font-medium text-white/60">
                      {epLabel}
                      {showCustomTitle ? ` — ${titleClean}` : ""}
                    </h1>
                  );
                })()}
              </div>
              <FavoriteButton
                animeId={anime.id}
                initialFavorited={favorited}
                authenticated={authenticated}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              <span className="badge">{animeStatus}</span>
              {animeYear && <span className="badge">{animeYear}</span>}
              {animeScore !== null && (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  {animeScore.toFixed(1)}
                </span>
              )}
              {!authenticated && savedLocally && (
                <span className="text-white/35">Progres disimpan di perangkat ini.</span>
              )}
              {!authenticated && (
                <Link href={`/login?next=${encodeURIComponent(`/anime/${anime.slug}/episode-${formatEpisodeNumber(episode.number)}`)}`} className="text-accent hover:underline">
                  Masuk untuk menyinkronkan progres
                </Link>
              )}
            </div>

            {episode.description ? (
              <p className="prose-synopsis max-w-3xl">{episode.description}</p>
            ) : null}
          </section>

          {related.length > 0 && (
            <section className="space-y-3 border-t border-white/10 pt-5">
              <h2 className="text-sm font-bold text-white">Rekomendasi berikutnya</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {related.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={`/anime/${item.slug}`}
                    className="group overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="relative aspect-[2/3] w-full bg-ink-750">
                      {item.poster && (
                        <Image
                          src={item.poster}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 45vw, 20vw"
                          className="object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <p className="line-clamp-2 p-2 text-xs font-medium text-white/85 group-hover:text-white">
                      {item.title}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {!theater && (
          <aside className="min-w-0">
            <div className="surface sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <ListVideo className="h-4 w-4 text-accent" aria-hidden="true" />
                Daftar episode
              </h2>
              <EpisodeList
                animeSlug={anime.slug}
                episodes={episodes}
                currentEpisodeNumber={episode.number}
                latestEpisodeNumber={episodes[episodes.length - 1]?.number ?? null}
              />
            </div>
          </aside>
        )}

        {theater && (
          <section className="surface p-4">
            <h2 className="mb-3 text-sm font-bold text-white">Daftar episode</h2>
            <EpisodeList
              animeSlug={anime.slug}
              episodes={episodes}
              currentEpisodeNumber={episode.number}
              latestEpisodeNumber={episodes[episodes.length - 1]?.number ?? null}
            />
          </section>
        )}
      </div>
    </div>
  );
}

