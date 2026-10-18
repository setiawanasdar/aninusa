import { watchProgressSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  enforceRateLimit,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
  requireApiUser,
} from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "progress");
    const user = await requireApiUser();
    const input = await parseJson(request, watchProgressSchema);

    const episode = await prisma.episode.findUnique({
      where: { id: input.episodeId },
      select: { id: true, animeId: true, duration: true },
    });
    if (!episode) throw errors.notFound("Episode tidak ditemukan");

    const duration = input.duration || episode.duration || 0;
    const progress = Math.max(0, Math.min(input.progress, duration || input.progress));
    const completed =
      input.completed === true ||
      (duration > 0 ? progress >= duration - 20 || progress / duration >= 0.95 : false);

    const history = await prisma.watchHistory.upsert({
      where: { userId_episodeId: { userId: user.id, episodeId: episode.id } },
      update: { progress, duration, completed },
      create: {
        userId: user.id,
        animeId: episode.animeId,
        episodeId: episode.id,
        progress,
        duration,
        completed,
      },
      select: { id: true, progress: true, duration: true, completed: true, updatedAt: true },
    });

    return json(
      {
        id: history.id,
        progress: history.progress,
        duration: history.duration,
        completed: history.completed,
        updatedAt: history.updatedAt.toISOString(),
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const episodeId = url.searchParams.get("episodeId");

    if (episodeId) {
      const entry = await prisma.watchHistory.findUnique({
        where: { userId_episodeId: { userId: user.id, episodeId } },
        select: { progress: true, duration: true, completed: true, updatedAt: true },
      });
      return json(entry, { headers: noStoreHeaders() });
    }

    return json(null, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
