import { errorResponse, json, noStoreHeaders, requireApiAdmin } from "@/lib/api";
import { getAdminStats } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAdmin();
    return json(await getAdminStats(), { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
