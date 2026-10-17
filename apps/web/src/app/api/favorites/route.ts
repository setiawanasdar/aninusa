import { favoriteSchema } from "@aninusa/types";
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
import { getFavorites } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const favorites = await getFavorites(user.id);
    return json(favorites, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "public");
    const user = await requireApiUser();
    const input = await parseJson(request, favoriteSchema);

    const anime = await prisma.anime.findUnique({
      where: { id: input.animeId },
      select: { id: true },
    });
    if (!anime) throw errors.notFound("Anime tidak ditemukan");

    const favorite = await prisma.favorite.upsert({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
      update: {},
      create: { userId: user.id, animeId: anime.id },
      select: { id: true, animeId: true, createdAt: true },
    });

    return json(
      { id: favorite.id, animeId: favorite.animeId, createdAt: favorite.createdAt.toISOString() },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
