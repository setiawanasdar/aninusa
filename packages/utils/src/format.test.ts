import { describe, expect, it } from "vitest";
import {
  episodeSlug,
  formatDuration,
  formatEpisodeNumber,
  formatSeasonSlug,
  parseEpisodeSlug,
  parseSeasonSlug,
} from "./format";

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("0:00");
  });
});

describe("episode slugs", () => {
  it("builds and parses episode slugs", () => {
    expect(episodeSlug(1)).toBe("episode-1");
    expect(episodeSlug(12.5)).toBe("episode-12.5");
    expect(parseEpisodeSlug("episode-12")).toBe(12);
    expect(parseEpisodeSlug("episode-12.5")).toBe(12.5);
    expect(parseEpisodeSlug("episode-abc")).toBeNull();
    expect(parseEpisodeSlug("episode--1")).toBeNull();
  });

  it("formats episode numbers without trailing zeros", () => {
    expect(formatEpisodeNumber(12)).toBe("12");
    expect(formatEpisodeNumber(12.5)).toBe("12.5");
  });
});

describe("season slugs", () => {
  it("round-trips season slugs", () => {
    expect(formatSeasonSlug(2026, "FALL")).toBe("2026-fall");
    expect(parseSeasonSlug("2026-fall")).toEqual({ year: 2026, season: "FALL" });
    expect(parseSeasonSlug("2026-autumn")).toBeNull();
    expect(parseSeasonSlug("1899-fall")).toBeNull();
  });
});
