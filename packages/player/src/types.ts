export type PlayerSourceFormat = "HLS" | "DASH" | "MP4" | "WEBM";

export interface PlayerSource {
  id: string;
  url: string;
  quality: number;
  format: PlayerSourceFormat;
  codec?: string | null;
  language?: string;
  label?: string;
}

export interface PlayerSubtitle {
  id: string;
  language: string;
  label: string;
  format: "VTT" | "SRT" | "ASS";
  url: string;
  isDefault?: boolean;
}

export interface PlayerEpisodeLink {
  id: string;
  number: number;
  title?: string | null;
}

export interface PlayerProgress {
  currentTime: number;
  duration: number;
  completed: boolean;
}

export interface SubtitleStyle {
  fontSize: number;
  bottom: number;
  backgroundOpacity: number;
  textOpacity: number;
}

export interface VideoPlayerProps {
  sources: PlayerSource[];
  subtitles?: PlayerSubtitle[];
  poster?: string | null;
  animeTitle: string;
  animeHref?: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  startAt?: number;
  autoPlay?: boolean;
  autoNextDefault?: boolean;
  nextEpisode?: PlayerEpisodeLink | null;
  previousEpisode?: PlayerEpisodeLink | null;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  onBack?: () => void;
  intro?: { start: number; end: number } | null;
  outroStart?: number | null;
  theater?: boolean;
  onTheaterChange?: (enabled: boolean) => void;
  onProgress?: (progress: PlayerProgress) => void;
  onEnded?: () => void;
  className?: string;
}

export interface HlsQualityLevel {
  index: number;
  height: number;
  bitrate: number;
  name: string;
}
