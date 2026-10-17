import { syncSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  json,
  noStoreHeaders,
  parseJson,
  requireApiAdmin,
} from "@/lib/api";
import { audit, afterCatalogMutation } from "@/lib/admin";
import { runProviderSync } from "@aninusa/services";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const input = await parseJson(request, syncSchema);

    const result = await runProviderSync({
      providerKey: input.providerKey,
      mode: input.mode,
      limit: input.limit,
      triggeredBy: admin.email,
    });

    await audit(admin.id, "provider.sync", "Provider", input.providerKey, { ...result.stats }, clientIp(request));
    if (result.stats.created + result.stats.updated > 0) await afterCatalogMutation();

    return json(result, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    await requireApiAdmin();
    const jobs = await prisma.ingestionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        providerKey: true,
        type: true,
        mode: true,
        status: true,
        attempts: true,
        stats: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    return json(jobs, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
