import type { Season } from "@aninusa/types";
import { titleSimilarity } from "./title";

export type MatchDecision = "AUTO" | "PROBABLE" | "REVIEW";

export interface MatchableAnime {
  id?: string;
  title: string;
  englishTitle?: string | null;
  japaneseTitle?: string | null;
  alternativeTitles?: string[];
  year?: number | null;
  season?: Season | null;
  totalEpisodes?: number | null;
  malId?: number | null;
  anilistId?: number | null;
}

export interface AnimeMatchResult {
  animeId?: string;
  confidence: number;
  decision: MatchDecision;
  reasons: string[];
  matchedTitle: string;
}

function allTitles(anime: MatchableAnime): string[] {
  return Array.from(
    new Set(
      [anime.title, anime.englishTitle, anime.japaneseTitle, ...(anime.alternativeTitles ?? [])]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  );
}

export function decisionForConfidence(confidence: number): MatchDecision {
  if (confidence >= 0.95) return "AUTO";
  if (confidence >= 0.8) return "PROBABLE";
  return "REVIEW";
}

/**
 * Scores how likely a provider record and an internal Anime are the same work.
 * External IDs (MAL/AniList) are authoritative when both sides have them.
 * The threshold semantics are documented in docs/ARCHITECTURE.md.
 */
export function scoreAnimeMatch(
  candidate: MatchableAnime,
  existing: MatchableAnime,
): AnimeMatchResult {
  const reasons: string[] = [];

  if (candidate.malId && existing.malId && candidate.malId === existing.malId) {
    return {
      animeId: existing.id,
      confidence: 0.99,
      decision: "AUTO",
      reasons: ["MAL ID matches"],
      matchedTitle: existing.title,
    };
  }

  if (candidate.anilistId && existing.anilistId && candidate.anilistId === existing.anilistId) {
    return {
      animeId: existing.id,
      confidence: 0.99,
      decision: "AUTO",
      reasons: ["AniList ID matches"],
      matchedTitle: existing.title,
    };
  }

  let best = { similarity: 0, candidateTitle: candidate.title, existingTitle: existing.title };
  for (const candidateTitle of allTitles(candidate)) {
    for (const existingTitle of allTitles(existing)) {
      const similarity = titleSimilarity(candidateTitle, existingTitle);
      if (similarity > best.similarity) {
        best = { similarity, candidateTitle, existingTitle };
      }
    }
  }

  let confidence =
    best.similarity >= 0.999 ? 0.96 : Math.min(0.95, 0.52 + 0.44 * best.similarity);

  if (best.similarity >= 0.999) {
    reasons.push(`Title matches exactly: "${best.existingTitle}"`);
  } else if (best.similarity >= 0.8) {
    reasons.push(`Strong fuzzy title match (${best.similarity.toFixed(2)})`);
  } else {
    reasons.push(`Weak title similarity (${best.similarity.toFixed(2)})`);
  }

  if (candidate.year && existing.year) {
    const difference = Math.abs(candidate.year - existing.year);
    if (difference === 0) {
      confidence += 0.02;
      reasons.push("Release year matches");
    } else if (difference === 1) {
      confidence -= 0.05;
      reasons.push("Release year differs by one");
    } else {
      confidence -= 0.2;
      reasons.push(`Release year differs by ${difference}`);
    }
  }

  if (candidate.totalEpisodes && existing.totalEpisodes) {
    const difference = Math.abs(candidate.totalEpisodes - existing.totalEpisodes);
    if (difference === 0) {
      confidence += 0.02;
      reasons.push("Episode count matches");
    } else if (difference > 2) {
      confidence -= 0.06;
      reasons.push("Episode count differs");
    }
  }

  if (candidate.season && existing.season) {
    if (candidate.season === existing.season) {
      confidence += 0.01;
      reasons.push("Season matches");
    } else {
      confidence -= 0.02;
    }
  }

  confidence = Math.max(0, Math.min(0.99, confidence));

  return {
    animeId: existing.id,
    confidence: Number(confidence.toFixed(4)),
    decision: decisionForConfidence(confidence),
    reasons,
    matchedTitle: best.existingTitle,
  };
}

export function findBestAnimeMatch(
  candidate: MatchableAnime,
  existing: MatchableAnime[],
): AnimeMatchResult | null {
  if (!existing.length) return null;

  let best: AnimeMatchResult | null = null;
  for (const anime of existing) {
    const result = scoreAnimeMatch(candidate, anime);
    if (!best || result.confidence > best.confidence) best = result;
  }

  return best;
}
