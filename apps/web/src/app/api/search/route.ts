import { catalogQuerySchema } from "@aninusa/types";
import { errorResponse, enforceRateLimit, json, publicCacheHeaders } from "@/lib/api";
import { listAnime } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const url = new URL(request.url);
    const query = catalogQuerySchema.parse(Object.fromEntries(url.searchParams));

    if (!query.q || query.q.trim().length < 2) {
      return json({
        items: [],
        page: 1,
        perPage: query.perPage,
        total: 0,
        totalPages: 1,
        hasNext: false,
      });
    }

    const result = await listAnime(query);
    return json(result, { headers: publicCacheHeaders(30) });
  } catch (error) {
    return errorResponse(error);
  }
}
