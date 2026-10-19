import { enforceRateLimit, errorResponse, json, publicCacheHeaders } from "@/lib/api";
import { searchManga } from "@/lib/manga";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") || searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;

    if (!keyword.trim()) {
      return json({ items: [], keyword: "", page: 1, total: 0 });
    }

    const data = await searchManga(keyword, page);
    return json(data, { headers: publicCacheHeaders(180) });
  } catch (error) {
    return errorResponse(error);
  }
}
