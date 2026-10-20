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

const mangaHistorySchema = z.object({
  comicSlug: z.string().min(1),
  comicTitle: z.string().min(1),
  thumbnail: z.string().optional().nullable(),
  lastChapterSlug: z.string().min(1),
  lastChapterTitle: z.string().min(1),
  lastPage: z.number().int().min(1).optional().default(1),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    const history = await prisma.mangaReadingHistory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return json(history, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "public");
    const user = await requireApiUser();
    const input = await parseJson(request, mangaHistorySchema);

    const record = await prisma.mangaReadingHistory.upsert({
      where: {
        userId_comicSlug: {
          userId: user.id,
          comicSlug: input.comicSlug,
        },
      },
      update: {
        comicTitle: input.comicTitle,
        thumbnail: input.thumbnail ?? undefined,
        lastChapterSlug: input.lastChapterSlug,
        lastChapterTitle: input.lastChapterTitle,
        lastPage: input.lastPage ?? 1,
      },
      create: {
        userId: user.id,
        comicSlug: input.comicSlug,
        comicTitle: input.comicTitle,
        thumbnail: input.thumbnail,
        lastChapterSlug: input.lastChapterSlug,
        lastChapterTitle: input.lastChapterTitle,
        lastPage: input.lastPage ?? 1,
      },
    });

    return json(record, { status: 201, headers: noStoreHeaders() });
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

    if (comicSlug) {
      await prisma.mangaReadingHistory.deleteMany({
        where: { userId: user.id, comicSlug },
      });
    } else {
      await prisma.mangaReadingHistory.deleteMany({
        where: { userId: user.id },
      });
    }

    return json({ success: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
