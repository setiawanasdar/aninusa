import type { HlsQualityLevel, SubtitleStyle } from "./types";

export type PlayerAction =
  | "toggle-play"
  | "seek-backward"
  | "seek-forward"
  | "volume-up"
  | "volume-down"
  | "mute"
  | "fullscreen"
  | "next"
  | "previous"
  | "theater"
  | "pip"
  | "captions";

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 20,
  bottom: 10,
  backgroundOpacity: 0.65,
  textOpacity: 1,
};

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function formatPlayerTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return "0:00";
  }
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function qualityLabel(height: number, bitrate?: number): string {
  if (height > 0) return `${height}p`;
  if (bitrate && bitrate > 0) return `${Math.round(bitrate / 1000)} kbps`;
  return "Auto";
}

export function pickAutoQuality(qualities: number[], downlinkMbps?: number): number {
  const available = Array.from(new Set(qualities.filter((quality) => quality > 0))).sort((a, b) => b - a);
  if (!available.length) return 0;

  const target =
    !downlinkMbps || !Number.isFinite(downlinkMbps)
      ? 720
      : downlinkMbps < 1.5
        ? 360
        : downlinkMbps < 3
          ? 480
          : downlinkMbps < 7
            ? 720
            : 1080;

  const suitable = available.find((quality) => quality <= target);
  return suitable ?? available[available.length - 1] ?? 0;
}

export function hlsLevelsToOptions(levels: HlsQualityLevel[]): Array<{ value: number; label: string }> {
  const seen = new Set<number>();
  const options: Array<{ value: number; label: string }> = [];
  for (const level of levels) {
    if (level.height > 0 && !seen.has(level.height)) {
      seen.add(level.height);
      options.push({ value: level.height, label: `${level.height}p` });
    }
  }
  return options.sort((a, b) => b.value - a.value);
}

export function actionForKey(
  key: string,
  options: { hasNext: boolean; hasPrevious: boolean },
): PlayerAction | null {
  switch (key) {
    case " ":
    case "k":
    case "K":
      return "toggle-play";
    case "ArrowLeft":
      return "seek-backward";
    case "ArrowRight":
      return "seek-forward";
    case "ArrowUp":
      return "volume-up";
    case "ArrowDown":
      return "volume-down";
    case "m":
    case "M":
      return "mute";
    case "f":
    case "F":
      return "fullscreen";
    case "n":
    case "N":
      return options.hasNext ? "next" : null;
    case "p":
    case "P":
      return options.hasPrevious ? "previous" : null;
    case "t":
    case "T":
      return "theater";
    case "i":
    case "I":
      return "pip";
    case "c":
    case "C":
      return "captions";
    default:
      return null;
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function subtitleStyleToCss(style: SubtitleStyle): React.CSSProperties {
  return {
    fontSize: `${style.fontSize}px`,
    bottom: `${style.bottom}%`,
    opacity: style.textOpacity,
  };
}

export function sanitizeSubtitleStyle(value: unknown): SubtitleStyle {
  if (!value || typeof value !== "object") return { ...DEFAULT_SUBTITLE_STYLE };
  const candidate = value as Partial<SubtitleStyle>;
  return {
    fontSize: clamp(Number(candidate.fontSize) || DEFAULT_SUBTITLE_STYLE.fontSize, 12, 40),
    bottom: clamp(Number(candidate.bottom) || DEFAULT_SUBTITLE_STYLE.bottom, 4, 40),
    backgroundOpacity: clamp(
      Number.isFinite(Number(candidate.backgroundOpacity))
        ? Number(candidate.backgroundOpacity)
        : DEFAULT_SUBTITLE_STYLE.backgroundOpacity,
      0,
      1,
    ),
    textOpacity: clamp(
      Number.isFinite(Number(candidate.textOpacity))
        ? Number(candidate.textOpacity)
        : DEFAULT_SUBTITLE_STYLE.textOpacity,
      0.3,
      1,
    ),
  };
}
