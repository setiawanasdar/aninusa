import { errorResponse, enforceRateLimit, json, publicCacheHeaders } from "@/lib/api";
import { listStudios } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    return json(await listStudios(), { headers: publicCacheHeaders(600) });
  } catch (error) {
    return errorResponse(error);
  }
}
