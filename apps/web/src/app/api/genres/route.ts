import { errorResponse, enforceRateLimit, json, publicCacheHeaders } from "@/lib/api";
import { listGenres } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    return json(await listGenres(), { headers: publicCacheHeaders(600) });
  } catch (error) {
    return errorResponse(error);
  }
}
