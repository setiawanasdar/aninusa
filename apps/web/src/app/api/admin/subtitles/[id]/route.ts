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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = await parseJson(request, adminSubtitleSchema);

    const existing = await prisma.subtitle.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Subtitle tidak ditemukan");

    const subtitle = await prisma.subtitle.update({
      where: { id },
      data: {
        language: input.language,
        label: input.label,
        url: input.url,
        format: input.format,
        isDefault: input.isDefault,
        isActive: input.isActive,
        status: input.status,
      },
      select: { id: true, episodeId: true },
    });

    if (input.isDefault) {
      await prisma.subtitle.updateMany({
        where: { episodeId: subtitle.episodeId, id: { not: subtitle.id } },
        data: { isDefault: false },
      });
    }

    await audit(admin.id, "subtitle.update", "Subtitle", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json({ id: subtitle.id }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    const existing = await prisma.subtitle.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Subtitle tidak ditemukan");

    await prisma.subtitle.delete({ where: { id } });
    await audit(admin.id, "subtitle.delete", "Subtitle", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
