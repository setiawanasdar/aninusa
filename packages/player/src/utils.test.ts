import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUBTITLE_STYLE,
  actionForKey,
  formatPlayerTime,
  hlsLevelsToOptions,
  isTypingTarget,
  pickAutoQuality,
  qualityLabel,
  sanitizeSubtitleStyle,
} from "./utils";

describe("formatPlayerTime", () => {
  it("formats seconds with and without hours", () => {
    expect(formatPlayerTime(5)).toBe("0:05");
    expect(formatPlayerTime(65)).toBe("1:05");
    expect(formatPlayerTime(3661)).toBe("1:01:01");
    expect(formatPlayerTime(Number.NaN)).toBe("0:00");
  });
});

describe("pickAutoQuality", () => {
  const available = [1080, 720, 480, 360];

  it("never selects a quality above the bandwidth target", () => {
    expect(pickAutoQuality(available, 1)).toBe(360);
    expect(pickAutoQuality(available, 2)).toBe(480);
    expect(pickAutoQuality(available, 5)).toBe(720);
    expect(pickAutoQuality(available, 20)).toBe(1080);
  });

  it("falls back to the lowest available quality", () => {
    expect(pickAutoQuality([240], 20)).toBe(240);
    expect(pickAutoQuality([], 10)).toBe(0);
  });

  it("ignores the adaptive (0) pseudo-quality", () => {
    expect(pickAutoQuality([0, 720], 10)).toBe(720);
  });
});

describe("qualityLabel", () => {
  it("labels resolutions and bitrate fallbacks", () => {
    expect(qualityLabel(1080)).toBe("1080p");
    expect(qualityLabel(0, 2_500_000)).toBe("2500 kbps");
    expect(qualityLabel(0)).toBe("Auto");
  });
});

describe("hlsLevelsToOptions", () => {
  it("deduplicates heights and sorts descending", () => {
    const options = hlsLevelsToOptions([
      { index: 0, height: 720, bitrate: 1, name: "a" },
      { index: 1, height: 1080, bitrate: 2, name: "b" },
      { index: 2, height: 720, bitrate: 3, name: "c" },
      { index: 3, height: 0, bitrate: 4, name: "audio" },
    ]);
    expect(options.map((option) => option.value)).toEqual([1080, 720]);
  });
});

describe("actionForKey", () => {
  const options = { hasNext: true, hasPrevious: false };

  it("maps documented shortcuts", () => {
    expect(actionForKey(" ", options)).toBe("toggle-play");
    expect(actionForKey("ArrowLeft", options)).toBe("seek-backward");
    expect(actionForKey("ArrowRight", options)).toBe("seek-forward");
    expect(actionForKey("ArrowUp", options)).toBe("volume-up");
    expect(actionForKey("ArrowDown", options)).toBe("volume-down");
    expect(actionForKey("f", options)).toBe("fullscreen");
    expect(actionForKey("M", options)).toBe("mute");
    expect(actionForKey("n", options)).toBe("next");
    expect(actionForKey("t", options)).toBe("theater");
  });

  it("disables next/previous when unavailable", () => {
    expect(actionForKey("n", { hasNext: false, hasPrevious: false })).toBeNull();
    expect(actionForKey("p", { hasNext: true, hasPrevious: false })).toBeNull();
  });

  it("ignores unrelated keys", () => {
    expect(actionForKey("q", options)).toBeNull();
  });
});

describe("sanitizeSubtitleStyle", () => {
  it("clamps out-of-range values", () => {
    const style = sanitizeSubtitleStyle({ fontSize: 999, bottom: -20, backgroundOpacity: 5, textOpacity: 0 });
    expect(style.fontSize).toBe(40);
    expect(style.bottom).toBe(4);
    expect(style.backgroundOpacity).toBe(1);
    expect(style.textOpacity).toBe(0.3);
  });

  it("falls back to defaults for invalid input", () => {
    expect(sanitizeSubtitleStyle(null)).toEqual(DEFAULT_SUBTITLE_STYLE);
  });
});

describe("isTypingTarget", () => {
  it("is false outside the DOM", () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});
