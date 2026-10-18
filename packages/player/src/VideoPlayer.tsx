"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Hls from "hls.js";
import {
  Captions,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  TriangleAlert,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  findActiveCues,
  parseSubtitles,
  type SubtitleCue,
} from "@aninusa/utils";
import { SettingsMenu } from "./SettingsMenu";
import type { PlayerProgress, PlayerSource, SubtitleStyle, VideoPlayerProps } from "./types";
import {
  DEFAULT_SUBTITLE_STYLE,
  actionForKey,
  clamp,
  formatPlayerTime,
  hlsLevelsToOptions,
  isTypingTarget,
  sanitizeSubtitleStyle,
} from "./utils";

const STORAGE_PREFIX = "aninusa:player:";

interface QualityOption {
  value: number;
  label: string;
  sourceId?: string;
}

/**
 * Minimal structural type for the dash.js surface we use. Keeping it local
 * avoids shipping the full dash.js type graph to consumers of the player.
 */
interface DashPlayer {
  initialize: (element: HTMLVideoElement, url: string, autoPlay?: boolean) => void;
  reset: () => void;
  on: (event: string, handler: () => void) => void;
  getBitrateInfoListFor: (type: string) => Array<{ height?: number; bitrate?: number }>;
  setQualityFor: (type: string, index: number, replace?: boolean) => void;
  updateSettings: (settings: unknown) => void;
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function VideoPlayer({
  sources,
  selectedSourceIndex,
  subtitles = [],
  poster,
  animeTitle,
  animeHref,
  episodeNumber,
  episodeTitle,
  startAt = 0,
  autoPlay = false,
  autoNextDefault = true,
  nextEpisode,
  previousEpisode,
  onNextEpisode,
  onPreviousEpisode,
  onBack,
  intro,
  outroStart,
  theater = false,
  onTheaterChange,
  onProgress,
  onEnded,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<DashPlayer | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressReportTimer = useRef(0);
  const resumeApplied = useRef(false);
  const introSkipped = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [hlsQualities, setHlsQualities] = useState<QualityOption[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [autoNext, setAutoNext] = useState(autoNextDefault);
  const [subtitleId, setSubtitleId] = useState<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [showIntroButton, setShowIntroButton] = useState(false);
  const [showOutroButton, setShowOutroButton] = useState(false);
  const [ended, setEnded] = useState(false);
  const [seekPreview, setSeekPreview] = useState<{ time: number; x: number } | null>(null);

  const playerId = useId();

  const orderedSources = useMemo(() => {
    if (sources.some((s) => s.format === "EMBED")) return sources;
    return [...sources].sort((a, b) => (a.quality === 0 ? -1 : b.quality === 0 ? 1 : b.quality - a.quality));
  }, [sources]);

  const activeSource: PlayerSource | undefined =
    typeof selectedSourceIndex === "number" && sources[selectedSourceIndex]
      ? sources[selectedSourceIndex]
      : orderedSources[sourceIndex] ?? sources[0];

  const isEmbed = Boolean(
    activeSource &&
      (activeSource.format === "EMBED" || /megaplay\.buzz|\/stream\//i.test(activeSource.url)),
  );
  const activeSubtitle = subtitles.find((track) => track.id === subtitleId) ?? null;

  const visibleCues = useMemo(
    () => (subtitleCues.length ? findActiveCues(subtitleCues, currentTime) : []),
    [subtitleCues, currentTime],
  );

  useEffect(() => {
    const stored = readStored<SubtitleStyle>("subtitle-style", DEFAULT_SUBTITLE_STYLE);
    setSubtitleStyle(sanitizeSubtitleStyle(stored));
    setAutoNext(readStored("auto-next", autoNextDefault));
  }, [autoNextDefault]);

  useEffect(() => {
    writeStored("subtitle-style", subtitleStyle);
  }, [subtitleStyle]);

  useEffect(() => {
    writeStored("auto-next", autoNext);
  }, [autoNext]);

  useEffect(() => {
    setSourceIndex(0);
    setSelectedQuality(-1);
    setError(null);
    setEnded(false);
    resumeApplied.current = false;
    introSkipped.current = false;
  }, [sources]);

  useEffect(() => {
    if (!subtitles.length) {
      setSubtitleId(null);
      return;
    }
    const indonesian = subtitles.find((track) => track.language.toLowerCase().startsWith("id"));
    const fallback = subtitles.find((track) => track.isDefault) ?? indonesian ?? subtitles[0];
    setSubtitleId(fallback?.id ?? null);
  }, [subtitles]);

  useEffect(() => {
    if (!activeSubtitle) {
      setSubtitleCues([]);
      setSubtitleError(null);
      return;
    }

    const controller = new AbortController();
    setSubtitleError(null);
    setSubtitleCues([]);

    fetch(activeSubtitle.url, { signal: controller.signal, credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("subtitle-unavailable");
        const text = await response.text();
        return parseSubtitles(text, activeSubtitle.format);
      })
      .then((cues) => {
        if (!controller.signal.aborted) setSubtitleCues(cues);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setSubtitleError(
          activeSubtitle.language.toLowerCase().startsWith("id")
            ? "Subtitle Indonesia tidak tersedia."
            : "Subtitle tidak tersedia.",
        );
        if (process.env.NODE_ENV !== "production") {
          console.warn("[player] subtitle load failed", cause);
        }
      });

    return () => controller.abort();
  }, [activeSubtitle]);

  // Attach the active source. HLS uses hls.js where MSE is available and falls
  // back to native HLS (Safari/iOS) otherwise.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHlsQualities([]);

    const isEmbed = activeSource.format === "EMBED" || /megaplay\.buzz|\/stream\//i.test(activeSource.url);
    if (isEmbed) {
      setLoading(false);
      setError(null);
      return;
    }

    const isHls = activeSource.format === "HLS" || /\.m3u8(\?|$)/i.test(activeSource.url);
    const isDash = activeSource.format === "DASH" || /\.mpd(\?|$)/i.test(activeSource.url);

    if (isDash) {
      let cancelled = false;
      let player: DashPlayer | null = null;

      void import("dashjs")
        .then((module) => {
          if (cancelled) return;
          const dashjs = (module as unknown as { default?: { MediaPlayer: () => { create: () => DashPlayer } } })
            .default;
          const factory = dashjs ?? (module as unknown as { MediaPlayer: () => { create: () => DashPlayer } });
          player = factory.MediaPlayer().create();
          dashRef.current = player;

          player.initialize(video, activeSource.url, autoPlay);
          player.on("streamInitialized", () => {
            const bitrates = player?.getBitrateInfoListFor("video") ?? [];
            const heights = bitrates
              .map((info) => info.height ?? 0)
              .filter((height) => height > 0);
            setHlsQualities(
              Array.from(new Set(heights))
                .sort((a, b) => b - a)
                .map((height) => ({ value: height, label: `${height}p` })),
            );
            setLoading(false);
          });
          player.on("error", () => {
            setError("Sumber video tidak tersedia.");
            setLoading(false);
          });
        })
        .catch(() => {
          setError("Sumber video tidak tersedia.");
          setLoading(false);
        });

      return () => {
        cancelled = true;
        player?.reset();
        dashRef.current = null;
      };
    }

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        capLevelToPlayerSize: true,
        startLevel: -1,
      });
      hlsRef.current = hls;

      hls.loadSource(activeSource.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const options = hlsLevelsToOptions(
          data.levels.map((level, index) => ({
            index,
            height: level.height ?? 0,
            bitrate: level.bitrate ?? 0,
            name: level.name ?? "",
          })),
        );
        setHlsQualities(options);
        setLoading(false);
        if (autoPlay) void video.play().catch(() => setPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setError("Sumber video tidak tersedia.");
            setLoading(false);
            hls.destroy();
            hlsRef.current = null;
            break;
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = activeSource.url;
    if (isHls) {
      setLoading(false);
      if (autoPlay) void video.play().catch(() => setPlaying(false));
      return;
    }

    const handleLoaded = () => {
      setLoading(false);
      if (autoPlay) void video.play().catch(() => setPlaying(false));
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
    // Quality changes are applied through hls.currentLevel; re-attaching the
    // source here would reset playback position on every menu selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource, autoPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = playbackRate;
  }, [volume, muted, playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const applyStart = () => {
      if (resumeApplied.current) return;
      const target = Number.isFinite(startAt) ? Math.max(0, startAt) : 0;
      if (target > 0 && Number.isFinite(video.duration) && target < video.duration - 10) {
        video.currentTime = target;
      }
      resumeApplied.current = true;
    };

    if (video.readyState >= 1) applyStart();
    video.addEventListener("loadedmetadata", applyStart);
    return () => video.removeEventListener("loadedmetadata", applyStart);
  }, [startAt, activeSource?.id]);

  const reportProgress = useCallback(
    (force = false) => {
      const video = videoRef.current;
      if (!video || !onProgress) return;
      const now = Date.now();
      if (!force && now - progressReportTimer.current < 5_000) return;
      progressReportTimer.current = now;
      const total = Number.isFinite(video.duration) ? video.duration : 0;
      onProgress({
        currentTime: Math.floor(video.currentTime),
        duration: Math.floor(total),
        completed: total > 0 && (video.currentTime >= total - 20 || video.currentTime / total >= 0.95),
      });
    },
    [onProgress],
  );

  useEffect(() => {
    const handleUnload = () => reportProgress(true);
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [reportProgress]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setEnded(false);
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = clamp(video.currentTime + delta, 0, total || 0);
  }, []);

  const changeVolume = useCallback((delta: number) => {
    setVolume((current) => {
      const next = clamp(Number((current + delta).toFixed(2)), 0, 1);
      if (next > 0) setMuted(false);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        if (typeof screen !== "undefined" && screen.orientation) {
          try {
            void (screen.orientation as any).unlock?.();
          } catch {
            /* ignore */
          }
        }
      } else {
        await container.requestFullscreen();
        if (typeof screen !== "undefined" && screen.orientation) {
          try {
            void (screen.orientation as any).lock?.("landscape")?.catch?.(() => undefined);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* browsers can reject fullscreen without a user gesture */
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {
      /* unsupported or denied */
    }
  }, []);

  const toggleTheater = useCallback(() => {
    onTheaterChange?.(!theater);
  }, [onTheaterChange, theater]);

  const skipIntro = useCallback(() => {
    const video = videoRef.current;
    if (!video || !intro) return;
    video.currentTime = intro.end;
    introSkipped.current = true;
    setShowIntroButton(false);
  }, [intro]);

  const skipOutro = useCallback(() => {
    const video = videoRef.current;
    if (!video || !nextEpisode) return;
    if (autoNext) {
      onNextEpisode?.();
      return;
    }
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    if (total > 0) video.currentTime = Math.max(0, total - 1);
  }, [autoNext, nextEpisode, onNextEpisode]);

  const goNext = useCallback(() => {
    reportProgress(true);
    onNextEpisode?.();
  }, [onNextEpisode, reportProgress]);

  const goPrevious = useCallback(() => {
    reportProgress(true);
    onPreviousEpisode?.();
  }, [onPreviousEpisode, reportProgress]);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 3_000);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    const onPipChange = () => setPipActive(Boolean(document.pictureInPictureElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("enterpictureinpicture", onPipChange);
    document.addEventListener("leavepictureinpicture", onPipChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("enterpictureinpicture", onPipChange);
      document.removeEventListener("leavepictureinpicture", onPipChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const action = actionForKey(event.key, {
        hasNext: Boolean(nextEpisode),
        hasPrevious: Boolean(previousEpisode),
      });
      if (!action) return;
      if (event.key === " " || event.key.startsWith("Arrow")) event.preventDefault();
      if (settingsOpen && event.key !== "Escape") return;

      switch (action) {
        case "toggle-play":
          togglePlay();
          break;
        case "seek-backward":
          seekBy(event.shiftKey ? -30 : -10);
          break;
        case "seek-forward":
          seekBy(event.shiftKey ? 30 : 10);
          break;
        case "volume-up":
          changeVolume(0.1);
          break;
        case "volume-down":
          changeVolume(-0.1);
          break;
        case "mute":
          toggleMute();
          break;
        case "fullscreen":
          void toggleFullscreen();
          break;
        case "next":
          goNext();
          break;
        case "previous":
          goPrevious();
          break;
        case "theater":
          toggleTheater();
          break;
        case "pip":
          void togglePip();
          break;
        case "captions":
          setSettingsOpen((open) => !open);
          break;
      }
      showControlsTemporarily();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    changeVolume,
    goNext,
    goPrevious,
    nextEpisode,
    previousEpisode,
    seekBy,
    settingsOpen,
    showControlsTemporarily,
    toggleFullscreen,
    toggleMute,
    togglePip,
    togglePlay,
    toggleTheater,
  ]);

  const qualityOptions: QualityOption[] = useMemo(() => {
    if (hlsQualities.length) return hlsQualities;
    const fixed = orderedSources
      .filter((source) => source.quality > 0)
      .map((source) => ({ value: source.quality, label: `${source.quality}p`, sourceId: source.id }));
    return fixed.sort((a, b) => b.value - a.value);
  }, [hlsQualities, orderedSources]);

  const handleQualityChange = (value: number) => {
    setSelectedQuality(value);

    const dash = dashRef.current;
    if (dash) {
      if (value === -1) {
        dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      } else {
        const bitrates = dash.getBitrateInfoListFor("video");
        const index = bitrates.findIndex((info) => info.height === value);
        if (index >= 0) {
          dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
          dash.setQualityFor("video", index, true);
        }
      }
      return;
    }

    const hls = hlsRef.current;
    if (hls) {
      if (value === -1) {
        hls.currentLevel = -1;
      } else {
        const index = hls.levels.findIndex((level) => level.height === value);
        if (index >= 0) hls.currentLevel = index;
      }
      return;
    }

    if (value > 0) {
      const index = orderedSources.findIndex((source) => source.quality === value);
      if (index >= 0) {
        const video = videoRef.current;
        const resumeAt = video?.currentTime ?? 0;
        const wasPlaying = video ? !video.paused : false;
        setSourceIndex(index);
        window.setTimeout(() => {
          const nextVideo = videoRef.current;
          if (!nextVideo) return;
          nextVideo.currentTime = resumeAt;
          if (wasPlaying) void nextVideo.play().catch(() => undefined);
        }, 120);
      }
    } else {
      setSourceIndex(0);
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    const video = videoRef.current;
    if (video) {
      video.load();
    }
    if (orderedSources.length > 1) {
      setSourceIndex((index) => (index + 1) % orderedSources.length);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const introPercent =
    intro && duration > 0 ? clamp((intro.end / duration) * 100, 0, 100) : null;
  const outroPercent = outroStart && duration > 0 ? clamp((outroStart / duration) * 100, 0, 100) : null;

  if (!activeSource) {
    return (
      <div
        className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0e] ${className}`}
        role="alert"
      >
        <div className="space-y-2 px-6 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-400" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Sumber video tidak tersedia.</p>
          <p className="text-xs text-white/50">
            Sumber yang rusak otomatis disembunyikan. Coba lagi nanti atau pilih episode lain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`anp-root group relative w-full overflow-hidden bg-black ${theater ? "rounded-none" : "rounded-xl"} ${className}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => {
        if (!videoRef.current?.paused) setControlsVisible(false);
      }}
      onTouchStart={showControlsTemporarily}
      data-testid="video-player"
    >
      <style>{`
        .anp-root:fullscreen { border-radius: 0; }
        .anp-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 9999px; background: rgba(255,255,255,.22); outline: none; }
        .anp-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 13px; height: 13px; border-radius: 50%; background: #ff3b5c; border: 2px solid #fff; cursor: pointer; }
        .anp-range::-moz-range-thumb { width: 13px; height: 13px; border: 2px solid #fff; border-radius: 50%; background: #ff3b5c; cursor: pointer; }
        .anp-range:focus-visible { box-shadow: 0 0 0 2px #ff3b5c; }
        @media (prefers-reduced-motion: reduce) {
          .anp-root * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>

      <div className="relative aspect-video w-full">
        {isEmbed && activeSource ? (
          <>
            <iframe
              key={activeSource.id || activeSource.url}
              src={activeSource.url}
              title={`Pemutar video ${animeTitle} episode ${episodeNumber}`}
              className="h-full w-full bg-black border-0"
              allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; accelerometer *; gyroscope *"
              allowFullScreen
              // @ts-expect-error legacy browser fullscreen attributes
              webkitallowfullscreen="true"
              mozallowfullscreen="true"
              referrerPolicy="no-referrer"
            />
            <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/80 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md transition-all hover:bg-black hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
                aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
                title={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
              >
                {fullscreen ? (
                  <>
                    <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Keluar</span>
                  </>
                ) : (
                  <>
                    <Maximize className="h-3.5 w-3.5 text-[#ff3b5c]" aria-hidden="true" />
                    <span className="hidden sm:inline">Layar Penuh</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full bg-black object-contain"
            poster={poster ?? undefined}
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            aria-label={`Pemutar video ${animeTitle} episode ${episodeNumber}`}
            onClick={togglePlay}
            onPlay={() => {
              setPlaying(true);
              setEnded(false);
              showControlsTemporarily();
            }}
            onPause={() => {
              setPlaying(false);
              setControlsVisible(true);
              reportProgress(true);
            }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration || 0);
              setLoading(false);
            }}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              setCurrentTime(video.currentTime);
              if (video.buffered.length) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
              }
              if (intro && !introSkipped.current) {
                setShowIntroButton(video.currentTime >= intro.start && video.currentTime < intro.end - 1);
              }
              if (outroStart) {
                setShowOutroButton(video.currentTime >= outroStart);
              }
              reportProgress();
            }}
            onVolumeChange={(event) => {
              setVolume(event.currentTarget.volume);
              setMuted(event.currentTarget.muted);
            }}
            onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              setControlsVisible(true);
              reportProgress(true);
              onEnded?.();
              if (autoNext && nextEpisode) onNextEpisode?.();
            }}
            onError={() => {
              if (hlsRef.current) return;
              setError("Sumber video tidak tersedia.");
              setLoading(false);
            }}
          >
            {/* Subtitle cues are fetched and rendered as a custom overlay so the
                user can control size, position and opacity. Native <track>
                elements are intentionally omitted to avoid double rendering. */}
          </video>
        )}

        {!isEmbed && (
          <>
            {loading && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                <Loader2 className="h-10 w-10 animate-spin text-white/80" aria-hidden="true" />
                <span className="sr-only">Memuat video</span>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
                <TriangleAlert className="h-10 w-10 text-amber-400" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">Sumber video tidak tersedia.</p>
                  <p className="text-sm text-white/55">
                    Coba sumber lain. Detail teknis hanya dicatat di server.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md bg-[#ff3b5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e63350] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Coba sumber lain
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Muat ulang
                  </button>
                </div>
              </div>
            )}

            {visibleCues.length > 0 && !error && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4"
                style={{ bottom: `${subtitleStyle.bottom}%` }}
                aria-live="off"
              >
                <div
                  className="max-w-[92%] whitespace-pre-line rounded px-2 py-1 text-center font-medium leading-snug text-white"
                  style={{
                    fontSize: `${subtitleStyle.fontSize}px`,
                    backgroundColor: `rgba(0,0,0,${subtitleStyle.backgroundOpacity})`,
                    opacity: subtitleStyle.textOpacity,
                    textShadow: "0 1px 2px rgba(0,0,0,.85)",
                  }}
                >
                  {visibleCues.map((cue) => cue.text).join("\n")}
                </div>
              </div>
            )}

            {showIntroButton && intro && (
              <button
                type="button"
                onClick={skipIntro}
                className="absolute bottom-24 right-4 z-20 rounded-md border border-white/25 bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
              >
                Lewati intro
              </button>
            )}

            {showOutroButton && (nextEpisode || outroStart) && !ended && (
              <button
                type="button"
                onClick={skipOutro}
                className="absolute bottom-24 right-4 z-20 rounded-md border border-white/25 bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
              >
                {autoNext && nextEpisode ? "Episode berikutnya" : "Lewati outro"}
              </button>
            )}

            {ended && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
                <p className="text-sm text-white/60">Episode {episodeNumber} selesai</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const video = videoRef.current;
                      if (!video) return;
                      video.currentTime = 0;
                      void video.play().catch(() => undefined);
                    }}
                    className="flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Putar ulang
                  </button>
                  {nextEpisode && (
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex items-center gap-2 rounded-md bg-[#ff3b5c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e63350] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Episode {nextEpisode.number}
                      <SkipForward className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!playing && !loading && !error && !ended && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35 focus-visible:outline-none"
                aria-label="Putar video"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff3b5c]/95 shadow-xl">
                  <Play className="ml-1 h-7 w-7 fill-white text-white" aria-hidden="true" />
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {!isEmbed && (
        <div
          className={`absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 pb-10 pt-3 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-1 flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Kembali
                </button>
              )}
              <p className="truncate text-sm font-semibold text-white sm:text-base">{animeTitle}</p>
              <p className="truncate text-xs text-white/60">
                Episode {episodeNumber}
                {episodeTitle ? ` · ${episodeTitle}` : ""}
              </p>
            </div>
            {animeHref && (
              <a
                href={animeHref}
                className="hidden shrink-0 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] sm:block"
              >
                Detail anime
              </a>
            )}
          </div>
        </div>
      )}

      {!isEmbed && (
        <>
          <div
            className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-10 transition-opacity duration-200 sm:px-3 ${
              controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
        <div
          className="group/seek relative mx-1 mb-1 flex h-4 cursor-pointer items-center"
          role="slider"
          tabIndex={0}
          aria-label="Posisi video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatPlayerTime(currentTime)} dari ${formatPlayerTime(duration)}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              seekBy(-5);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              seekBy(5);
            } else if (event.key === "Home") {
              event.preventDefault();
              seekBy(-duration);
            } else if (event.key === "End") {
              event.preventDefault();
              seekBy(duration);
            }
          }}
          onClick={(event) => {
            const video = videoRef.current;
            if (!video || !duration) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            video.currentTime = ratio * duration;
          }}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            setSeekPreview({ time: ratio * duration, x: ratio * 100 });
          }}
          onMouseLeave={() => setSeekPreview(null)}
        >
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white/35" style={{ width: `${bufferedPercent}%` }} />
          </div>
          <div
            className="absolute inset-x-0 h-1 rounded-full bg-[#ff3b5c]"
            style={{ width: `${progressPercent}%` }}
          />
          {introPercent !== null && (
            <span
              className="absolute top-0 h-1 w-0.5 bg-amber-300/80"
              style={{ left: `${introPercent}%` }}
              aria-hidden="true"
            />
          )}
          {outroPercent !== null && (
            <span
              className="absolute top-0 h-1 w-0.5 bg-sky-300/80"
              style={{ left: `${outroPercent}%` }}
              aria-hidden="true"
            />
          )}
          <span
            className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[#ff3b5c] opacity-0 transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${progressPercent}%` }}
            aria-hidden="true"
          />
          {seekPreview && Number.isFinite(seekPreview.time) && (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ left: `${seekPreview.x}%` }}
            >
              {formatPlayerTime(seekPreview.time)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
            aria-label={playing ? "Jeda" : "Putar"}
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={goPrevious}
            disabled={!previousEpisode}
            className="hidden rounded-md p-2 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] sm:block"
            aria-label="Episode sebelumnya"
            title="Episode sebelumnya (P)"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={!nextEpisode}
            className="hidden rounded-md p-2 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] sm:block"
            aria-label="Episode berikutnya"
            title="Episode berikutnya (N)"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="group/volume flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
              aria-label={muted ? "Nyalakan suara" : "Bisukan"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" aria-hidden="true" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                setMuted(next === 0);
              }}
              aria-label="Volume"
              className="anp-range hidden w-0 transition-all duration-200 group-hover/volume:w-20 sm:block"
            />
          </div>

          <span className="ml-1 shrink-0 font-mono text-[11px] tabular-nums text-white/85 sm:text-xs">
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {nextEpisode && (
              <button
                type="button"
                onClick={goNext}
                className="rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] sm:hidden"
                aria-label="Episode berikutnya"
              >
                <SkipForward className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex items-center gap-1 rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
              aria-label="Kualitas, kecepatan, dan subtitle"
              aria-expanded={settingsOpen}
            >
              {activeSubtitle ? (
                <Captions className="h-5 w-5 text-[#ff3b5c]" aria-hidden="true" />
              ) : (
                <Settings className="h-5 w-5" aria-hidden="true" />
              )}
              {selectedQuality > 0 && (
                <span className="hidden text-[10px] font-semibold sm:inline">{selectedQuality}p</span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleTheater}
              className="hidden rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] lg:block"
              aria-label={theater ? "Keluar dari mode teater" : "Mode teater"}
              aria-pressed={theater}
              title="Mode teater (T)"
            >
              {theater ? (
                <Minimize className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Maximize className="h-5 w-5 rotate-45" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={togglePip}
              className="hidden rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] sm:block"
              aria-label="Picture in picture"
              aria-pressed={pipActive}
              title="Picture in picture (I)"
            >
              <PictureInPicture2 className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
              aria-label={fullscreen ? "Keluar dari layar penuh" : "Layar penuh"}
              aria-pressed={fullscreen}
              title="Layar penuh (F)"
            >
              {fullscreen ? (
                <Minimize className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Maximize className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <SettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        qualityOptions={qualityOptions.map(({ value, label }) => ({ value, label }))}
        selectedQuality={selectedQuality}
        onQualityChange={handleQualityChange}
        playbackRate={playbackRate}
        onPlaybackRateChange={(rate) => {
          setPlaybackRate(rate);
          if (videoRef.current) videoRef.current.playbackRate = rate;
        }}
        subtitles={subtitles}
        subtitleId={subtitleId}
        onSubtitleChange={setSubtitleId}
        subtitleStyle={subtitleStyle}
        onSubtitleStyleChange={setSubtitleStyle}
        autoNext={autoNext}
        onAutoNextChange={setAutoNext}
        subtitleError={subtitleError}
      />
    </>
  )}

      <p className="sr-only" aria-live="polite" id={`${playerId}-status`}>
        {playing ? "Memutar" : "Dijeda"} pada {formatPlayerTime(currentTime)} dari{" "}
        {formatPlayerTime(duration)}
      </p>
    </div>
  );
}
