import {
  decisionForConfidence,
  findBestAnimeMatch,
  scoreAnimeMatch,
  type AnimeMatchResult,
  type MatchDecision,
  type MatchableAnime,
} from "./match";

export interface AnimeMatcherOptions {
  /** Confidence at or above which records merge automatically. */
  autoThreshold?: number;
  /** Confidence at or above which a human should review the match. */
  probableThreshold?: number;
}

/**
 * Facade over the pure matching functions. Ingestion depends on this service
 * rather than on individual scoring details, so the strategy can be replaced
 * (for example with embeddings) without touching the database layer.
 */
export class AnimeMatcher {
  private readonly autoThreshold: number;
  private readonly probableThreshold: number;

  constructor(options: AnimeMatcherOptions = {}) {
    this.autoThreshold = options.autoThreshold ?? 0.95;
    this.probableThreshold = options.probableThreshold ?? 0.8;
  }

  score(candidate: MatchableAnime, existing: MatchableAnime): AnimeMatchResult {
    return scoreAnimeMatch(candidate, existing);
  }

  findBest(candidate: MatchableAnime, existing: MatchableAnime[]): AnimeMatchResult | null {
    return findBestAnimeMatch(candidate, existing);
  }

  classify(confidence: number): MatchDecision {
    if (confidence >= this.autoThreshold) return "AUTO";
    if (confidence >= this.probableThreshold) return "PROBABLE";
    return decisionForConfidence(confidence);
  }

  shouldAutoMerge(result: AnimeMatchResult | null): boolean {
    return Boolean(result && result.confidence >= this.autoThreshold);
  }
}
