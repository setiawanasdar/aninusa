import type {
  NormalizedAnime,
  NormalizedSubtitle,
  NormalizedVideoSource,
  Season,
} from "@aninusa/types";
import { normalizeTitle } from "@aninusa/utils";
import type { MetadataProvider, VideoProvider } from "../types";

/**
 * Bundled demo catalog.
 *
 * Every title here is an independently produced open movie from the Blender
 * Foundation, licensed CC BY 3.0/4.0. The streams are the studios' public
 * showcase/test endpoints. They are intentionally not anime licensed from a
 * distributor: the adapter exists so the product is fully functional without
 * unauthorized content, and so authorized video providers can be added later.
 */
const CATALOG: NormalizedAnime[] = [
  {
    externalId: "big-buck-bunny",
    title: "Big Buck Bunny",
    englishTitle: "Big Buck Bunny",
    alternativeTitles: ["Big Buck Bunny (Open Movie)"],
    synopsis:
      "Sebuah film pendek animasi terbuka dari Blender Foundation. Big Buck Bunny yang berbadan besar menghadapi tiga hewan pengerat pengganggu, lalu menyiapkan balasan yang cerdik. Dilisensikan CC BY 3.0 dan tersedia untuk streaming secara sah.",
    poster: "/art/big-buck-bunny-poster.svg",
    banner: "/art/big-buck-bunny-banner.svg",
    type: "MOVIE",
    status: "COMPLETED",
    year: 2008,
    season: "SPRING",
    score: 8.1,
    popularity: 9800,
    duration: 10,
    totalEpisodes: 1,
    airedFrom: "2008-04-10",
    airedTo: "2008-04-10",
    genres: ["Comedy", "Adventure", "Family"],
    studios: ["Blender Animation Studio"],
    source: "open-media",
    episodes: [
      {
        number: 1,
        title: "Big Buck Bunny",
        description:
          "Film lengkap. Naskah dan karakter © Blender Foundation, lisensi Creative Commons Attribution 3.0.",
        duration: 596,
        thumbnail: "/art/big-buck-bunny-banner.svg",
        airDate: "2008-04-10",
        introStart: 0,
        introEnd: 12,
        outroStart: 560,
        sources: [
          {
            provider: "open-media",
            externalId: "bbb-hls",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            quality: 0,
            format: "HLS",
            codec: "h264/aac",
            language: "en",
          },
        ],
        subtitles: [
          {
            language: "id",
            label: "Bahasa Indonesia",
            url: "/subtitles/big-buck-bunny-id.vtt",
            format: "VTT",
            isDefault: true,
          },
          {
            language: "en",
            label: "English",
            url: "/subtitles/big-buck-bunny-en.vtt",
            format: "VTT",
          },
        ],
      },
    ],
  },
  {
    externalId: "sintel",
    title: "Sintel",
    englishTitle: "Sintel",
    alternativeTitles: ["Sintel (Open Movie)"],
    synopsis:
      "Sintel, seorang gadis muda, merawat seekor naga kecil yang terluka. Ketika naga itu diculik, ia memulai perjalanan panjang melintasi dunia yang keras. Film animasi terbuka Blender Foundation, dilisensikan CC BY 3.0.",
    poster: "/art/sintel-poster.svg",
    banner: "/art/sintel-banner.svg",
    type: "MOVIE",
    status: "COMPLETED",
    year: 2010,
    season: "FALL",
    score: 8.3,
    popularity: 9100,
    duration: 15,
    totalEpisodes: 1,
    airedFrom: "2010-09-27",
    airedTo: "2010-09-27",
    genres: ["Fantasy", "Adventure", "Drama"],
    studios: ["Blender Animation Studio"],
    source: "open-media",
    episodes: [
      {
        number: 1,
        title: "Sintel",
        description:
          "Film lengkap. Naskah dan karakter © Blender Foundation, lisensi Creative Commons Attribution 3.0.",
        duration: 888,
        thumbnail: "/art/sintel-banner.svg",
        airDate: "2010-09-27",
        introStart: 0,
        introEnd: 15,
        outroStart: 850,
        sources: [
          {
            provider: "open-media",
            externalId: "sintel-hls",
            url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
            quality: 0,
            format: "HLS",
            codec: "h264/aac",
            language: "en",
          },
        ],
        subtitles: [
          {
            language: "id",
            label: "Bahasa Indonesia",
            url: "/subtitles/sintel-id.vtt",
            format: "VTT",
            isDefault: true,
          },
          {
            language: "en",
            label: "English",
            url: "/subtitles/sintel-en.vtt",
            format: "VTT",
          },
        ],
      },
    ],
  },
  {
    externalId: "elephants-dream",
    title: "Elephants Dream",
    englishTitle: "Elephants Dream",
    alternativeTitles: ["Elephants Dream (Open Movie)"],
    synopsis:
      "Dua pria menjelajahi mesin raksasa yang terus berubah. Film animasi terbuka pertama Blender Foundation, penuh imajinasi surealis dan eksperimen visual. Dilisensikan CC BY 2.5.",
    poster: "/art/elephants-dream-poster.svg",
    banner: "/art/elephants-dream-banner.svg",
    type: "MOVIE",
    status: "COMPLETED",
    year: 2006,
    season: "SPRING",
    score: 7.6,
    popularity: 7300,
    duration: 11,
    totalEpisodes: 1,
    airedFrom: "2006-03-24",
    airedTo: "2006-03-24",
    genres: ["Sci-Fi", "Surreal", "Drama"],
    studios: ["Blender Animation Studio"],
    source: "open-media",
    episodes: [
      {
        number: 1,
        title: "Elephants Dream",
        description:
          "Film lengkap. Naskah dan karakter © Blender Foundation, lisensi Creative Commons Attribution 2.5.",
        duration: 653,
        thumbnail: "/art/elephants-dream-banner.svg",
        airDate: "2006-03-24",
        introStart: 0,
        introEnd: 10,
        outroStart: 620,
        sources: [
          {
            provider: "open-media",
            externalId: "elephants-dream-mp4",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            quality: 0,
            format: "MP4",
            codec: "h264/aac",
            language: "en",
          },
        ],
        subtitles: [
          {
            language: "id",
            label: "Bahasa Indonesia",
            url: "/subtitles/elephants-dream-id.vtt",
            format: "VTT",
            isDefault: true,
          },
        ],
      },
    ],
  },
];

