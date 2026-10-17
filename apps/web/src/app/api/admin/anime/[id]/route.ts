import { adminAnimeSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
  requireApiAdmin,
} from "@/lib/api";
import { afterCatalogMutation, audit, ensureUniqueAnimeSlug } from "@/lib/admin";
import { slugify } from "@aninusa/utils";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = await parseJson(request, adminAnimeSchema);

    const existing = await prisma.anime.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!existing) throw errors.notFound("Anime tidak ditemukan");

    const slug =
      input.slug && input.slug !== existing.slug
        ? await ensureUniqueAnimeSlug(input.slug, id)
        : existing.slug;

    const anime = await prisma.anime.update({
      where: { id },
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
          set: [],
          connectOrCreate: input.genres.map((name) => ({
            where: { slug: slugify(name) },
            create: { name, slug: slugify(name) },
          })),
        },
        studios: {
          set: [],
          connectOrCreate: input.studios.map((name) => ({
            where: { slug: slugify(name) },
            create: { name, slug: slugify(name) },
          })),
        },
      },
      select: { id: true, slug: true, title: true },
    });

    await audit(admin.id, "anime.update", "Anime", anime.id, { title: anime.title }, clientIp(request));
    await afterCatalogMutation();

    return json(anime, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSameOrigin(request);
    const admin = await requireApiAdmin();
    const { id } = await params;

    const existing = await prisma.anime.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!existing) throw errors.notFound("Anime tidak ditemukan");

    await prisma.anime.delete({ where: { id } });
    await audit(admin.id, "anime.delete", "Anime", id, { title: existing.title }, clientIp(request));
    await afterCatalogMutation();

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
