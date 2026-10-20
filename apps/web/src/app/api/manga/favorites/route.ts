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
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mangaFavoriteSchema = z.object({
  comicSlug: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    const favorites = await prisma.mangaFavorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
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
    const input = await parseJson(request, mangaFavoriteSchema);

    // Check if already favorited (Toggle behavior)
    const existing = await prisma.mangaFavorite.findUnique({
      where: {
        userId_comicSlug: {
          userId: user.id,
          comicSlug: input.comicSlug,
        },
      },
    });

    if (existing) {
      await prisma.mangaFavorite.delete({
        where: { id: existing.id },
      });
      return json(
        { favorited: false, message: "Dihapus dari favorit" },
        { headers: noStoreHeaders() }
      );
    }

    const created = await prisma.mangaFavorite.create({
      data: {
        userId: user.id,
        comicSlug: input.comicSlug,
        title: input.title,
        thumbnail: input.thumbnail,
        type: input.type || "Manga",
      },
    });

    return json(
      { favorited: true, item: created, message: "Ditambahkan ke favorit" },
      { status: 201, headers: noStoreHeaders() }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await assertSameOrigin(request);
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const comicSlug = searchParams.get("comicSlug");

    if (!comicSlug) {
      throw errors.badRequest("comicSlug wajib diisi");
    }

    await prisma.mangaFavorite.deleteMany({
      where: { userId: user.id, comicSlug },
    });

    return json({ success: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
