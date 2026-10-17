import { ingestNormalizedAnime, prisma } from "@aninusa/database";
import { createProviderRegistry, providerConfigFromEnv } from "@aninusa/source-adapters";
import { getErrorMessage } from "@aninusa/utils";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  requireApiAdmin,
} from "@/lib/api";
import { afterCatalogMutation, audit } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RefreshResult {
  providerKey: string;
  ok: boolean;
  message: string;
  episodes?: number;
  sources?: number;
  subtitles?: number;
}

/**
 * Re-fetches metadata and the episode list for one anime from the provider
 * records that produced it. Only authorized providers are called; a restricted
 * or disabled provider is reported as skipped.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    const anime = await prisma.anime.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        providerRefs: { select: { providerKey: true, externalId: true } },
      },
    });

    if (!anime) throw errors.notFound("Anime tidak ditemukan");
    if (!anime.providerRefs.length) {
      throw errors.badRequest(
        "Anime ini tidak memiliki referensi provider. Tambahkan episode secara manual atau sinkronkan provider terlebih dahulu.",
      );
    }

    const registry = createProviderRegistry(providerConfigFromEnv());
    const results: RefreshResult[] = [];

    for (const ref of anime.providerRefs) {
      const provider = registry.getMetadataProvider(ref.providerKey);

      if (!provider) {
        results.push({
          providerKey: ref.providerKey,
          ok: false,
          message: "Provider tidak aktif atau tidak terdaftar",
        });
        continue;
      }

      if (!provider.capabilities.automatedAccessPermitted) {
        results.push({
          providerKey: ref.providerKey,
          ok: false,
          message: "Provider tidak mengizinkan akses otomatis (tidak didukung)",
        });
        continue;
      }

      try {
        const normalized = await provider.getAnime(ref.externalId);
        if (!normalized) {
          results.push({
            providerKey: ref.providerKey,
            ok: false,
            message: "Provider tidak mengembalikan data untuk ID ini",
          });
          continue;
        }

        const ingested = await prisma.$transaction(
          (tx) => ingestNormalizedAnime(tx, ref.providerKey, normalized),
          { timeout: 30_000 },
        );

        results.push({
          providerKey: ref.providerKey,
          ok: true,
          message: ingested.created ? "Dibuat ulang" : "Diperbarui",
          episodes: ingested.episodesUpserted,
          sources: ingested.sourcesUpserted,
          subtitles: ingested.subtitlesUpserted,
        });
      } catch (error) {
        results.push({
          providerKey: ref.providerKey,
          ok: false,
          message: getErrorMessage(error).slice(0, 300),
        });
      }
    }

    await audit(admin.id, "anime.refresh", "Anime", id, { results }, clientIp(request));
    if (results.some((result) => result.ok)) await afterCatalogMutation();

    return json({ animeId: id, results }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
