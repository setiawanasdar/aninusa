import { validateSourcesSchema } from "@aninusa/types";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  json,
  noStoreHeaders,
  parseJson,
  requireApiAdmin,
} from "@/lib/api";
import { audit } from "@/lib/admin";
import { checkSubtitle, checkVideoSource, runHealthSweep } from "@aninusa/services";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const input = await parseJson(request, validateSourcesSchema);

    let result: unknown;

    if (input.id) {
      result =
        input.type === "sources" ? await checkVideoSource(input.id) : await checkSubtitle(input.id);
    } else {
      result = await runHealthSweep({ limit: input.limit });
    }

    await audit(admin.id, `health.${input.type}`, input.type, input.id ?? null, {}, clientIp(request));
    return json(result, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
