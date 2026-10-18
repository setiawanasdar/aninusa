import path from "node:path";
import { config } from "dotenv";
import { prisma } from "../src/client";

config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  console.log("=== Checking current rows in Neon DB ===");
  const users = await prisma.user.count();
  const sessions = await prisma.session.count();
  const anime = await prisma.anime.count();
  const episodes = await prisma.episode.count();
  const sources = await prisma.videoSource.count();
  const subtitles = await prisma.subtitle.count();
  const jobs = await prisma.ingestionJob.count();
  const providerRefs = await prisma.providerRef.count();
  const health = await prisma.sourceHealthCheck.count();

  console.log({
    users,
    sessions,
    anime,
    episodes,
    sources,
    subtitles,
    jobs,
    providerRefs,
    health,
  });

  console.log("\n=== Deleting all anime-related data from Neon DB ===");

  await prisma.sourceHealthCheck.deleteMany({});
  await prisma.videoSource.deleteMany({});
  await prisma.subtitle.deleteMany({});
  await prisma.episode.deleteMany({});
  await prisma.providerRef.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.watchHistory.deleteMany({});
  await prisma.ingestionJob.deleteMany({});
  await prisma.anime.deleteMany({});
  await prisma.genre.deleteMany({});
  await prisma.studio.deleteMany({});

  console.log("\n=== Verification after cleanup ===");
  const remainingUsers = await prisma.user.count();
  const remainingSessions = await prisma.session.count();
  const remainingAnime = await prisma.anime.count();
  const remainingEpisodes = await prisma.episode.count();
  const remainingSources = await prisma.videoSource.count();

  console.log({
    remainingUsers,
    remainingSessions,
    remainingAnime,
    remainingEpisodes,
    remainingSources,
  });

  const userList = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true },
  });
  console.log("\nPreserved Accounts in Neon DB:", userList);
  console.log("\nCleanup successful! Only account data remains in Neon DB.");
}

main()
  .catch((e) => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
