import { prisma } from "@/lib/db";
import { assertSameOrigin, errorResponse, json, noStoreHeaders, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ animeId: string }> }) {
  try {
    await assertSameOrigin(request);
    const user = await requireApiUser();
    const { animeId } = await params;

    await prisma.favorite.deleteMany({ where: { userId: user.id, animeId } });
    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
