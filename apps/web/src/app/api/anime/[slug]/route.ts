import { errorResponse, enforceRateLimit, errors, json, publicCacheHeaders } from "@/lib/api";
import { getAnimeBySlug, getAnimeEpisodes } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await enforceRateLimit(request, "public");
    const { slug } = await params;
    const anime = await getAnimeBySlug(slug);
    if (!anime) throw errors.notFound("Anime tidak ditemukan");

    const episodes = await getAnimeEpisodes(anime.id);
    return json(
      { ...anime, episodes },
      { headers: publicCacheHeaders(120) },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
