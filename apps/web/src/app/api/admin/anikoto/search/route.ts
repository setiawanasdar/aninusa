import { assertSameOrigin, errorResponse, json, noStoreHeaders, requireApiAdmin } from "@/lib/api";
import { createProviderRegistry, providerConfigFromEnv } from "@aninusa/source-adapters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await assertSameOrigin(request);
    await requireApiAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    if (!q.trim()) {
      return json([], { headers: noStoreHeaders() });
    }

    const registry = createProviderRegistry(providerConfigFromEnv());
    const provider = registry.getMetadataProvider("anikoto");
    if (!provider) {
      throw new Error("Provider AniKoto tidak tersedia");
    }

    const results = await provider.search(q, { limit: 20 });
    return json(results, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
