import { prisma } from "@/lib/db";
import { errorResponse, enforceRateLimit, errors, json, publicCacheHeaders } from "@/lib/api";
import { mapEpisode } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(request, "public");
    const { id } = await params;

    const episode = await prisma.episode.findUnique({
      where: { id },
      select: {
        id: true,
        animeId: true,
        episodeNumber: true,
        title: true,
        description: true,
        duration: true,
        thumbnail: true,
        airDate: true,
        introStart: true,
        introEnd: true,
        outroStart: true,
        anime: { select: { slug: true, title: true, poster: true } },
      },
    });

    if (!episode) throw errors.notFound("Episode tidak ditemukan");

    return json(
      { ...mapEpisode(episode), anime: episode.anime },
      { headers: publicCacheHeaders(120) },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
