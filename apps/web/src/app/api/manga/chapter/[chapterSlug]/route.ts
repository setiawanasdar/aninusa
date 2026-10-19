import { enforceRateLimit, errorResponse, json, publicCacheHeaders } from "@/lib/api";
import { getChapterDetail } from "@/lib/manga";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ chapterSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await enforceRateLimit(request, "public");
    const { chapterSlug } = await params;
    const { searchParams } = new URL(request.url);
    const comicSlug = searchParams.get("comic") || undefined;

    const data = await getChapterDetail(chapterSlug, comicSlug);
    if (!data) {
      return json({ error: "Chapter not found" }, { status: 404 });
    }
    return json(data, { headers: publicCacheHeaders(3600) });
  } catch (error) {
    return errorResponse(error);
  }
}
