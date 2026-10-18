import { prisma } from "@/lib/db";
import { assertSameOrigin, errorResponse, json, noStoreHeaders, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ animeId: string }> }) {
  try {
    await assertSameOrigin(request);
    const user = await requireApiUser();
    const { animeId } = await params;
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
      select: { id: true },
    });

    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        animeId: { in: [animeId, anime?.id].filter(Boolean) as string[] },
      },
    });
    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
