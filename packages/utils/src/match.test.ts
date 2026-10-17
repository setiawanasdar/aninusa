import { describe, expect, it } from "vitest";
import { findBestAnimeMatch, scoreAnimeMatch } from "./match";
import { AnimeMatcher } from "./matcher-service";
import { normalizeTitle, titleSimilarity } from "./title";

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation while preserving Japanese", () => {
    expect(normalizeTitle("ONE PIECE!!")).toBe("one piece");
    expect(normalizeTitle("  Shingeki   no Kyojin ")).toBe("shingeki no kyojin");
    expect(normalizeTitle("ワンピース")).toBe("ワンピース");
  });
});

describe("titleSimilarity", () => {
  it("scores exact normalized titles as identical", () => {
    expect(titleSimilarity("One Piece", "ONE PIECE")).toBe(1);
  });

  it("scores substring titles highly", () => {
    expect(titleSimilarity("Naruto", "Naruto Shippuden")).toBeGreaterThanOrEqual(0.9);
  });

  it("scores unrelated titles low", () => {
    expect(titleSimilarity("Bleach", "Haikyuu")).toBeLessThan(0.8);
  });
});

describe("scoreAnimeMatch", () => {
  const base = {
    title: "One Piece",
    englishTitle: "One Piece",
    japaneseTitle: "ワンピース",
    year: 1999,
    totalEpisodes: 1000,
  };

  it("auto-matches on MAL ID regardless of title", () => {
    const result = scoreAnimeMatch(
      { title: "Different Title", malId: 21 },
      { title: "One Piece", malId: 21 },
    );
    expect(result.decision).toBe("AUTO");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("auto-matches identical titles and metadata", () => {
    const result = scoreAnimeMatch(base, { ...base });
    expect(result.decision).toBe("AUTO");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("does not auto-match a probable fuzzy match", () => {
    const result = scoreAnimeMatch(
      { title: "One Piece Film Red", year: 2022, totalEpisodes: 1 },
      { title: "One Piece", year: 1999, totalEpisodes: 1000 },
    );
    expect(result.decision).not.toBe("AUTO");
    expect(result.confidence).toBeLessThan(0.95);
  });

  it("penalizes a large year gap", () => {
    const result = scoreAnimeMatch(
      { title: "Fullmetal Alchemist", year: 2017, totalEpisodes: 12 },
      { title: "Fullmetal Alchemist", year: 2003, totalEpisodes: 51 },
    );
    expect(result.confidence).toBeLessThan(0.95);
    expect(result.reasons.some((reason) => reason.includes("year"))).toBe(true);
  });
});

describe("AnimeMatcher service", () => {
  it("classifies confidence into decision bands", () => {
    const matcher = new AnimeMatcher();
    expect(matcher.classify(0.99)).toBe("AUTO");
    expect(matcher.classify(0.95)).toBe("AUTO");
    expect(matcher.classify(0.85)).toBe("PROBABLE");
    expect(matcher.classify(0.5)).toBe("REVIEW");
  });

  it("only auto-merges results above the threshold", () => {
    const matcher = new AnimeMatcher();
    expect(
      matcher.shouldAutoMerge({
        animeId: "a",
        confidence: 0.96,
        decision: "AUTO",
        reasons: [],
        matchedTitle: "x",
      }),
    ).toBe(true);
    expect(
      matcher.shouldAutoMerge({
        animeId: "a",
        confidence: 0.85,
        decision: "PROBABLE",
        reasons: [],
        matchedTitle: "x",
      }),
    ).toBe(false);
    expect(matcher.shouldAutoMerge(null)).toBe(false);
  });

  it("honours custom thresholds", () => {
    const matcher = new AnimeMatcher({ autoThreshold: 0.9, probableThreshold: 0.7 });
    expect(matcher.classify(0.9)).toBe("AUTO");
    expect(matcher.classify(0.75)).toBe("PROBABLE");
  });
});

describe("findBestAnimeMatch", () => {
  it("returns the highest confidence candidate", () => {
    const result = findBestAnimeMatch(
      { title: "Attack on Titan", year: 2013, totalEpisodes: 25 },
      [
        { id: "a", title: "Attack on Titan", year: 2013, totalEpisodes: 25 },
        { id: "b", title: "Attack on Titan Junior High", year: 2015, totalEpisodes: 12 },
      ],
    );

    expect(result?.animeId).toBe("a");
    expect(result?.decision).toBe("AUTO");
  });

  it("returns null for an empty candidate list", () => {
    expect(findBestAnimeMatch({ title: "Bleach" }, [])).toBeNull();
  });
});
