import { historyQuerySchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  enforceRateLimit,
  errorResponse,
  json,
  noStoreHeaders,
  requireApiUser,
} from "@/lib/api";
import { getWatchHistoryForUser } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const query = historyQuerySchema.parse(Object.fromEntries(url.searchParams));

    const items = await getWatchHistoryForUser(user.id, query.limit, query.includeCompleted);
    return json(items, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "public");
    const user = await requireApiUser();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      await prisma.watchHistory.deleteMany({ where: { id, userId: user.id } });
    } else {
      await prisma.watchHistory.deleteMany({ where: { userId: user.id } });
    }

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
