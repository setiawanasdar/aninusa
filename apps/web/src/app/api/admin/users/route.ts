import { prisma } from "@/lib/db";
import { errorResponse, json, noStoreHeaders, requireApiAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApiAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        _count: { select: { favorites: true, watchHistory: true } },
      },
    });

    return json(users, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
