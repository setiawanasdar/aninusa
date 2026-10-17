import { adminSourceSchema } from "@aninusa/types";
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
    const input = await parseJson(request, adminSourceSchema);

    const episode = await prisma.episode.findUnique({ where: { id: input.episodeId }, select: { id: true } });
    if (!episode) throw errors.notFound("Episode tidak ditemukan");

    const source = await prisma.videoSource.create({
      data: {
        episodeId: input.episodeId,
        provider: input.provider,
        externalId: input.externalId ?? null,
        url: input.url,
        quality: input.quality,
        format: input.format,
        codec: input.codec ?? null,
        language: input.language,
        subtitleSupport: input.subtitleSupport,
        isActive: input.isActive,
        status: input.status,
      },
      select: { id: true },
    });

    await audit(admin.id, "source.create", "VideoSource", source.id, { provider: input.provider }, clientIp(request));
    await afterCatalogMutation();

    return json(source, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
