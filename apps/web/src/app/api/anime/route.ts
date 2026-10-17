import { catalogQuerySchema } from "@aninusa/types";
import { errorResponse, enforceRateLimit, json, publicCacheHeaders } from "@/lib/api";
import { listAnime } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const url = new URL(request.url);
    const query = catalogQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listAnime(query);
    return json(result, { headers: publicCacheHeaders(60) });
  } catch (error) {
    return errorResponse(error);
  }
}
