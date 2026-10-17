import path from "node:path";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { AniListProvider, OpenMediaProvider, providerConfigFromEnv } from "@aninusa/source-adapters";
import type { NormalizedAnime, Season } from "@aninusa/types";
import { prisma } from "../src/client";
import { ingestNormalizedAnime } from "../src/ingest";

config({ path: path.resolve(__dirname, "../../../.env") });

function currentSeason(): { year: number; season: Season } {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const season: Season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  return { year: now.getUTCFullYear(), season };
}

async function seedProviders() {
  await prisma.provider.upsert({
    where: { key: "open-media" },
    update: { enabled: true, kind: "VIDEO", name: "Open Media Showcase (CC BY)" },
    create: {
      key: "open-media",
      name: "Open Media Showcase (CC BY)",
      kind: "VIDEO",
      baseUrl: null,
      enabled: true,
      config: { license: "CC BY 2.5/3.0", source: "Blender Foundation open movies" },
    },
  });

  await prisma.provider.upsert({
    where: { key: "anilist" },
    update: { enabled: true, kind: "METADATA", name: "AniList (official public API)" },
    create: {
      key: "anilist",
      name: "AniList (official public API)",
      kind: "METADATA",
      baseUrl: "https://graphql.anilist.co",
      enabled: true,
      config: { attribution: "Metadata provided by AniList", video: false },
    },
  });

  await prisma.provider.upsert({
    where: { key: "restricted-example" },
    update: { enabled: false },
    create: {
      key: "restricted-example",
      name: "Restricted Provider (unsupported)",
      kind: "METADATA",
      baseUrl: null,
      enabled: false,
      config: {
        supported: false,
        reason: "Provider terms prohibit automated access. No bypass is implemented.",
      },
    },
  });
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@aninusa.local").toLowerCase();
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password && process.env.NODE_ENV === "production") {
    throw new Error("SEED_ADMIN_PASSWORD is required when seeding in production");
  }

  const plainPassword = password ?? "ChangeMe123!";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`Admin already exists: ${email} (role ensured)`);
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 12);
  await prisma.user.create({
    data: { email, username, passwordHash, role: "ADMIN" },
  });

  console.log(`Created admin ${email} / ${plainPassword}`);
  if (!password) console.warn("Using the development default admin password. Change it before deploying.");
}

async function ingestMany(providerKey: string, items: NormalizedAnime[]) {
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await prisma.$transaction((tx) => ingestNormalizedAnime(tx, providerKey, item), {
        timeout: 30_000,
      });
      if (result.created) created += 1;
      else updated += 1;
    } catch (error) {
      failed += 1;
      console.warn(`  ! ${item.title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { created, updated, failed };
}

async function seedAniList() {
  if (process.env.SEED_ANILIST === "false") {
    console.log("Skipping AniList metadata (SEED_ANILIST=false)");
    return;
  }

  const runtime = providerConfigFromEnv();
  const provider = new AniListProvider(
    {
      timeoutMs: runtime.requestTimeoutMs,
      userAgent: runtime.userAgent,
      logger: console,
    },
    {
      maxEpisodes: runtime.ingestMaxEpisodes,
      requestsPerMinute: runtime.anilistRateLimitPerMinute,
    },
  );

  const { year, season } = currentSeason();
  const collected = new Map<string, NormalizedAnime>();

  try {
    const [popular, seasonal] = await Promise.all([
      provider.getPopular({ page: 1, perPage: 24 }),
      provider.getSeasonalAnime(year, season, { page: 1, perPage: 18 }),
    ]);

    for (const anime of [...popular, ...seasonal]) {
      if (anime.externalId) collected.set(anime.externalId, anime);
    }
  } catch (error) {
    console.warn(
      `AniList seed skipped: ${error instanceof Error ? error.message : String(error)}. The open-media catalog is still available.`,
    );
    return;
  }

  const result = await ingestMany("anilist", Array.from(collected.values()).slice(0, 40));
  console.log(
    `AniList metadata: ${result.created} created, ${result.updated} updated, ${result.failed} failed (season ${year}-${season.toLowerCase()})`,
  );
}

async function main() {
  console.log("Seeding AniNusa...");
  await seedProviders();
  await seedAdmin();

  const openMedia = new OpenMediaProvider();
  const openResult = await ingestMany("open-media", openMedia.getCatalog());
  console.log(
    `Open media catalog: ${openResult.created} created, ${openResult.updated} updated, ${openResult.failed} failed`,
  );

  await seedAniList();

  const [anime, episodes, sources, subtitles] = await Promise.all([
    prisma.anime.count(),
    prisma.episode.count(),
    prisma.videoSource.count(),
    prisma.subtitle.count(),
  ]);

  console.log(`Seed complete: ${anime} anime, ${episodes} episodes, ${sources} sources, ${subtitles} subtitles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
