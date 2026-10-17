import { adminEpisodeSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
  requireApiAdmin,
} from "@/lib/api";
import { afterCatalogMutation, audit } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const input = await parseJson(request, adminEpisodeSchema);

    const anime = await prisma.anime.findUnique({ where: { id: input.animeId }, select: { id: true } });
    if (!anime) throw errors.notFound("Anime tidak ditemukan");

    const duplicate = await prisma.episode.findUnique({
      where: { animeId_episodeNumber: { animeId: input.animeId, episodeNumber: input.episodeNumber } },
      select: { id: true },
    });
    if (duplicate) throw errors.conflict("Nomor episode sudah ada");

    const episode = await prisma.episode.create({
      data: {
        animeId: input.animeId,
        episodeNumber: input.episodeNumber,
        title: input.title ?? null,
        description: input.description ?? null,
        duration: input.duration ?? null,
        thumbnail: input.thumbnail ?? null,
        airDate: input.airDate ? new Date(input.airDate) : null,
        introStart: input.introStart ?? null,
        introEnd: input.introEnd ?? null,
        outroStart: input.outroStart ?? null,
      },
      select: { id: true, animeId: true, episodeNumber: true, title: true },
    });

    await prisma.anime.update({
      where: { id: input.animeId },
      data: { latestEpisode: input.episodeNumber },
    });

    await audit(admin.id, "episode.create", "Episode", episode.id, {}, clientIp(request));
    await afterCatalogMutation();

    return json(episode, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
