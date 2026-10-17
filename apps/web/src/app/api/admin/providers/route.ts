import { prisma } from "@/lib/db";
import { errorResponse, json, noStoreHeaders, requireApiAdmin } from "@/lib/api";
import { createProviderRegistry, providerConfigFromEnv } from "@aninusa/source-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAdmin();
    const registry = createProviderRegistry(providerConfigFromEnv());
    const rows = await prisma.provider.findMany({ orderBy: { name: "asc" } });

    const providers = rows.map((row) => {
      const descriptor = registry.statuses.find((provider) => provider.key === row.key);
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        kind: row.kind,
        baseUrl: row.baseUrl,
        enabled: row.enabled,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        capabilities: descriptor?.capabilities ?? null,
        registered: Boolean(descriptor),
      };
    });

    return json(providers, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
