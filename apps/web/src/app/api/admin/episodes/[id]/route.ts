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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = await parseJson(request, adminEpisodeSchema);

    const existing = await prisma.episode.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Episode tidak ditemukan");

    const episode = await prisma.episode.update({
      where: { id },
      data: {
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

    await audit(admin.id, "episode.update", "Episode", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json(episode, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    const existing = await prisma.episode.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Episode tidak ditemukan");

    await prisma.episode.delete({ where: { id } });
    await audit(admin.id, "episode.delete", "Episode", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
