import { errorResponse, enforceRateLimit, errors, json, noStoreHeaders } from "@/lib/api";
import { getEpisodePlayback } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(request, "public");
    const { id } = await params;
    const playback = await getEpisodePlayback(id);
    if (!playback) throw errors.notFound("Episode tidak ditemukan");

    // Sources are normalized server-side. The frontend never learns the
    // provider's identity or how the URL was obtained.
    return json(
      {
        episode: playback.episode,
        anime: playback.anime,
        sources: playback.sources,
        subtitles: playback.subtitles,
        previousEpisode: playback.previousEpisode,
        nextEpisode: playback.nextEpisode,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
