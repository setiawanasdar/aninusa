import { adminSubtitleSchema } from "@aninusa/types";
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
    const input = await parseJson(request, adminSubtitleSchema);

    const episode = await prisma.episode.findUnique({ where: { id: input.episodeId }, select: { id: true } });
    if (!episode) throw errors.notFound("Episode tidak ditemukan");

    const subtitle = await prisma.subtitle.create({
      data: {
        episodeId: input.episodeId,
        language: input.language,
        label: input.label,
        url: input.url,
        format: input.format,
        isDefault: input.isDefault,
        isActive: input.isActive,
        status: input.status,
      },
      select: { id: true },
    });

    if (input.isDefault) {
      await prisma.subtitle.updateMany({
        where: { episodeId: input.episodeId, id: { not: subtitle.id } },
        data: { isDefault: false },
      });
    }

    await audit(admin.id, "subtitle.create", "Subtitle", subtitle.id, {}, clientIp(request));
    await afterCatalogMutation();

    return json(subtitle, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
