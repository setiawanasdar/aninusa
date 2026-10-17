import { SEASONS } from "@aninusa/types";
import { errorResponse, enforceRateLimit, json, publicCacheHeaders } from "@/lib/api";
import { listSeasonYears } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");
    const years = await listSeasonYears();

    return json(
      {
        seasons: SEASONS,
        years,
        current: years[0] ?? new Date().getUTCFullYear(),
      },
      { headers: publicCacheHeaders(600) },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
