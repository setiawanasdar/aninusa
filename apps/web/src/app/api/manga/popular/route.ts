import { enforceRateLimit, errorResponse, json, publicCacheHeaders } from "@/lib/api";
import { getMangaPopular } from "@/lib/manga";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const data = await getMangaPopular();
    return json(data, { headers: publicCacheHeaders(600) });
  } catch (error) {
    return errorResponse(error);
  }
}