export class OpenMediaProvider implements MetadataProvider, VideoProvider {
  readonly key = "open-media";
  readonly name = "Open Media Showcase (CC BY)";
  readonly capabilities = {
    metadata: true,
    video: true,
    subtitles: true,
    incremental: true,
    seasonal: false,
    automatedAccessPermitted: true,
    notes:
      "Bundled Blender Foundation open movies (CC BY). No third-party copyrighted anime is mirrored or redistributed.",
  };

  getCatalog(): NormalizedAnime[] {
    return CATALOG;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<NormalizedAnime[]> {
    const normalized = normalizeTitle(query);
    return CATALOG.filter((anime) => {
      const haystack = normalizeTitle(
        [anime.title, anime.englishTitle, anime.japaneseTitle, ...(anime.alternativeTitles ?? [])]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(normalized);
    }).slice(0, options.limit ?? 10);
  }

  async getAnime(externalId: string): Promise<NormalizedAnime | null> {
    return CATALOG.find((anime) => anime.externalId === externalId) ?? null;
  }

  async getSeasonalAnime(year: number, season: Season): Promise<NormalizedAnime[]> {
    return CATALOG.filter((anime) => anime.year === year && anime.season === season);
  }

  async getVideoSources(animeExternalId: string, episodeNumber: number): Promise<NormalizedVideoSource[]> {
    const anime = CATALOG.find((entry) => entry.externalId === animeExternalId);
    const episode = anime?.episodes?.find((entry) => entry.number === episodeNumber);
    return episode?.sources ?? [];
  }

  async getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]> {
    const anime = CATALOG.find((entry) => entry.externalId === animeExternalId);
    const episode = anime?.episodes?.find((entry) => entry.number === episodeNumber);
    return episode?.subtitles ?? [];
  }

  async getAvailableQualities(animeExternalId: string, episodeNumber: number): Promise<number[]> {
    const sources = await this.getVideoSources(animeExternalId, episodeNumber);
    return Array.from(new Set(sources.map((source) => source.quality))).filter((quality) => quality > 0);
  }
}
