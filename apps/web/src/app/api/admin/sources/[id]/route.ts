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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = await parseJson(request, adminSourceSchema);

    const existing = await prisma.videoSource.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Sumber video tidak ditemukan");

    const source = await prisma.videoSource.update({
      where: { id },
      data: {
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

    await audit(admin.id, "source.update", "VideoSource", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json(source, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    const existing = await prisma.videoSource.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw errors.notFound("Sumber video tidak ditemukan");

    await prisma.videoSource.delete({ where: { id } });
    await audit(admin.id, "source.delete", "VideoSource", id, {}, clientIp(request));
    await afterCatalogMutation();

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
