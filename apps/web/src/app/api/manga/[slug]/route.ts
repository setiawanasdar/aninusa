import { enforceRateLimit, errorResponse, json, publicCacheHeaders } from "@/lib/api";
import { getMangaDetail } from "@/lib/manga";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await enforceRateLimit(request, "public");
    const { slug } = await params;
    const data = await getMangaDetail(slug);
    if (!data) {
      return json({ error: "Manga not found" }, { status: 404 });
    }
    return json(data, { headers: publicCacheHeaders(900) });
  } catch (error) {
    return errorResponse(error);
  }
}
