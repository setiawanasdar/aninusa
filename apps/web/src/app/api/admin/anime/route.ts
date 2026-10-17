import { adminAnimeSchema } from "@aninusa/types";
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
import { afterCatalogMutation, audit, ensureUniqueAnimeSlug } from "@/lib/admin";
import { slugify } from "@aninusa/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const input = await parseJson(request, adminAnimeSchema);

    const slug = await ensureUniqueAnimeSlug(input.slug ?? input.englishTitle ?? input.title);

    const anime = await prisma.anime.create({
      data: {
        slug,
        title: input.title,
        japaneseTitle: input.japaneseTitle ?? null,
        englishTitle: input.englishTitle ?? null,
        alternativeTitles: input.alternativeTitles,
        synopsis: input.synopsis ?? null,
        poster: input.poster ?? null,
        banner: input.banner ?? null,
        type: input.type,
        status: input.status,
        year: input.year ?? null,
        season: input.season ?? null,
        score: input.score ?? null,
        popularity: input.popularity,
        source: input.source ?? null,
        duration: input.duration ?? null,
        totalEpisodes: input.totalEpisodes ?? null,
        latestEpisode: input.latestEpisode ?? null,
        airedFrom: input.airedFrom ? new Date(input.airedFrom) : null,
        airedTo: input.airedTo ? new Date(input.airedTo) : null,
        malId: input.malId ?? null,
        anilistId: input.anilistId ?? null,
        genres: {
          connectOrCreate: input.genres.map((name) => ({
            where: { slug: slugify(name) },
            create: { name, slug: slugify(name) },
          })),
        },
        studios: {
          connectOrCreate: input.studios.map((name) => ({
            where: { slug: slugify(name) },
            create: { name, slug: slugify(name) },
          })),
        },
      },
      select: { id: true, slug: true, title: true },
    });

    await audit(admin.id, "anime.create", "Anime", anime.id, { title: anime.title }, clientIp(request));
    await afterCatalogMutation();

    return json(anime, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
