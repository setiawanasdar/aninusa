import type { NormalizedAnime, NormalizedSubtitle, NormalizedVideoSource, Season } from "@aninusa/types";
import {
  UnsupportedProviderError,
  type MetadataProvider,
  type VideoProvider,
} from "../types";

/**
 * Template for a provider that does NOT permit automated access.
 *
 * It is registered as disabled so operators can see the integration point, but
 * every operation fails closed. Never replace these throws with a scraper that
 * evades CAPTCHAs, login walls, robots restrictions, DRM or rate limits.
 */
export class RestrictedProviderExample implements MetadataProvider, VideoProvider {
  readonly key = "restricted-example";
  readonly name = "Restricted Provider (unsupported)";
  readonly capabilities = {
    metadata: false,
    video: false,
    subtitles: false,
    incremental: false,
    seasonal: false,
    automatedAccessPermitted: false,
    notes:
      "This provider's terms prohibit automated access. It is intentionally unsupported; no bypass is implemented.",
  };

  private fail(): never {
    throw new UnsupportedProviderError(
      "This provider does not permit automated access. Integrate it only through an official API or written authorization.",
    );
  }

  async search(_query: string, _options?: { limit?: number }): Promise<NormalizedAnime[]> {
    return this.fail();
  }

  async getAnime(_externalId: string): Promise<NormalizedAnime | null> {
    return this.fail();
  }

  async getSeasonalAnime(
    _year: number,
    _season: Season,
    _options?: { page?: number; perPage?: number },
  ): Promise<NormalizedAnime[]> {
    return this.fail();
  }

  async getVideoSources(
    _animeExternalId: string,
    _episodeNumber: number,
  ): Promise<NormalizedVideoSource[]> {
    return this.fail();
  }

  async getSubtitleTracks(
    _animeExternalId: string,
    _episodeNumber: number,
  ): Promise<NormalizedSubtitle[]> {
    return this.fail();
  }
}
