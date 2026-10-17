import type { SubtitleFormat } from "@aninusa/types";

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export class UnsupportedSubtitleFormatError extends Error {
  constructor(format: string) {
    super(`Subtitle format ${format} cannot be rendered directly in the browser`);
    this.name = "UnsupportedSubtitleFormatError";
  }
}

const TIMESTAMP_PATTERN = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

export function parseTimestamp(raw: string): number | null {
  const match = TIMESTAMP_PATTERN.exec(raw.trim());
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number((match[4] ?? "0").padEnd(3, "0").slice(0, 3));

  if (minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanCueText(lines: string[]): string {
  return decodeEntities(
    lines
      .join("\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\{\\[^}]+\}/g, "")
      .replace(/\r/g, "")
      .trim(),
  );
}

/**
 * Parses WebVTT or SubRip into a normalized cue list. ASS/SSA is intentionally
 * rejected: it requires a full layout engine, so providers should convert it to
 * VTT server-side. This keeps the player small and predictable.
 */
export function parseSubtitles(content: string, format: SubtitleFormat | string): SubtitleCue[] {
  const normalizedFormat = format.toUpperCase();
  if (normalizedFormat === "ASS" || normalizedFormat === "SSA") {
    throw new UnsupportedSubtitleFormatError(format);
  }
  if (normalizedFormat !== "VTT" && normalizedFormat !== "SRT") {
    throw new UnsupportedSubtitleFormatError(format);
  }

  const source = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = source.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    if (!lines.length) continue;

    const first = lines[0]?.trim() ?? "";
    if (/^WEBVTT/i.test(first) || /^NOTE\b/i.test(first) || /^STYLE\b/i.test(first) || /^REGION\b/i.test(first)) {
      continue;
    }

    const arrowIndex = lines.findIndex((line) => line.includes("-->"));
    if (arrowIndex === -1) continue;

    const timing = lines[arrowIndex] ?? "";
    const [startRaw, endRaw] = timing.split("-->");
    if (!startRaw || !endRaw) continue;

    const start = parseTimestamp(startRaw.trim().split(/\s+/)[0] ?? "");
    const end = parseTimestamp(endRaw.trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null || end <= start) continue;

    const text = cleanCueText(lines.slice(arrowIndex + 1));
    if (!text) continue;

    cues.push({
      id: `cue-${cues.length}-${Math.round(start * 1000)}`,
      start,
      end,
      text,
    });
  }

  return cues.sort((a, b) => a.start - b.start);
}

export function findActiveCues(cues: SubtitleCue[], time: number): SubtitleCue[] {
  return cues.filter((cue) => time >= cue.start && time < cue.end);
}

export function toWebVtt(cues: SubtitleCue[]): string {
  const timestamp = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);
    const ms = Math.round((safe - Math.floor(safe)) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };

  const body = cues
    .map(
      (cue) =>
        `${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text.replace(/-->/g, "→")}`,
    )
    .join("\n\n");

  return `WEBVTT\n\n${body}\n`;
}
