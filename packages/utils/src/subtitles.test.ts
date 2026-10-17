import { describe, expect, it } from "vitest";
import {
  UnsupportedSubtitleFormatError,
  findActiveCues,
  parseSubtitles,
  parseTimestamp,
  toWebVtt,
} from "./subtitles";

const VTT = `WEBVTT

NOTE this is a comment

00:00:01.000 --> 00:00:03.500
Halo, dunia!

00:00:04.000 --> 00:00:06.000
Baris pertama
Baris kedua
`;

const SRT = `1
00:00:01,000 --> 00:00:03,500
Halo, dunia!

2
00:00:04,000 --> 00:00:06,000
<i>Miring</i> dan &amp; ampersand
`;

describe("parseTimestamp", () => {
  it("parses VTT and SRT timestamps", () => {
    expect(parseTimestamp("00:00:01.500")).toBe(1.5);
    expect(parseTimestamp("01:02:03,250")).toBe(3723.25);
    expect(parseTimestamp("00:99:00.000")).toBeNull();
    expect(parseTimestamp("nope")).toBeNull();
  });
});

describe("parseSubtitles", () => {
  it("parses WebVTT cues and skips metadata blocks", () => {
    const cues = parseSubtitles(VTT, "VTT");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: "Halo, dunia!" });
    expect(cues[1]?.text).toContain("Baris kedua");
  });

  it("parses SRT, strips tags and decodes entities", () => {
    const cues = parseSubtitles(SRT, "SRT");
    expect(cues).toHaveLength(2);
    expect(cues[1]?.text).toBe("Miring dan & ampersand");
  });

  it("rejects ASS because it needs a full layout engine", () => {
    expect(() => parseSubtitles("[Script Info]", "ASS")).toThrow(UnsupportedSubtitleFormatError);
  });

  it("ignores malformed blocks instead of throwing", () => {
    const cues = parseSubtitles("WEBVTT\n\nnot a cue\n\n00:00:05.000 --> 00:00:04.000\nbad\n", "VTT");
    expect(cues).toHaveLength(0);
  });
});

describe("findActiveCues", () => {
  it("returns cues overlapping the given time", () => {
    const cues = parseSubtitles(VTT, "VTT");
    expect(findActiveCues(cues, 2)).toHaveLength(1);
    expect(findActiveCues(cues, 10)).toHaveLength(0);
  });
});

describe("toWebVtt", () => {
  it("round-trips cues into a valid VTT document", () => {
    const cues = parseSubtitles(SRT, "SRT");
    const output = toWebVtt(cues);
    expect(output.startsWith("WEBVTT")).toBe(true);
    expect(parseSubtitles(output, "VTT")).toHaveLength(2);
  });
});
