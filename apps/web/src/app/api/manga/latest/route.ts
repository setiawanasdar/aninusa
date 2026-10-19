import { enforceRateLimit, errorResponse, json, publicCacheHeaders } from "@/lib/api";
import { getMangaLatest } from "@/lib/manga";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const data = await getMangaLatest(page);
    return json(data, { headers: publicCacheHeaders(300) });
  } catch (error) {
    return errorResponse(error);
  }
}
