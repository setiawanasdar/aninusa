import { z } from "zod";
import { prisma, ingestNormalizedAnime } from "@aninusa/database";
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
import { createProviderRegistry, providerConfigFromEnv } from "@aninusa/source-adapters";

export const runtime = "nodejs";
export const maxDuration = 120;

const importSchema = z.object({
  slug: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const input = await parseJson(request, importSchema);

    const registry = createProviderRegistry(providerConfigFromEnv());
    const provider = registry.getMetadataProvider("anikoto");
    if (!provider) {
      throw new Error("Provider AniKoto tidak aktif atau tidak ditemukan.");
    }

    const normalized = await provider.getAnime(input.slug);
    if (!normalized) {
      throw new Error(`Anime dengan slug "${input.slug}" tidak ditemukan di AniKoto.`);
    }

    const result = await prisma.$transaction(
      (tx) => ingestNormalizedAnime(tx, "anikoto", normalized),
      { timeout: 60_000 },
    );

    await audit(admin.id, "anime.create", "Anime", result.animeId, {
      source: "anikoto",
      slug: result.slug,
      title: normalized.title,
      episodes: result.episodesUpserted,
    }, clientIp(request));

    await afterCatalogMutation();

    return json(
      {
        success: true,
        animeId: result.animeId,
        slug: result.slug,
        title: normalized.title,
        created: result.created,
        episodesCount: result.episodesUpserted,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
