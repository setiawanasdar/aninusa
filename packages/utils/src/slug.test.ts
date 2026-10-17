import { describe, expect, it } from "vitest";
import { isValidSlug, makeUniqueSlug, slugify } from "./slug";

describe("slugify", () => {
  it("normalizes accents, punctuation and spacing", () => {
    expect(slugify("Shingeki no Kyojin: The Final Season")).toBe(
      "shingeki-no-kyojin-the-final-season",
    );
    expect(slugify("  Café  Déjà Vu!! ")).toBe("cafe-deja-vu");
    expect(slugify("Fate/stay night & Zero")).toBe("fate-stay-night-and-zero");
  });

  it("falls back when a title has no latin characters", () => {
    expect(slugify("ワンピース")).toBe("anime");
  });

  it("truncates long titles without trailing separators", () => {
    const slug = slugify("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(90);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("makeUniqueSlug", () => {
  it("appends a numeric suffix when the slug is taken", () => {
    const taken = new Set(["one-piece", "one-piece-2"]);
    expect(makeUniqueSlug("One Piece", taken)).toBe("one-piece-3");
  });

  it("returns the base slug when available", () => {
    expect(makeUniqueSlug("Naruto", new Set())).toBe("naruto");
  });
});

describe("isValidSlug", () => {
  it("accepts kebab-case and rejects unsafe values", () => {
    expect(isValidSlug("one-piece")).toBe(true);
    expect(isValidSlug("One Piece")).toBe(false);
    expect(isValidSlug("../etc/passwd")).toBe(false);
    expect(isValidSlug("double--dash")).toBe(false);
  });
});
